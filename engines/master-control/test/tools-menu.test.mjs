import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Load every deployable file (same set wc-clasp.sh stages), so a menu item can never point at a deleted tool.
const context = vm.createContext({ console });
const root = new URL('../', import.meta.url);
const files = [
  ...readdirSync(root).filter((f) => /\.(gs|js)$/.test(f)),
  ...readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.gs')).map((f) => 'src/' + f),
].sort();
for (const file of files) vm.runInContext(readFileSync(new URL(file, root), 'utf8'), context);

test('every SZS Tools menu item calls a function that exists, and the tools they wrap exist', () => {
  const items = [...context.TOOLS_MENU_ITEMS, ...context.TOOLS_TEST_DATA_ITEMS].filter(Boolean);
  assert.ok(items.length >= 15);
  for (const item of items) assert.equal(typeof context[item.fn], 'function', item.fn);
  for (const tool of ['diagnoseHudWritePath', 'inspectHudAuditLog', 'runSchemaConformanceCheck', 'runCatalogCheck', 'previewLinkedDatabases',
    'runDashboardSyncNow', 'refillProjectSows', 'snapshotLiveSchemaToRegistry', 'runPhaseESetupDryRun', 'runPhaseESetup',
    'installPhaseDTriggers', 'seedTestData', 'purgeTestDataDryRun', 'purgeTestData', 'police_runReconciliation_']) {
    assert.equal(typeof context[tool], 'function', tool);
  }
});

test('onOpen builds the menu with a Test data submenu', () => {
  const added = [];
  const menu = (name) => ({ name, items: [], addItem(label, fn) { this.items.push([label, fn]); return this; }, addSeparator() { return this; }, addSubMenu(sub) { this.items.push(['sub', sub.name]); return this; }, addToUi() { added.push(this); } });
  context.SpreadsheetApp = { getUi: () => ({ createMenu: menu }) };
  context.onOpen();
  assert.equal(added.length, 1);
  assert.equal(added[0].name, 'SZS Tools');
  assert.ok(added[0].items.some(([label, fn]) => label === 'sub' && fn === 'Test data'));
});

test('the old simple onEdit, wipe and repair runners are gone; the Working Copy guard is still there', () => {
  for (const gone of ['applyDatabaseGuardrails', 'syncSelectedClientDownstream', 'runPhaseCWipe', 'runPhaseBRepairsAndSelfTest', 'updateKanban', 'getHudState', 'doGet']) {
    assert.equal(typeof context[gone], 'undefined', gone);
  }
  assert.equal(typeof context.onEdit, 'undefined', 'no simple onEdit: the installed hud_onEditInstalled is the only edit handler');
  assert.equal(typeof context.hud_assertWorkingCopy_, 'function');
});

test('report text is trimmed for the window', () => {
  assert.equal(context.tools_reportText_('ok'), 'ok');
  assert.match(context.tools_reportText_('x'.repeat(70000)), /trimmed/);
});
