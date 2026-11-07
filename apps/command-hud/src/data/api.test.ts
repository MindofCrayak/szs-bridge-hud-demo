import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MASTER_CONTROL_OAUTH_SCOPES,
  parseMasterControlProjectTasks,
  parseMasterControlProjectTaskList,
  summarizeProjectTasks,
  taskDescription,
  parseClientMessagePreview,
  parseMasterControlWriteResult,
  postMasterControlAction,
  syncServiceToMasterControl,
  MasterControlTransportError,
  isServerSideTransportError,
  recoverWriteFromAudit,
  parseMasterControlWriteStatus,
  parseServiceRemovalPreview,
} from './api';

test('requests Google Tasks access for approved service attachments', () => {
  assert.ok(MASTER_CONTROL_OAUTH_SCOPES.includes('https://www.googleapis.com/auth/tasks'));
});

test('marks missing-auth service attachments as offline, not persisted', async () => {
  const result = await syncServiceToMasterControl(
    'CLI',
    'comp_mcc_engine',
    3200,
    ['Create the welcome sequence'],
  );

  assert.deepEqual(result, { status: 'offline' });
});

test('blocks un-audited account-phase writes', async () => {
  await assert.rejects(
    postMasterControlAction('verified-oauth-token', {
      action: 'updateKanban',
      clientID: 'CLI',
      newStage: '03: Active Sprints',
    }),
    /Legacy updateKanban actions are unsupported/,
  );
});

test('accepts only a confirmed Master Control write response with read-back data', () => {
  assert.deepEqual(parseMasterControlWriteResult({
    ok: true,
    requestId: 'request-1',
    before: { AccountPhase: '01: Intake' },
    after: { AccountPhase: '02: Session Zero' },
  }), {
    ok: true,
    requestId: 'request-1',
    before: { AccountPhase: '01: Intake' },
    after: { AccountPhase: '02: Session Zero' },
  });
  assert.throws(
    () => parseMasterControlWriteResult({ ok: true, requestId: 'request-1' }),
    /did not confirm the requested write/,
  );
});

test('lost write reply (HTTP 500 "Internal error encountered"): the audit row decides the outcome', async () => {
  const lost = new MasterControlTransportError('Internal error encountered.', 500);
  assert.equal(isServerSideTransportError(lost), true);
  assert.equal(isServerSideTransportError(new MasterControlTransportError('Forbidden', 403)), false);
  assert.equal(isServerSideTransportError(new Error('script threw')), false);

  const answers: unknown[] = [
    new Error('network'),
    { requestId: 'r1', found: false },
    { requestId: 'r1', found: true, status: 'Pending' },
    { requestId: 'r1', found: true, status: 'Confirmed', before: { a: 1 }, after: { ActiveRoadblock: 'x' } },
  ];
  const read = async () => { const next = answers.shift(); if (next instanceof Error) throw next; return next; };
  const confirmed = await recoverWriteFromAudit('token', 'r1', lost, [0, 0, 0, 0], read);
  assert.deepEqual(confirmed, { ok: true, requestId: 'r1', before: { a: 1 }, after: { ActiveRoadblock: 'x' } });

  await assert.rejects(
    recoverWriteFromAudit('token', 'r2', lost, [0], async () => ({ requestId: 'r2', found: true, status: 'Failed', error: 'Read-back mismatch' })),
    /Read-back mismatch/,
  );
  await assert.rejects(
    recoverWriteFromAudit('token', 'r3', lost, [0, 0], async () => ({ requestId: 'r3', found: false })),
    /Internal error encountered\. Master Control has not confirmed this save/,
  );
  assert.throws(() => parseMasterControlWriteStatus({ requestId: 'other', found: true }, 'r1'), /invalid write status/);
});

test('service removal preview: numbers kept, refusals carry a reason, junk rejected', () => {
  const ok = parseServiceRemovalPreview({ ok: true, serviceName: 'DNS Security Protocols', price: 1500, tcvBefore: 9000, tcvAfter: 7500,
    finalBefore: 3000, finalAfter: 1500, finalInvoiceId: '', addendum: false, tasksToDelete: 4, completedTasksKept: 1, hasTaskList: true });
  assert.deepEqual([ok.tcvAfter, ok.finalAfter, ok.tasksToDelete, ok.completedTasksKept], [7500, 1500, 4, 1]);
  const free = parseServiceRemovalPreview({ ok: true, price: 0, tcvBefore: null, tasksToDelete: 0 });
  assert.equal(free.tcvBefore, null);
  const refused = parseServiceRemovalPreview({ ok: false, reason: 'final invoice already Sent' });
  assert.equal(refused.reason, 'final invoice already Sent');
  assert.throws(() => parseServiceRemovalPreview({ reason: 'x' }), /invalid service removal preview/);
});

test('summarizes project task status without returning task contents', () => {
  assert.deepEqual(parseMasterControlProjectTasks({
    projectId: 'ZZZ-01',
    tasks: [
      { id: 'task-open', title: 'Private task', status: 'needsAction' },
      { id: 'task-done', title: 'Another private task', status: 'completed' },
      { id: 'task-deleted', status: 'needsAction', deleted: true },
    ],
  }, 'ZZZ-01'), {
    projectId: 'ZZZ-01',
    total: 2,
    open: 1,
  });
  assert.throws(
    () => parseMasterControlProjectTasks({ projectId: 'OTHER', tasks: [] }, 'ZZZ-01'),
    /invalid project task response/,
  );
  assert.throws(
    () => parseMasterControlProjectTasks({
      projectId: 'ZZZ-01',
      tasks: [{ status: 'unknown' }],
    }, 'ZZZ-01'),
    /supported status/,
  );
});

test('E6: task list parse keeps parent, audience and the description without the header block', () => {
  const list = parseMasterControlProjectTaskList({
    projectId: 'PAC-01',
    tasks: [
      { id: 'P', title: 'Base', status: 'needsAction', notes: 'Audience: internal\nKey: x::__parent__' },
      { id: 'A', parent: 'P', title: 'Send logo', status: 'completed', due: '2026-11-20T00:00:00.000Z',
        notes: 'Audience: client\nKey: hud::1\n\nSVG please' },
      { id: 'Z', status: 'needsAction', deleted: true },
    ],
  }, 'PAC-01');
  assert.deepEqual(list.tasks, [
    { id: 'P', title: 'Base', status: 'needsAction', due: '', parentId: '', audience: 'internal', notes: '', start: '', key: 'x::__parent__', milestone: false },
    { id: 'A', title: 'Send logo', status: 'completed', due: '2026-11-20', parentId: 'P', audience: 'client', notes: 'SVG please', start: '', key: 'hud::1', milestone: false },
  ]);
  const withMilestones = parseMasterControlProjectTaskList({
    projectId: 'PAC-01',
    milestoneKeys: ['Base::sign-msa'],
    tasks: [{ id: 'M', parent: 'P', title: 'Sign MSA', status: 'needsAction', due: '2026-11-08T00:00:00.000Z',
      notes: 'Audience: client\nStart: 2026-11-07\nKey: Base::sign-msa\n\nSign it.' }],
  }, 'PAC-01');
  assert.equal(withMilestones.tasks[0].milestone, true);
  assert.equal(withMilestones.tasks[0].start, '2026-11-07');
  assert.equal(withMilestones.tasks[0].notes, 'Sign it.');
  assert.deepEqual(summarizeProjectTasks('PAC-01', list.tasks), { projectId: 'PAC-01', total: 2, open: 1 });
  assert.equal(taskDescription('Plain note'), 'Plain note');
  assert.equal(taskDescription('Audience: client\nKey: k'), '');
});

test('E6: Universe card task count sums listed projects and marks partial reads', async () => {
  const { clientTaskCount } = await import('../components/canvas/UniverseGalaxyView');
  const client = { activeProjects: [
    { ProjectID: 'A-01', Google_Tasklist_ID: 'L1' }, { ProjectID: 'A-02', Google_Tasklist_ID: 'L2' }, { ProjectID: 'A-03' },
  ] } as unknown as Parameters<typeof clientTaskCount>[0];
  const none = new Set<string>();
  assert.equal(clientTaskCount(client, {}, none), '—');
  assert.equal(clientTaskCount(client, {}, new Set(['A-01'])), 'Reading…');
  assert.equal(clientTaskCount(client, { 'A-01': { projectId: 'A-01', open: 3, total: 10 } }, none), '3 / 10+');
  assert.equal(clientTaskCount(client, {
    'A-01': { projectId: 'A-01', open: 3, total: 10 }, 'A-02': { projectId: 'A-02', open: 1, total: 2 },
  }, none), '4 / 12');
  assert.equal(clientTaskCount({ activeProjects: [] } as unknown as Parameters<typeof clientTaskCount>[0], {}, none), 'No list');
});

test('E7 catalog: every HUD component templateTab matches the Master Control component -> tab map', async () => {
  const { readFileSync } = await import('node:fs');
  const { SERVICE_REGISTRY } = await import('./serviceRegistry');
  const source = readFileSync(new URL('../../../../engines/master-control/Project_Automation.gs', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('var DOLORES_COMPONENT_TABS'), source.indexOf('};', source.indexOf('var DOLORES_COMPONENT_TABS')));
  const serverMap = Object.fromEntries([...block.matchAll(/(comp_\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
  const hudMap = Object.fromEntries(SERVICE_REGISTRY.filter((s) => s.templateTab).map((s) => [s.id, s.templateTab]));
  assert.deepEqual(hudMap, serverMap);
  assert.equal(Object.keys(hudMap).length, 14);
  assert.ok(SERVICE_REGISTRY.every((s) => s.tasksToInject.length === 0), 'template tabs are the only task source');
});

test('HUD write actions match Master Control HUD_WRITE_ACTIONS exactly', async () => {
  const { readFileSync } = await import('node:fs');
  const server = readFileSync(new URL('../../../../engines/master-control/HUD_Writes.gs', import.meta.url), 'utf8');
  const serverActions = [...(server.match(/var HUD_WRITE_ACTIONS = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
  const hud = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  const union = hud.slice(hud.indexOf('export type MasterControlWriteAction'), hud.indexOf(';', hud.indexOf('export type MasterControlWriteAction')));
  const hudActions = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual([...hudActions].sort(), [...serverActions].sort());
  assert.ok(serverActions.includes('draftInvoice') && serverActions.includes('requestOsintSweep'));
});

test('HUD OAuth scopes match the Master Control manifest (scripts.run needs every script scope)', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../../../../engines/master-control/appsscript.json', import.meta.url), 'utf8'));
  assert.deepEqual([...MASTER_CONTROL_OAUTH_SCOPES].sort(), [...manifest.oauthScopes].sort());
});

test('client message preview (Plan v3.1 E5) is validated before the owner sees it', () => {
  const valid = {
    projectId: 'PAC-01', spaceName: 'spaces/AAQAabr8Jcc', spaceUrl: 'https://mail.google.com/chat/u/0/#chat/space/AAQAabr8Jcc',
    deckUrl: 'https://docs.google.com/spreadsheets/d/deck/edit', overdue: [{ title: 'Pay deposit invoice', due: '2026-11-01' }],
    warnings: [], text: 'Hi Pat',
  };
  const preview = parseClientMessagePreview(valid, 'PAC-01');
  assert.equal(preview.text, 'Hi Pat');
  assert.equal(preview.overdue.length, 1);
  assert.equal(preview.finalAllowed, false, 'older servers without the field: final message off');
  const final = parseClientMessagePreview({ ...valid, finalAllowed: true, finalReason: '' }, 'PAC-01');
  assert.equal(final.finalAllowed, true);
  const blocked = parseClientMessagePreview({ ...valid, finalAllowed: false, finalReason: 'PAC-02 still open' }, 'PAC-01');
  assert.equal(blocked.finalReason, 'PAC-02 still open');
  assert.throws(() => parseClientMessagePreview({ ...valid, projectId: 'SEN-01' }, 'PAC-01'), /invalid client message preview/);
  assert.throws(() => parseClientMessagePreview({ ...valid, overdue: [{ title: 1 }] }, 'PAC-01'), /invalid overdue task/);
  assert.throws(() => parseClientMessagePreview(null, 'PAC-01'), /invalid client message preview/);
});
