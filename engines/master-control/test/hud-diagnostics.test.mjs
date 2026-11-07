import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
for (const file of ['../src/Central_Router.gs', '../Schema_Registry.gs', '../HUD_Diagnostics.gs']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}

function listRule(values, helpText) {
  return {
    getCriteriaType: () => 'VALUE_IN_LIST',
    getCriteriaValues: () => [values, true],
    getAllowInvalid: () => false,
    getHelpText: () => helpText,
  };
}

function forbidden() { throw new Error('diagnostics must not write'); }

function mockSheet(grid, rulesByCell = {}) {
  return {
    getDataRange: () => ({ getValues: () => grid.map(row => [...row]) }),
    getMaxRows: () => grid.length,
    getLastColumn: () => grid[0].length,
    getRange: (row, column, numRows = 1) => ({
      getDataValidation: () => rulesByCell[`${row}:${column}`] || null,
      getDataValidations: () => Array.from({ length: numRows }, (_, i) => [rulesByCell[`${row + i}:${column}`] || null]),
      setValue: forbidden,
      setValues: forbidden,
      setDataValidation: forbidden,
    }),
    appendRow: forbidden,
    deleteRow: forbidden,
  };
}

test('diagnoseHudWritePath_ reports per-row phase rules, registry gaps, and failed writes without writing', () => {
  const legacy = listRule(['01: Intake', '02: Inception'], 'Please select an option from the approved list.');
  const canonical = listRule(['01: Intake', '02: Session Zero'], '');
  const clients = mockSheet(
    [['ClientID', 'AccountPhase', 'AccountPhase_Mode'], ['AAA', '02: Inception', 'auto'], ['BBB', '01: Intake', 'auto'], ['', '', '']],
    { '2:2': legacy, '3:2': canonical, '4:2': canonical },
  );
  const registry = mockSheet([
    ['Registry_ID', 'Database', 'Tab', 'Column_Letter', 'Column_Name', 'Data_Type', 'Allowed_Values', 'Data_Class', 'Owner_Persona'],
    ['R1', 'Master Control', 'Clients', 'H', 'AccountPhase', 'enum', '01: Intake', 'Internal', 'Pamela'],
    ['R2', 'Master Control', 'Clients', 'Z', 'AccountPhase_Mode', 'enum', 'auto,manual', '', ''],
    ['R3', 'Master Control', 'Clients', 'Z', 'AccountPhase_Mode', 'enum', 'auto,manual', '', ''],
  ]);
  const audit = mockSheet([
    ['Timestamp', 'Action', 'Status', 'Error'],
    ['t1', 'setAccountPhase', 'Failed', 'Please select an option from the approved list.'],
    ['t2', 'resolveAlert', 'Confirmed', ''],
  ]);
  const sheets = { Clients: clients, Schema_Registry: registry, HUD_Audit_Log: audit };
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => '' }) };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({ getId: () => 'sheet-id', getName: () => 'WC', getSheetByName: name => sheets[name] || null }),
  };

  const report = context.diagnoseHudWritePath_();

  assert.equal(report.clients.accountPhaseColumn, 'B');
  assert.equal(report.clients.phaseRuleRanges.length, 2);
  assert.deepEqual([report.clients.phaseRuleRanges[0].fromRow, report.clients.phaseRuleRanges[0].toRow], [2, 2]);
  assert.match(report.clients.rows[0].phaseRule, /02: Inception/);
  assert.match(report.clients.rows[0].phaseRule, /allowInvalid=false/);
  assert.equal(report.clients.rows.length, 2);
  assert.equal(report.registry.totalRows, 3);
  assert.equal(report.registry.incompleteCount, 3);
  assert.ok(report.triggers.error, "ScriptApp is absent in the mock, so triggers report an error object");
  assert.equal(report.registry.duplicateKeys['Master Control|Clients|AccountPhase_Mode'], 2);
  assert.equal(report.recentFailedWrites.length, 1);
  assert.equal(report.recentFailedWrites[0].Action, 'setAccountPhase');
});
