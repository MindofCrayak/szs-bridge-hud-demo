/**
 * Phase G3 (Master Plan v3.1): report actions, both through the audited hud_write path.
 *   draftInvoice       payload { invoiceId }: copies the invoice template into the client's Drive folder as
 *                      "<ClientID> - <Project Name> - Invoice <InvoiceID>". The HUD shows the Financial Mutation
 *                      confirmation first (owner decision: money keeps the dialog). Changes no sheet value.
 *   requestOsintSweep  payload { clientId }: only appends an Alfred_Alerts row (Department Oracle, Action_Status
 *                      Requested). It runs nothing and carries no Oracle internals.
 */

function report_text_(value) { return String(value == null ? '' : value).trim(); }
function report_invalid_(message) { return createRouterError_(message, 'INVALID_REQUEST', 400); }

/** Pure: the standard Drive name (section 3). */
function report_invoiceName_(clientId, projectName, invoiceId) {
  return clientId + ' - ' + report_text_(projectName) + ' - Invoice ' + invoiceId;
}

/** Pure: Drive folder ID from a folder URL or a bare ID. */
function report_folderId_(value) {
  const text = report_text_(value);
  const match = text.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(text) ? text : '';
}

function report_invoiceTemplateId_() {
  let id = '';
  try { id = PropertiesService.getScriptProperties().getProperty('INVOICE_TEMPLATE_ID') || ''; } catch (error) { id = ''; }
  return id || HUD_PROVISIONING_DEFAULTS.INVOICE_TEMPLATE_ID;
}

/** Pure: the template fields for one invoice row (owner 2026-11-05: the first drafts were left unfilled). */
function report_invoiceFields_(invoice, project, client, today) {
  const amount = Number(invoice.InvoiceAmount !== '' && invoice.InvoiceAmount != null ? invoice.InvoiceAmount : invoice.Amount) || 0;
  const due = new Date(today.getTime() + 7 * 86400000);
  const iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const name = [report_text_(client.First_Name), report_text_(client.Last_Name)].filter(Boolean).join(' ') || report_text_(client.PrimaryContact);
  const milestone = report_text_(invoice.MilestoneStage) || 'Milestone';
  return {
    text: {
      '{{Client Name}}': name,
      '{{Business Name}}': report_text_(client.Company_Name),
      '{{Project Title}}': report_text_(project.ProjectName),
      '{{Invoice #}}': report_text_(invoice.InvoiceID),
      '{{Date Submitted}}': iso(today),
      '{{Week Of}}': iso(today),
      '{{Due Date}}': iso(due),
      '{{Task 1}}': milestone + ' - ' + report_text_(project.ProjectName) + ' (' + report_text_(project.ProjectID) + ')',
      '{{Notes}}': milestone + ' invoice for ' + report_text_(project.ProjectID) + '. Thank you.'
    },
    numbers: { '{{Task 1 Hours}}': 1, '{{Task 1 Rate}}': amount },
    clear: ['{{Task 2}}', '{{Task 2 Hours}}', '{{Task 2 Rate}}', '{{Task 3}}', '{{Task 3 Hours}}', '{{Task 3 Rate}}'],
    amount: amount
  };
}

function report_fillInvoice_(fileId, fields) {
  const sheet = SpreadsheetApp.openById(fileId).getSheets()[0];
  Object.keys(fields.numbers).forEach(function (tag) { setNumericCell_(sheet, tag, fields.numbers[tag]); });
  Object.keys(fields.text).forEach(function (tag) { replaceSheetText_(sheet, tag, fields.text[tag]); });
  fields.clear.forEach(function (tag) { clearCellIfExists_(sheet, tag); });
  SpreadsheetApp.flush();
  return sheet;
}

function report_record_(spreadsheet, tab, key, value) {
  try {
    return hud_findUniqueRecord_(hud_requireSheet_(spreadsheet, tab), key, value).record;
  } catch (error) {
    if (error && error.code) throw error;
    throw report_invalid_(String(error && error.message || error));
  }
}

function hud_prepareInvoiceDraftMutation_(spreadsheet, payload) {
  const invoiceId = report_text_(payload.invoiceId);
  if (!invoiceId) throw report_invalid_('An invoice ID is required.');
  const invoice = report_record_(spreadsheet, 'Finances', 'InvoiceID', invoiceId);
  const projectId = report_text_(invoice.ProjectID);
  if (!projectId) throw report_invalid_(invoiceId + ' has no ProjectID in Finances.');
  const project = report_record_(spreadsheet, 'Projects', 'ProjectID', projectId);
  const clientId = report_text_(invoice.ClientID || project.ClientID);
  const client = report_record_(spreadsheet, 'Clients', 'ClientID', clientId);
  const folderId = report_folderId_(client.DriveFolderUrl);
  if (!folderId) throw report_invalid_(clientId + ' has no Drive folder (Clients.DriveFolderUrl).');
  const name = report_invoiceName_(clientId, project.ProjectName, invoiceId);
  const folder = DriveApp.getFolderById(folderId);
  if (folder.getFilesByName(name).hasNext()) {
    throw createRouterError_('"' + name + '" already exists in the client folder.', 'ALREADY_DRAFTED', 409);
  }
  const templateId = report_invoiceTemplateId_();
  let copy = null;
  return {
    entity: 'invoice:' + invoiceId,
    before: { invoiceId: invoiceId, projectId: projectId, clientId: clientId, amount: invoice.Amount, status: invoice.Status, name: name, folderId: folderId },
    apply: function () {
      copy = DriveApp.getFileById(templateId).makeCopy(name, folder);
      report_fillInvoice_(copy.getId(), report_invoiceFields_(invoice, project, client, new Date()));
    },
    readAfter: function () {
      const files = folder.getFilesByName(name);
      const file = files.hasNext() ? files.next() : null;
      let filled = false;
      if (file) {
        const sheet = SpreadsheetApp.openById(file.getId()).getSheets()[0];
        filled = !sheet.createTextFinder('{{Invoice #}}').findNext() && Boolean(sheet.createTextFinder(invoiceId).findNext());
      }
      return { invoiceId: invoiceId, projectId: projectId, name: file ? file.getName() : '', fileId: file ? file.getId() : '', url: file ? file.getUrl() : '', filled: filled };
    },
    // `filled` is reported (the HUD warns when the template's {{…}} tags were not found) but is not a hard failure.
    matches: function (after) { return Boolean(copy) && after.fileId === copy.getId() && after.name === name; },
    rollback: function () { if (copy) copy.setTrashed(true); }
  };
}

/** Pure: an open OSINT request already exists for this client. */
function report_hasOpenSweep_(alerts, clientId) {
  return alerts.some(function (alert) {
    return report_text_(alert.Client_ID || alert.ClientID) === clientId && report_text_(alert.Department) === 'Oracle'
      && report_text_(alert.Action_Status) === 'Requested' && !hud_isTrue_(alert.Dismissed_Status);
  });
}

function hud_prepareOsintSweepMutation_(spreadsheet, payload) {
  const clientId = report_text_(payload.clientId);
  if (!clientId) throw report_invalid_('A client ID is required.');
  report_record_(spreadsheet, 'Clients', 'ClientID', clientId);
  const sheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
  const headers = hud_getHeaders_(sheet);
  const clientColumn = headers.indexOf('Client_ID') !== -1 ? 'Client_ID' : 'ClientID';
  ['Alert_ID', clientColumn, 'Department', 'Action_Status'].forEach(function (name) { hud_requireColumn_(headers, name); });
  if (report_hasOpenSweep_(hud_getSheetRecords_(sheet), clientId)) {
    throw createRouterError_('An OSINT sweep request for ' + clientId + ' is already open.', 'ALREADY_REQUESTED', 409);
  }
  const alertId = 'ALT-' + Utilities.getUuid();
  const now = new Date().toISOString();
  let appended = false;
  return {
    entity: 'alert:' + alertId,
    before: { clientId: clientId, alertId: alertId },
    apply: function () {
      sheet.appendRow(hud_objectRow_(headers, {
        Alert_ID: alertId, Timestamp: now, Created_At: now, ClientID: clientId, Client_ID: clientId,
        Priority: 'INFO', Category: 'OSINT', Message: 'OSINT sweep requested', Action_URL: '', Dismissed_Status: false,
        Source_Module: 'HUD', Department: 'Oracle', Project_ID: '', Entity_Reference: clientId, Severity: 'INFO',
        Trigger_Condition: 'OSINT sweep requested from the HUD', Prescribed_Action: 'Run the OSINT sweep for this client.',
        Due_SLA: '', Assigned_Lead: 'Oracle', Action_Status: 'Requested', Resolved_At: ''
      }));
      appended = true;
    },
    readAfter: function () {
      const record = hud_findUniqueRecord_(sheet, 'Alert_ID', alertId).record;
      return { alertId: alertId, clientId: report_text_(record[clientColumn]), Department: report_text_(record.Department), Action_Status: report_text_(record.Action_Status) };
    },
    matches: function (after) { return after.clientId === clientId && after.Department === 'Oracle' && after.Action_Status === 'Requested'; },
    rollback: function () { if (appended) hud_removeAlert_(spreadsheet, alertId); }
  };
}

/**
 * Owner 2026-11-05: SOWs kept ${…} tags the seed had no data for. Pure: values Master Control can supply for a
 * project's SOW. Address and owner title come from the intake form (Phase Q) and stay open until then.
 */
function report_sowValues_(project, tabs, tz) {
  const kickoff = project.Kickoff_Date instanceof Date ? project.Kickoff_Date
    : (report_text_(project.Kickoff_Date) ? new Date(report_text_(project.Kickoff_Date)) : null);
  const fmt = function (date) { return Utilities.formatDate(date, tz, 'MMMM dd, yyyy'); };
  const services = tabs.filter(function (tab) { return tab !== DOLORES_BASE_TAB && tab !== DOLORES_OFFBOARDING_TAB; })
    .map(function (tab) { return tab.replace(/_/g, ' '); });
  return {
    '${Project Overview}': report_text_(project.ProjectName).replace(/^\[TEST\]\s*/, '') + ' (' + report_text_(project.ProjectID) + ')',
    '${Project Services}': services.length ? services.join(', ') : 'Project lifecycle delivery on the 45-day cadence',
    '${Project Start Date}': kickoff && !isNaN(kickoff) ? fmt(kickoff) : '',
    '${Project End Date}': kickoff && !isNaN(kickoff) ? fmt(new Date(kickoff.getTime() + 45 * 86400000)) : ''
  };
}

/** Owner entry point: fills the remaining ${…} tags in every project SOW from Master Control and reports what is still open. */
function refillProjectSows() {
  const spreadsheet = hud_assertWorkingCopy_();
  const repo = SpreadsheetApp.openById(DOLORES_TEMPLATE_REPO_ID);
  const tabs = repo.getSheets().map(function (s) { return s.getName(); });
  const tz = Session.getScriptTimeZone();
  const report = { docs: [] };
  hud_getSheetRecords_(hud_requireSheet_(spreadsheet, 'Projects')).forEach(function (project) {
    const id = report_text_(project.SOW_DocID);
    if (!id || id.indexOf('TEST-PLACEHOLDER') === 0) return;
    try {
      const values = report_sowValues_(project, dolores_projectTabs_(project, tabs).tabs, tz);
      populateDocPlaceholders_(id, values);
      const open = DocumentApp.openById(id).getBody().getText().match(/\$\{[^}]+\}/g) || [];
      report.docs.push({ projectId: report_text_(project.ProjectID), sow: id, tagsStillOpen: open });
    } catch (error) {
      report.docs.push({ projectId: report_text_(project.ProjectID), sow: id, error: String(error && error.message || error) });
    }
  });
  return dolores_report_(report);
}

/**
 * Flag Blocker (parking lot G3; owner 2026-11-06: several blockers per client, each removable on its own).
 * Each blocker is one Alfred_Alerts row (Category Blocker, Severity BLOCK, Department Dolores, Message
 * "Blocker: <note>"). Clients.ActiveRoadblock is the summary: the open blocker notes joined with " | ".
 * setBlocker payload { clientId, ... }:
 *   { note, projectId? } -> adds one blocker
 *   { alertId }          -> resolves that blocker only
 *   { }  (empty note)    -> resolves every open blocker of the client
 * Read-back confirms the roadblock summary (and the alert); rollback restores both.
 */
var BLOCKER_PREFIX = 'Blocker: ';
var BLOCKER_SEPARATOR = ' | ';

/** Pure: open Blocker alert rows of one client, with their notes. */
function report_openBlockerRows_(values, clientColumn, clientId) {
  const headers = values[0].map(function (h) { return report_text_(h); });
  const col = function (name) { return headers.indexOf(name); };
  const rows = [];
  values.slice(1).forEach(function (row, index) {
    if (report_text_(row[clientColumn]) !== clientId || report_text_(row[col('Category')]) !== 'Blocker') return;
    if (hud_isTrue_(row[col('Dismissed_Status')]) || report_text_(row[col('Action_Status')]) === 'Resolved') return;
    const message = col('Message') === -1 ? '' : report_text_(row[col('Message')]);
    rows.push({
      rowNumber: index + 2, alertId: report_text_(row[col('Alert_ID')]),
      note: message.indexOf(BLOCKER_PREFIX) === 0 ? message.slice(BLOCKER_PREFIX.length) : message,
      Action_Status: row[col('Action_Status')], Dismissed_Status: row[col('Dismissed_Status')], Resolved_At: row[col('Resolved_At')]
    });
  });
  return rows;
}

/** Pure: the ActiveRoadblock summary for a list of notes. */
function report_roadblockSummary_(notes) {
  return notes.filter(function (note) { return note; }).join(BLOCKER_SEPARATOR).slice(0, 2000);
}

function hud_prepareBlockerMutation_(spreadsheet, payload) {
  const clientId = report_text_(payload.clientId);
  const note = report_text_(payload.note).replace(/\s*\|\s*/g, ' / ').slice(0, 500);
  const projectId = report_text_(payload.projectId);
  const removeId = report_text_(payload.alertId);
  if (!clientId) throw report_invalid_('A client ID is required.');
  const clientsSheet = hud_requireSheet_(spreadsheet, 'Clients');
  const client = hud_findUniqueRecord_(clientsSheet, 'ClientID', clientId);
  const roadblockColumn = hud_requireColumn_(client.headers, 'ActiveRoadblock');
  const previous = report_text_(client.values[roadblockColumn]);

  const alertsSheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
  const headers = hud_getHeaders_(alertsSheet);
  const clientColumnName = headers.indexOf('Client_ID') !== -1 ? 'Client_ID' : 'ClientID';
  ['Alert_ID', clientColumnName, 'Category', 'Action_Status', 'Dismissed_Status', 'Resolved_At'].forEach(function (name) { hud_requireColumn_(headers, name); });
  const statusCol = headers.indexOf('Action_Status') + 1;
  const dismissedCol = headers.indexOf('Dismissed_Status') + 1;
  const resolvedCol = headers.indexOf('Resolved_At') + 1;
  const open = report_openBlockerRows_(alertsSheet.getDataRange().getValues(), headers.indexOf(clientColumnName), clientId);

  let toResolve = [];
  let roadblock = '';
  const alertId = (note && !removeId) ? 'ALT-' + Utilities.getUuid() : '';
  if (removeId) {
    toResolve = open.filter(function (row) { return row.alertId === removeId; });
    if (!toResolve.length) throw createRouterError_('Blocker ' + removeId + ' is not open for ' + clientId + '.', 'NOTHING_TO_CLEAR', 409);
    roadblock = report_roadblockSummary_(open.filter(function (row) { return row.alertId !== removeId; }).map(function (row) { return row.note; }));
  } else if (note) {
    // A roadblock typed by hand before blockers were alerts has no alert row: keep it in the summary.
    const existing = open.length ? open.map(function (row) { return row.note; }) : [previous];
    roadblock = report_roadblockSummary_(existing.concat([note]));
  } else {
    if (!open.length && !previous) throw createRouterError_(clientId + ' has no roadblock to clear.', 'NOTHING_TO_CLEAR', 409);
    toResolve = open;
  }
  const now = new Date().toISOString();
  let roadblockWritten = false;
  let appended = false;
  let resolved = 0;
  const cell = function () { return clientsSheet.getRange(client.rowNumber, roadblockColumn + 1); };

  return {
    entity: 'client:' + clientId,
    before: { clientId: clientId, ActiveRoadblock: previous, openBlockers: open.map(function (row) { return row.alertId; }), removing: removeId },
    apply: function () {
      cell().setValue(roadblock);
      roadblockWritten = true;
      if (alertId) {
        alertsSheet.appendRow(hud_objectRow_(headers, {
          Alert_ID: alertId, Timestamp: now, Created_At: now, ClientID: clientId, Client_ID: clientId,
          Priority: 'BLOCK', Category: 'Blocker', Message: BLOCKER_PREFIX + note, Action_URL: '', Dismissed_Status: false,
          Source_Module: 'HUD', Department: 'Dolores', Project_ID: projectId, Entity_Reference: projectId || clientId,
          Severity: 'BLOCK', Trigger_Condition: BLOCKER_PREFIX + note, Prescribed_Action: 'Remove the blocker, then clear it in the HUD.',
          Due_SLA: '', Assigned_Lead: 'Owner', Action_Status: 'Open', Resolved_At: ''
        }));
        appended = true;
      }
      toResolve.forEach(function (row) {
        alertsSheet.getRange(row.rowNumber, statusCol).setValue('Resolved');
        alertsSheet.getRange(row.rowNumber, dismissedCol).setValue(true);
        alertsSheet.getRange(row.rowNumber, resolvedCol).setValue(now);
        resolved += 1;
      });
    },
    readAfter: function () {
      const current = hud_findUniqueRecord_(clientsSheet, 'ClientID', clientId);
      const after = { clientId: clientId, ActiveRoadblock: report_text_(current.values[roadblockColumn]), alertId: alertId, note: note, removedAlertId: removeId, resolvedAlerts: resolved };
      if (alertId) after.alertCategory = report_text_(hud_findUniqueRecord_(alertsSheet, 'Alert_ID', alertId).record.Category);
      return after;
    },
    matches: function (after) {
      return after.ActiveRoadblock === roadblock && (!alertId || after.alertCategory === 'Blocker') && after.resolvedAlerts === toResolve.length;
    },
    rollback: function () {
      if (appended) hud_removeAlert_(spreadsheet, alertId);
      toResolve.slice(0, resolved).forEach(function (row) {
        alertsSheet.getRange(row.rowNumber, statusCol).setValue(row.Action_Status);
        alertsSheet.getRange(row.rowNumber, dismissedCol).setValue(row.Dismissed_Status);
        alertsSheet.getRange(row.rowNumber, resolvedCol).setValue(row.Resolved_At);
      });
      if (roadblockWritten) cell().setValue(previous);
    }
  };
}
