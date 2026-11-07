import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(readFileSync(new URL('../Linked_Databases.gs', import.meta.url), 'utf8'), context);
const plain = (v) => JSON.parse(JSON.stringify(v));

test('linked DB preview lists exactly the owner-name and email changes the Police sync would make', () => {
  const clients = [['PAC', 'Pat', 'Ace', 'Prime', 'pat@new.example', ''], ['SEN', 'Sam', 'Sun', 'Solar', 'sam@x.example', ''], ['', '', '', '', '', '']];
  const oracle = [['B1', 'PAC', 'x', 'Pat Old'], ['B2', 'ZZZ', 'x', 'Nobody']];
  const mcc = [['S1', 'pat@old.example', '', '', '', '', '', 'pac'], ['S2', 'sam@x.example', '', '', '', '', '', 'SEN']];
  assert.deepEqual(plain(context.linked_planChanges_(clients, oracle, mcc)), {
    oracle: [{ clientId: 'PAC', row: 2, from: 'Pat Old', to: 'Pat Ace' }],
    mcc: [{ clientId: 'PAC', row: 2, from: 'pat@old.example', to: 'pat@new.example' }],
  });
  assert.deepEqual(plain(context.linked_planChanges_(clients, [], [])), { oracle: [], mcc: [] });
});
