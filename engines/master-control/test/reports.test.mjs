import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../HUD_Writes.gs', '../HUD_Seed.gs', '../Reports.gs', '../src/Master_Control_Auth.gs', '../src/Drive_Provisioning.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = (value) => JSON.parse(JSON.stringify(value));

const records = {
  Finances: { InvoiceID: 'INV-PAC-26-002', ProjectID: 'PAC-01', ClientID: 'PAC', Amount: 4500, Status: 'Unpaid' },
  Projects: { ProjectID: 'PAC-01', ClientID: 'PAC', ProjectName: '[TEST] Initial Project Build' },
  Clients: { ClientID: 'PAC', DriveFolderUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv' },
};

function fakeDrive() {
  const files = [];
  const folder = {
    getFilesByName: (name) => { const hits = files.filter((f) => f.name === name && !f.trashed); let i = 0; return { hasNext: () => i < hits.length, next: () => hits[i++] }; },
  };
  context.DriveApp = {
    getFolderById: (id) => { assert.equal(id, '1AbCdEfGhIjKlMnOpQrStUv'); return folder; },
    getFileById: (id) => ({ makeCopy: (name) => {
      const file = { id: 'copy-' + files.length, name, template: id, trashed: false, getId() { return this.id; }, getName() { return this.name; }, getUrl() { return 'https://docs/' + this.id; }, setTrashed(v) { this.trashed = v; } };
      files.push(file);
      return file;
    } }),
  };
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => '' }) };
  // A template sheet as a map of cells: {{tags}} get replaced by the fill step.
  const cells = new Map([['A1', '{{Invoice #}}'], ['A2', '{{Client Name}}'], ['A3', '{{Task 1 Rate}}'], ['A4', '{{Task 2}}']]);
  const sheet = {
    createTextFinder: (text) => ({
      replaceAllWith: (value) => { for (const [k, v] of cells) if (String(v).includes(text)) cells.set(k, String(v).split(text).join(value)); },
      findNext: () => {
        const hit = [...cells.entries()].find(([, v]) => String(v).includes(text));
        return hit ? { setValue: (value) => cells.set(hit[0], value), clearContent: () => cells.set(hit[0], '') } : null;
      },
    }),
  };
  context.SpreadsheetApp = { openById: () => ({ getSheets: () => [sheet] }), flush: () => {} };
  files.cells = cells;
  return files;
}

test('report actions are allowed audited writes', () => {
  assert.ok(context.HUD_WRITE_ACTIONS.includes('draftInvoice'));
  assert.ok(context.HUD_WRITE_ACTIONS.includes('requestOsintSweep'));
});

test('invoice draft: standard name, copy of the invoice template into the client folder, read-back, rollback, no duplicates', () => {
  context.hud_requireSheet_ = (_s, name) => name;
  context.hud_findUniqueRecord_ = (sheet) => ({ record: records[sheet] });
  const files = fakeDrive();
  const m = context.hud_prepareInvoiceDraftMutation_({}, { invoiceId: 'INV-PAC-26-002' });
  assert.equal(m.before.name, 'PAC - [TEST] Initial Project Build - Invoice INV-PAC-26-002');
  m.apply();
  const after = m.readAfter();
  assert.equal(m.matches(after), true);
  assert.equal(files[0].template, context.HUD_PROVISIONING_DEFAULTS.INVOICE_TEMPLATE_ID);
  assert.equal(after.filled, true, 'the copy is filled from the Finances row');
  assert.equal(files.cells.get('A1'), 'INV-PAC-26-002');
  assert.equal(files.cells.get('A3'), 4500);
  assert.equal(files.cells.get('A4'), '');
  assert.throws(() => context.hud_prepareInvoiceDraftMutation_({}, { invoiceId: 'INV-PAC-26-002' }), /already exists/);
  m.rollback();
  assert.equal(files[0].trashed, true);
  assert.throws(() => context.hud_prepareInvoiceDraftMutation_({}, { invoiceId: '' }), /invoice ID is required/);
});

test('folder ID parsing and the open-sweep guard', () => {
  assert.equal(context.report_folderId_('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv?usp=x'), '1AbCdEfGhIjKlMnOpQrStUv');
  assert.equal(context.report_folderId_('not a folder'), '');
  const open = { Client_ID: 'PAC', Department: 'Oracle', Action_Status: 'Requested', Dismissed_Status: false };
  assert.equal(context.report_hasOpenSweep_([open], 'PAC'), true);
  assert.equal(context.report_hasOpenSweep_([{ ...open, Action_Status: 'Resolved' }], 'PAC'), false);
  assert.equal(context.report_hasOpenSweep_([{ ...open, Department: 'Daisy' }], 'PAC'), false);
  assert.equal(context.report_hasOpenSweep_([open], 'SEN'), false);
});

test('OSINT sweep only appends an Oracle Requested alert and confirms it on read-back', () => {
  const rows = [];
  const headers = ['Alert_ID', 'Client_ID', 'Department', 'Action_Status', 'Message', 'Dismissed_Status'];
  context.Utilities = { getUuid: () => 'u1' };
  context.hud_findUniqueRecord_ = (sheet, key, value) => {
    if (sheet === 'Clients') return { record: { ClientID: 'PAC' } };
    const row = rows.find((r) => r[0] === value);
    return { record: Object.fromEntries(headers.map((h, i) => [h, row[i]])), rowNumber: 2 };
  };
  context.hud_requireSheet_ = (_s, name) => (name === 'Alfred_Alerts' ? { appendRow: (row) => rows.push(row) } : name);
  context.hud_getHeaders_ = () => headers;
  context.hud_getSheetRecords_ = () => [];
  const m = context.hud_prepareOsintSweepMutation_({}, { clientId: 'PAC' });
  m.apply();
  const after = m.readAfter();
  assert.deepEqual(plain(after), { alertId: 'ALT-u1', clientId: 'PAC', Department: 'Oracle', Action_Status: 'Requested' });
  assert.equal(m.matches(after), true);
  assert.equal(rows.length, 1);
});

test('audit digest: newest first, compact, errors only when present', async () => {
  const diag = vm.createContext({ console });
  vm.runInContext(readFileSync(new URL('../HUD_Diagnostics.gs', import.meta.url), 'utf8'), diag);
  const values = [
    ['Timestamp', 'User', 'Action', 'Entity', 'Before', 'After', 'Request_ID', 'Status', 'Error'],
    ['2026-11-05T10:00:00.000Z', 'u', 'setAccountPhase', 'client:PAC', '{"AccountPhase":"02"}', '{"AccountPhase":"03"}', 'r1', 'Confirmed', ''],
    ['2026-11-05T11:00:00.000Z', 'u', 'resolveAlert', 'alert:A', '{}', '', 'r2', 'Failed', 'boom'],
  ];
  const rows = [...diag.diag_auditDigest_(values, 40)];
  assert.equal(rows.length, 2);
  assert.equal(rows[0], '2026-11-05T11:00:00 | resolveAlert | alert:A | Failed | {} ->  | boom');
  assert.equal(rows[1], '2026-11-05T10:00:00 | setAccountPhase | client:PAC | Confirmed | {"AccountPhase":"02"} -> {"AccountPhase":"03"}');
});

test('audit digest prints recorded save timings as their own field', async () => {
  const diag = vm.createContext({ console });
  vm.runInContext(readFileSync(new URL('../HUD_Diagnostics.gs', import.meta.url), 'utf8'), diag);
  const timings = { lockMs: 20000, auditSetupMs: 20100, prepareMs: 21000, applyMs: 21500, readBackMs: 21600, auditConfirmMs: 21800, policeLedgerMs: 1000, policeReadMs: 500, policeAlertsMs: 2000, totalMs: 25300 };
  const values = [
    ['Timestamp', 'Action', 'Entity', 'Before', 'After', 'Status', 'Error'],
    ['2026-11-05T12:00:00.000Z', 'setAccountPhase', 'client:ZES', '{}', JSON.stringify({ AccountPhase: '02', _timings: timings }), 'Confirmed', ''],
  ];
  const [row] = [...diag.diag_auditDigest_(values, 5)];
  assert.match(row, /\{"AccountPhase":"02"\} \| TIMINGS total 25\.3s, lock wait 20\.0s, audit setup 0\.1s, prepare 0\.9s, apply 0\.5s, police 3\.5s \(ledger 1\.0s, read 0\.5s, alerts 2\.0s\)$/);
});

test('Police after a save is one debounced background trigger, not part of the save', () => {
  const store = new Map();
  const triggers = [];
  context.CacheService = { getScriptCache: () => ({ get: (k) => store.get(k) ?? null, put: (k, v) => store.set(k, v), remove: (k) => store.delete(k) }) };
  const builder = { timeBased: () => builder, after: (ms) => { builder.ms = ms; return builder; }, create: () => { triggers.push({ getHandlerFunction: () => builder.handler }); } };
  context.ScriptApp = { getProjectTriggers: () => triggers, newTrigger: (handler) => { builder.handler = handler; return builder; }, deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1) };
  assert.equal(context.hud_schedulePolice_(), 'scheduled');
  assert.equal(context.hud_schedulePolice_(), 'already pending');
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].getHandlerFunction(), 'police_afterWrite');
  assert.equal(context.hud_needsPolice_('setAccountPhase'), true);
  assert.equal(context.hud_needsPolice_('createTask'), false);
});

test('invoice fields: client, project, milestone, amount from the Finances row; unused task lines cleared', () => {
  const fields = context.report_invoiceFields_(
    { InvoiceID: 'INV-PAC-26-002', MilestoneStage: 'Mid-Flight (1/3)', InvoiceAmount: 4500 },
    { ProjectID: 'PAC-01', ProjectName: '[TEST] Initial Project Build' },
    { First_Name: 'Pat', Last_Name: 'Ace', Company_Name: '[TEST] Prime Auto Collision' },
    new Date(2026, 10, 5),
  );
  assert.equal(fields.text['{{Invoice #}}'], 'INV-PAC-26-002');
  assert.equal(fields.text['{{Client Name}}'], 'Pat Ace');
  assert.equal(fields.text['{{Due Date}}'], '2026-11-12');
  assert.equal(fields.text['{{Task 1}}'], 'Mid-Flight (1/3) - [TEST] Initial Project Build (PAC-01)');
  assert.equal(fields.numbers['{{Task 1 Rate}}'], 4500);
  assert.ok(fields.clear.includes('{{Task 3 Rate}}'));
});

test('stage saves into 02-08 queue background project automation; the alert summarises created assets and failures', () => {
  assert.equal(context.dolores_shouldAutomate_('01: Vibecheck'), false);
  assert.equal(context.dolores_shouldAutomate_('02: Contract & Inception'), true);
  assert.equal(context.dolores_shouldAutomate_('08: Liftoff & Handover'), true);
  assert.equal(context.dolores_shouldAutomate_('09: Sunset / Retainer'), false);
  assert.equal(context.dolores_automationSummary_({ projectId: 'ZES-01', actions: ['group: exists', 'docs: created Brief and Outline'], errors: [] }),
    'ZES-01 project automation. Created: docs');
  assert.equal(context.dolores_automationSummary_({ projectId: 'ZES-01', actions: ['group: exists'], errors: [] }), '');
  assert.match(context.dolores_automationSummary_({ projectId: 'ZES-01', actions: [], errors: ['chat: denied'] }), /Failed: chat: denied/);
  const props = new Map();
  const triggers = [];
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) };
  const builder = { timeBased: () => builder, after: () => builder, create: () => triggers.push({ getHandlerFunction: () => 'dolores_afterStageChange' }) };
  context.ScriptApp = { getProjectTriggers: () => triggers, newTrigger: () => builder };
  context.hud_scheduleProjectAutomation_('ZES-01');
  context.hud_scheduleProjectAutomation_('ZES-01');
  context.hud_scheduleProjectAutomation_('PAC-02');
  assert.deepEqual(JSON.parse(props.get('dolores-queue')), ['ZES-01', 'PAC-02']);
  assert.equal(triggers.length, 1);
});

test('automation summary also reports steps that are waiting on missing information', () => {
  assert.equal(context.dolores_automationSummary_({ projectId: 'ZES-01', actions: ['group: exists x; added pat@x', 'tasks: not ready (missing Project_Brief_DocID)'], errors: [] }),
    'ZES-01 project automation. Created: group. Waiting: tasks: not ready (missing Project_Brief_DocID)');
});

test('SOW refill values: overview, services from the project tabs, start = kickoff, end = kickoff + 45 days', () => {
  vm.runInContext(readFileSync(new URL('../Project_Automation.gs', import.meta.url), 'utf8'), context);
  context.Utilities = { ...context.Utilities, formatDate: (d) => d.toISOString().slice(0, 10) };
  const values = context.report_sowValues_(
    { ProjectID: 'SEN-01', ProjectName: '[TEST] Solar Lead Engine', Kickoff_Date: new Date('2026-11-01T00:00:00Z') },
    ['Project_Lifecycle_Base', 'DNS_Security_Protocols', 'Offboarding_Sunset_Archive'], 'UTC');
  assert.equal(values['${Project Overview}'], 'Solar Lead Engine (SEN-01)');
  assert.equal(values['${Project Services}'], 'DNS Security Protocols');
  assert.equal(values['${Project Start Date}'], '2026-11-01');
  assert.equal(values['${Project End Date}'], '2026-12-16');
  assert.equal(context.report_sowValues_({ ProjectID: 'X-01', ProjectName: 'X' }, ['Project_Lifecycle_Base'], 'UTC')['${Project Start Date}'], '');
});

test('setBlocker: several blockers per client; remove one by alert ID; clear all; rollback restores', () => {
  assert.ok(context.HUD_WRITE_ACTIONS.includes('setBlocker'));
  const clientRow = ['PAC', ''];
  const clientHeaders = ['ClientID', 'ActiveRoadblock'];
  const alertHeaders = ['Alert_ID', 'Client_ID', 'Category', 'Action_Status', 'Dismissed_Status', 'Resolved_At', 'Message'];
  const alerts = [];
  const sheets = {
    Clients: { getRange: (_r, c) => ({ setValue: (v) => { clientRow[c - 1] = v; } }) },
    Alfred_Alerts: {
      appendRow: (row) => alerts.push(row),
      getDataRange: () => ({ getValues: () => [alertHeaders, ...alerts.map((r) => [...r])] }),
      getRange: (r, c) => ({ setValue: (v) => { alerts[r - 2][c - 1] = v; } }),
    },
  };
  let uuid = 0;
  context.Utilities = { getUuid: () => `b${++uuid}` };
  context.hud_requireSheet_ = (_s, name) => sheets[name];
  context.hud_getHeaders_ = () => alertHeaders;
  context.hud_removeAlert_ = (_s, id) => { alerts.splice(alerts.findIndex((r) => r[0] === id), 1); };
  context.hud_findUniqueRecord_ = (sheet, _key, value) => {
    if (sheet === sheets.Clients) return { headers: clientHeaders, values: [...clientRow], rowNumber: 2, record: {} };
    const row = alerts.find((r) => r[0] === value);
    return { record: Object.fromEntries(alertHeaders.map((h, i) => [h, row[i]])) };
  };
  const run = (payload) => {
    const m = context.hud_prepareBlockerMutation_({}, payload);
    m.apply();
    const after = m.readAfter();
    assert.equal(m.matches(after), true, JSON.stringify(after));
    return { m, after };
  };

  assert.throws(() => context.hud_prepareBlockerMutation_({}, { clientId: 'PAC', note: '' }), /no roadblock to clear/);
  const first = run({ clientId: 'PAC', note: 'Waiting on DNS access', projectId: 'PAC-01' });
  assert.equal(first.after.alertId, 'ALT-b1');
  const second = run({ clientId: 'PAC', note: 'Logo files | missing' });
  assert.equal(clientRow[1], 'Waiting on DNS access | Logo files / missing');
  assert.equal(alerts.length, 2);
  assert.equal(alerts[1][6], 'Blocker: Logo files / missing');

  // Remove only the first one.
  const removed = run({ clientId: 'PAC', alertId: 'ALT-b1' });
  assert.equal(clientRow[1], 'Logo files / missing');
  assert.equal(alerts[0][3], 'Resolved');
  assert.equal(alerts[1][3], 'Open');
  assert.throws(() => context.hud_prepareBlockerMutation_({}, { clientId: 'PAC', alertId: 'ALT-b1' }), /not open/);
  removed.m.rollback();
  assert.equal(alerts[0][3], 'Open');
  assert.equal(clientRow[1], 'Waiting on DNS access | Logo files / missing');

  // Clear all.
  const clear = run({ clientId: 'PAC', note: '' });
  assert.equal(clear.after.resolvedAlerts, 2);
  assert.equal(clientRow[1], '');
  clear.m.rollback();
  assert.equal(clientRow[1], 'Waiting on DNS access | Logo files / missing');
  second.m.rollback();
  first.m.rollback();
  assert.equal(alerts.length, 0);
  assert.equal(clientRow[1], '');

  // A hand-typed roadblock with no alert row is kept when the first blocker is added.
  clientRow[1] = 'Typed in the sheet';
  run({ clientId: 'PAC', note: 'New one' });
  assert.equal(clientRow[1], 'Typed in the sheet | New one');
});
