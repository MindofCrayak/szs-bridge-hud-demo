import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });
// Apps Script order: root files alphabetically, then src/.
for (const file of [
  '../Finance_Model.gs', '../HUD_API.gs', '../HUD_Diagnostics.gs', '../HUD_Seed.gs', '../src/Master_Control_Auth.gs', '../HUD_Writes.gs',
  '../Schema_Registry.gs', '../src/Central_Router.gs', '../src/Pipeline_Phase_Gate.gs',
]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
}
const data = JSON.parse(JSON.stringify(context.hud_seedDataset_({}, 2026)));

test('seed IDs follow section 3 and every row is visibly test data', () => {
  for (const c of data.clients) {
    assert.match(c.ClientID, /^[A-Z]{3}\d{0,2}$/);
    assert.ok(c.Company_Name.startsWith('[TEST] '));
    assert.equal(c.GoogleGroupEmail, `client-${c.ClientID.toLowerCase()}@sessionzero.solutions`);
  }
  for (const p of data.projects) {
    assert.match(p.ProjectID, /^[A-Z]{3}\d{0,2}-\d{2,3}$/);
    assert.ok(p.ProjectName.startsWith('[TEST] '));
  }
  const invoices = data.finances.filter(f => f.MilestoneStage !== 'Contract');
  const malformed = invoices.filter(f => !/^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$/.test(f.InvoiceID));
  assert.deepEqual(malformed.map(f => f.InvoiceID), ['INV-PAC-1'], 'exactly one deliberate malformed row');
  for (const alert of data.alerts) assert.ok(alert.Trigger_Condition.startsWith('[TEST] '));
});

test('seed covers all six AccountPhases, 8 projects, and a two-project client', () => {
  assert.equal(data.clients.length, 6);
  assert.deepEqual([...new Set(data.clients.map(c => c.AccountPhase))].sort(), [...context.HUD_WRITE_ACCOUNT_PHASES].sort());
  assert.equal(data.projects.length, 8);
  const perClient = data.projects.reduce((all, p) => ({ ...all, [p.ClientID]: (all[p.ClientID] || 0) + 1 }), {});
  assert.ok(Object.values(perClient).some(count => count >= 2));
  for (const c of data.clients.filter(c => c.AccountPhase_Mode === 'auto')) {
    const derived = context.hud_deriveAccountPhase_(data.projects.filter(p => p.ClientID === c.ClientID), c.ClientID, '01: Intake');
    assert.equal(c.AccountPhase, derived, `${c.ClientID} auto phase matches derivation`);
  }
  assert.deepEqual(data.alerts.map(a => a.Severity).sort(), ['BLOCK', 'INFO', 'WARN']);
});

test('projects at stage 04+ satisfy the gate (deposit, MSA, SOW)', () => {
  for (const p of data.projects) {
    const stage = context.HUD_WRITE_SPRINT_STAGES.indexOf(p.SprintStage);
    if (stage < 4) continue;
    const client = data.clients.find(c => c.ClientID === p.ClientID);
    const depositPaid = data.finances.some(f => f.ClientID === p.ClientID && f.DepositPaid === true);
    assert.ok(depositPaid, `${p.ProjectID} deposit`);
    assert.ok(client.MSA_DocID, `${p.ProjectID} MSA`);
    assert.ok(p.SOW_DocID, `${p.ProjectID} SOW`);
  }
});

test('finance model: one contract row per contracted project; invoices never exceed TCV; final makes the total', () => {
  for (const p of data.projects) {
    const contracts = data.finances.filter(f => f.ProjectID === p.ProjectID && f.MilestoneStage === 'Contract');
    const invoices = data.finances.filter(f => f.ProjectID === p.ProjectID && f.MilestoneStage !== 'Contract' && f.InvoiceID !== 'INV-PAC-1');
    if (!contracts.length) { assert.equal(invoices.length, 0); continue; }
    assert.equal(contracts.length, 1);
    const tcv = contracts[0].TotalContractValue;
    const cents = v => Math.round(v * 100);
    const issued = invoices.reduce((sum, f) => sum + cents(f.InvoiceAmount), 0) / 100;
    assert.ok(issued <= tcv, `${p.ProjectID} issued <= TCV`);
    if (invoices.length === 3) assert.equal(issued, tcv, `${p.ProjectID} three invoices equal TCV`);
    const paid = invoices.filter(f => f.InvoiceStatus === 'Paid').reduce((sum, f) => sum + cents(f.InvoiceAmount), 0);
    assert.equal(cents(contracts[0].Remaining_Balance), cents(tcv) - paid);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(context.hud_invoiceSchedule_(10000))), [3333.33, 3333.33, 3333.34]);
  // Per-client-per-year numbering continues across a client's projects.
  const pac = data.finances.filter(f => f.ClientID === 'PAC' && /^INV-PAC-26-\d{3}$/.test(f.InvoiceID)).map(f => f.InvoiceID);
  assert.deepEqual(pac, ['INV-PAC-26-001', 'INV-PAC-26-002', 'INV-PAC-26-003']);
});

test('deliberate R1 mismatch exists only on PAC', () => {
  for (const c of data.clients) {
    const tcv = data.finances.filter(f => f.ClientID === c.ClientID && f.MilestoneStage === 'Contract')
      .reduce((sum, f) => sum + f.TotalContractValue, 0);
    if (c.ClientID === 'PAC') assert.notEqual(c.ContractValue, tcv);
    else assert.equal(c.ContractValue, tcv, c.ClientID);
  }
});

test('pre-flight reports dropdown conflicts and allows only whitelisted additive values', () => {
  const listRule = values => ({ getCriteriaType: () => 'VALUE_IN_LIST', getCriteriaValues: () => [values, true] });
  const sheet = {
    getLastColumn: () => 2,
    getRange: (row, column, rows = 1, columns = 1) => ({
      getValues: () => [['ClientID', 'MilestoneStage']],
      getDataValidations: () => Array.from({ length: rows }, () => [null, listRule(['Deposit (1/3)'])]),
    }),
  };
  const conflicts = [];
  const extensions = [];
  context.hud_preflightRows_(sheet, 'Finances', [
    { ClientID: 'PAC', MilestoneStage: 'Contract' },
    { ClientID: 'PAC', MilestoneStage: 'Deposit (1/3)' },
    { ClientID: 'PAC', MilestoneStage: 'Bogus' },
  ], conflicts, extensions);
  assert.deepEqual(JSON.parse(JSON.stringify(extensions)), [{ tab: 'Finances', column: 'MilestoneStage', value: 'Contract' }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].value, 'Bogus');
});

test('pre-flight treats checkbox rules on non-boolean columns as stray, but keeps real checkbox columns strict', () => {
  const checkbox = { getCriteriaType: () => 'CHECKBOX', getCriteriaValues: () => [] };
  const sheet = {
    getLastColumn: () => 2,
    getRange: (row, column, rows = 1) => ({
      getValues: () => [['DepositAmount', 'DepositPaid']],
      getDataValidations: () => Array.from({ length: rows }, () => [checkbox, checkbox]),
    }),
  };
  const conflicts = [];
  const extensions = [];
  context.hud_preflightRows_(sheet, 'Finances', [{ DepositAmount: 2000, DepositPaid: 'yes' }, { DepositAmount: 3000, DepositPaid: true }], conflicts, extensions);
  assert.deepEqual(JSON.parse(JSON.stringify(extensions)), [{ tab: 'Finances', column: 'DepositAmount', clearStrayCheckboxes: true }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].column, 'DepositPaid');
});

test('seed row keys use the tab identity column and match the known seed keys', () => {
  assert.equal(context.hud_seedRowKey_('Projects', { ProjectID: 'PAC-01', ClientID: 'PAC' }), 'PAC-01');
  assert.equal(context.hud_seedRowKey_('Alfred_Alerts', { Alert_ID: 'ALT-TEST-001', ClientID: 'ZES' }), 'ALT-TEST-001');
  assert.equal(context.hud_seedRowKey_('Finances', { InvoiceID: '', ProjectID: 'PAC-01' }), 'contract:PAC-01');
  const known = JSON.parse(JSON.stringify(context.hud_seedKnownKeys_(2026)));
  assert.equal(known.Projects.length, 8);
  assert.ok(known.Projects.includes('ORT-01'));
  assert.ok(known.Alfred_Alerts.includes('ALT-TEST-003'));
  assert.ok(known.Finances.includes('INV-PAC-1'));
  assert.equal(known.Clients.includes('PAC-01'), false);
});

test('provisioning results fill the seeded client and first-project cells', () => {
  const updates = JSON.parse(JSON.stringify(context.hud_provisioningCellUpdates_('PAC', {
    clientFolderUrl: 'https://drive/f', kickoffDocUrl: 'https://docs/k', msaDocId: 'msa', sowDocId: 'sow', meetingNotesFolderId: 'notes',
  })));
  assert.deepEqual(updates, {
    Clients: { key: 'PAC', values: { DriveFolderUrl: 'https://drive/f', NotesDocUrl: 'https://docs/k', MSA_DocID: 'msa' } },
    Projects: { key: 'PAC-01', values: { SOW_DocID: 'sow', MeetingNotes_DriveFolderID: 'notes' } },
  });
});

test('Drive names follow <ClientID> - <Project Name> - <document>', () => {
  vm.runInContext(readFileSync(new URL('../src/Drive_Provisioning.gs', import.meta.url), 'utf8'), context);
  const names = JSON.parse(JSON.stringify(context.driveNames_('PAC', 'Prime Auto Collision', 'Initial Project Build', 'INV-PAC-26-001')));
  assert.deepEqual(names, {
    clientRoot: 'PAC - Prime Auto Collision',
    projectFolder: 'PAC - Initial Project Build',
    msa: 'PAC - Prime Auto Collision - Master Services Agreement',
    sow: 'PAC - Initial Project Build - SOW',
    invoice: 'PAC - Initial Project Build - Invoice INV-PAC-26-001',
    kickoffNotes: 'PAC - Initial Project Build - Session Zero Kickoff Notes',
  });
  assert.equal(context.driveNames_('PAC', 'X', '', 'I').sow, 'PAC - Initial Project Build - SOW');
});

test('MSA/SOW tag values use the ${...} template names and leave unknowns empty', () => {
  context.Utilities = { formatDate: () => 'November 04, 2026' };
  context.Session = { getScriptTimeZone: () => 'America/Los_Angeles' };
  const sow = JSON.parse(JSON.stringify(context.templateTagValues_('sow', {
    companyName: 'Prime Auto Collision', firstName: 'Pat', lastName: 'Alvarez', estValue: 9000, depositAmt: 3000, leadData: {},
  })));
  assert.equal(sow['${Client Business name}'], 'Prime Auto Collision');
  assert.equal(sow["${today's date}"], 'November 04, 2026');
  assert.equal(sow['${Business Owners name}'], 'Pat Alvarez');
  assert.equal(sow['${Project Total}'], '$9,000.00');
  assert.equal(sow['${Deposit}'], '$3,000.00');
  assert.equal(sow['${Client Business Address}'], '', 'unknown stays empty so the tag remains visible');
  const msa = JSON.parse(JSON.stringify(context.templateTagValues_('msa', { companyName: 'X', leadData: {} })));
  assert.equal(msa['${Deposit}'], undefined);
});
