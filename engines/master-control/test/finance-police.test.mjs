import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
// Apps Script order: root files alphabetically, then src/.
for (const file of [
  '../Edit_Log.gs', '../Finance_Model.gs', '../HUD_API.gs', '../HUD_Diagnostics.gs', '../HUD_Seed.gs',
  '../src/Master_Control_Auth.gs', '../HUD_Writes.gs', '../Police_Reconciliation.gs', '../Schema_Registry.gs',
  '../src/Central_Router.gs', '../src/Pipeline_Phase_Gate.gs',
]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = value => JSON.parse(JSON.stringify(value));
const cents = value => Math.round(Number(value) * 100);

/** Seeded dataset as sheet records with row numbers. */
function seeded() {
  const data = plain(context.hud_seedDataset_({}, 2026));
  const withRows = rows => rows.map((row, index) => ({ rowNumber: index + 2, ...row }));
  return { clients: withRows(data.clients), projects: withRows(data.projects), finances: withRows(data.finances) };
}
const letters = {
  Clients: { ContractValue: 'J', AccountPhase: 'H', ClientID: 'A' },
  Projects: { SprintStage: 'D', SOW_DocID: 'F', ProjectID: 'A' },
  Finances: { TotalContractValue: 'F', InvoiceAmount: 'H', DepositPaid: 'I', InvoiceStatus: 'K', ClientID: 'B', ProjectID: 'C', InvoiceID: 'A', TotalContractDue: 'S', TCV_At_First_Invoice: 'X' },
};

test('default schedule is exact to the cent and sums to TCV', () => {
  assert.deepEqual(plain(context.vala_defaultSchedule_(10000)), [3333.33, 3333.33, 3333.34]);
  assert.deepEqual(plain(context.vala_defaultSchedule_(9000)), [3000, 3000, 3000]);
  for (const tcv of [1, 100, 4500.5, 12345.67, 99999.99]) {
    assert.equal(context.vala_defaultSchedule_(tcv).reduce((sum, v) => sum + cents(v), 0), cents(tcv), String(tcv));
  }
  assert.deepEqual(plain(context.vala_schedule_({ TotalContractValue: 9000, Schedule_Deposit: 4000, Schedule_MidFlight: 2500, Schedule_Final: 2500 })), [4000, 2500, 2500]);
  assert.deepEqual(plain(context.vala_schedule_({ TotalContractValue: 9000, Schedule_Deposit: 4000, Schedule_MidFlight: '', Schedule_Final: '' })), [3000, 3000, 3000], 'partial override falls back to thirds');
});

test('invoice numbering is per client per year and continues past 003', () => {
  const on = new Date(2026, 5, 1);
  assert.equal(context.vala_nextInvoiceId_([], 'PAC', on), 'INV-PAC-26-001');
  assert.equal(context.vala_nextInvoiceId_(['INV-PAC-26-001', 'INV-PAC-26-003', 'INV-SEN-26-009', 'INV-PAC-25-004', ''], 'PAC', on), 'INV-PAC-26-004');
});

test('ledger recompute fills TotalContractDue, invoice amounts, balance, and the first-invoice baseline', () => {
  const rows = [
    { rowNumber: 2, InvoiceID: '', ClientID: 'HLW', ProjectID: 'HLW-01', MilestoneStage: 'Contract', TotalContractValue: 10000, Remaining_Balance: 3334, TotalContractDue: '', TCV_At_First_Invoice: '' },
    { rowNumber: 3, InvoiceID: 'INV-HLW-26-001', ClientID: 'HLW', ProjectID: 'HLW-01', MilestoneStage: 'Deposit (1/3)', InvoiceAmount: 3333, DepositAmount: 3333, DepositPaid: true, InvoiceStatus: 'Paid' },
    { rowNumber: 4, InvoiceID: 'INV-HLW-26-002', ClientID: 'HLW', ProjectID: 'HLW-01', MilestoneStage: 'Mid-Flight (1/3)', InvoiceAmount: 3333, InvoiceStatus: 'Paid' },
    { rowNumber: 5, InvoiceID: 'INV-HLW-26-003', ClientID: 'HLW', ProjectID: 'HLW-01', MilestoneStage: 'Liftoff & QA (1/3)', InvoiceAmount: 3334, InvoiceStatus: 'Sent' },
  ];
  const updates = plain(context.vala_computeLedgerUpdates_(rows));
  const get = (row, column) => updates.find(u => u.rowNumber === row && u.column === column)?.value;
  assert.equal(get(2, 'TotalContractDue'), 10000);
  assert.equal(get(2, 'TCV_At_First_Invoice'), 10000);
  assert.equal(get(3, 'InvoiceAmount'), 3333.33);
  assert.equal(get(5, 'InvoiceAmount'), 3333.34);
  assert.equal(get(2, 'Remaining_Balance'), 3333.34);
  // Idempotent: applying the updates yields no further updates.
  for (const u of updates) rows.find(r => r.rowNumber === u.rowNumber)[u.column] = u.value;
  assert.deepEqual(plain(context.vala_computeLedgerUpdates_(rows)), []);
});

test('stage 02/06/08 create the deposit, mid-flight and final invoices once each', () => {
  const on = new Date(2026, 5, 1);
  const rows = [{ InvoiceID: '', ClientID: 'PAC', ProjectID: 'PAC-01', MilestoneStage: 'Contract', TotalContractValue: 9000 }];
  const deposit = plain(context.vala_invoiceForStage_(rows, 'PAC-01', 'PAC', 2, on));
  assert.equal(deposit.InvoiceID, 'INV-PAC-26-001');
  assert.equal(deposit.MilestoneStage, 'Deposit (1/3)');
  assert.equal(deposit.InvoiceAmount, 3000);
  assert.equal(deposit.InvoiceStatus, 'Draft');
  rows.push(deposit);
  assert.equal(context.vala_invoiceForStage_(rows, 'PAC-01', 'PAC', 2, on), null, 'no duplicate deposit');
  assert.equal(context.vala_invoiceForStage_(rows, 'PAC-01', 'PAC', 5, on), null, 'stage 05 issues nothing');
  const mid = plain(context.vala_invoiceForStage_(rows, 'PAC-01', 'PAC', 6, on));
  assert.equal(mid.InvoiceID, 'INV-PAC-26-002');
  rows.push(mid);
  assert.equal(plain(context.vala_invoiceForStage_(rows, 'PAC-01', 'PAC', 8, on)).MilestoneStage, 'Liftoff & QA (1/3)');
  assert.equal(context.vala_invoiceForStage_([], 'ZES-01', 'ZES', 2, on), null, 'no contract row, no invoice');
});

test('roll-up formula references the right columns', () => {
  assert.equal(context.vala_contractValueFormula_(5, { clientId: 'A', tcv: 'F', client: 'B', stage: 'E' }),
    '=SUMIFS(Finances!F:F,Finances!B:B,$A5,Finances!E:E,"Contract")');
});

test('Police catches the deliberate seed mismatch (R1) and malformed row (R8), naming cells and values', () => {
  const findings = plain(context.police_reconcile_(seeded(), letters));
  const r1 = findings.find(f => f.id === 'POL-R1-PAC');
  assert.ok(r1, 'R1 on PAC');
  assert.equal(r1.severity, 'BLOCK');
  assert.match(r1.condition, /Clients!J2/);
  assert.match(r1.condition, /\$12,000\.00/);
  assert.match(r1.condition, /\$13,500\.00/);
  assert.ok(r1.cells.some(c => c.startsWith('Finances!F')));
  assert.equal(r1.resolvable.financesValue, 13500);
  const r8 = findings.find(f => f.id === 'POL-R8-INV-PAC-1');
  assert.ok(r8, 'R8 on the malformed invoice');
  assert.equal(r8.severity, 'WARN');
  // Only PAC has an R1; contract rows (blank InvoiceID) are not flagged as malformed.
  assert.deepEqual(findings.filter(f => f.rule === 'R1').map(f => f.id), ['POL-R1-PAC']);
  assert.equal(findings.filter(f => f.rule === 'R8').length, 1);
  // Seed satisfies the gate and the derivation: no R7 or R6.
  assert.equal(findings.filter(f => f.rule === 'R7' || f.rule === 'R6').length, 0);
});

test('Police rules R2, R3, R4, R5, R7, R10 fire on crafted rows', () => {
  const data = seeded();
  const contract = data.finances.find(f => f.ProjectID === 'SEN-01' && f.MilestoneStage === 'Contract');
  contract.TotalContractDue = 7000; // R3
  contract.TCV_At_First_Invoice = 7000; // R10 (TCV 7500, no AddendumRef)
  const deposit = data.finances.find(f => f.InvoiceID === 'INV-SEN-26-001');
  deposit.DepositPaid = false; // R5 (status Paid)
  data.finances.push({ rowNumber: 99, InvoiceID: 'INV-SEN-26-009', ClientID: 'SEN', ProjectID: 'SEN-01', MilestoneStage: 'Retainer / Maintenance', InvoiceAmount: 9000, InvoiceStatus: 'Sent' }); // R4
  data.finances.push({ rowNumber: 100, InvoiceID: 'INV-XXX-26-001', ClientID: '', ProjectID: 'NOPE-01', MilestoneStage: 'Deposit (1/3)', InvoiceAmount: 1, InvoiceStatus: 'Draft' }); // R2 twice
  data.clients.find(c => c.ClientID === 'SEN').MSA_DocID = ''; // R7 on SEN-01 (stage 04)
  const ids = plain(context.police_reconcile_(data, letters)).map(f => f.id);
  for (const id of ['POL-R3-SEN-01', 'POL-R10-SEN-01', 'POL-R5-INV-SEN-26-001', 'POL-R4-SEN-01', 'POL-R2-ROW100', 'POL-R2-INV-XXX-26-001', 'POL-R7-SEN-01']) {
    assert.ok(ids.includes(id), id);
  }
  contract.AddendumRef = 'ADD-SEN-01-A';
  assert.equal(plain(context.police_reconcile_(data, letters)).some(f => f.id === 'POL-R10-SEN-01'), false, 'AddendumRef clears R10');
});

test('Police R6 flags auto clients whose phase disagrees, and R8 flags duplicates as BLOCK', () => {
  const data = seeded();
  data.clients.find(c => c.ClientID === 'ZES').AccountPhase = '02: Session Zero';
  data.projects.push({ ...data.projects[0], rowNumber: 50 });
  const findings = plain(context.police_reconcile_(data, letters));
  assert.equal(findings.find(f => f.id === 'POL-R6-ZES').severity, 'INFO');
  assert.equal(findings.find(f => f.id === 'POL-R8-DUP-PAC-01').severity, 'BLOCK');
});

test('alert records carry rule, both cells, severity and prescribed action', () => {
  const finding = plain(context.police_reconcile_(seeded(), letters)).find(f => f.id === 'POL-R1-PAC');
  const record = plain(context.police_alertRecord_(finding, '2026-11-04T00:00:00.000Z'));
  assert.equal(record.Alert_ID, 'POL-R1-PAC');
  assert.equal(record.Source_Module, 'Police');
  assert.equal(record.Department, 'Vala');
  assert.equal(record.Severity, 'BLOCK');
  assert.equal(record.Action_Status, 'Open');
  assert.match(record.Entity_Reference, /Clients!J2/);
  assert.match(record.Trigger_Condition, /^\[R1\]/);
  assert.ok(record.Prescribed_Action.length > 10);
});

test('alert sync creates once, updates in place, reopens, and auto-resolves cleared findings', () => {
  const headers = ['Alert_ID', 'Source_Module', 'Severity', 'Trigger_Condition', 'Message', 'Entity_Reference', 'Priority', 'Prescribed_Action', 'Action_Status', 'Dismissed_Status', 'Resolved_At'];
  const grid = [headers, ...Array.from({ length: 6 }, () => headers.map(() => ''))];
  const sheet = {
    getLastColumn: () => headers.length,
    getMaxRows: () => grid.length,
    getDataRange: () => ({ getValues: () => grid.map(r => [...r]) }),
    getRange: (row, column, rows = 1, columns = 1) => ({
      getValues: () => grid.slice(row - 1, row - 1 + rows).map(r => r.slice(column - 1, column - 1 + columns)),
      getDataValidations: () => Array.from({ length: rows }, () => Array.from({ length: columns }, () => null)),
      setValue: value => { grid[row - 1][column - 1] = value; },
      setValues: values => { values.forEach((r, i) => r.forEach((v, j) => { grid[row - 1 + i][column - 1 + j] = v; })); },
    }),
    insertRowAfter: () => grid.push(headers.map(() => '')),
  };
  const spreadsheet = { getSheetByName: name => (name === 'Alfred_Alerts' ? sheet : null) };
  const finding = { id: 'POL-R1-PAC', rule: 'R1', severity: 'BLOCK', department: 'Vala', clientId: 'PAC', projectId: '', cells: ['Clients!J2'], condition: 'mismatch', action: 'fix it' };
  let result = plain(context.police_syncAlerts_(spreadsheet, [finding]));
  assert.deepEqual(result.created, ['POL-R1-PAC']);
  result = plain(context.police_syncAlerts_(spreadsheet, [finding]));
  assert.deepEqual([result.created, result.updated], [[], []], 'no duplicate, no needless update');
  assert.equal(grid.filter(r => r[0] === 'POL-R1-PAC').length, 1);
  result = plain(context.police_syncAlerts_(spreadsheet, []));
  assert.deepEqual(result.resolved, ['POL-R1-PAC']);
  assert.equal(grid.find(r => r[0] === 'POL-R1-PAC')[headers.indexOf('Action_Status')], 'Resolved');
  result = plain(context.police_syncAlerts_(spreadsheet, [finding]));
  assert.deepEqual(result.reopened, ['POL-R1-PAC']);
  assert.equal(grid.find(r => r[0] === 'POL-R1-PAC')[headers.indexOf('Action_Status')], 'Open');
});

test('Edit_Log watches money, phase, stage and ID columns only, never the header row', () => {
  const headers = ['ClientID', 'Company_Name', 'AccountPhase', 'ContractValue'];
  assert.deepEqual(plain(context.editLog_watchedCells_('Clients', headers, 2, 1, 1, 4)).map(c => c.name), ['ClientID', 'AccountPhase', 'ContractValue']);
  assert.deepEqual(plain(context.editLog_watchedCells_('Clients', headers, 1, 1, 1, 4)), []);
  assert.deepEqual(plain(context.editLog_watchedCells_('Edit_Log', headers, 2, 1, 1, 4)), []);
});

test('resolveFinding is an allowed audited action', () => {
  assert.ok(context.HUD_WRITE_ACTIONS.includes('resolveFinding'));
});

test('typed-input clean-up (moved from the old simple onEdit) is by header name and never touches other columns', () => {
  const n = (tab, header, value) => context.editLog_normalizedValue_(tab, header, value);
  assert.equal(n('Clients', 'ClientID', '  pa-c 01! '), 'PA-C01');
  assert.equal(n('Clients', 'ContactEmail', ' Pat@Example.COM '), 'pat@example.com');
  assert.equal(n('Projects', 'ProjectID', 'pac-01'), 'PAC-01');
  assert.equal(n('Finances', 'InvoiceID', 'inv-pac-26-002'), 'INV-PAC-26-002');
  assert.equal(n('Clients', 'ClientID', 'PAC'), null, 'already clean: no write');
  assert.equal(n('Clients', 'Company_Name', ' prime auto '), null, 'other columns untouched');
  assert.equal(n('Alfred_Alerts', 'ClientID', 'pac'), null, 'other tabs untouched');
  assert.equal(n('Clients', 'ClientID', ''), null);
});

test('a hand edit logs to Edit_Log and queues the background Police run instead of running it under the lock', () => {
  const logged = [];
  const scheduled = [];
  let lockTaken = 0;
  const saved = { LockService: context.LockService, CacheService: context.CacheService, Session: context.Session, hud_schedulePolice_: context.hud_schedulePolice_, police_runReconciliation_: context.police_runReconciliation_ };
  context.LockService = { getScriptLock: () => { lockTaken += 1; return { tryLock: () => true, waitLock() {}, releaseLock() {} }; } };
  context.CacheService = { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) };
  context.Session = { getActiveUser: () => ({ getEmail: () => 'owner@example.com' }) };
  context.hud_schedulePolice_ = () => { scheduled.push(1); return 'scheduled'; };
  context.police_runReconciliation_ = () => { throw new Error('must not run inline'); };
  const headers = ['ClientID', 'AccountPhase'];
  let cellValue = ' pac ';
  const log = { appendRow: (row) => logged.push(row) };
  const sheet = {
    getName: () => 'Clients',
    getLastColumn: () => 2,
    getRange: (r, c, nr, nc) => (nr ? { getValues: () => [headers] } : { getValue: () => (c === 1 ? 'PAC' : '03') }),
    getParent: () => ({ getSheetByName: (name) => (name === 'Edit_Log' ? log : null) }),
  };
  const range = { getSheet: () => sheet, getRow: () => 2, getColumn: () => 1, getNumRows: () => 1, getNumColumns: () => 1, setValue: (v) => { cellValue = v; } };
  try {
    context.hud_onEditInstalled({ range, value: ' pac ', oldValue: 'PAC' });
  } finally {
    Object.assign(context, saved);
  }
  assert.equal(cellValue, 'PAC', 'typed ID cleaned');
  assert.equal(logged.length, 1, 'one Edit_Log row');
  assert.equal(logged[0][4], 'ClientID');
  assert.equal(scheduled.length, 1, 'Police queued');
  assert.equal(lockTaken, 0, 'no script lock on a hand edit');
});
