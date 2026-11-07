import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../HUD_API.gs', '../Project_Automation.gs', '../Project_Dashboard.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}

test('milestone keys: computed from the project tabs once, then served from the 10-minute cache; failures return []', () => {
  const store = new Map();
  let opens = 0;
  context.CacheService = { getScriptCache: () => ({ get: (k) => store.get(k) ?? null, put: (k, v, ttl) => { assert.equal(ttl, 600); store.set(k, v); } }) };
  context.SpreadsheetApp = { openById: () => { opens += 1; return { repo: true }; } };
  context.deck_milestoneKeys_ = () => ({ 'Project_Lifecycle_Base::sign-msa-and-sow': true });
  const project = { ProjectID: 'PAC-01' };
  assert.deepEqual([...context.hud_milestoneKeys_(project)], ['Project_Lifecycle_Base::sign-msa-and-sow']);
  assert.deepEqual([...context.hud_milestoneKeys_(project)], ['Project_Lifecycle_Base::sign-msa-and-sow']);
  assert.equal(opens, 1);
  context.deck_milestoneKeys_ = () => { throw new Error('repo unavailable'); };
  assert.deepEqual([...context.hud_milestoneKeys_({ ProjectID: 'OTHER' })], []);
});
