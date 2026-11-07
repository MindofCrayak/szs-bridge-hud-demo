/**
 * Phase C4: seed complete test data (Master Plan v3.1 section 3 standards).
 * Owner runs `seedTestData` once; `purgeTestDataDryRun` / `purgeTestData` remove exactly what was seeded.
 * Every seeded client and project name starts with "[TEST] ".
 */

var HUD_SEED_MANIFEST_PROPERTY = 'HUD_SEED_MANIFEST';
var HUD_TEST_PREFIX = '[TEST] ';
var HUD_CONTRACT_MILESTONE = 'Contract';
/** List values the seed may add to an existing dropdown (additive only). */
var HUD_SEED_EXTENDABLE_LISTS = { 'Finances|MilestoneStage': [HUD_CONTRACT_MILESTONE] };
/** The only columns that should carry checkboxes. A checkbox rule anywhere else is stray formatting. */
var HUD_BOOLEAN_COLUMNS = ['DepositPaid', 'Dismissed_Status'];
/** The identifying column for each seeded tab. */
var HUD_SEED_KEY_COLUMNS = { Clients: 'ClientID', Projects: 'ProjectID', Alfred_Alerts: 'Alert_ID' };

/** Pure: the key a seeded row is identified by (Finances: InvoiceID, or contract:<ProjectID>). */
function hud_seedRowKey_(tab, record) {
  if (tab === 'Finances') return String(record.InvoiceID || '') || 'contract:' + record.ProjectID;
  return String(record[HUD_SEED_KEY_COLUMNS[tab]] || '');
}

/** Pure: every key the seed dataset can produce, per tab. */
function hud_seedKnownKeys_(year) {
  const dataset = hud_seedDataset_({}, year);
  const tabs = { Clients: 'clients', Projects: 'projects', Finances: 'finances', Alfred_Alerts: 'alerts' };
  const known = {};
  Object.keys(tabs).forEach(function (tab) { known[tab] = dataset[tabs[tab]].map(function (record) { return hud_seedRowKey_(tab, record); }); });
  return known;
}

/* ---------- dataset (pure) ---------- */

/** Equal thirds with the remainder on the final invoice (section 3). */
function hud_invoiceSchedule_(tcv) {
  return vala_defaultSchedule_(tcv); // one schedule engine (Finance_Model.gs), exact to the cent
}

/**
 * Pure dataset. `docs` maps ClientID -> { folderUrl, kickoffUrl, msaDocId, sowDocId, meetingNotesFolderId }
 * for clients that received real Drive folders; others get placeholders.
 */
function hud_seedDataset_(docs, year) {
  docs = docs || {};
  const yy = String(year).slice(-2);
  const placeholder = function (kind, id) { return 'TEST-PLACEHOLDER-' + kind + '-' + id; };
  const doc = function (clientId, field, kind) {
    return docs[clientId] && docs[clientId][field] ? docs[clientId][field] : placeholder(kind, clientId);
  };

  const clients = [
    { id: 'PAC', name: 'Prime Auto Collision', first: 'Pat', last: 'Alvarez', archetype: 'Trade Contractor / SBO', stack: 'Google Workspace, Squarespace', mode: 'auto', real: true },
    { id: 'SEN', name: 'SolarPulse Energy', first: 'Sam', last: 'Nguyen', archetype: 'Enterprise / Custom', stack: 'HubSpot, WordPress', mode: 'auto', real: true },
    { id: 'ZES', name: 'Zenith EdTech Solutions', first: 'Zoe', last: 'Ellis', archetype: 'Enterprise / Custom', stack: 'Moodle', mode: 'auto', real: false },
    { id: 'HLW', name: 'Harbor Line Woodworks', first: 'Hal', last: 'Lowe', archetype: 'Trade Contractor / SBO', stack: 'Shopify', mode: 'auto', real: true },
    { id: 'MBS', name: 'Moonbeam Studios', first: 'Mia', last: 'Brooks', archetype: 'TTRPG / Indie Studio', stack: 'Itch.io, Notion', mode: 'manual', manualPhase: '05: Complete', real: false },
    { id: 'ORT', name: 'Orchard Row Tea', first: 'Olive', last: 'Reyes', archetype: 'Trade Contractor / SBO', stack: 'Wix', mode: 'auto', real: false }
  ];

  // stage index, TCV, invoices issued (0-3), paid count, rate tier
  const projects = [
    { id: 'PAC-01', client: 'PAC', name: 'Initial Project Build', stage: 6, tcv: 9000, issued: 2, paid: 1, tier: 'Premium ($115)', hours: [80, 52] },
    { id: 'PAC-02', client: 'PAC', name: 'Booking Portal Addendum', stage: 2, tcv: 4500, issued: 1, paid: 0, tier: 'Normal ($85)', hours: [40, 4], parent: 'PAC-01', addendum: 'ADD-PAC-01-A' },
    { id: 'SEN-01', client: 'SEN', name: 'Solar Lead Engine', stage: 4, tcv: 7500, issued: 1, paid: 1, tier: 'Normal ($85)', hours: [60, 18] },
    { id: 'SEN-02', client: 'SEN', name: 'Monitoring Dashboard', stage: 3, tcv: 6000, issued: 1, paid: 0, tier: 'Normal ($85)', hours: [50, 6], overdueDeposit: true },
    { id: 'ZES-01', client: 'ZES', name: 'Learning Portal Discovery', stage: 0, tcv: 0, issued: 0, paid: 0, tier: 'Reduced ($65)', hours: [10, 2] },
    { id: 'HLW-01', client: 'HLW', name: 'Shop Website Rebuild', stage: 8, tcv: 10000, issued: 3, paid: 2, tier: 'Normal ($85)', hours: [100, 96] },
    { id: 'MBS-01', client: 'MBS', name: 'Game Launch Kit', stage: 8, tcv: 12000, issued: 3, paid: 3, tier: 'Premium ($115)', hours: [110, 120] },
    { id: 'ORT-01', client: 'ORT', name: 'Retainer Storefront', stage: 9, tcv: 6000, issued: 3, paid: 3, tier: 'Reduced ($65)', hours: [70, 66] }
  ];

  const milestoneNames = ['Deposit (1/3)', 'Mid-Flight (1/3)', 'Liftoff & QA (1/3)'];
  const invoiceCount = {};
  const finances = [];
  const paidDeposit = {};
  projects.forEach(function (project) {
    if (!project.tcv) return;
    const schedule = hud_invoiceSchedule_(project.tcv);
    let paidTotal = 0;
    const invoices = [];
    for (let index = 0; index < project.issued; index += 1) {
      invoiceCount[project.client] = (invoiceCount[project.client] || 0) + 1;
      const paid = index < project.paid;
      if (paid) paidTotal = vala_sum_([paidTotal, schedule[index]]);
      if (index === 0 && paid) paidDeposit[project.client] = true;
      const status = paid ? 'Paid' : (index === 0 && project.overdueDeposit ? 'Overdue' : 'Sent');
      invoices.push({
        InvoiceID: 'INV-' + project.client + '-' + yy + '-' + String(invoiceCount[project.client]).padStart(3, '0'),
        ClientID: project.client,
        ProjectID: project.id,
        MilestoneStage: milestoneNames[index],
        DepositAmount: index === 0 ? schedule[0] : '',
        InvoiceAmount: schedule[index],
        DepositPaid: index === 0 ? paid : false,
        InvoiceStatus: status,
        PaymentDate: paid ? year + '-0' + (index + 3) + '-15' : ''
      });
    }
    finances.push({
      InvoiceID: '',
      ClientID: project.client,
      ProjectID: project.id,
      MilestoneStage: HUD_CONTRACT_MILESTONE,
      TotalContractValue: project.tcv,
      Remaining_Balance: vala_fromCents_(vala_toCents_(project.tcv) - vala_toCents_(paidTotal)),
      Est_Hours_Allocation: project.hours[0],
      Actual_Hours_Worked: project.hours[1]
    });
    invoices.forEach(function (row) { finances.push(row); });
  });

  // Deliberate malformed row (R8): bad InvoiceID shape.
  finances.push({ InvoiceID: 'INV-PAC-1', ClientID: 'PAC', ProjectID: 'PAC-01', MilestoneStage: 'Retainer / Maintenance', InvoiceAmount: 250, InvoiceStatus: 'Draft' });

  const tcvByClient = {};
  projects.forEach(function (project) { tcvByClient[project.client] = (tcvByClient[project.client] || 0) + project.tcv; });

  const projectRows = projects.map(function (project) {
    const gated = project.stage >= 4;
    const first = project.id.slice(-2) === '01';
    return {
      ProjectID: project.id,
      ClientID: project.client,
      ProjectName: HUD_TEST_PREFIX + project.name,
      SprintStage: HUD_WRITE_SPRINT_STAGES[project.stage],
      AssignedRateTier: project.tier,
      SOW_DocID: gated || project.stage >= 2 ? (first ? doc(project.client, 'sowDocId', 'SOW') : placeholder('SOW', project.id)) : '',
      MeetingNotes_DriveFolderID: first && docs[project.client] ? docs[project.client].meetingNotesFolderId : '',
      Est_Hours: project.hours[0],
      Actual_Hours: project.hours[1],
      ParentProjectID: project.parent || '',
      AddendumRef: project.addendum || ''
    };
  });

  const clientRows = clients.map(function (client) {
    const clientProjects = projectRows.filter(function (row) { return row.ClientID === client.id; });
    const derived = hud_deriveAccountPhase_(clientProjects, client.id, '01: Intake');
    const contractValue = client.id === 'PAC' ? tcvByClient.PAC - 1500 : tcvByClient[client.id]; // deliberate R1 mismatch on PAC
    const maxStage = Math.max.apply(null, clientProjects.map(function (row) { return HUD_WRITE_SPRINT_STAGES.indexOf(row.SprintStage); }));
    return {
      ClientID: client.id,
      First_Name: client.first,
      Last_Name: client.last,
      Company_Name: HUD_TEST_PREFIX + client.name,
      ContactEmail: client.first.toLowerCase() + '.' + client.id.toLowerCase() + '@example.com',
      GoogleGroupEmail: 'client-' + client.id.toLowerCase() + '@sessionzero.solutions',
      Archetype: client.archetype,
      AccountPhase: client.mode === 'manual' ? client.manualPhase : derived,
      AccountPhase_Mode: client.mode,
      ContractValue: contractValue,
      DepositPaid: Boolean(paidDeposit[client.id]),
      CurrentMilestone: HUD_WRITE_SPRINT_STAGES[maxStage],
      CompletedMilestones: maxStage,
      TotalMilestones: 10,
      DriveFolderUrl: docs[client.id] ? docs[client.id].folderUrl : '',
      NotesDocUrl: docs[client.id] ? docs[client.id].kickoffUrl : '',
      MSA_DocID: maxStage >= 2 ? doc(client.id, 'msaDocId', 'MSA') : '',
      Tech_Stack: client.stack
    };
  });

  const now = new Date().toISOString();
  const alert = function (id, severity, department, clientId, projectId, trigger, action) {
    return {
      Alert_ID: id, Timestamp: now, Created_At: now, Source_Module: 'Seed', Department: department,
      ClientID: clientId, Client_ID: clientId, Project_ID: projectId, Entity_Reference: projectId || clientId,
      Severity: severity, Trigger_Condition: HUD_TEST_PREFIX + trigger, Message: HUD_TEST_PREFIX + trigger,
      Prescribed_Action: action, Assigned_Lead: department, Action_Status: 'Open', Dismissed_Status: false
    };
  };
  const alerts = [
    alert('ALT-TEST-001', 'INFO', 'Pamela', 'ZES', 'ZES-01', 'Discovery call notes not yet filed.', 'File the discovery notes in the client folder.'),
    alert('ALT-TEST-002', 'WARN', 'Vala', 'SEN', 'SEN-02', 'Deposit invoice is overdue.', 'Send a payment reminder through Daisy.'),
    alert('ALT-TEST-003', 'BLOCK', 'Vala', 'HLW', 'HLW-01', 'Final invoice unpaid at Liftoff & Handover.', 'Hold handover until the final invoice is paid.')
  ];

  return {
    clients: clientRows,
    projects: projectRows,
    finances: finances,
    alerts: alerts,
    provisionFor: clients.filter(function (client) { return client.real; }).map(function (client) {
      const firstProject = projects.filter(function (project) { return project.client === client.id; })[0];
      return { id: client.id, name: HUD_TEST_PREFIX + client.name, first: client.first, last: client.last, tcv: tcvByClient[client.id], projectName: HUD_TEST_PREFIX + firstProject.name };
    })
  };
}

/* ---------- runner ---------- */

function seedTestData() {
  const report = { ok: false };
  try {
    report.result = hud_seedTestData_();
    report.ok = report.result.conflicts.length === 0 && report.result.written === true;
  } catch (error) {
    report.error = String(error && error.message || error);
  }
  const text = JSON.stringify(report, null, 1);
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return report;
}

function hud_seedTestData_() {
  const spreadsheet = hud_assertWorkingCopy_();
  const actor = getAuthorizedMasterControlUser_();
  const props = PropertiesService.getScriptProperties();
  const tabs = { Clients: 'clients', Projects: 'projects', Finances: 'finances', Alfred_Alerts: 'alerts' };

  const nonEmpty = Object.keys(tabs).filter(function (tab) { return hud_tabHasInputData_(spreadsheet.getSheetByName(tab)); });
  if (nonEmpty.length) throw new Error('REFUSING: data tabs are not empty: ' + nonEmpty.join(', ') + '. Run purgeTestData or the wipe first.');

  // Pre-flight on a dataset with placeholder docs (same cells and values as the final rows).
  const year = new Date().getFullYear();
  const preview = hud_seedDataset_({}, year);
  const conflicts = [];
  const extensions = [];
  Object.keys(tabs).forEach(function (tab) {
    hud_preflightRows_(spreadsheet.getSheetByName(tab), tab, preview[tabs[tab]], conflicts, extensions);
  });
  if (conflicts.length) return { written: false, conflicts: conflicts, note: 'Nothing was written.' };

  extensions.forEach(function (extension) { hud_extendListValidation_(spreadsheet, actor, extension); });

  // Real Drive folders through the existing provisioning (about 3 clients).
  const docs = {};
  const provisioning = [];
  preview.provisionFor.forEach(function (client) {
    try {
      const result = provisionClientDriveArchitecture_(client.id, client.id + '-01', 'INV-' + client.id + '-' + String(year).slice(-2) + '-001', {
        Company_Name: client.name, First_Name: client.first, Last_Name: client.last, Project_Name: client.projectName,
        Email: client.first.toLowerCase() + '.' + client.id.toLowerCase() + '@example.com', Est_Value: client.tcv
      });
      docs[client.id] = {
        folderId: result.clientFolderId, folderUrl: result.clientFolderUrl, kickoffUrl: result.kickoffDocUrl,
        msaDocId: result.msaDocId, sowDocId: result.sowDocId, meetingNotesFolderId: result.meetingNotesFolderId
      };
      provisioning.push({ clientId: client.id, ok: true, folderId: result.clientFolderId });
    } catch (error) {
      provisioning.push({ clientId: client.id, ok: false, error: String(error && error.message || error) });
    }
  });

  const dataset = hud_seedDataset_(docs, year);
  const manifest = { seededAt: new Date().toISOString(), rows: {}, driveFolderIds: [] };
  withLock_(function () {
    Object.keys(tabs).forEach(function (tab) {
      manifest.rows[tab] = hud_writeSeedRows_(spreadsheet.getSheetByName(tab), dataset[tabs[tab]]);
    });
    SpreadsheetApp.flush();
  });
  Object.keys(docs).forEach(function (id) { manifest.driveFolderIds.push(docs[id].folderId); });
  props.setProperty(HUD_SEED_MANIFEST_PROPERTY, JSON.stringify(manifest));

  hud_logRepair_(spreadsheet, actor, {
    action: 'seedTestData', entity: 'Clients,Projects,Finances,Alfred_Alerts',
    before: { empty: true },
    after: { clients: dataset.clients.length, projects: dataset.projects.length, finances: dataset.finances.length, alerts: dataset.alerts.length }
  });

  return {
    written: true,
    conflicts: [],
    listExtensions: extensions,
    provisioning: provisioning,
    counts: { clients: dataset.clients.length, projects: dataset.projects.length, finances: dataset.finances.length, alerts: dataset.alerts.length },
    deliberate: {
      contractMismatch: 'Clients PAC ContractValue = 12000; project TCVs sum to 13500 (R1)',
      malformedRow: 'Finances InvoiceID INV-PAC-1 (R8)'
    },
    manifestRows: manifest.rows
  };
}

/* ---------- helpers ---------- */

function hud_tabHasInputData_(sheet) {
  if (!sheet || sheet.getMaxRows() < 2) return false;
  return sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()).getValues()
    .some(function (row) { return row.some(function (cell) { return cell !== '' && cell !== false && cell !== null; }); });
}

/** Checks every planned cell against that cell's live validation. Collects additive list extensions. */
function hud_preflightRows_(sheet, tab, records, conflicts, extensions) {
  if (!sheet) { conflicts.push({ tab: tab, error: 'sheet missing' }); return; }
  const headers = hud_getHeaders_(sheet);
  Object.keys(records.reduce(function (all, record) { Object.keys(record).forEach(function (key) { all[key] = true; }); return all; }, {}))
    .forEach(function (name) {
      if (headers.indexOf(name) === -1) conflicts.push({ tab: tab, column: name, error: 'column missing' });
    });
  if (!records.length) return;
  const rules = sheet.getRange(2, 1, records.length, headers.length).getDataValidations();
  records.forEach(function (record, index) {
    headers.forEach(function (header, column) {
      if (!Object.prototype.hasOwnProperty.call(record, header)) return;
      const value = record[header];
      const rule = rules[index][column];
      if (!rule || value === '' || value === null) return;
      const type = String(rule.getCriteriaType());
      if (type === 'CHECKBOX') {
        if (typeof value === 'boolean') return;
        if (HUD_BOOLEAN_COLUMNS.indexOf(header) === -1) {
          if (!extensions.some(function (e) { return e.tab === tab && e.column === header && e.clearStrayCheckboxes; })) {
            extensions.push({ tab: tab, column: header, clearStrayCheckboxes: true });
          }
          return;
        }
        conflicts.push({ tab: tab, row: index + 2, column: header, value: value, error: 'checkbox needs true/false' });
        return;
      }
      if (type !== 'VALUE_IN_LIST' && type !== 'VALUE_IN_RANGE') return;
      const allowed = hud_ruleListValues_(rule);
      if (allowed.indexOf(String(value)) !== -1) return;
      const extendable = HUD_SEED_EXTENDABLE_LISTS[tab + '|' + header] || [];
      if (type === 'VALUE_IN_LIST' && extendable.indexOf(String(value)) !== -1) {
        if (!extensions.some(function (e) { return e.tab === tab && e.column === header && e.value === value; })) {
          extensions.push({ tab: tab, column: header, value: value });
        }
        return;
      }
      conflicts.push({ tab: tab, row: index + 2, column: header, value: value, allowed: allowed });
    });
  });
}

function hud_ruleListValues_(rule) {
  const criteria = rule.getCriteriaValues() || [];
  const first = criteria[0];
  if (Array.isArray(first)) return first.map(String);
  if (first && typeof first.getValues === 'function') {
    return first.getValues().reduce(function (all, row) { return all.concat(row.map(String)); }, []).filter(Boolean);
  }
  return [];
}

/** Adds one value to an existing list rule on rows 2..max of a column (additive; logged once). */
function hud_extendListValidation_(spreadsheet, actor, extension) {
  if (extension.clearStrayCheckboxes) return hud_clearStrayCheckboxes_(spreadsheet, actor, extension);
  const sheet = hud_requireSheet_(spreadsheet, extension.tab);
  const column = hud_requireColumn_(hud_getHeaders_(sheet), extension.column) + 1;
  const range = sheet.getRange(2, column, sheet.getMaxRows() - 1, 1);
  const current = sheet.getRange(2, column).getDataValidation();
  const list = current ? hud_ruleListValues_(current) : [];
  if (list.indexOf(extension.value) !== -1) return;
  const builder = SpreadsheetApp.newDataValidation()
    .requireValueInList(list.concat([extension.value]), true)
    .setAllowInvalid(current ? current.getAllowInvalid() : false);
  if (current && current.getHelpText()) builder.setHelpText(current.getHelpText());
  range.setDataValidation(builder.build());
  hud_registerSchemaChangeOnce_(spreadsheet, actor, {
    tab: extension.tab, column: extension.column, changeType: 'Add allowed value',
    reason: 'Add "' + extension.value + '" to ' + extension.tab + '.' + extension.column + ' (Master Plan v3.1 finance model).',
    impact: 'Additive dropdown value; existing values unchanged.'
  });
}

/** Removes checkbox rules (only checkbox rules) from a column that is not a boolean column. Logged once. */
function hud_clearStrayCheckboxes_(spreadsheet, actor, extension) {
  if (HUD_BOOLEAN_COLUMNS.indexOf(extension.column) !== -1) throw new Error('Refusing to clear checkboxes on ' + extension.column + '.');
  const sheet = hud_requireSheet_(spreadsheet, extension.tab);
  const column = hud_requireColumn_(hud_getHeaders_(sheet), extension.column) + 1;
  const range = sheet.getRange(2, column, sheet.getMaxRows() - 1, 1);
  const rules = range.getDataValidations();
  let cleared = 0;
  const next = rules.map(function (row) {
    if (row[0] && String(row[0].getCriteriaType()) === 'CHECKBOX') { cleared += 1; return [null]; }
    return [row[0]];
  });
  if (!cleared) return;
  range.setDataValidations(next);
  extension.clearedCells = cleared;
  hud_registerSchemaChangeOnce_(spreadsheet, actor, {
    tab: extension.tab, column: extension.column, changeType: 'Other',
    reason: 'Remove stray checkbox rules from ' + extension.tab + '.' + extension.column + ' (a currency column).',
    impact: 'Only checkbox rules in this column were removed; other validation unchanged.'
  });
}

/** Writes records from row 2 down; returns the key values written (for purge). */
function hud_writeSeedRows_(sheet, records) {
  const headers = hud_getHeaders_(sheet);
  if (!records.length) return [];
  const rules = sheet.getRange(2, 1, records.length, headers.length).getDataValidations();
  const values = records.map(function (record, index) {
    return headers.map(function (header, column) {
      const has = Object.prototype.hasOwnProperty.call(record, header);
      const rule = rules[index][column];
      const isCheckbox = rule && String(rule.getCriteriaType()) === 'CHECKBOX';
      if (!has) return isCheckbox ? false : '';
      const value = record[header];
      return isCheckbox ? value === true : value;
    });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  const sheetName = sheet.getName();
  return records.map(function (record, index) {
    return { row: index + 2, key: hud_seedRowKey_(sheetName, record) };
  });
}

/* ---------- purge ---------- */

function purgeTestDataDryRun() { return hud_runPurge_(true); }
function purgeTestData() { return hud_runPurge_(false); }

function hud_runPurge_(dryRun) {
  const report = { dryRun: dryRun };
  try {
    const spreadsheet = hud_assertWorkingCopy_();
    const raw = PropertiesService.getScriptProperties().getProperty(HUD_SEED_MANIFEST_PROPERTY);
    if (!raw) throw new Error('No seed manifest found; nothing to purge.');
    const manifest = JSON.parse(raw);
    const known = hud_seedKnownKeys_(new Date(manifest.seededAt).getFullYear());
    report.rows = {};
    report.mismatches = [];
    Object.keys(manifest.rows).forEach(function (tab) {
      const sheet = hud_requireSheet_(spreadsheet, tab);
      const headers = hud_getHeaders_(sheet);
      const planned = [];
      manifest.rows[tab].forEach(function (entry) {
        const values = sheet.getRange(entry.row, 1, 1, headers.length).getValues()[0];
        const record = {};
        headers.forEach(function (header, column) { record[header] = values[column]; });
        // A row is purged only if it sits where the seed wrote it AND its own key is one the seed produces.
        const actual = hud_seedRowKey_(tab, record);
        if ((known[tab] || []).indexOf(actual) === -1) report.mismatches.push({ tab: tab, row: entry.row, manifestKey: entry.key, found: actual });
        else planned.push(entry);
      });
      report.rows[tab] = planned.length;
      if (!dryRun) planned.forEach(function (entry) { sheet.getRange(entry.row, 1, 1, headers.length).clearContent(); });
    });
    report.driveFolders = manifest.driveFolderIds.map(function (id) {
      try {
        const folder = DriveApp.getFolderById(id);
        const info = { id: id, name: folder.getName(), trashed: folder.isTrashed() };
        if (!dryRun && !info.trashed && folder.getName().indexOf(HUD_TEST_PREFIX.trim()) !== -1) { folder.setTrashed(true); info.trashedNow = true; }
        return info;
      } catch (error) {
        return { id: id, error: String(error && error.message || error) };
      }
    });
    if (!dryRun) PropertiesService.getScriptProperties().deleteProperty(HUD_SEED_MANIFEST_PROPERTY);
    report.ok = report.mismatches.length === 0;
  } catch (error) {
    report.ok = false;
    report.error = String(error && error.message || error);
  }
  const text = JSON.stringify(report, null, 1);
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return report;
}

/* ---------- C4 follow-up: provisioning config and real Drive folders for seeded clients ---------- */

var HUD_PROVISIONING_DEFAULTS = {
  MSA_TEMPLATE_ID: '12D4K96cdqoDv4kPss1owc1n0mu3A7gOiq7nPjFjE-kA',
  SOW_TEMPLATE_ID: '18uqIyzZ2etVDRBkQsJhPWXcj-c8Rwffdp5d3lugzf7Q',
  INVOICE_TEMPLATE_ID: '1lr7HfMPQOksgOhOoOOuXc99Iiy2KJQaSLcG7TYl0LUs'
};
/** Owner standard (2026-11-04): client folders live in Sanctum Active. Test folders are marked by their "[TEST] " name. */
/** Drive search fallback when a template ID is unreadable: every word must appear in the title. */
var HUD_TEMPLATE_SEARCH = {
  MSA_TEMPLATE_ID: { words: ['Master Services Agreement'], mime: 'application/vnd.google-apps.document' },
  SOW_TEMPLATE_ID: { words: ['Statement of Work'], mime: 'application/vnd.google-apps.document' },
  INVOICE_TEMPLATE_ID: { words: ['Invoice', 'Template'], mime: 'application/vnd.google-apps.spreadsheet' }
};

function hud_findTemplateCandidates_(search) {
  const query = search.words.map(function (word) { return "title contains '" + word.replace(/'/g, "\\'") + "'"; })
    .concat(["mimeType = '" + search.mime + "'", 'trashed = false']).join(' and ');
  const out = [];
  const files = DriveApp.searchFiles(query);
  while (files.hasNext() && out.length < 10) {
    const file = files.next();
    if (file.getName().indexOf('[TEST]') === -1) out.push(file);
  }
  return out;
}

var HUD_SANCTUM_ACTIVE_FOLDER_ID = '1jUsGGSmNK1lAHgBmVcULtecLqjMxHSEm';

/** Owner entry point: set missing provisioning properties, then give PAC, SEN, HLW real Drive folders. */
function runPhaseCDriveProvisioning() {
  const report = {};
  try {
    hud_assertWorkingCopy_();
    report.config = hud_configureProvisioning_();
    report.provisioning = hud_provisionSeededClients_(['PAC', 'SEN', 'HLW']);
    report.ok = report.provisioning.every(function (entry) { return entry.ok; });
  } catch (error) {
    report.ok = false;
    report.error = String(error && error.message || error);
  }
  const text = JSON.stringify(report, null, 1);
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return report;
}

function hud_configureProvisioning_() {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  Object.keys(HUD_PROVISIONING_DEFAULTS).forEach(function (name) {
    const stored = props.getProperty(name) || '';
    const candidates = [stored, HUD_PROVISIONING_DEFAULTS[name]].filter(Boolean);
    let file = null;
    for (let i = 0; i < candidates.length && !file; i += 1) {
      try { file = DriveApp.getFileById(candidates[i]); } catch (error) { file = null; }
    }
    let foundBy = file ? 'id' : '';
    if (!file) {
      const matches = hud_findTemplateCandidates_(HUD_TEMPLATE_SEARCH[name]);
      if (matches.length !== 1) {
        throw new Error(name + ': no readable ID and ' + matches.length + ' search matches: '
          + JSON.stringify(matches.map(function (m) { return { name: m.getName(), id: m.getId() }; }))
          + '. Set the Script Property ' + name + ' to the right file ID and run again.');
      }
      file = matches[0];
      foundBy = 'search';
    }
    const setNow = stored !== file.getId();
    if (setNow) props.setProperty(name, file.getId());
    out[name] = { id: file.getId(), name: file.getName(), setNow: setNow, foundBy: foundBy };
  });
  let parentId = props.getProperty('ACTIVE_PARENT_FOLDER_ID') || '';
  if (!parentId) {
    const folder = DriveApp.getFolderById(HUD_SANCTUM_ACTIVE_FOLDER_ID);
    parentId = folder.getId();
    props.setProperty('ACTIVE_PARENT_FOLDER_ID', parentId);
    out.ACTIVE_PARENT_FOLDER_ID = { id: parentId, name: folder.getName(), setNow: true };
  } else {
    out.ACTIVE_PARENT_FOLDER_ID = { id: parentId, name: DriveApp.getFolderById(parentId).getName(), setNow: false };
  }
  return out;
}

/** Pure: which cells to fill on the seeded rows from one provisioning result. */
function hud_provisioningCellUpdates_(clientId, result) {
  return {
    Clients: { key: clientId, values: { DriveFolderUrl: result.clientFolderUrl, NotesDocUrl: result.kickoffDocUrl, MSA_DocID: result.msaDocId } },
    Projects: { key: clientId + '-01', values: { SOW_DocID: result.sowDocId, MeetingNotes_DriveFolderID: result.meetingNotesFolderId } }
  };
}

function hud_provisionSeededClients_(clientIds) {
  const spreadsheet = hud_assertWorkingCopy_();
  const actor = getAuthorizedMasterControlUser_();
  const props = PropertiesService.getScriptProperties();
  const manifest = JSON.parse(props.getProperty(HUD_SEED_MANIFEST_PROPERTY) || '{"rows":{},"driveFolderIds":[]}');
  const clients = hud_requireSheet_(spreadsheet, 'Clients');
  const projects = hud_requireSheet_(spreadsheet, 'Projects');
  const year = new Date().getFullYear();
  return clientIds.map(function (clientId) {
    try {
      const client = hud_findUniqueRecord_(clients, 'ClientID', clientId);
      if (String(client.record.DriveFolderUrl || '').trim()) return { clientId: clientId, ok: true, skipped: 'already has a Drive folder' };
      const tcv = hud_getSheetRecords_(hud_requireSheet_(spreadsheet, 'Finances'))
        .filter(function (row) { return row.ClientID === clientId && row.MilestoneStage === HUD_CONTRACT_MILESTONE; })
        .reduce(function (sum, row) { return sum + Number(row.TotalContractValue || 0); }, 0);
      const firstProject = hud_findUniqueRecord_(projects, 'ProjectID', clientId + '-01');
      const result = provisionClientDriveArchitecture_(clientId, clientId + '-01', 'INV-' + clientId + '-' + String(year).slice(-2) + '-001', {
        Project_Name: String(firstProject.record.ProjectName || ''),
        Company_Name: String(client.record.Company_Name), First_Name: String(client.record.First_Name || ''),
        Last_Name: String(client.record.Last_Name || ''), Email: String(client.record.ContactEmail || ''), Est_Value: tcv
      });
      manifest.driveFolderIds = (manifest.driveFolderIds || []).concat([result.clientFolderId]);
      props.setProperty(HUD_SEED_MANIFEST_PROPERTY, JSON.stringify(manifest));
      const updates = hud_provisioningCellUpdates_(clientId, result);
      [[clients, 'ClientID', updates.Clients], [projects, 'ProjectID', updates.Projects]].forEach(function (target) {
        const record = hud_findUniqueRecord_(target[0], target[1], target[2].key);
        Object.keys(target[2].values).forEach(function (name) {
          target[0].getRange(record.rowNumber, hud_requireColumn_(record.headers, name) + 1).setValue(target[2].values[name]);
        });
      });
      hud_logRepair_(spreadsheet, actor, {
        action: 'seedProvisionDrive', entity: 'client:' + clientId,
        before: { DriveFolderUrl: '' }, after: { folderId: result.clientFolderId, msaDocId: result.msaDocId, sowDocId: result.sowDocId }
      });
      return { clientId: clientId, ok: true, folderId: result.clientFolderId, folderUrl: result.clientFolderUrl };
    } catch (error) {
      return { clientId: clientId, ok: false, error: String(error && error.message || error) };
    }
  });
}

