import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../Finance_Model.gs', '../HUD_Writes.gs', '../Project_Automation.gs', '../Project_Dashboard.gs', '../Task_Writes.gs', '../src/Master_Control_Auth.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = value => JSON.parse(JSON.stringify(value));

/** In-memory Google Tasks list with the calls Task_Writes uses. */
function fakeTasks(initial) {
  const items = new Map(initial.map(t => [t.id, { ...t }]));
  let next = 1;
  const calls = [];
  context.Tasks = { Tasks: {
    get: (listId, id) => { if (!items.has(id)) throw new Error('Not Found'); return { ...items.get(id) }; },
    insert: (resource, listId, opts) => { const id = 'N' + next++; items.set(id, { id, status: 'needsAction', ...resource, ...(opts && opts.parent ? { parent: opts.parent } : {}) }); calls.push(['insert', id]); return { id }; },
    patch: (body, listId, id) => { Object.assign(items.get(id), body); calls.push(['patch', id, body.status]); },
    remove: (listId, id) => { items.delete(id); calls.push(['remove', id]); },
  } };
  return { items, calls };
}
context.Utilities = { getUuid: () => 'abcdef12-3456' };
context.hud_requireSheet_ = (_s, name) => name;
context.hud_findUniqueRecord_ = () => ({ record: { ProjectID: 'PAC-01', Google_Tasklist_ID: 'L1' } });

const base = [
  { id: 'P', title: 'Project Lifecycle Base', notes: 'Audience: internal\nKey: x::__parent__', status: 'needsAction' },
  { id: 'A', parent: 'P', title: 'Pay deposit', notes: 'Audience: client\nKey: a', status: 'needsAction' },
];

test('createTask and setTaskStatus are allowed audited actions', () => {
  assert.ok(context.HUD_WRITE_ACTIONS.includes('createTask'));
  assert.ok(context.HUD_WRITE_ACTIONS.includes('setTaskStatus'));
});

test('notes and due helpers follow the Tasks conventions', () => {
  assert.equal(context.taskw_notes_('client', 'hud::1', 'Bring the logo files.'), 'Audience: client\nKey: hud::1\n\nBring the logo files.');
  assert.equal(context.taskw_notes_('internal', 'hud::1', ''), 'Audience: internal\nKey: hud::1');
  assert.equal(context.dashboard_description_(context.taskw_notes_('client', 'hud::1', 'Body')), 'Body');
  assert.equal(context.taskw_due_('2026-11-20'), '2026-11-20T00:00:00.000Z');
  assert.equal(context.taskw_due_(''), '');
  assert.throws(() => context.taskw_due_('2026-02-30'), /YYYY-MM-DD/);
  assert.throws(() => context.taskw_due_('11/20/2026'), /YYYY-MM-DD/);
});

test('createTask writes the Audience line, nests under the parent and confirms on read-back', () => {
  const fake = fakeTasks(base);
  const m = context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: 'Send logo files', notes: 'SVG please', due: '2026-11-20', parentId: 'P', clientFacing: true });
  m.apply();
  const after = m.readAfter();
  assert.equal(m.matches(after), true);
  assert.deepEqual(plain(after), { taskId: 'N1', title: 'Send logo files', status: 'needsAction', due: '2026-11-20', parentId: 'P', audience: 'client', deleted: false, projectId: 'PAC-01', key: 'hud::abcdef12' });
  assert.equal(fake.items.get('N1').notes, 'Audience: client\nKey: hud::abcdef12\n\nSVG please');
  m.rollback();
  assert.equal(fake.items.has('N1'), false, 'rollback removes the created task');
});

test('createTask refuses bad input before touching Tasks', () => {
  const fake = fakeTasks(base);
  assert.throws(() => context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: '' }), /title are required/);
  assert.throws(() => context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: 'X', clientFacing: true }), /need a parent/);
  assert.throws(() => context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: 'X', parentId: 'A' }), /one level/);
  assert.throws(() => context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: 'X', parentId: 'nope' }), /not found/);
  assert.throws(() => context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: 'X', due: 'soon' }), /YYYY-MM-DD/);
  assert.deepEqual(fake.calls, []);
  const internal = context.hud_prepareTaskCreateMutation_({}, { projectId: 'PAC-01', title: 'Internal top-level' });
  internal.apply();
  assert.equal(internal.matches(internal.readAfter()), true, 'internal tasks may be top-level with no due date');
});

test('setTaskStatus completes and reopens with read-back; no-op and rollback', () => {
  const fake = fakeTasks(base);
  const done = context.hud_prepareTaskStatusMutation_({}, { projectId: 'PAC-01', taskId: 'A', done: true });
  done.apply();
  assert.equal(done.matches(done.readAfter()), true);
  assert.equal(fake.items.get('A').status, 'completed');
  assert.throws(() => context.hud_prepareTaskStatusMutation_({}, { projectId: 'PAC-01', taskId: 'A', done: true }), /already complete/);
  const reopen = context.hud_prepareTaskStatusMutation_({}, { projectId: 'PAC-01', taskId: 'A', done: false });
  reopen.apply();
  assert.equal(reopen.matches(reopen.readAfter()), true);
  assert.equal(fake.items.get('A').status, 'needsAction');
  reopen.rollback();
  assert.equal(fake.items.get('A').status, 'completed', 'rollback restores the previous status');
  assert.throws(() => context.hud_prepareTaskStatusMutation_({}, { projectId: 'PAC-01', taskId: 'A', done: 'yes' }), /done \(true or false\)/);
});
