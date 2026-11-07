import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../Catalog_Check.gs', '../Project_Automation.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}

test('component IDs parse from comma lists and JSON arrays; all 14 mapped tabs resolve', () => {
  assert.deepEqual([...context.dolores_componentIds_('comp_a, comp_b')], ['comp_a', 'comp_b']);
  assert.deepEqual([...context.dolores_componentIds_('["comp_a","comp_b"]')], ['comp_a', 'comp_b']);
  assert.deepEqual([...context.dolores_componentIds_('')], []);
  const tabs = Object.values(context.DOLORES_COMPONENT_TABS);
  assert.equal(tabs.length, 14);
  const picked = context.dolores_projectTabs_({ ActiveComponents: '["comp_looker_war_room"]' }, ['Project_Lifecycle_Base', 'Offboarding_Sunset_Archive', ...tabs]);
  assert.deepEqual([...picked.tabs], ['Project_Lifecycle_Base', 'Looker_Studio_Executive_War_Room', 'Offboarding_Sunset_Archive']);
});

test('catalog findings: missing mapped tab, unmapped tabs, duplicate keys, unknown project references', () => {
  const findings = context.catalog_findings_({
    componentTabs: { comp_a: 'A_Tab', comp_b: 'Missing_Tab' },
    tabs: [
      { tab: 'Project_Lifecycle_Base', tasks: ['Kickoff'] },
      { tab: 'Offboarding_Sunset_Archive', tasks: ['Archive'] },
      { tab: 'A_Tab', tasks: ['Set up DNS', 'Set-up DNS'] },
      { tab: 'Extra_Tab', tasks: [] },
    ],
    projects: [{ projectId: 'PAC-01', components: ['comp_a', 'comp_x'], templates: ['Extra_Tab', 'Nope_Tab'] }],
  });
  assert.deepEqual([...findings], [
    'Component comp_b maps to missing tab Missing_Tab.',
    'Tab Extra_Tab (0 tasks) is not mapped to a service component; reachable only via Projects.Task_Templates.',
    'Tab A_Tab repeats task "Set-up DNS" (duplicate Key A_Tab::set-up-dns).',
    'Tab Extra_Tab has no tasks.',
    'PAC-01 uses component comp_x which has no template tab.',
    'PAC-01 names unknown template tab Nope_Tab in Task_Templates.',
  ]);
});
