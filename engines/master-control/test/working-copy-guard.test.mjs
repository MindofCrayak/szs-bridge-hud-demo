import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../src/Central_Router.gs', '../Schema_Registry.gs', '../src/Master_Control_Auth.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const plain = value => JSON.parse(JSON.stringify(value));

test('Working Copy guard refuses the Original and any other spreadsheet', () => {
  const target = id => {
    context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => id }) };
    context.SpreadsheetApp = { openById: () => ({ getId: () => id }) };
  };
  target('1VLvipkP8LUOX2_F4RdIFHrq7e346XRSk1nYSClTVDy0');
  assert.throws(() => context.hud_assertWorkingCopy_(), /ORIGINAL/);
  target('some-other-sheet');
  assert.throws(() => context.hud_assertWorkingCopy_(), /not the Working Copy/);
  target('1KlP547wMInbfabpbAYI-sx8oirIQ8A19wlUquUdx3Rs');
  assert.equal(context.hud_assertWorkingCopy_().getId(), '1KlP547wMInbfabpbAYI-sx8oirIQ8A19wlUquUdx3Rs');
});

