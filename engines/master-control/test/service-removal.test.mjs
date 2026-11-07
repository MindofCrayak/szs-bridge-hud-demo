import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../src/Master_Control_Auth.gs', '../src/Central_Router.gs', '../Finance_Model.gs', '../HUD_Writes.gs', '../Project_Automation.gs', '../Service_Removal.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const contract = (extra = {}) => ({ rowNumber: 2, ProjectID: 'PAC-01', ClientID: 'PAC', MilestoneStage: 'Contract', TotalContractValue: 9000, ...extra });

test('removeService is an audited HUD write and re-runs Police', () => {
  assert.ok(context.HUD_WRITE_ACTIONS.includes('removeService'));
  assert.equal(context.hud_needsPolice_('removeService'), true);
});

test('money: the price comes off the final invoice only; deposit and mid-flight are frozen; TCV drops', () => {
  const plan = plain(context.service_removalFinancePlan_([contract()], 'PAC-01', 1500, 'DNS Security Protocols', '2026-11-06'));
  assert.deepEqual(plan.after, {
    TotalContractValue: 7500, Schedule_Deposit: 3000, Schedule_MidFlight: 3000, Schedule_Final: 1500,
  });
  assert.equal(plan.finalBefore, 3000);
  // The new schedule sums to the new TCV, so Police R3 stays quiet.
  assert.equal(plan.after.Schedule_Deposit + plan.after.Schedule_MidFlight + plan.after.Schedule_Final, plan.after.TotalContractValue);
  // A negotiated schedule is respected: only its final part shrinks.
  const custom = plain(context.service_removalFinancePlan_([contract({ Schedule_Deposit: 4000, Schedule_MidFlight: 2000, Schedule_Final: 3000 })], 'PAC-01', 500, 'X', '2026-11-06'));
  assert.deepEqual([custom.after.Schedule_Deposit, custom.after.Schedule_MidFlight, custom.after.Schedule_Final, custom.after.TotalContractValue], [4000, 2000, 2500, 8500]);
  assert.equal(context.service_removalFinancePlan_([contract()], 'PAC-01', 0, 'X', '2026-11-06'), null, 'a free service changes no money');
});

test('after invoicing started the change is recorded in AddendumRef (Police R10 stays quiet)', () => {
  const rows = [contract({ TCV_At_First_Invoice: 9000, AddendumRef: 'ADD-1' }),
    { rowNumber: 3, ProjectID: 'PAC-01', MilestoneStage: 'Deposit (1/3)', InvoiceID: 'INV-PAC-26-001', InvoiceStatus: 'Paid' }];
  const plan = context.service_removalFinancePlan_(rows, 'PAC-01', 1000, 'DNS Security Protocols', '2026-11-06');
  assert.equal(plan.after.AddendumRef, 'ADD-1; Removed DNS Security Protocols -$1000 from the final invoice (2026-11-06)');
  const fresh = context.service_removalFinancePlan_([contract()], 'PAC-01', 1000, 'X', '2026-11-06');
  assert.equal(fresh.after.AddendumRef, undefined, 'before invoicing nothing is written to AddendumRef');
});

test('refusals: final invoice already issued, price larger than the final invoice, missing contract', () => {
  const issued = [contract(), { rowNumber: 4, ProjectID: 'PAC-01', MilestoneStage: 'Liftoff & QA (1/3)', InvoiceID: 'INV-PAC-26-003', InvoiceStatus: 'Sent' }];
  assert.throws(() => context.service_removalFinancePlan_(issued, 'PAC-01', 100, 'X', 'd'), /final invoice \(INV-PAC-26-003\) is already Sent/);
  const draft = [contract(), { rowNumber: 4, ProjectID: 'PAC-01', MilestoneStage: 'Liftoff & QA (1/3)', InvoiceID: 'INV-PAC-26-003', InvoiceStatus: 'Draft' }];
  assert.equal(context.service_removalFinancePlan_(draft, 'PAC-01', 100, 'X', 'd').finalInvoiceId, 'INV-PAC-26-003', 'a Draft final invoice is reduced');
  assert.throws(() => context.service_removalFinancePlan_([contract()], 'PAC-01', 3001, 'X', 'd'), /more than PAC-01's final invoice/);
  assert.throws(() => context.service_removalFinancePlan_([], 'PAC-01', 100, 'X', 'd'), /no Finances contract row/);
});

test('tasks: open ones of the service tab are deleted, completed ones stay, the parent goes only when nothing stays under it', () => {
  const tab = 'DNS_Security_Protocols';
  const key = (k) => `Audience: internal\nKey: ${tab}::${k}`;
  const tasks = [
    { id: 'P', notes: key('__parent__'), status: 'needsAction' },
    { id: 'A', parent: 'P', notes: key('a'), status: 'needsAction' },
    { id: 'B', parent: 'P', notes: key('b'), status: 'needsAction' },
    { id: 'O', notes: 'Audience: internal\nKey: Project_Lifecycle_Base::x', status: 'needsAction' },
    { id: 'Z', notes: key('z'), status: 'needsAction', deleted: true },
  ];
  assert.deepEqual(plain(context.service_tasksToDelete_(tasks, tab)), { ids: ['A', 'B', 'P'], completedKept: 0 });
  const withDone = [...tasks, { id: 'C', parent: 'P', notes: key('c'), status: 'completed' }];
  assert.deepEqual(plain(context.service_tasksToDelete_(withDone, tab)), { ids: ['A', 'B'], completedKept: 1 });
  const handAdded = [...tasks, { id: 'H', parent: 'P', notes: 'my own note', status: 'needsAction' }];
  assert.deepEqual(plain(context.service_tasksToDelete_(handAdded, tab)).ids, ['A', 'B']);
});

test('mutation: components, money and tasks change together; rollback restores the sheets', () => {
  const projectHeaders = ['ProjectID', 'ActiveComponents', 'Google_Tasklist_ID', 'Task_Templates'];
  const projectRow = ['PAC-01', 'comp_dns_shield,comp_citadel_portal', 'LIST', ''];
  const financeHeaders = ['InvoiceID', 'ClientID', 'ProjectID', 'MilestoneStage', 'TotalContractValue', 'Schedule_Deposit', 'Schedule_MidFlight', 'Schedule_Final', 'AddendumRef', 'TCV_At_First_Invoice'];
  const financeRows = [['', 'PAC', 'PAC-01', 'Contract', 9000, '', '', '', '', '']];
  const removed = [];
  const sheets = {
    Projects: { getRange: (_r, c) => ({ setValue: (v) => { projectRow[c - 1] = v; } }) },
    Finances: {
      getRange: (r, c) => ({
        setValue: (v) => { financeRows[r - 2][c - 1] = v; },
        getValues: () => [financeRows[r - 2]],
      }),
    },
  };
  context.hud_requireSheet_ = (_s, name) => sheets[name];
  context.hud_findUniqueRecord_ = () => ({ headers: projectHeaders, values: [...projectRow], rowNumber: 2,
    record: Object.fromEntries(projectHeaders.map((h, i) => [h, projectRow[i]])) });
  context.vala_readRecords_ = () => ({ headers: financeHeaders,
    rows: financeRows.map((row, i) => ({ rowNumber: i + 2, ...Object.fromEntries(financeHeaders.map((h, j) => [h, row[j]])) })) });
  context.vala_recomputeFinances_ = () => [];
  context.Utilities = { formatDate: () => '2026-11-06' };
  context.Session = { getScriptTimeZone: () => 'UTC' };
  context.SpreadsheetApp = { flush: () => {} };
  context.dolores_listTasks_ = () => [
    { id: 'P', notes: 'Key: DNS_Security_Protocols::__parent__', status: 'needsAction' },
    { id: 'A', parent: 'P', notes: 'Key: DNS_Security_Protocols::spf', status: 'needsAction' },
  ];
  context.Tasks = { Tasks: { remove: (_list, id) => removed.push(id) } };

  assert.throws(() => context.hud_prepareServiceRemovalMutation_({}, { projectId: 'PAC-01', serviceId: 'comp_mcc_engine', price: 1 }), /not installed/);
  const m = context.hud_prepareServiceRemovalMutation_({}, { projectId: 'PAC-01', serviceId: 'comp_dns_shield', price: 1500 });
  assert.equal(m.before.openTasksToDelete, 2);
  m.apply();
  const after = m.readAfter();
  assert.equal(m.matches(after), true, JSON.stringify(after));
  assert.equal(projectRow[1], 'comp_citadel_portal');
  assert.deepEqual(financeRows[0].slice(4, 8), [7500, 3000, 3000, 1500]);
  assert.deepEqual(removed, ['A', 'P']);
  assert.equal(after.tasksDeleted, 2);
  m.rollback();
  assert.equal(projectRow[1], 'comp_dns_shield,comp_citadel_portal');
  assert.deepEqual(financeRows[0].slice(4, 8), [9000, '', '', '']);
});

test('preview: the owner sees the money and task change before confirming; refusals come back as a reason', () => {
  context.getAuthorizedMasterControlUser_ = () => 'owner@example.com';
  context.getMasterControlSpreadsheet_ = () => ({});
  const ok = plain(context.hud_previewServiceRemoval('PAC-01', 'comp_citadel_portal', 1000));
  assert.equal(ok.ok, true, ok.reason);
  assert.equal(ok.serviceName, 'Digital Citadel Client Portal');
  assert.deepEqual([ok.tcvBefore, ok.tcvAfter, ok.finalBefore, ok.finalAfter], [9000, 8000, 3000, 2000]);
  assert.equal(ok.tasksToDelete, 0, 'no Citadel tasks in the list');
  const refused = plain(context.hud_previewServiceRemoval('PAC-01', 'comp_citadel_portal', 5000));
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /more than PAC-01's final invoice/);
});
