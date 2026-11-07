var HUD_WRITE_AUDIT_HEADERS = [
  'Timestamp', 'User', 'Action', 'Entity', 'Before', 'After',
  'Request_ID', 'Status', 'Error'
];

var HUD_WRITE_ACTIONS = ['setAccountPhase', 'setSprintStage', 'resolveAlert', 'resolveFinding', 'sendClientMessage', 'createTask', 'setTaskStatus', 'draftInvoice', 'requestOsintSweep', 'setBlocker', 'restoreClientFolder', 'removeService'];

var HUD_WRITE_ACCOUNT_PHASES = [
  '01: Intake',
  '02: Session Zero',
  '03: Active Sprints',
  '04: Liftoff',
  '05: Complete',
  '06: Archived/Sunset'
];

var HUD_WRITE_SPRINT_STAGES = [
  '00: Discovery',
  '01: Vibecheck',
  '02: Contract & Inception',
  '03: Deep Intelligence',
  '04: Session Zero Kickoff',
  '05: Architecture & Builds',
  '06: Mid-Flight Review',
  '07: Final Staging & QA',
  '08: Liftoff & Handover',
  '09: Sunset / Retainer'
];

/** Writes that can change a Police finding (ledger, phases, stages, finding fixes); others skip the re-check. */
var HUD_POLICE_AFTER_ACTIONS = ['setAccountPhase', 'setSprintStage', 'resolveFinding', 'removeService'];

/** Pure: true when the write should re-run the Police reconciliation. */
function hud_needsPolice_(action) { return HUD_POLICE_AFTER_ACTIONS.indexOf(action) !== -1; }

/**
 * Runs `fn` once per 6 hours per key (CacheService). Schema registration is idempotent metadata, so re-checking
 * ~10 registry rows on every write only cost time (owner feedback 2026-11-05: saves took 30-45 s).
 */
function hud_onceCached_(key, fn) {
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (error) { cache = null; }
  const cacheKey = 'hud-once:' + key + ':' + HUD_SCHEMA_VERSION + ':' + HUD_WRITE_ACTIONS.length;
  if (cache && cache.get(cacheKey)) return;
  fn();
  if (cache) { try { cache.put(cacheKey, '1', 21600); } catch (error) { /* optional */ } }
}

var HUD_POLICE_AFTER_HANDLER = 'police_afterWrite';

/** Debounced: one pending background Police run at a time. Returns 'scheduled' or 'already pending'. */
function hud_schedulePolice_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('police-pending')) return 'already pending';
  const pending = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === HUD_POLICE_AFTER_HANDLER; });
  if (!pending) ScriptApp.newTrigger(HUD_POLICE_AFTER_HANDLER).timeBased().after(3000).create();
  cache.put('police-pending', '1', 300);
  return 'scheduled';
}

var HUD_AUTOMATION_HANDLER = 'dolores_afterStageChange';

/** Pure: stages that get project assets (02 contract .. 08 liftoff), matching dolores_runProjectAutomation_. */
function dolores_shouldAutomate_(stage) {
  const index = HUD_WRITE_SPRINT_STAGES.indexOf(String(stage || '').trim());
  return index >= 2 && index <= 8;
}

/** Queues a project (Script Properties, so the queue survives) and makes sure one background run is pending. */
function hud_scheduleProjectAutomation_(projectId) {
  const props = PropertiesService.getScriptProperties();
  const queue = JSON.parse(props.getProperty('dolores-queue') || '[]');
  if (queue.indexOf(projectId) === -1) queue.push(projectId);
  props.setProperty('dolores-queue', JSON.stringify(queue));
  const pending = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === HUD_AUTOMATION_HANDLER; });
  if (!pending) ScriptApp.newTrigger(HUD_AUTOMATION_HANDLER).timeBased().after(5000).create();
  return 'queued ' + projectId;
}

/** Pure: a short, readable alert text for one automation entry, or '' when nothing was created and nothing failed. */
function dolores_automationSummary_(entry) {
  const created = (entry.actions || []).filter(function (action) { return /created|added [^0]|invited|shared|installed/i.test(action); });
  const waiting = (entry.actions || []).filter(function (action) { return /not ready/i.test(action); });
  const parts = [];
  if (created.length) parts.push('Created: ' + created.map(function (a) { return a.split(':')[0]; }).join(', '));
  if (waiting.length) parts.push('Waiting: ' + waiting.join(' | '));
  if ((entry.errors || []).length) parts.push('Failed: ' + entry.errors.join(' | '));
  return parts.length ? entry.projectId + ' project automation. ' + parts.join('. ') : '';
}

/** One-off trigger: runs the queued projects' automation, then posts a Dolores alert per project that changed. */
function dolores_afterStageChange() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === HUD_AUTOMATION_HANDLER) ScriptApp.deleteTrigger(t);
  });
  const props = PropertiesService.getScriptProperties();
  const queue = JSON.parse(props.getProperty('dolores-queue') || '[]');
  props.deleteProperty('dolores-queue');
  if (!queue.length) return;
  const report = dolores_runProjectAutomation_({ only: queue, dryRun: false });
  console.log('Background project automation: ' + JSON.stringify(report).slice(0, 4000));
  const spreadsheet = hud_assertWorkingCopy_();
  (report.projects || []).forEach(function (entry) {
    const message = dolores_automationSummary_(entry);
    if (!message) return;
    const sheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
    const now = new Date().toISOString();
    const clientId = entry.projectId.replace(/-\d+$/, '');
    sheet.appendRow(hud_objectRow_(hud_getHeaders_(sheet), {
      Alert_ID: 'ALT-' + Utilities.getUuid(), Timestamp: now, Created_At: now, ClientID: clientId, Client_ID: clientId,
      Priority: entry.errors.length ? 'WARN' : 'INFO', Severity: entry.errors.length ? 'WARN' : 'INFO', Category: 'Project automation',
      Message: message, Action_URL: '', Dismissed_Status: false, Source_Module: 'Dolores', Department: 'Dolores', Project_ID: entry.projectId,
      Entity_Reference: entry.projectId, Trigger_Condition: message, Prescribed_Action: entry.errors.length ? 'Check the failed steps in the Dossier links' : 'New links are in the Client Dossier',
      Due_SLA: '', Assigned_Lead: 'Dolores', Action_Status: 'Open', Resolved_At: ''
    }));
  });
}

/** One-off trigger handler: removes itself, then runs the Police reconciliation under the script lock. */
function police_afterWrite() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === HUD_POLICE_AFTER_HANDLER) ScriptApp.deleteTrigger(t);
  });
  try { CacheService.getScriptCache().remove('police-pending'); } catch (error) { /* expires */ }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // the 15-minute audit will catch up
  try {
    police_runReconciliation_(hud_assertWorkingCopy_());
  } finally {
    lock.releaseLock();
  }
}

function hud_write(action, payload, requestId) {
  const actor = getAuthorizedMasterControlUser_();
  const timings = { start: Date.now() };
  const mark = function (name) { timings[name] = Date.now() - timings.start; };
  const actionName = String(action == null ? '' : action).trim();
  const requestKey = String(requestId == null ? '' : requestId).trim();
  if (HUD_WRITE_ACTIONS.indexOf(actionName) === -1) {
    throw createRouterError_('The requested HUD write action is not allowed.', 'ACTION_NOT_ALLOWED', 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createRouterError_('A write payload object is required.', 'INVALID_REQUEST', 400);
  }
  if (!requestKey || requestKey.length > 128) {
    throw createRouterError_('A request ID between 1 and 128 characters is required.', 'INVALID_REQUEST', 400);
  }

  return withLock_(function () {
    mark('lockMs');
    const spreadsheet = getMasterControlSpreadsheet_();
    const audit = hud_ensureAuditLog_(spreadsheet, actor);
    mark('auditSetupMs');
    if (hud_hasRequestId_(audit.sheet, audit.headers, requestKey)) {
      throw createRouterError_('This request ID has already been used.', 'DUPLICATE_REQUEST', 409);
    }

    if (actionName === 'setAccountPhase' || actionName === 'setSprintStage') {
      hud_onceCached_('account-phase-mode-column', function () { hud_ensureAccountPhaseModeColumn_(spreadsheet, actor); });
    }

    const mutation = hud_prepareMutation_(spreadsheet, actionName, payload);
    mark('prepareMs');
    const timestamp = new Date().toISOString();
    audit.sheet.appendRow(hud_objectRow_(audit.headers, {
      Timestamp: timestamp,
      User: actor,
      Action: actionName,
      Entity: mutation.entity,
      Before: JSON.stringify(mutation.before),
      After: '',
      Request_ID: requestKey,
      Status: 'Pending',
      Error: ''
    }));
    const auditRow = audit.sheet.getLastRow();

    try {
      mutation.apply();
      SpreadsheetApp.flush();
      mark('applyMs');
      const after = mutation.readAfter();
      mark('readBackMs');
      if (!mutation.matches(after)) {
        throw new Error('Master Control did not confirm the requested values on read-back. Read back: '
          + JSON.stringify(after).slice(0, 500));
      }
      hud_updateAuditLog_(audit.sheet, audit.headers, auditRow, {
        After: JSON.stringify(after),
        Status: 'Confirmed',
        Error: ''
      });
      mark('auditConfirmMs');
      // Measured 2026-11-05: Police took ~4 s of a ~10 s save. It now runs right after the save in a one-off
      // background trigger (police_afterWrite), so the HUD gets its confirmation without waiting for it.
      if (hud_needsPolice_(actionName)) {
        try { timings.police = hud_schedulePolice_(); } catch (policeError) { console.error('Police re-check not scheduled:', policeError && policeError.message); }
      }
      // Plan v3.1 E3 / Phase H: a stage save into 02-08 queues Dolores' project automation (docs, spaces, group,
      // task list, Command Deck) in the background; it is idempotent and creates only what is missing.
      if (actionName === 'setSprintStage' && dolores_shouldAutomate_(after.SprintStage)) {
        try { timings.automation = hud_scheduleProjectAutomation_(String(after.projectId)); } catch (automationError) { console.error('Automation not scheduled:', automationError && automationError.message); }
      }
      mark('totalMs');
      delete timings.start;
      console.log('hud_write ' + actionName + ' timings ' + JSON.stringify(timings));
      // Evidence for slow saves: the step timings go into this write's audit row (After._timings).
      try {
        hud_updateAuditLog_(audit.sheet, audit.headers, auditRow, { After: JSON.stringify(Object.assign({}, after, { _timings: timings })) });
      } catch (timingError) { console.warn('Could not record timings: ' + (timingError && timingError.message)); }
      return {
        ok: true,
        requestId: requestKey,
        before: mutation.before,
        after: after,
        timings: timings
      };
    } catch (error) {
      const message = error && error.message ? String(error.message) : 'The Master Control write failed.';
      let finalMessage = message;
      try {
        mutation.rollback();
      } catch (rollbackError) {
        const rollbackMessage = rollbackError && rollbackError.message
          ? String(rollbackError.message)
          : 'Unknown rollback error.';
        finalMessage += ' Rollback failed: ' + rollbackMessage;
      }
      try {
        hud_updateAuditLog_(audit.sheet, audit.headers, auditRow, {
          Status: 'Failed',
          Error: finalMessage
        });
      } catch (auditError) {
        const auditMessage = auditError && auditError.message
          ? String(auditError.message)
          : 'Unknown audit update error.';
        console.error('HUD write failed and its audit row could not be updated:', auditMessage);
        finalMessage += ' Audit status could not be updated: ' + auditMessage;
      }
      throw new Error(finalMessage);
    }
  });
}

function hud_prepareMutation_(spreadsheet, action, payload) {
  if (action === 'setAccountPhase') {
    return hud_prepareAccountPhaseMutation_(spreadsheet, payload);
  }
  if (action === 'setSprintStage') {
    return hud_prepareSprintStageMutation_(spreadsheet, payload);
  }
  if (action === 'resolveFinding') {
    return hud_prepareFindingMutation_(spreadsheet, payload);
  }
  if (action === 'draftInvoice') {
    return hud_prepareInvoiceDraftMutation_(spreadsheet, payload);
  }
  if (action === 'requestOsintSweep') {
    return hud_prepareOsintSweepMutation_(spreadsheet, payload);
  }
  if (action === 'setBlocker') {
    return hud_prepareBlockerMutation_(spreadsheet, payload);
  }
  if (action === 'restoreClientFolder') {
    return hud_prepareRestoreFolderMutation_(spreadsheet, payload);
  }
  if (action === 'removeService') {
    return hud_prepareServiceRemovalMutation_(spreadsheet, payload);
  }
  if (action === 'createTask') {
    return hud_prepareTaskCreateMutation_(spreadsheet, payload);
  }
  if (action === 'setTaskStatus') {
    return hud_prepareTaskStatusMutation_(spreadsheet, payload);
  }
  if (action === 'sendClientMessage') {
    return hud_prepareClientMessageMutation_(spreadsheet, payload);
  }
  return hud_prepareAlertMutation_(spreadsheet, payload);
}

function hud_prepareAccountPhaseMutation_(spreadsheet, payload) {
  const clientId = String(payload.clientId || payload.clientID || '').trim();
  const mode = String(payload.mode == null ? 'manual' : payload.mode).trim().toLowerCase();
  if (!clientId || ['auto', 'manual'].indexOf(mode) === -1) {
    throw createRouterError_('A client ID and mode "auto" or "manual" are required.', 'INVALID_REQUEST', 400);
  }

  const sheet = hud_requireSheet_(spreadsheet, 'Clients');
  const record = hud_findUniqueRecord_(sheet, 'ClientID', clientId);
  const phaseColumn = hud_requireColumn_(record.headers, 'AccountPhase');
  const modeColumn = hud_requireColumn_(record.headers, 'AccountPhase_Mode');
  const previousPhase = String(record.values[phaseColumn] || '').trim();
  const previousMode = String(record.values[modeColumn] || 'auto').trim().toLowerCase();
  const projects = hud_getSheetRecords_(hud_requireSheet_(spreadsheet, 'Projects'));
  const phase = mode === 'manual'
    ? String(payload.phase == null ? '' : payload.phase).trim()
    : hud_deriveAccountPhase_(projects, clientId, previousPhase);
  if (HUD_WRITE_ACCOUNT_PHASES.indexOf(phase) === -1) {
    throw createRouterError_('A canonical account phase is required.', 'INVALID_PHASE', 400);
  }

  const before = { clientId: clientId, AccountPhase: previousPhase, AccountPhase_Mode: previousMode };
  let sunsetAlertId = '';
  let applied = false;
  return {
    entity: 'client:' + clientId,
    before: before,
    apply: function () {
      applied = true;
      sheet.getRange(record.rowNumber, phaseColumn + 1).setValue(phase);
      sheet.getRange(record.rowNumber, modeColumn + 1).setValue(mode);
      if (phase === '06: Archived/Sunset' && previousPhase !== phase) {
        sunsetAlertId = hud_appendSunsetAlert_(spreadsheet, clientId);
      }
    },
    readAfter: function () {
      const current = hud_findUniqueRecord_(sheet, 'ClientID', clientId);
      const result = {
        clientId: clientId,
        AccountPhase: String(current.values[phaseColumn] || '').trim(),
        AccountPhase_Mode: String(current.values[modeColumn] || '').trim()
      };
      if (sunsetAlertId) {
        const alert = hud_findUniqueRecord_(
          hud_requireSheet_(spreadsheet, 'Alfred_Alerts'),
          'Alert_ID',
          sunsetAlertId,
        );
        result.sunsetAlertId = sunsetAlertId;
        result.sunsetAlertStatus = String(alert.record.Action_Status || '').trim();
        result.sunsetAlertDepartment = String(alert.record.Department || '').trim();
      }
      return result;
    },
    matches: function (after) {
      return after.AccountPhase === phase
        && after.AccountPhase_Mode === mode
        && (!sunsetAlertId || (
          after.sunsetAlertId === sunsetAlertId
          && after.sunsetAlertStatus === 'Requested'
          && after.sunsetAlertDepartment === 'Daisy'
        ));
    },
    rollback: function () {
      if (!applied) return;
      sheet.getRange(record.rowNumber, phaseColumn + 1).setValue(previousPhase);
      sheet.getRange(record.rowNumber, modeColumn + 1).setValue(previousMode);
      if (sunsetAlertId) hud_removeAlert_(spreadsheet, sunsetAlertId);
    }
  };
}

function hud_prepareSprintStageMutation_(spreadsheet, payload) {
  const projectId = String(payload.projectId || payload.projectID || '').trim();
  const stage = String(payload.stage == null ? '' : payload.stage).trim();
  if (!projectId || HUD_WRITE_SPRINT_STAGES.indexOf(stage) === -1) {
    throw createRouterError_('A project ID and canonical sprint stage are required.', 'INVALID_REQUEST', 400);
  }

  const projectSheet = hud_requireSheet_(spreadsheet, 'Projects');
  const project = hud_findUniqueRecord_(projectSheet, 'ProjectID', projectId);
  const projectStageColumn = hud_requireColumn_(project.headers, 'SprintStage');
  const clientIdColumn = hud_requireColumn_(project.headers, 'ClientID');
  const clientId = String(project.values[clientIdColumn] || '').trim();
  if (!clientId) throw createRouterError_('The project has no ClientID.', 'INVALID_PROJECT', 400);

  const clientSheet = hud_requireSheet_(spreadsheet, 'Clients');
  const client = hud_findUniqueRecord_(clientSheet, 'ClientID', clientId);
  const accountPhaseColumn = hud_requireColumn_(client.headers, 'AccountPhase');
  const accountModeColumn = hud_requireColumn_(client.headers, 'AccountPhase_Mode');
  const priorProjectStage = String(project.values[projectStageColumn] || '').trim();
  const priorAccountPhase = String(client.values[accountPhaseColumn] || '').trim();
  const priorMode = String(client.values[accountModeColumn] || 'auto').trim().toLowerCase();

  hud_enforceSprintStageGate_(spreadsheet, client, project, stage);

  const projectedProjects = hud_getSheetRecords_(projectSheet).map(function (row) {
    if (String(row.ProjectID || '').trim() === projectId) {
      return Object.assign({}, row, { SprintStage: stage });
    }
    return row;
  });
  const nextAccountPhase = priorMode === 'auto'
    ? hud_deriveAccountPhase_(projectedProjects, clientId, priorAccountPhase)
    : priorAccountPhase;
  const before = {
    projectId: projectId,
    ClientID: clientId,
    SprintStage: priorProjectStage,
    AccountPhase: priorAccountPhase,
    AccountPhase_Mode: priorMode
  };
  let applied = false;
  let stageInvoice = { created: null, rollback: function () {} };
  return {
    entity: 'project:' + projectId,
    before: before,
    apply: function () {
      applied = true;
      projectSheet.getRange(project.rowNumber, projectStageColumn + 1).setValue(stage);
      if (priorMode === 'auto') {
        clientSheet.getRange(client.rowNumber, accountPhaseColumn + 1).setValue(nextAccountPhase);
      }
      if (typeof vala_onStageReached_ === 'function') {
        stageInvoice = vala_onStageReached_(spreadsheet, projectId, clientId, HUD_WRITE_SPRINT_STAGES.indexOf(stage));
      }
    },
    readAfter: function () {
      const currentProject = hud_findUniqueRecord_(projectSheet, 'ProjectID', projectId);
      const currentClient = hud_findUniqueRecord_(clientSheet, 'ClientID', clientId);
      return {
        projectId: projectId,
        ClientID: clientId,
        SprintStage: String(currentProject.values[projectStageColumn] || '').trim(),
        AccountPhase: String(currentClient.values[accountPhaseColumn] || '').trim(),
        AccountPhase_Mode: String(currentClient.values[accountModeColumn] || '').trim(),
        invoiceCreated: stageInvoice.created
      };
    },
    matches: function (after) {
      return after.SprintStage === stage
        && after.AccountPhase === nextAccountPhase
        && after.AccountPhase_Mode === priorMode;
    },
    rollback: function () {
      if (!applied) return;
      stageInvoice.rollback();
      projectSheet.getRange(project.rowNumber, projectStageColumn + 1).setValue(priorProjectStage);
      if (priorMode === 'auto') {
        clientSheet.getRange(client.rowNumber, accountPhaseColumn + 1).setValue(priorAccountPhase);
      }
    }
  };
}

function hud_prepareAlertMutation_(spreadsheet, payload) {
  const alertId = String(payload.alertId || payload.alertID || '').trim();
  const status = String(payload.status == null ? '' : payload.status).trim();
  if (!alertId || ['Resolved', 'Open'].indexOf(status) === -1) {
    throw createRouterError_('An alert ID and status "Resolved" or "Open" are required.', 'INVALID_REQUEST', 400);
  }

  const sheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
  const record = hud_findUniqueRecord_(sheet, 'Alert_ID', alertId);
  const statusColumn = hud_requireColumn_(record.headers, 'Action_Status');
  const dismissedColumn = hud_requireColumn_(record.headers, 'Dismissed_Status');
  const resolvedColumn = hud_requireColumn_(record.headers, 'Resolved_At');
  const before = {
    alertId: alertId,
    Action_Status: String(record.values[statusColumn] || '').trim(),
    Dismissed_Status: hud_isTrue_(record.values[dismissedColumn]),
    Resolved_At: record.values[resolvedColumn] || ''
  };
  const resolvedAt = status === 'Resolved' ? new Date().toISOString() : '';
  const dismissed = status === 'Resolved';
  let applied = false;
  return {
    entity: 'alert:' + alertId,
    before: before,
    apply: function () {
      applied = true;
      sheet.getRange(record.rowNumber, statusColumn + 1).setValue(status);
      sheet.getRange(record.rowNumber, dismissedColumn + 1).setValue(dismissed);
      sheet.getRange(record.rowNumber, resolvedColumn + 1).setValue(resolvedAt);
    },
    readAfter: function () {
      const current = hud_findUniqueRecord_(sheet, 'Alert_ID', alertId);
      return {
        alertId: alertId,
        Action_Status: String(current.values[statusColumn] || '').trim(),
        Dismissed_Status: hud_isTrue_(current.values[dismissedColumn]),
        Resolved_At: current.values[resolvedColumn] || ''
      };
    },
    matches: function (after) {
      return after.Action_Status === status
        && after.Dismissed_Status === dismissed
        && after.Resolved_At === resolvedAt;
    },
    rollback: function () {
      if (!applied) return;
      sheet.getRange(record.rowNumber, statusColumn + 1).setValue(before.Action_Status);
      sheet.getRange(record.rowNumber, dismissedColumn + 1).setValue(before.Dismissed_Status);
      sheet.getRange(record.rowNumber, resolvedColumn + 1).setValue(before.Resolved_At);
    }
  };
}

/**
 * Resolves a Police R1 contract-value finding (Plan v3.1 D2).
 * choice "finances": restore the Clients.ContractValue roll-up formula.
 * choice "clients": set the single contract row's TCV to the Clients value (a money change; the HUD
 * shows the Financial Mutation confirmation first). Refused when the client has several contract rows.
 */
function hud_prepareFindingMutation_(spreadsheet, payload) {
  const alertId = String(payload.alertId || '').trim();
  const choice = String(payload.choice || '').trim();
  const match = alertId.match(/^POL-R1-([A-Z]{3}\d{0,2})$/);
  if (!match || ['finances', 'clients'].indexOf(choice) === -1) {
    throw createRouterError_('Only Police R1 findings can be resolved here, with choice "finances" or "clients".', 'INVALID_REQUEST', 400);
  }
  const clientId = match[1];
  const clients = hud_requireSheet_(spreadsheet, 'Clients');
  const finances = hud_requireSheet_(spreadsheet, 'Finances');
  const client = hud_findUniqueRecord_(clients, 'ClientID', clientId);
  const valueColumn = hud_requireColumn_(client.headers, 'ContractValue');
  const valueCell = clients.getRange(client.rowNumber, valueColumn + 1);
  const priorFormula = valueCell.getFormula();
  const priorValue = valueCell.getValue();
  const contracts = vala_readRecords_(finances, ['InvoiceID', 'ClientID', 'ProjectID']).rows
    .filter(function (row) { return String(row.ClientID).trim() === clientId && row.MilestoneStage === VALA_CONTRACT; });
  const financeHeaders = hud_getHeaders_(finances);
  const tcvColumn = hud_requireColumn_(financeHeaders, 'TotalContractValue');
  if (choice === 'clients' && contracts.length !== 1) {
    throw createRouterError_('"Use Clients value" needs exactly one contract row; ' + clientId + ' has ' + contracts.length + '.', 'INVALID_REQUEST', 409);
  }
  const target = choice === 'clients' ? contracts[0] : null;
  const priorTcv = target ? target.TotalContractValue : null;
  const formula = vala_contractValueFormula_(client.rowNumber, {
    clientId: colLetter_(hud_requireColumn_(client.headers, 'ClientID') + 1),
    tcv: colLetter_(tcvColumn + 1),
    client: colLetter_(hud_requireColumn_(financeHeaders, 'ClientID') + 1),
    stage: colLetter_(hud_requireColumn_(financeHeaders, 'MilestoneStage') + 1)
  });
  const clientsValue = Number(priorValue || 0);
  let applied = false;
  return {
    entity: 'finding:' + alertId,
    before: { alertId: alertId, ContractValue: priorValue, ContractValueFormula: priorFormula, TotalContractValue: priorTcv },
    apply: function () {
      applied = true;
      if (target) finances.getRange(target.rowNumber, tcvColumn + 1).setValue(clientsValue);
      valueCell.setFormula(formula);
    },
    readAfter: function () {
      SpreadsheetApp.flush();
      const rollup = vala_contractRollup_(vala_readRecords_(finances, ['InvoiceID', 'ClientID', 'ProjectID']).rows)[clientId] || 0;
      return { alertId: alertId, choice: choice, ContractValue: valueCell.getValue(), ContractValueFormula: valueCell.getFormula(), rollup: rollup };
    },
    matches: function (after) {
      return after.ContractValueFormula === formula
        && vala_toCents_(after.ContractValue) === vala_toCents_(after.rollup)
        && (!target || vala_toCents_(after.rollup) === vala_toCents_(clientsValue));
    },
    rollback: function () {
      if (!applied) return;
      if (target) finances.getRange(target.rowNumber, tcvColumn + 1).setValue(priorTcv);
      if (priorFormula) valueCell.setFormula(priorFormula); else valueCell.setValue(priorValue);
    }
  };
}

function hud_enforceSprintStageGate_(spreadsheet, client, project, stage) {
  const stageIndex = HUD_WRITE_SPRINT_STAGES.indexOf(stage);
  if (stageIndex < 4) return;
  if (typeof evaluatePipelineStageGate_ !== 'function') {
    throw new Error('The server-side pipeline stage gate is unavailable.');
  }
  const clientIdColumn = hud_requireColumn_(client.headers, 'ClientID');
  const depositSheet = hud_requireSheet_(spreadsheet, 'Finances');
  const financeRows = hud_getSheetRecords_(depositSheet);
  const depositPaid = financeRows.some(function (row) {
    return String(row.ClientID || '').trim() === String(client.values[clientIdColumn] || '').trim()
      && hud_isTrue_(row.DepositPaid);
  });
  const decision = evaluatePipelineStageGate_({
    ClientID: client.values[clientIdColumn],
    DepositPaid: depositPaid,
    MSA_DocID: client.record.MSA_DocID,
    SOW_DocID: project.record.SOW_DocID
  }, stage, {}, {});
  if (!decision.allowed) {
    throw createRouterError_(decision.message, decision.code, 409, {
      missing: decision.missing || []
    });
  }
}

function hud_deriveAccountPhase_(projects, clientId, fallbackPhase) {
  const stages = projects
    .filter(function (project) { return String(project.ClientID || '').trim() === clientId; })
    .map(function (project) {
      const index = HUD_WRITE_SPRINT_STAGES.indexOf(String(project.SprintStage || '').trim());
      if (index === -1) {
        throw new Error('A project for this client has an unsupported SprintStage.');
      }
      return index;
    });
  if (stages.length === 0) {
    if (HUD_WRITE_ACCOUNT_PHASES.indexOf(fallbackPhase) === -1) {
      throw new Error('The client has no projects and its current AccountPhase is invalid.');
    }
    return fallbackPhase;
  }
  if (stages.some(function (stage) { return stage >= 5 && stage <= 7; })) return '03: Active Sprints';
  if (stages.some(function (stage) { return stage >= 2 && stage <= 4; })) return '02: Session Zero';
  if (stages.some(function (stage) { return stage <= 1; })) return '01: Intake';
  if (stages.some(function (stage) { return stage === 9; })) return '06: Archived/Sunset';
  return '04: Liftoff';
}

function hud_appendSunsetAlert_(spreadsheet, clientId) {
  const sheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
  const headers = hud_getHeaders_(sheet);
  const clientColumn = headers.indexOf('Client_ID') !== -1 ? 'Client_ID' : 'ClientID';
  const messageColumn = headers.indexOf('Prescribed_Action') !== -1 ? 'Prescribed_Action' : 'Message';
  ['Alert_ID', clientColumn, 'Department', 'Action_Status', messageColumn].forEach(function (name) {
    hud_requireColumn_(headers, name);
  });
  const alertId = 'ALT-' + Utilities.getUuid();
  const now = new Date().toISOString();
  const alert = {
    Alert_ID: alertId,
    Timestamp: now,
    Created_At: now,
    ClientID: clientId,
    Client_ID: clientId,
    Priority: 'INFO',
    Category: 'Offboarding',
    Message: 'Sunset requested',
    Action_URL: '',
    Dismissed_Status: false,
    Source_Module: 'HUD',
    Department: 'Daisy',
    Project_ID: '',
    Entity_Reference: clientId,
    Severity: 'INFO',
    Trigger_Condition: 'Client sunset requested',
    Prescribed_Action: 'Review the sunset request.',
    Due_SLA: '',
    Assigned_Lead: 'Daisy',
    Action_Status: 'Requested',
    Resolved_At: ''
  };
  sheet.appendRow(hud_objectRow_(headers, alert));
  return alertId;
}

function hud_removeAlert_(spreadsheet, alertId) {
  const sheet = hud_requireSheet_(spreadsheet, 'Alfred_Alerts');
  const record = hud_findUniqueRecord_(sheet, 'Alert_ID', alertId);
  sheet.deleteRow(record.rowNumber);
}

function hud_ensureAccountPhaseModeColumn_(spreadsheet, actor) {
  const sheet = hud_requireSheet_(spreadsheet, 'Clients');
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) throw new Error('The Clients sheet has no header row.');
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const clientIdColumn = hud_requireColumn_(headers, 'ClientID');
  const phaseColumn = hud_requireColumn_(headers, 'AccountPhase');
  let modeColumn = headers.indexOf('AccountPhase_Mode');
  if (modeColumn === -1) {
    const newModeColumn = Math.max(sheet.getLastColumn(), headers.length) + 1;
    sheet.getRange(1, newModeColumn).setValue('AccountPhase_Mode');
    modeColumn = newModeColumn - 1;
    hud_registerSchemaColumn_(spreadsheet, actor, {
      tab: 'Clients',
      column: 'AccountPhase_Mode',
      columnLetter: colLetter_(newModeColumn),
      dataType: 'enum',
      allowedValues: 'auto,manual',
      required: 'yes',
      changeType: 'Add column',
      impact: 'HUD phase override mode'
    });
  } else {
    hud_registerSchemaColumn_(spreadsheet, actor, {
      tab: 'Clients',
      column: 'AccountPhase_Mode',
      columnLetter: colLetter_(modeColumn + 1),
      dataType: 'enum',
      allowedValues: 'auto,manual',
      required: 'yes',
      changeType: 'Add column',
      impact: 'HUD phase override mode'
    });
  }

  const currentValues = sheet.getDataRange().getValues();
  const invalidRows = [];
  for (let index = 1; index < currentValues.length; index += 1) {
    const row = currentValues[index];
    if (!String(row[clientIdColumn] || '').trim()) continue;
    const mode = String(row[modeColumn] || '').trim().toLowerCase();
    if (mode && mode !== 'auto' && mode !== 'manual') invalidRows.push(index + 1);
  }
  if (invalidRows.length) {
    throw new Error('Clients.AccountPhase_Mode has unsupported values on row(s): ' + invalidRows.join(', ') + '.');
  }
  for (let index = 1; index < currentValues.length; index += 1) {
    const row = currentValues[index];
    if (!String(row[clientIdColumn] || '').trim() || String(row[modeColumn] || '').trim()) continue;
    sheet.getRange(index + 1, modeColumn + 1).setValue('auto');
  }
  return { sheet: sheet, phaseColumn: phaseColumn, modeColumn: modeColumn };
}

function hud_ensureAuditLog_(spreadsheet, actor) {
  let sheet = spreadsheet.getSheetByName('HUD_Audit_Log');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('HUD_Audit_Log');
    sheet.getRange(1, 1, 1, HUD_WRITE_AUDIT_HEADERS.length).setValues([HUD_WRITE_AUDIT_HEADERS]);
  }
  const headers = hud_getHeaders_(sheet);
  HUD_WRITE_AUDIT_HEADERS.forEach(function (header) { hud_requireColumn_(headers, header); });
  hud_onceCached_('audit-log-schema', function () {
    const definitions = {
      Timestamp: ['date', 'yes'],
      User: ['text', 'yes', 'pii'],
      Action: ['enum', 'yes'],
      Entity: ['id', 'yes'],
      Before: ['json', 'yes'],
      After: ['json', 'no'],
      Request_ID: ['id', 'yes'],
      Status: ['enum', 'yes'],
      Error: ['text', 'no']
    };
    HUD_WRITE_AUDIT_HEADERS.forEach(function (column) {
      hud_registerSchemaColumn_(spreadsheet, actor, {
        tab: 'HUD_Audit_Log',
        column: column,
        dataType: definitions[column][0],
        dataClass: definitions[column][2],
        allowedValues: column === 'Action'
          ? HUD_WRITE_ACTIONS.join(',')
          : column === 'Status' ? 'Pending,Confirmed,Failed' : '',
        required: definitions[column][1],
        changeType: 'New tab',
        impact: 'Audited HUD write history'
      }, false);
    });
    hud_registerSchemaChange_(spreadsheet, actor, {
      tab: 'HUD_Audit_Log',
      column: 'HUD_Audit_Log',
      changeType: 'New tab',
      reason: 'Add an audit ledger for authorized HUD mutations.',
      impact: 'Write confirmation and idempotency'
    });
  });
  return { sheet: sheet, headers: headers };
}

function hud_registerSchemaColumn_(spreadsheet, actor, definition, includeChange) {
  const registry = hud_ensureSchemaSheet_(spreadsheet, SCHEMA.REGISTRY_TAB, SCHEMA.REGISTRY_HEADERS);
  const registryHeaders = hud_getHeaders_(registry);
  const tabColumn = hud_requireColumn_(registryHeaders, 'Tab');
  const nameColumn = hud_requireColumn_(registryHeaders, 'Column_Name');
  const registryRows = registry.getDataRange().getValues();
  const exists = registryRows.slice(1).some(function (row) {
    return String(row[tabColumn] || '').trim() === definition.tab
      && String(row[nameColumn] || '').trim() === definition.column;
  });
  if (!exists) {
    const targetSheet = spreadsheet.getSheetByName(definition.tab);
    const targetHeaders = targetSheet ? hud_getHeaders_(targetSheet) : [];
    const targetColumnNumber = targetHeaders.indexOf(definition.column) + 1;
    const record = {
      Registry_ID: 'REG-' + definition.tab.replace(/[^A-Za-z0-9]+/g, '-') + '-' + definition.column,
      Database: 'Master Control',
      Tab: definition.tab,
      Column_Letter: definition.columnLetter
        || (targetColumnNumber > 0 ? colLetter_(targetColumnNumber) : ''),
      Column_Name: definition.column,
      Data_Type: definition.dataType,
      Allowed_Values: definition.allowedValues,
      Data_Class: definition.dataClass || 'internal',
      Owner_Persona: 'Alfred',
      Required: definition.required,
      Schema_Version: HUD_SCHEMA_VERSION,
      Last_Verified: new Date().toISOString(),
      Notes: definition.impact
    };
    registry.appendRow(hud_objectRow_(registryHeaders, record));
  }
  if (includeChange !== false) {
    hud_registerSchemaChange_(spreadsheet, actor, {
      tab: definition.tab,
      column: definition.column,
      changeType: definition.changeType,
      reason: definition.reason || (definition.tab === 'Clients'
        ? 'Add the approved manual/automatic phase mode for HUD phase changes.'
        : definition.tab === 'Finances'
          ? 'Add the Plan v3.1 finance-model column ' + definition.column + '.'
          : 'Register the additive HUD audit-log field.'),
      impact: definition.impact
    });
  }
}

function hud_registerSchemaChange_(spreadsheet, actor, definition) {
  const log = hud_ensureSchemaSheet_(spreadsheet, SCHEMA.LOG_TAB, SCHEMA.LOG_HEADERS);
  const headers = hud_getHeaders_(log);
  const targetTabColumn = hud_requireColumn_(headers, 'Target_Tab');
  const targetColumnColumn = hud_requireColumn_(headers, 'Target_Column');
  const typeColumn = hud_requireColumn_(headers, 'Change_Type');
  const statusColumn = hud_requireColumn_(headers, 'Status');
  const rows = log.getDataRange().getValues();
  const alreadyLogged = rows.slice(1).some(function (row) {
    return String(row[targetTabColumn] || '').trim() === definition.tab
      && String(row[targetColumnColumn] || '').trim() === definition.column
      && String(row[typeColumn] || '').trim() === definition.changeType
      && ['Approved', 'Applied', 'Verified'].indexOf(String(row[statusColumn] || '').trim()) !== -1;
  });
  if (alreadyLogged) return;
  log.appendRow(hud_objectRow_(headers, {
    Change_ID: nextChangeId_(log),
    Logged_At: new Date().toISOString(),
    Requested_By: actor,
    Target_Database: 'Master Control',
    Target_Tab: definition.tab,
    Target_Column: definition.column,
    Change_Type: definition.changeType,
    Reason: definition.reason,
    Impact: definition.impact,
    Severity: 'INFO',
    Status: 'Approved',
    Approved_By: actor,
    Applied_Version: '',
    Police_Check_Result: '',
    Rollback_Note: 'Restore the prior HUD code and remove the additive field if rollback is required.',
    Source: 'manual'
  }));
}

function hud_ensureSchemaSheet_(spreadsheet, name, expectedHeaders) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }
  const headers = hud_getHeaders_(sheet);
  expectedHeaders.forEach(function (header) { hud_requireColumn_(headers, header); });
  return sheet;
}

function hud_hasRequestId_(sheet, headers, requestId) {
  const requestColumn = hud_requireColumn_(headers, 'Request_ID');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  // Only the Request_ID column (the full log read grew with every write).
  return sheet.getRange(2, requestColumn + 1, lastRow - 1, 1).getValues().some(function (row) {
    return String(row[0] || '').trim() === requestId;
  });
}

function hud_updateAuditLog_(sheet, headers, rowNumber, updates) {
  Object.keys(updates).forEach(function (name) {
    const column = hud_requireColumn_(headers, name);
    sheet.getRange(rowNumber, column + 1).setValue(updates[name]);
  });
}

function hud_getSheetRecords_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) throw new Error(sheet.getName() + ' has no header row.');
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (value) { return value !== '' && value !== null; }); })
    .map(function (row) {
      const record = {};
      headers.forEach(function (header, index) {
        if (header) record[header] = row[index];
      });
      return record;
    });
}

function hud_findUniqueRecord_(sheet, keyName, keyValue) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw createRouterError_(keyName + ' record was not found.', 'RECORD_NOT_FOUND', 404);
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const keyColumn = hud_requireColumn_(headers, keyName);
  const matches = values.slice(1)
    .map(function (row, index) { return { row: row, rowNumber: index + 2 }; })
    .filter(function (entry) { return String(entry.row[keyColumn] || '').trim() === keyValue; });
  if (matches.length === 0) {
    throw createRouterError_(keyName + ' record was not found.', 'RECORD_NOT_FOUND', 404);
  }
  if (matches.length > 1) {
    throw createRouterError_('Master Control contains duplicate ' + keyName + ' records.', 'DUPLICATE_RECORD', 409);
  }
  const match = matches[0];
  const record = {};
  headers.forEach(function (header, index) { if (header) record[header] = match.row[index]; });
  return {
    headers: headers,
    values: match.row,
    rowNumber: match.rowNumber,
    record: record
  };
}

function hud_requireSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('The ' + name + ' sheet is unavailable.');
  return sheet;
}

function hud_getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error(sheet.getName() + ' has no header row.');
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (value) { return String(value || '').trim(); });
}

function hud_requireColumn_(headers, name) {
  const index = headers.indexOf(name);
  if (index === -1) throw new Error('Master Control is missing the required ' + name + ' column.');
  return index;
}

function hud_objectRow_(headers, record) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  });
}

function hud_isTrue_(value) {
  return value === true || ['true', 'yes', 'y', '1'].indexOf(String(value || '').trim().toLowerCase()) !== -1;
}
