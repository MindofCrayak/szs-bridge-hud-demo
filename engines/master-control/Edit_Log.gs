/**
 * Edit_Log (Master Plan v3.1 section 3, Phase D3) and the Phase D setup runner.
 * An installable on-edit trigger records hand edits to money, phase, stage and ID fields,
 * then re-runs the finance recompute and Police reconciliation so mismatches appear right away.
 */

var EDIT_LOG_TAB = 'Edit_Log';
var EDIT_LOG_HEADERS = ['Timestamp', 'User', 'Tab', 'Cell', 'Column', 'Row_Key', 'Old_Value', 'New_Value'];
var EDIT_LOG_WATCHED = {
  Clients: ['ClientID', 'AccountPhase', 'AccountPhase_Mode', 'ContractValue', 'DepositPaid'],
  Projects: ['ProjectID', 'ClientID', 'SprintStage'],
  Finances: ['InvoiceID', 'ClientID', 'ProjectID', 'MilestoneStage', 'TotalContractValue', 'DepositAmount', 'InvoiceAmount',
    'DepositPaid', 'InvoiceStatus', 'Schedule_Deposit', 'Schedule_MidFlight', 'Schedule_Final', 'AddendumRef']
};
var EDIT_LOG_KEY = { Clients: 'ClientID', Projects: 'ProjectID', Finances: 'InvoiceID' };
var EDIT_LOG_GUARD = 'HUD_EDIT_LOG_BUSY';

/**
 * 2026-11-06 cleanup: typed-input clean-up moved here from the old DatabaseGuardrails.js simple onEdit, which
 * matched fixed column numbers and took the script lock on every edit. Now by header name and without a lock.
 */
var EDIT_NORMALIZE = {
  Clients: { ClientID: 'id', ContactEmail: 'email', GoogleGroupEmail: 'email' },
  Projects: { ProjectID: 'id', ClientID: 'id' },
  Finances: { InvoiceID: 'id', ProjectID: 'id', ClientID: 'id' }
};

/** Pure: the cleaned value for one typed cell, or null when nothing changes. */
function editLog_normalizedValue_(tab, header, value) {
  const kind = EDIT_NORMALIZE[tab] && EDIT_NORMALIZE[tab][header];
  if (!kind || value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  const clean = kind === 'id' ? text.toUpperCase().replace(/[^A-Z0-9-]/g, '') : text.toLowerCase();
  return clean === String(value) ? null : clean;
}

/** Pure: which watched cells an edit touched. Returns [{ row, column, name }]. */
function editLog_watchedCells_(tab, headers, startRow, startColumn, numRows, numColumns) {
  const watched = EDIT_LOG_WATCHED[tab];
  if (!watched) return [];
  const out = [];
  for (let r = 0; r < numRows; r += 1) {
    const row = startRow + r;
    if (row < 2) continue; // header row edits are schema changes, not data edits
    for (let c = 0; c < numColumns; c += 1) {
      const name = headers[startColumn + c - 1];
      if (watched.indexOf(name) !== -1) out.push({ row: row, column: startColumn + c, name: name });
    }
  }
  return out;
}

/** Installable on-edit handler (installed by installPhaseDTriggers). */
function hud_onEditInstalled(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const tab = sheet.getName();
  if (!EDIT_LOG_WATCHED[tab]) return; // includes Edit_Log itself: never log our own writes
  const cache = CacheService.getScriptCache();
  if (cache.get(EDIT_LOG_GUARD)) return; // loop guard while our handler is writing
  const headers = hud_getHeaders_(sheet);
  const single = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
  if (single && e.range.getRow() > 1) {
    const cleaned = editLog_normalizedValue_(tab, headers[e.range.getColumn() - 1], e.value);
    if (cleaned !== null) e.range.setValue(cleaned);
  }
  const cells = editLog_watchedCells_(tab, headers, e.range.getRow(), e.range.getColumn(), e.range.getNumRows(), e.range.getNumColumns());
  if (!cells.length) return;
  // No script lock: appendRow is atomic, and Police runs as the debounced background job (as after HUD saves), so a
  // hand edit never makes a HUD save wait.
  cache.put(EDIT_LOG_GUARD, '1', 60);
  try {
    const spreadsheet = sheet.getParent();
    const log = editLog_ensureTab_(spreadsheet);
    const user = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || 'unknown';
    const oneCell = cells.length === 1 && single;
    const keyColumn = headers.indexOf(EDIT_LOG_KEY[tab]);
    cells.forEach(function (target) {
      const key = keyColumn === -1 ? '' : sheet.getRange(target.row, keyColumn + 1).getValue();
      log.appendRow([
        new Date().toISOString(), user, tab, colLetter_(target.column) + target.row, target.name, String(key || ''),
        oneCell && e.oldValue !== undefined ? e.oldValue : '(multi-cell edit)',
        oneCell && e.value !== undefined ? e.value : sheet.getRange(target.row, target.column).getValue()
      ]);
    });
    hud_schedulePolice_();
  } catch (error) {
    console.error('Edit_Log handler failed:', error && error.message);
  } finally {
    cache.remove(EDIT_LOG_GUARD);
  }
}

function editLog_ensureTab_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(EDIT_LOG_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(EDIT_LOG_TAB);
    sheet.getRange(1, 1, 1, EDIT_LOG_HEADERS.length).setValues([EDIT_LOG_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Scheduled Police audit (every 15 minutes): the existing sync audit plus the R1-R10 reconciliation. */
function police_scheduledAudit() {
  const spreadsheet = hud_assertWorkingCopy_();
  // The legacy sync audit reads the Oracle/MCC databases; it runs outside the script lock so HUD writes do not wait
  // on it (owner 2026-11-05: 30-55 s saves). Only the Master Control reconciliation (ledger + alerts) is locked.
  try { runSystemPoliceAuditBody_(); } catch (error) { console.error('Sync audit failed:', error && error.message); }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    police_runReconciliation_(spreadsheet);
  } finally {
    lock.releaseLock();
  }
}

/** Installs (or replaces) the two Phase D triggers. Idempotent. */
function installPhaseDTriggers() {
  const spreadsheet = hud_assertWorkingCopy_();
  const handlers = ['hud_onEditInstalled', 'police_scheduledAudit'];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('hud_onEditInstalled').forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger('police_scheduledAudit').timeBased().everyMinutes(15).create();
  return ScriptApp.getProjectTriggers().map(function (trigger) {
    return { handler: trigger.getHandlerFunction(), event: String(trigger.getEventType()) };
  });
}

/** Owner entry point for Phase D: columns, ledger recompute, roll-up formulas, Edit_Log tab, triggers, first reconciliation. */
function runPhaseDSetup() {
  const report = {};
  try {
    const spreadsheet = hud_assertWorkingCopy_();
    const actor = getAuthorizedMasterControlUser_();
    withLock_(function () {
      report.columnsAdded = vala_ensureColumns_(spreadsheet, actor);
      SpreadsheetApp.flush();
      report.ledgerUpdates = vala_recomputeFinances_(spreadsheet);
      SpreadsheetApp.flush();
      report.contractValueFormulas = vala_installContractValueFormulas_(spreadsheet);
      editLog_ensureTab_(spreadsheet);
      hud_registerSchemaColumn_(spreadsheet, actor, {
        tab: EDIT_LOG_TAB, column: 'Timestamp', dataType: 'date', allowedValues: '*', required: 'yes',
        changeType: 'New tab', impact: 'Edit_Log: hand edits to money, phase, stage and ID fields.',
        reason: 'Add the Edit_Log tab fed by an installable on-edit trigger (Plan v3.1 D3).'
      });
      SpreadsheetApp.flush();
      report.reconciliation = police_runReconciliation_(spreadsheet);
    });
    report.triggers = installPhaseDTriggers();
    hud_logRepair_(spreadsheet, actor, {
      action: 'runPhaseDSetup', entity: 'Finances,Clients,Alfred_Alerts,Edit_Log',
      before: {}, after: { columnsAdded: report.columnsAdded, findings: report.reconciliation.findings.length }
    });
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = String(error && error.message || error);
  }
  const text = JSON.stringify(report, null, 1);
  for (let i = 0; i < text.length; i += 7000) console.log(text.slice(i, i + 7000));
  return report;
}
