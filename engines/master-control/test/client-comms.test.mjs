import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../Client_Comms.gs', '../Final_Message.gs', '../Reports.gs', '../Finance_Model.gs', '../HUD_Writes.gs', '../Project_Automation.gs', '../Project_Dashboard.gs', '../src/Master_Control_Auth.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = value => JSON.parse(JSON.stringify(value));

const tasks = [
  { id: 'P', title: 'Base', notes: 'Audience: internal\nKey: x::__parent__' },
  { id: 'A', parent: 'P', title: 'Pay deposit invoice', due: '2026-11-01T00:00:00.000Z', status: 'needsAction', notes: 'Audience: client\nKey: a' },
  { id: 'B', parent: 'P', title: 'Sign MSA and SOW', due: '2026-10-30T00:00:00.000Z', status: 'completed', notes: 'Audience: client\nKey: b' },
  { id: 'C', parent: 'P', title: 'Research brief', due: '2026-10-29T00:00:00.000Z', status: 'needsAction', notes: 'Audience: internal\nKey: c' },
  { id: 'D', parent: 'P', title: 'Final QA walkthrough', due: '2026-12-10T00:00:00.000Z', status: 'needsAction', notes: 'Audience: client\nKey: d' },
];

test('overdue digest: open client tasks due before today only', () => {
  assert.deepEqual(plain(context.daisy_overdueClientTasks_(tasks, '2026-11-05')), [{ title: 'Pay deposit invoice', due: '2026-11-01' }]);
});

test('Daisy message: greeting, stage, deck link, waiting-on-you list, signature; [TEST] prefix hidden', () => {
  const text = context.daisy_composeClientMessage_({
    firstName: 'Pat', projectName: '[TEST] Initial Project Build', projectId: 'PAC-01', stage: '06: Mid-Flight Review',
    deckUrl: 'https://docs.google.com/spreadsheets/d/deck/edit', overdue: [{ title: 'Pay deposit invoice', due: '2026-11-01' }],
  });
  assert.match(text, /^Hi Pat, a quick update on \*Initial Project Build\* \(PAC-01\)\./);
  assert.match(text, /We are in \*Mid-Flight Review\*\./);
  assert.match(text, /<https:\/\/docs\.google\.com\/spreadsheets\/d\/deck\/edit\|Open your Command Deck>/);
  assert.match(text, /\*Waiting on you:\*\n• Pay deposit invoice \(due Nov 1\)/);
  assert.match(text, /— Daisy, Session Zero Solutions$/);
  const calm = context.daisy_composeClientMessage_({ firstName: '', projectId: 'PAC-01', overdue: [] });
  assert.match(calm, /^Hi there/);
  assert.match(calm, /Nothing is waiting on you right now/);
});

test('client space only: missing or internal space is refused', () => {
  assert.deepEqual(plain(context.daisy_clientSpace_({ ChatSpaceURL: 'https://mail.google.com/chat/u/0/#chat/space/AAQAabr8Jcc', ChatSpace_Internal_URL: 'https://mail.google.com/chat/u/0/#chat/space/AAQAdTyeZAM' })),
    { name: 'spaces/AAQAabr8Jcc', url: 'https://mail.google.com/chat/u/0/#chat/space/AAQAabr8Jcc' });
  assert.throws(() => context.daisy_clientSpace_({ ProjectID: 'X-01', ChatSpaceURL: '' }), /no client Chat Space/);
  const same = 'https://mail.google.com/chat/u/0/#chat/space/AAQAdTyeZAM';
  assert.throws(() => context.daisy_clientSpace_({ ChatSpaceURL: same, ChatSpace_Internal_URL: same }), /internal space/);
});

test('sendClientMessage is an allowed audited write action', () => {
  assert.ok(context.HUD_WRITE_ACTIONS.includes('sendClientMessage'));
});

test('send mutation confirms on the created message name even when Chat reformats the echoed text', () => {
  const project = { ProjectID: 'PAC-01', ClientID: 'PAC', ChatSpaceURL: 'https://mail.google.com/chat/u/0/#chat/space/AAQAabr8Jcc', ChatSpace_Internal_URL: 'https://mail.google.com/chat/u/0/#chat/space/AAQAdTyeZAM' };
  context.hud_requireSheet_ = (_s, name) => name;
  context.hud_findUniqueRecord_ = (sheet) => ({ record: sheet === 'Projects' ? project : { ClientID: 'PAC', First_Name: 'Pat' } });
  const calls = [];
  context.Chat = { Spaces: { Messages: { create: (body, space) => { calls.push(space); return { name: space + '/messages/m1', text: body.text.replace(/<([^|>]+)\|([^>]+)>/g, '$2') }; } } } };
  const text = 'Hi Pat <https://deck|Open your Command Deck>';
  const mutation = context.hud_prepareClientMessageMutation_({ getSheetByName: () => null }, { projectId: 'PAC-01', text });
  mutation.apply();
  const after = mutation.readAfter();
  assert.equal(mutation.matches(after), true);
  assert.deepEqual(calls, ['spaces/AAQAabr8Jcc']);
  assert.equal(after.text, text);
  assert.equal(after.returnedText, 'Hi Pat Open your Command Deck');
  const failed = context.hud_prepareClientMessageMutation_({ getSheetByName: () => null }, { projectId: 'PAC-01', text });
  context.Chat.Spaces.Messages.create = () => ({});
  failed.apply();
  assert.equal(failed.matches(failed.readAfter()), false);
});

test('duplicate guard: same text to the same space within 10 minutes is refused; edits, old sends and failures are not', () => {
  const now = new Date('2026-11-05T11:00:00.000Z');
  const row = (over) => ({ Action: 'sendClientMessage', Entity: 'chat:spaces/A', Timestamp: '2026-11-05T10:55:00.000Z', Status: 'Confirmed',
    Before: JSON.stringify({ text: 'Hi Pat' }), After: JSON.stringify({ messageName: 'spaces/A/messages/1' }), ...over });
  const dup = (rows, text = 'Hi Pat') => context.daisy_isRecentDuplicate_(rows, 'chat:spaces/A', text, now);
  assert.equal(dup([row({})]), true);
  assert.equal(dup([row({ Status: 'Pending', After: '' })]), true, 'an in-flight post counts');
  assert.equal(dup([row({})], 'Hi Pat, edited'), false);
  assert.equal(dup([row({ Timestamp: '2026-11-05T10:40:00.000Z' })]), false);
  assert.equal(dup([row({ Status: 'Failed', After: '' })]), false);
  assert.equal(dup([row({ Status: 'Failed' })]), true, 'a failed read-back that still created a message counts');
  assert.equal(dup([row({ Entity: 'chat:spaces/B' })]), false);
});

test('final message is allowed only at 08/09 with every other project of the client at 09', () => {
  const p = (id, stage) => ({ ProjectID: id, ClientID: 'PAC', SprintStage: stage });
  const ok = context.daisy_finalEligibility_([p('PAC-01', '08: Liftoff & Handover'), p('PAC-02', '09: Sunset / Retainer')], 'PAC-01');
  assert.deepEqual(plain(ok), { ok: true, reason: '' });
  const early = context.daisy_finalEligibility_([p('PAC-01', '06: Mid-Flight Review')], 'PAC-01');
  assert.equal(early.ok, false);
  assert.match(early.reason, /Liftoff \(08\) or Sunset \(09\)/);
  const shared = context.daisy_finalEligibility_([p('PAC-01', '09: Sunset / Retainer'), p('PAC-02', '02: Contract & Inception')], 'PAC-01');
  assert.equal(shared.ok, false);
  assert.match(shared.reason, /still open: PAC-02/);
  assert.equal(context.daisy_finalEligibility_([], 'PAC-01').ok, false);
});

function fakeDrive(start) {
  const where = { folder: start };
  context.DriveApp = {
    getFolderById: (id) => ({
      id,
      getId: () => id,
      getName: () => 'PAC - [TEST] Prime Auto Collision',
      getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return { getId: () => where.folder }; } }; },
      moveTo: (target) => { where.folder = target.id; },
    }),
  };
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => '' }) };
  return where;
}

test('final send posts, then moves the client folder Active -> Inactive; rollback moves it back; a refusal posts nothing', () => {
  const where = fakeDrive('ACTIVE');
  context.HUD_SANCTUM_ACTIVE_FOLDER_ID = 'ACTIVE';
  const posts = [];
  context.Chat = { Spaces: { Messages: { create: (msg, space) => { posts.push(msg.text); return { name: space + '/messages/m1' }; } } } };
  const saved = { daisy_projectContext_: context.daisy_projectContext_, daisy_recentDuplicate_: context.daisy_recentDuplicate_, daisy_clientProjects_: context.daisy_clientProjects_ };
  context.daisy_projectContext_ = () => ({
    project: { ProjectID: 'PAC-01', ChatSpaceURL: 'https://mail.google.com/chat/u/0/#chat/space/CLIENT', ChatSpace_Internal_URL: 'https://mail.google.com/chat/u/0/#chat/space/INTERNAL' },
    client: { ClientID: 'PAC', DriveFolderUrl: 'https://drive.google.com/drive/folders/1PacFolderPacFolderPacF' },
  });
  context.daisy_recentDuplicate_ = () => false;
  let stage = '08: Liftoff & Handover';
  context.daisy_clientProjects_ = () => [{ ProjectID: 'PAC-01', ClientID: 'PAC', SprintStage: stage }];
  try {
    const m = context.hud_prepareClientMessageMutation_({}, { projectId: 'PAC-01', text: 'Thank you, all done.', final: true });
    assert.equal(m.before.final, true);
    m.apply();
    const after = m.readAfter();
    assert.equal(m.matches(after), true);
    assert.equal(after.archived, true);
    assert.equal(where.folder, context.DAISY_INACTIVE_DEFAULT_ID);
    assert.deepEqual(posts, ['Thank you, all done.']);
    m.rollback();
    assert.equal(where.folder, 'ACTIVE', 'rollback restores the folder');

    // not final -> no folder move
    const plainSend = context.hud_prepareClientMessageMutation_({}, { projectId: 'PAC-01', text: 'Normal update' });
    plainSend.apply();
    assert.equal(where.folder, 'ACTIVE');
    assert.equal(plainSend.readAfter().final, false);

    // ineligible -> refused before posting
    stage = '05: Architecture & Builds';
    assert.throws(() => context.hud_prepareClientMessageMutation_({}, { projectId: 'PAC-01', text: 'Bye', final: true }), /Liftoff \(08\)/);
    assert.equal(posts.length, 2);
  } finally {
    Object.assign(context, saved);
  }
});

test('restoreClientFolder moves Inactive -> Active and refuses when the folder is not archived', () => {
  const where = fakeDrive('1vvPDDq4pw037kwkKDEdZbCfEWXc16eSl');
  context.HUD_SANCTUM_ACTIVE_FOLDER_ID = 'ACTIVE';
  const saved = { hud_requireSheet_: context.hud_requireSheet_, hud_findUniqueRecord_: context.hud_findUniqueRecord_ };
  context.hud_requireSheet_ = () => 'Clients';
  context.hud_findUniqueRecord_ = () => ({ record: { ClientID: 'PAC', DriveFolderUrl: 'https://drive.google.com/drive/folders/1PacFolderPacFolderPacF' } });
  try {
    assert.ok(context.HUD_WRITE_ACTIONS.includes('restoreClientFolder'));
    const m = context.hud_prepareRestoreFolderMutation_({}, { clientId: 'PAC' });
    m.apply();
    assert.equal(m.matches(m.readAfter()), true);
    assert.equal(where.folder, 'ACTIVE');
    assert.throws(() => context.hud_prepareRestoreFolderMutation_({}, { clientId: 'PAC' }), /not in Sanctum Inactive/);
  } finally {
    Object.assign(context, saved);
  }
});
