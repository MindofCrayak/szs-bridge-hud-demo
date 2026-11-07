import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../Finance_Model.gs', '../src/Master_Control_Auth.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const contract = (over) => ({ rowNumber: 2, ProjectID: 'PAC-01', ClientID: 'PAC', MilestoneStage: 'Contract', TotalContractValue: 13500, TCV_At_First_Invoice: '', ...over });

test('attach price: adds to the project contract-row TCV in cents', () => {
  assert.deepEqual(plain(context.vala_tcvIncreasePlan_([contract({}), contract({ rowNumber: 3, ProjectID: 'PAC-02', TotalContractValue: 900 })], 'PAC-01', 1500.1)),
    { rowNumber: 2, before: 13500, after: 15000.1 });
  assert.deepEqual(plain(context.vala_tcvIncreasePlan_([contract({ TotalContractValue: '' })], 'PAC-01', 680)), { rowNumber: 2, before: 0, after: 680 });
});

test('attach price: refused without a contract row, with two, or once invoicing started (R10)', () => {
  assert.throws(() => context.vala_tcvIncreasePlan_([], 'PAC-01', 100), (e) => e.code === 'NO_CONTRACT_ROW');
  assert.throws(() => context.vala_tcvIncreasePlan_([contract({}), contract({ rowNumber: 3 })], 'PAC-01', 100), (e) => e.code === 'DUPLICATE_CONTRACT');
  assert.throws(() => context.vala_tcvIncreasePlan_([contract({ TCV_At_First_Invoice: 13500 })], 'PAC-01', 100), (e) => e.code === 'CONTRACT_INVOICED' && /addendum/.test(e.message));
  assert.throws(() => context.vala_tcvIncreasePlan_([contract({ MilestoneStage: 'Deposit (1/3)' })], 'PAC-01', 100), (e) => e.code === 'NO_CONTRACT_ROW');
});
