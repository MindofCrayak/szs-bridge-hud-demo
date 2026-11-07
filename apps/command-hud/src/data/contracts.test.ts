import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ClientIdSchema,
  ClientSchema,
  InvoiceIdSchema,
  LegacyComsClientIdSchema,
  LegacyComsProjectIdSchema,
  ProjectIdSchema,
  ProjectSchema,
  DataContractError,
  isValidClientId,
  isValidInvoiceId,
  isValidLegacyComsClientId,
  isValidLegacyComsProjectId,
  isValidProjectId,
  parseRows,
} from './contracts';
import { createClientId, createInvoiceId, createProjectId } from './identity';
import { EXPECTED_SCHEMA_VERSION, LiveAdapter, MockAdapter, SnapshotAdapter, findSchemaVersionMismatches } from './adapter';
import type { SnapshotCsvFiles } from './snapshotData';

test('typed IDs follow the Master Plan v3.1 section 3 standard', () => {
  for (const id of ['PAC', 'PAC2', 'PAC12', 'ZZZ']) assert.equal(isValidClientId(id), true, id);
  for (const id of ['PAC-26', 'PAC-26-02', 'C-107', 'AB', 'ICA-02', 'pac', 'PAC123', 'PA2C']) assert.equal(isValidClientId(id), false, id);
  for (const id of ['PAC-01', 'PAC2-03', 'PAC-123']) assert.equal(isValidProjectId(id), true, id);
  for (const id of ['PAC-26-01', 'AB-12', 'PRJ-2026-01', 'PAC', 'PAC-1', 'PAC-1234']) assert.equal(isValidProjectId(id), false, id);
  for (const id of ['INV-PAC-26-001', 'INV-PAC2-26-004', 'INV-PAC-26-1000']) assert.equal(isValidInvoiceId(id), true, id);
  for (const id of ['INV-PAC-26-01', 'INV-ICA-01', 'INV-TEMP-01', 'PAC-26-001', 'INV-PAC-2026-001']) assert.equal(isValidInvoiceId(id), false, id);
  assert.equal(isValidLegacyComsClientId('CLT-001'), true);
  assert.equal(isValidLegacyComsClientId('CLI-001'), true);
  assert.equal(isValidLegacyComsClientId('PRJ-2026-01'), false);
  assert.equal(isValidLegacyComsProjectId('PRJ-2026-01'), true);
  assert.equal(isValidLegacyComsProjectId('CLT-001'), false);
  assert.equal(ClientIdSchema.safeParse('PAC2').success, true);
  assert.equal(ProjectIdSchema.safeParse('PAC2-01').success, true);
  assert.equal(InvoiceIdSchema.safeParse('INV-PAC2-26-001').success, true);
  assert.equal(LegacyComsClientIdSchema.safeParse('CLI-001').success, true);
  assert.equal(LegacyComsProjectIdSchema.safeParse('PRJ-2026-01').success, true);
});

test('client IDs use a 3-letter abbreviation and append a digit on collision', () => {
  assert.equal(createClientId('Prime Auto Collision', []), 'PAC');
  assert.equal(createClientId('SolarPulse Energy', []), 'SEN');
  assert.equal(createClientId('Zenith EdTech Solutions', []), 'ZES');
  assert.equal(createClientId('Zenith', []), 'ZEN');
  assert.equal(createClientId('Prime Auto Collision', ['PAC']), 'PAC2');
  assert.equal(createClientId('Prime Auto Collision', ['pac', 'PAC2']), 'PAC3');
  assert.equal(createClientId('', []), 'CLT');
  assert.equal(createClientId('X', []), 'XXX');
});

test('project and invoice IDs follow <ClientID>-NN and INV-<ClientID>-<YY>-<NNN>', () => {
  assert.equal(createProjectId('PAC', []), 'PAC-01');
  assert.equal(createProjectId('PAC', ['PAC-01', 'PAC-02', 'PAC2-07']), 'PAC-03');
  const issued = new Date(2026, 4, 1);
  assert.equal(createInvoiceId('PAC', [], issued), 'INV-PAC-26-001');
  assert.equal(createInvoiceId('PAC', ['INV-PAC-26-001', 'INV-PAC-26-003', 'INV-PAC-25-009'], issued), 'INV-PAC-26-004');
  assert.equal(createInvoiceId('PAC', ['INV-PAC-26-999'], issued), 'INV-PAC-26-1000');
  for (const id of [createProjectId('PAC2', []), createInvoiceId('PAC2', [], issued)]) {
    assert.ok(isValidProjectId(id) || isValidInvoiceId(id), id);
  }
});

test('row contracts reject missing required fields with readable errors', () => {
  const result = ClientSchema.safeParse({
    ClientID: 'ZZZ',
    AccountPhase: '01: Intake',
    ContractValue: 0,
    DepositPaid: false,
  });
  assert.equal(result.success, false);
  assert.equal(ClientSchema.safeParse({
    ClientID: 'ZZZ',
    Company_Name: 'Example Co',
    AccountPhase: '01: Intake',
    ContractValue: 0,
    DepositPaid: false,
    activeComponents: ['comp_example'],
  }).success, true);
  assert.equal(ProjectSchema.safeParse({
    ProjectID: 'ZZZ-01',
    ClientID: 'ZZZ',
    SprintStage: '00: Discovery',
    MilestonesTotal: 0,
    MilestonesDone: 0,
    AssignedRateTier: 'Normal',
    ActiveComponents: ['comp_example'],
  }).success, true);
  assert.equal(ProjectSchema.safeParse({
    ClientID: 'ZZZ',
    SprintStage: '00: Discovery',
    MilestonesTotal: 0,
    MilestonesDone: 0,
    AssignedRateTier: 'Normal',
  }).success, false);
  assert.throws(
    () => parseRows('Clients', [{ ClientID: 'ZZZ' }], ClientSchema),
    (error: unknown) => error instanceof DataContractError
      && error.message.includes('Clients row 1 is invalid')
      && error.message.includes('Company_Name'),
  );
});

test('optional metadata skips invalid rows with warnings instead of failing the live read', async () => {
  const payload = {
    clients: [],
    projects: [],
    finances: [],
    servicesRates: [],
    alerts: [],
    schemaRegistry: [{
      Registry_ID: 'REG-1',
      Database: 'Master Control',
      Tab: 'Clients',
      Column_Letter: 'A',
      Column_Name: 'ClientID',
      Data_Type: 'text',
      Allowed_Values: '',
      Data_Class: 'internal',
      Owner_Persona: 'Alfred',
      Required: 'yes',
      Schema_Version: '1.0',
      Last_Verified: '2026-10-31',
      Notes: '',
    }, {
      Registry_ID: 'REG-2',
      Database: 'Master Control',
      Tab: 'Clients',
      Column_Letter: 'B',
      Column_Name: 'Company_Name',
      Data_Type: 'unsupported',
      Allowed_Values: '',
      Data_Class: 'internal',
      Owner_Persona: 'Alfred',
      Required: 'unknown',
      Schema_Version: '1.0',
      Last_Verified: '2026-10-31',
      Notes: '',
    }],
    schemaChangeLog: [],
    schemaVersion: '1.0',
    generatedAt: '2026-10-31T12:00:00.000Z',
    warnings: [],
  };
  const adapter = new LiveAdapter('verified-oauth-token', async () => payload);
  const [snapshot, registry, changes] = await Promise.all([
    adapter.getSnapshot(),
    adapter.getSchemaRegistry(),
    adapter.getSchemaChangeLog(),
  ]);

  assert.equal(adapter.status(), 'live');
  assert.equal(snapshot.clients.length, 0);
  assert.equal(registry.length, 1);
  assert.deepEqual(changes, []);
  assert.match(adapter.warnings()[0] ?? '', /Schema registry: skipped 1 invalid row/);
  assert.match(adapter.warnings()[0] ?? '', /Schema registry row 2 skipped/);
  assert.match(adapter.warnings()[0] ?? '', /Data_Type/);
  assert.match(adapter.warnings()[0] ?? '', /Required/);
});

test('mock fixtures satisfy their contracts and cover every phase and stage', async () => {
  const adapter = new MockAdapter();
  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(new Set(snapshot.clients.map((client) => client.AccountPhase)).size, 6);
  assert.deepEqual(new Set(snapshot.projects.map((project) => project.SprintStage)).size, 10);
  assert.equal(snapshot.projects.filter((project) => project.ClientID === 'BBB').length, 2);

  const alerts = await adapter.getAlerts();
  for (const department of ['Housekeeping', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy']) {
    for (const severity of ['INFO', 'WARN', 'BLOCK']) {
      assert.equal(alerts.some((alert) => alert.Department === department && alert.Severity === severity), true);
    }
  }

  const mismatches = findSchemaVersionMismatches(await adapter.getSchemaRegistry());
  assert.equal(EXPECTED_SCHEMA_VERSION, '1.0');
  assert.equal(mismatches.length, 1);
});

test('live adapter reports its connection state and requires OAuth before reading', async () => {
  const adapter = new LiveAdapter();
  assert.equal(adapter.status(), 'offline');
  await assert.rejects(adapter.getSnapshot(), /Google sign-in is required/);
  assert.equal(new LiveAdapter('verified-oauth-token').status(), 'live');
});

test('snapshot adapter loads local CSVs once and exposes per-file reject counts', async () => {
  const files: SnapshotCsvFiles = {
    'clients.csv': 'ClientID,Company_Name,AccountPhase,ContractValue,DepositPaid\nCSV,Example Co,03: Active Sprints,1000,true\ninvalid,,,x,?',
    'projects.csv': 'ProjectID,ClientID,SprintStage,MilestonesTotal,MilestonesDone,AssignedRateTier',
    'finances.csv': 'InvoiceID,ClientID,Amount,Status',
    'alerts.csv': 'Alert_ID,Created_At,Source_Module,Department,Client_ID,Project_ID,Severity,Trigger_Condition,Prescribed_Action,Assigned_Lead,Action_Status',
    'services_rates.csv': 'ServiceID,ServiceName,RateTier,Rate',
  };
  let loadCalls = 0;
  const adapter = new SnapshotAdapter(async () => {
    loadCalls += 1;
    return files;
  });

  assert.equal(adapter.status(), 'snapshot');
  assert.equal((await adapter.getSnapshot()).clients.length, 1);
  assert.equal((await adapter.getAlerts()).length, 0);
  assert.equal(loadCalls, 1);
  assert.deepEqual(adapter.getFileCounts()['clients.csv'], { loaded: 1, rejected: 1, ignored: 0 });
  assert.match(adapter.getRejectedRows()[0].reason, /ClientID|Company_Name|ContractValue|DepositPaid/);
});

test('schema registry rows accept raw sheet values (numeric version, null notes, cased enums)', async () => {
  const { SchemaRegistryRowSchema } = await import('./contracts.ts');
  const parsed = SchemaRegistryRowSchema.parse({
    Registry_ID: 'REG-Clients-A',
    Database: 'Master Control',
    Tab: 'Clients',
    Column_Letter: 'A',
    Column_Name: 'ClientID',
    Data_Type: 'ID',
    Allowed_Values: null,
    Data_Class: ' internal ',
    Owner_Persona: 'Pamela',
    Required: 'Yes',
    Schema_Version: 0.1,
    Last_Verified: '2026-11-04T00:00:00.000Z',
    Notes: null,
  });
  assert.equal(parsed.Schema_Version, '0.1');
  assert.equal(parsed.Data_Type, 'id');
  assert.equal(parsed.Required, 'yes');
  assert.equal(parsed.Allowed_Values, '');
  assert.equal(
    SchemaRegistryRowSchema.safeParse({ ...parsed, Data_Type: 'string' }).success,
    false,
    'non-standard types stay rejected so the repair is still needed',
  );
});

test('finance contract rows need no InvoiceID; invoice rows still need a valid one', async () => {
  const { FinanceRowSchema } = await import('./contracts.ts');
  const contract = { InvoiceID: '', ClientID: 'PAC', ProjectID: 'PAC-01', MilestoneStage: 'Contract', TotalContractValue: 9000, Amount: 9000, Status: 'Contract' };
  assert.equal(FinanceRowSchema.safeParse(contract).success, true);
  assert.equal(FinanceRowSchema.safeParse({ ...contract, MilestoneStage: 'Deposit (1/3)' }).success, false);
  assert.equal(FinanceRowSchema.safeParse({ ...contract, MilestoneStage: 'Deposit (1/3)', InvoiceID: 'INV-PAC-26-001' }).success, true);
  assert.equal(FinanceRowSchema.safeParse({ ...contract, InvoiceID: 'INV-BAD' }).success, false);
});
