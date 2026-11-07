/**
 * SZS Tools menu (owner 2026-11-06 cleanup). Every maintenance tool in one place in the spreadsheet menu bar, so
 * nothing has to be picked from the Apps Script editor's function dropdown. Each item runs the existing tool and
 * shows its report in a window; tools that change data ask first (Yes / No).
 *
 * Reload the Master Control tab after a deploy to see the menu.
 */
var TOOLS_MENU_ITEMS = [
  { label: 'Check: HUD save path (read-only)', fn: 'tools_diagnoseSavePath' },
  { label: 'Check: recent HUD saves (read-only)', fn: 'tools_recentSaves' },
  { label: 'Check: schema vs registry (read-only)', fn: 'tools_schemaCheck' },
  { label: 'Check: service catalog vs templates (read-only)', fn: 'tools_catalogCheck' },
  { label: 'Check: linked MCC / Oracle databases (read-only)', fn: 'tools_linkedDatabases' },
  null,
  { label: 'Run Police reconciliation now', fn: 'tools_policeNow' },
  { label: 'Sync Command Decks now', fn: 'tools_syncDecks' },
  { label: 'Fill remaining SOW placeholders', fn: 'tools_refillSows' },
  { label: 'Add registry rows for new columns', fn: 'tools_snapshotSchema' },
  null,
  { label: 'Project setup: preview (read-only)', fn: 'tools_projectSetupPreview' },
  { label: 'Project setup: run (creates missing assets)…', fn: 'tools_projectSetupRun' },
  { label: 'Project automation: preview (read-only)', fn: 'tools_automationPreview' },
  { label: 'Reinstall background triggers…', fn: 'tools_reinstallTriggers' }
];
var TOOLS_TEST_DATA_ITEMS = [
  { label: 'Seed [TEST] data…', fn: 'tools_seedTestData' },
  { label: 'Provision Drive folders for [TEST] clients…', fn: 'tools_provisionTestDrive' },
  { label: 'Purge [TEST] data: preview (read-only)', fn: 'tools_purgePreview' },
  { label: 'Purge [TEST] data…', fn: 'tools_purgeTestData' }
];

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('SZS Tools');
  TOOLS_MENU_ITEMS.forEach(function (item) {
    if (item) menu.addItem(item.label, item.fn); else menu.addSeparator();
  });
  const sub = ui.createMenu('Test data');
  TOOLS_TEST_DATA_ITEMS.forEach(function (item) { sub.addItem(item.label, item.fn); });
  menu.addSeparator().addSubMenu(sub).addToUi();
}

/** Pure: a report as readable text, trimmed so the window stays usable. */
function tools_reportText_(report) {
  const text = typeof report === 'string' ? report : JSON.stringify(report, null, 1);
  return text.length > 60000 ? text.slice(0, 60000) + '\n… (trimmed; the full report is in the Execution log)' : text;
}

function tools_escape_(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tools_show_(title, run) {
  let body;
  try {
    body = tools_reportText_(run());
  } catch (error) {
    body = 'FAILED: ' + String(error && error.message || error);
  }
  const html = HtmlService.createHtmlOutput(
    '<pre style="font:12px/1.4 Consolas,monospace;white-space:pre-wrap;margin:0">' + tools_escape_(body) + '</pre>'
  ).setWidth(760).setHeight(560);
  SpreadsheetApp.getUi().showModelessDialog(html, title);
}

function tools_confirm_(question) {
  const ui = SpreadsheetApp.getUi();
  return ui.alert('SZS Tools', question, ui.ButtonSet.YES_NO) === ui.Button.YES;
}

function tools_diagnoseSavePath() { tools_show_('HUD save path', diagnoseHudWritePath); }
function tools_recentSaves() { tools_show_('Recent HUD saves', function () { return inspectHudAuditLog().join('\n') || 'No saves yet.'; }); }
function tools_schemaCheck() { tools_show_('Schema vs registry', runSchemaConformanceCheck); }
function tools_catalogCheck() { tools_show_('Service catalog vs templates', runCatalogCheck); }
function tools_linkedDatabases() { tools_show_('Linked MCC / Oracle databases', previewLinkedDatabases); }
function tools_syncDecks() { tools_show_('Command Deck sync', runDashboardSyncNow); }
function tools_refillSows() { tools_show_('SOW placeholders', refillProjectSows); }
function tools_snapshotSchema() { tools_show_('Registry rows for new columns', snapshotLiveSchemaToRegistry); }
function tools_projectSetupPreview() { tools_show_('Project setup preview', runPhaseESetupDryRun); }
function tools_automationPreview() { tools_show_('Project automation preview', runPhaseEAutomationDryRun); }
function tools_purgePreview() { tools_show_('Purge [TEST] data preview', purgeTestDataDryRun); }

function tools_policeNow() {
  tools_show_('Police reconciliation', function () {
    const spreadsheet = hud_assertWorkingCopy_();
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const result = police_runReconciliation_(spreadsheet);
      return { findings: (result.findings || []).length, detail: result };
    } finally {
      lock.releaseLock();
    }
  });
}

function tools_projectSetupRun() {
  if (!tools_confirm_('Create any missing project assets (Groups, Docs, Chat spaces, Tasks lists) for every project? Existing assets are kept.')) return;
  tools_show_('Project setup', runPhaseESetup);
}

function tools_reinstallTriggers() {
  if (!tools_confirm_('Remove and reinstall the on-edit log and the 15-minute Police audit triggers?')) return;
  tools_show_('Background triggers', installPhaseDTriggers);
}

function tools_seedTestData() {
  if (!tools_confirm_('Add the [TEST] clients, projects and invoices to the Working Copy?')) return;
  tools_show_('Seed [TEST] data', seedTestData);
}

function tools_purgeTestData() {
  if (!tools_confirm_('Delete everything the [TEST] seed created (rows, Drive files, Groups, Chat spaces, Tasks lists)? This cannot be undone.')) return;
  tools_show_('Purge [TEST] data', purgeTestData);
}

function tools_provisionTestDrive() {
  if (!tools_confirm_('Create the Drive folders and documents for the [TEST] clients (PAC, SEN, HLW)?')) return;
  tools_show_('Provision [TEST] Drive', runPhaseCDriveProvisioning);
}
