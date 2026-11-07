import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../Project_Automation.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = value => JSON.parse(JSON.stringify(value));

test('template defaults: phase offsets, estimate days, client hints, last task is the milestone', () => {
  const rows = [
    ['1. Audit', 'Domain Registrar Access', 'Secure delegated access to the DNS registrar.', '30 min', 'Dolores', '[ ]'],
    ['2. SPF Setup', 'SPF String Injection', 'Generate and inject the TXT record.', '60 min', 'Dolores', '[ ]'],
    ['5. Validation', 'Video walkthrough', 'Record a 3-minute walkthrough for the client.', '2 hrs', 'Dolores', '[ ]'],
  ];
  const fields = plain(context.dolores_defaultTemplateFields_(rows));
  assert.deepEqual(fields.map(f => f.Offset_Days), [0, 2, 8]);
  assert.deepEqual(fields.map(f => f.Duration_Days), [1, 1, 1]);
  assert.deepEqual(fields.map(f => f.Audience), ['client', 'internal', 'client']);
  assert.deepEqual(fields.map(f => f.Is_Milestone), [false, false, true]);
  assert.equal(context.dolores_estimateDays_('10 hrs'), 3);
});

test('project tabs = base + mapped components + Task_Templates + offboarding, de-duplicated', () => {
  const available = ['Project_Lifecycle_Base', 'DNS_Security_Protocols', 'MCC_Newsletter_Engine_Setup', 'Local_SEO_and_GBP_PowerUp', 'Offboarding_Sunset_Archive'];
  const selection = plain(context.dolores_projectTabs_({
    ActiveComponents: 'comp_dns_shield, comp_gantt_symphony,comp_dns_shield',
    Task_Templates: 'Local_SEO_and_GBP_PowerUp, Typo_Tab',
  }, available));
  assert.deepEqual(selection.tabs, ['Project_Lifecycle_Base', 'DNS_Security_Protocols', 'Local_SEO_and_GBP_PowerUp', 'Offboarding_Sunset_Archive']);
  assert.deepEqual(selection.unknown, ['Typo_Tab']);
  assert.deepEqual(plain(context.dolores_projectTabs_({}, available)).tabs, ['Project_Lifecycle_Base', 'Offboarding_Sunset_Archive']);
});

test('task plan: notes start with Audience/Start/Key, dates follow the 45-day cadence, keys are stable', () => {
  const kickoff = new Date(2026, 10, 2);
  const plan = context.dolores_buildTaskPlan_([
    { tab: 'Project_Lifecycle_Base', title: 'Project Lifecycle Base', tasks: [{ name: 'Sign MSA and SOW', description: 'Sign it.', offset: 5, duration: 2, audience: 'client', milestone: true }] },
    { tab: 'DNS_Security_Protocols', title: 'DNS Security Protocols', tasks: [{ name: 'SPF String Injection', description: '', offset: 2, duration: 1, audience: 'internal', milestone: false }] },
    { tab: 'Offboarding_Sunset_Archive', title: 'Offboarding Sunset Archive', tasks: [{ name: 'Workspace Lockout', description: '', offset: 0, duration: 1, audience: 'internal', milestone: false }] },
  ], kickoff);
  const sign = plan[0].children[0];
  assert.match(sign.notes, /^Audience: client\nStart: 2026-11-07\nKey: Project_Lifecycle_Base::sign-msa-and-sow\n\nSign it\.$/);
  assert.equal(context.dolores_isoDate_(sign.due), '2026-11-08');
  assert.equal(sign.milestone, true);
  assert.equal(context.dolores_isoDate_(plan[1].children[0].start), '2026-11-21', 'component tabs start after kickoff (day 17 + offset)');
  assert.equal(context.dolores_isoDate_(plan[2].children[0].start), '2026-12-17', 'offboarding starts at day 45');
  assert.equal(plan[1].parent.key, 'DNS_Security_Protocols::parent');
  assert.equal(context.dolores_noteKey_(sign.notes), 'Project_Lifecycle_Base::sign-msa-and-sow');
  assert.equal(context.dolores_noteKey_('no key here'), null);
});

test('list readiness, asset names, group email and Chat Space URL round-trip', () => {
  assert.deepEqual(plain(context.dolores_listReadiness_({ AssignedRateTier: 'Normal ($85)', Project_Brief_DocID: 'b' })),
    ['Project_Outline_DocID', 'ChatSpaceURL', 'ChatSpace_Internal_URL']);
  assert.deepEqual(plain(context.dolores_listReadiness_({
    AssignedRateTier: 'Normal', Project_Brief_DocID: 'b', Project_Outline_DocID: 'o', ChatSpaceURL: 'c', ChatSpace_Internal_URL: 'i',
  })), []);
  const names = plain(context.dolores_assetNames_('PAC', 'Initial Project Build'));
  assert.equal(names.brief, 'PAC - Initial Project Build - Project Brief');
  assert.equal(names.dashboard, 'PAC - Initial Project Build - Command Deck');
  assert.equal(names.clientSpace, 'PAC - Initial Project Build - Client');
  assert.equal(context.dolores_groupEmail_('PAC2'), 'client-pac2@sessionzero.solutions');
  const url = context.dolores_spaceUrl_('spaces/AAAAbc123');
  assert.equal(context.dolores_spaceName_(url), 'spaces/AAAAbc123');
});

test('retryNotFound retries only "not found" errors, up to 6 attempts', () => {
  let sleeps = 0;
  context.Utilities = { sleep: () => { sleeps += 1; } };
  let calls = 0;
  assert.equal(context.dolores_retryNotFound_(() => { calls += 1; if (calls < 3) throw new Error('Resource Not Found: groupKey'); return 'ok'; }), 'ok');
  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
  calls = 0;
  assert.throws(() => context.dolores_retryNotFound_(() => { calls += 1; throw new Error('Permission denied'); }), /Permission denied/);
  assert.equal(calls, 1);
  calls = 0;
  assert.throws(() => context.dolores_retryNotFound_(() => { calls += 1; throw new Error('404 not found'); }), /not found/);
  assert.equal(calls, 6);
});

test('base lifecycle covers every SprintStage within the 45-day cadence', () => {
  const stages = new Set(context.DOLORES_BASE_TASKS.map(t => t[0].slice(0, 2)));
  assert.deepEqual([...stages].sort(), ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09']);
  assert.ok(context.DOLORES_BASE_TASKS.every(t => t[3] >= 0 && t[3] <= 45));
  assert.ok(context.DOLORES_BASE_TASKS.some(t => t[5] === 'client') && context.DOLORES_BASE_TASKS.some(t => t[6] === true));
});
