import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../Finance_Model.gs', '../HUD_Writes.gs', '../Project_Automation.gs', '../Project_Dashboard.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = value => JSON.parse(JSON.stringify(value));

const tasks = [
  { id: 'P1', title: 'Project Lifecycle Base', notes: 'Audience: internal\nKey: Project_Lifecycle_Base::__parent__' },
  { id: 'T2', parent: 'P1', title: 'Pay deposit invoice', due: '2026-11-09T00:00:00.000Z', status: 'needsAction',
    notes: 'Audience: client\nStart: 2026-11-08\nKey: Project_Lifecycle_Base::pay-deposit-invoice\n\nDeposit is paid.' },
  { id: 'T1', parent: 'P1', title: 'Sign MSA and SOW', due: '2026-11-08T00:00:00.000Z', status: 'completed',
    notes: 'Audience: client\nStart: 2026-11-07\nKey: Project_Lifecycle_Base::sign-msa-and-sow\n\nSign it.' },
  { id: 'T3', parent: 'P1', title: 'Research brief', due: '2026-11-12T00:00:00.000Z', status: 'needsAction',
    notes: 'Audience: internal\nStart: 2026-11-10\nKey: Project_Lifecycle_Base::research-brief' },
];

test('client tasks: only Audience client children, sorted by due, notes without the header block', () => {
  const rows = plain(context.dashboard_clientTasks_(tasks));
  assert.deepEqual(rows.map(r => r.id), ['T1', 'T2']);
  assert.deepEqual(rows[0], { id: 'T1', title: 'Sign MSA and SOW', due: '2026-11-08', notes: 'Sign it.', done: true });
  assert.equal(context.dashboard_description_('Audience: client\nKey: x'), '');
});

test('reconcile: the sheet side wins, then Tasks, else nothing (state-based loop guard)', () => {
  assert.equal(context.dashboard_reconcile_(true, false, false), 'push');
  assert.equal(context.dashboard_reconcile_(false, true, true), 'push');
  assert.equal(context.dashboard_reconcile_(false, false, true), 'pull');
  assert.equal(context.dashboard_reconcile_(true, true, true), 'none');
});

test('sync plan: push ticks, pull task changes, append new client tasks, report orphans', () => {
  const sheetRows = [
    ['Sign MSA and SOW', '2026-11-08', 'Sign it.', false, 'T1', false],   // completed in Tasks -> pull
    ['Pay deposit invoice', '2026-11-09', '', true, 'T2', false],          // ticked in sheet -> push
    ['Old task', '2026-11-01', '', false, 'GONE', false],                  // removed from Tasks
    ['', '', '', false, '', false],                                         // blank checkbox row
  ];
  const newTask = { id: 'T4', parent: 'P1', title: 'Final QA walkthrough', due: '2026-12-08T00:00:00.000Z', status: 'needsAction', notes: 'Audience: client\nKey: k' };
  const plan = plain(context.dashboard_syncPlan_(sheetRows, tasks.concat([newTask])));
  assert.deepEqual(plan.push, [{ row: 1, taskId: 'T2', done: true }]);
  assert.deepEqual(plan.pull, [{ row: 0, done: true }]);
  assert.deepEqual(plan.append, [['Final QA walkthrough', '2026-12-08', '', false, 'T4', false]]);
  assert.deepEqual(plan.orphaned, ['GONE']);
});

test('a just-ticked box is not reverted by a stale Tasks read', () => {
  const plan = plain(context.dashboard_syncPlan_([['Pay deposit invoice', '2026-11-09', '', true, 'T2', false]], tasks));
  assert.deepEqual(plan.pull, []);
  assert.equal(plan.push.length, 1);
});

test('deck SSOT values come from Master Control records and the task list', () => {
  const milestoneTasks = [
    { id: 'M1', parent: 'P1', title: 'Sign MSA and SOW', due: '2026-11-08T00:00:00.000Z', status: 'completed', notes: 'Audience: client\nKey: Project_Lifecycle_Base::sign-msa-and-sow' },
    { id: 'M2', parent: 'P1', title: 'Session Zero kickoff call', due: '2026-11-16T00:00:00.000Z', status: 'needsAction', notes: 'Audience: client\nKey: Project_Lifecycle_Base::session-zero-kickoff-call' },
    { id: 'M3', parent: 'P1', title: 'Handover acceptance', due: '2026-12-14T00:00:00.000Z', status: 'needsAction', notes: 'Audience: client\nKey: Project_Lifecycle_Base::handover-acceptance' },
  ];
  const keys = { 'Project_Lifecycle_Base::sign-msa-and-sow': true, 'Project_Lifecycle_Base::session-zero-kickoff-call': true, 'Project_Lifecycle_Base::handover-acceptance': true };
  const out = context.deck_ssotValues_({
    client: { ClientID: 'PAC', Company_Name: 'Pacific Test Co', First_Name: 'Pat', Last_Name: 'Pac', ContactEmail: 'pat@example.com',
      AccountPhase: '03: Active Sprints', DriveFolderUrl: 'https://drive.google.com/drive/folders/abc', NotesDocUrl: 'TEST-PLACEHOLDER-notes', MSA_DocID: 'msa123' },
    project: { ProjectID: 'PAC-01', ProjectName: 'Build', SprintStage: '06: Mid-Flight Review', ChatSpaceURL: 'https://chat/x', SOW_DocID: 'sow1', Project_Brief_DocID: 'b1' },
    contract: { TotalContractValue: 13500, Remaining_Balance: 9000 },
    invoices: [
      { MilestoneStage: 'Mid-Flight (1/3)', InvoiceStatus: 'Sent' },
      { MilestoneStage: 'Deposit (1/3)', InvoiceStatus: 'Paid', DepositPaid: true },
    ],
    tasks: milestoneTasks, milestoneKeys: keys,
    tickets: [['TCK-1', '', 'Roadblock', 'Waiting on DNS access', 'High', 'Logged', ''], ['TCK-2', '', 'Roadblock', 'Old', 'Low', 'Resolved', '']],
  });
  const l = plain(out.labels);
  assert.equal(l.PrimaryContact, 'Pat Pac');
  assert.equal(l.GoogleGroupEmail, 'client-pac@sessionzero.solutions');
  assert.equal(l.NotesDocUrl, '', 'seed placeholders are blanked');
  assert.equal(l.MSA_DocID, 'https://docs.google.com/document/d/msa123/edit');
  assert.equal(l.RootDriveFolderUrl, 'https://drive.google.com/drive/folders/abc');
  assert.equal(l.ActiveRoadblock, 'Waiting on DNS access');
  assert.equal(l.CompletedMilestones, 1);
  assert.equal(l.TotalMilestones, 3);
  assert.equal(l.CurrentMilestone, 'Session Zero kickoff call');
  assert.equal(l.ContractValue, 13500);
  assert.equal(l.RemainingBalance, 9000);
  assert.equal(l.DepositPaid, true);
  assert.equal(l.InvoiceStatus, 'Sent', 'latest issued invoice by schedule order');
  assert.equal(context.dolores_isoDate_(out.retention[0]), '2026-12-14', 'handover date from the handover task');
  assert.equal(out.retention[1], 'Active Sanctum');
});

test('deck SSOT writes match labels (including the renamed folder label) and skip formula rows', () => {
  const writes = plain(context.deck_ssotWrites_(
    ['ClientID', 'RootDriveFolderID', 'MilestonePercent', 'Unknown_Label', ''],
    ['', '', '=IFERROR(B17/B18, 0)', '', ''],
    { ClientID: 'PAC', RootDriveFolderUrl: 'https://x', MilestonePercent: 0.5 }));
  assert.deepEqual(writes, [{ row: 1, value: 'PAC' }, { row: 2, value: 'https://x' }]);
});
