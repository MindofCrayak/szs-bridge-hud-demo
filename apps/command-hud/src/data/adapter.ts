import {
  Alert,
  AlertSchema,
  Client,
  ClientSchema,
  DATA_DEPARTMENTS,
  FinanceRow,
  FinanceRowSchema,
  Project,
  ProjectSchema,
  SchemaChange,
  SchemaChangeSchema,
  SchemaRegistryRow,
  SchemaRegistryRowSchema,
  Snapshot,
  SnapshotSchema,
  parseRows,
  parseRowsSkippingInvalid,
  parseSnapshot,
} from './contracts';
import { fetchMasterControlSnapshot, MasterControlReadSnapshot } from './api';
import { DATA_ADAPTER_MODE } from './adapterMode';
import {
  MasterControlTables,
  parseMasterControlTables,
  parseSnapshotCsvFiles,
  RejectedSnapshotRow,
  SnapshotCsvFiles,
  SnapshotFileCount,
} from './snapshotData';

export type AdapterStatus = 'live' | 'stale' | 'snapshot' | 'mock' | 'offline';

export interface DataAdapter {
  getSnapshot(clientId?: string): Promise<Snapshot>;
  getAlerts(): Promise<Alert[]>;
  getSchemaRegistry(): Promise<SchemaRegistryRow[]>;
  getSchemaChangeLog(): Promise<SchemaChange[]>;
  getRejectedRows(): RejectedSnapshotRow[];
  getFileCounts(): Record<keyof SnapshotCsvFiles, SnapshotFileCount>;
  status(): AdapterStatus;
  warnings?(): string[];
}

function summarizeMetadataWarnings(label: string, warnings: string[]): string[] {
  if (warnings.length === 0) return [];
  const examples = warnings.slice(0, 2).join(' ');
  const remainder = warnings.length > 2 ? ` ${warnings.length - 2} additional row warning(s) omitted.` : '';
  return [`${label}: skipped ${warnings.length} invalid row(s). ${examples}${remainder}`];
}

const MOCK_CLIENTS: Client[] = [
  { ClientID: 'AAA', Company_Name: 'Example Intake Co', AccountPhase: '01: Intake', ContractValue: 0, DepositPaid: false },
  { ClientID: 'BBB', Company_Name: 'Example Session Co', AccountPhase: '02: Session Zero', ContractValue: 1200, DepositPaid: true },
  { ClientID: 'CCC', Company_Name: 'Example Sprint Co', AccountPhase: '03: Active Sprints', ContractValue: 2400, DepositPaid: true },
  { ClientID: 'DDD', Company_Name: 'Example Liftoff Co', AccountPhase: '04: Liftoff', ContractValue: 3600, DepositPaid: true },
  { ClientID: 'EEE', Company_Name: 'Example Complete Co', AccountPhase: '05: Complete', ContractValue: 4800, DepositPaid: true },
  { ClientID: 'FFF', Company_Name: 'Example Sunset Co', AccountPhase: '06: Archived/Sunset', ContractValue: 0, DepositPaid: false },
];

const MOCK_PROJECTS: Project[] = [
  { ProjectID: 'AAA-01', ClientID: 'AAA', SprintStage: '00: Discovery', MilestonesTotal: 1, MilestonesDone: 0, AssignedRateTier: 'Normal', Title: 'Example discovery' },
  { ProjectID: 'BBB-01', ClientID: 'BBB', SprintStage: '01: Vibecheck', MilestonesTotal: 1, MilestonesDone: 0, AssignedRateTier: 'Normal', Title: 'Example vibecheck' },
  { ProjectID: 'BBB-02', ClientID: 'BBB', SprintStage: '02: Contract & Inception', MilestonesTotal: 2, MilestonesDone: 1, AssignedRateTier: 'Premium', Title: 'Example inception' },
  { ProjectID: 'CCC-01', ClientID: 'CCC', SprintStage: '03: Deep Intelligence', MilestonesTotal: 2, MilestonesDone: 1, AssignedRateTier: 'Normal', Title: 'Example intelligence' },
  { ProjectID: 'CCC-02', ClientID: 'CCC', SprintStage: '04: Session Zero Kickoff', MilestonesTotal: 2, MilestonesDone: 1, AssignedRateTier: 'Normal', Title: 'Example kickoff' },
  { ProjectID: 'DDD-01', ClientID: 'DDD', SprintStage: '05: Architecture & Builds', MilestonesTotal: 3, MilestonesDone: 1, AssignedRateTier: 'Fixed', Title: 'Example build' },
  { ProjectID: 'DDD-02', ClientID: 'DDD', SprintStage: '06: Mid-Flight Review', MilestonesTotal: 3, MilestonesDone: 2, AssignedRateTier: 'Fixed', Title: 'Example review' },
  { ProjectID: 'EEE-01', ClientID: 'EEE', SprintStage: '07: Final Staging & QA', MilestonesTotal: 3, MilestonesDone: 3, AssignedRateTier: 'Premium', Title: 'Example QA' },
  { ProjectID: 'EEE-02', ClientID: 'EEE', SprintStage: '08: Liftoff & Handover', MilestonesTotal: 3, MilestonesDone: 3, AssignedRateTier: 'Normal', Title: 'Example handover' },
  { ProjectID: 'FFF-01', ClientID: 'FFF', SprintStage: '09: Sunset / Retainer', MilestonesTotal: 1, MilestonesDone: 1, AssignedRateTier: 'Reduced', Title: 'Example sunset' },
];

const MOCK_FINANCE_ROWS: FinanceRow[] = [
  { InvoiceID: 'INV-AAA-26-001', ClientID: 'AAA', Amount: 0, Status: 'Draft' },
  { InvoiceID: 'INV-BBB-26-001', ClientID: 'BBB', Amount: 1200, Status: 'Paid', PaidDate: '2026-10-01' },
];

const MOCK_ALERTS: Alert[] = DATA_DEPARTMENTS.flatMap((department, departmentIndex) =>
  (['INFO', 'WARN', 'BLOCK'] as const).map((severity, severityIndex) => ({
    Alert_ID: `ALT-MOCK-${departmentIndex + 1}-${severityIndex + 1}`,
    Created_At: '2026-10-31T12:00:00.000Z',
    Source_Module: department === 'Housekeeping' ? 'Police' : department,
    Department: department,
    Client_ID: departmentIndex === 0 ? null : 'AAA',
    Project_ID: departmentIndex === 0 ? null : 'AAA-01',
    Entity_Reference: null,
    Severity: severity,
    Trigger_Condition: `Example ${severity} condition`,
    Prescribed_Action: 'Review this example item.',
    Due_SLA: null,
    Assigned_Lead: department,
    Action_Status: 'Open',
    Resolved_At: null,
  })),
);

const MOCK_SCHEMA_REGISTRY: SchemaRegistryRow[] = [{
  Registry_ID: 'REG-Clients-A',
  Database: 'Master Control',
  Tab: 'Clients',
  Column_Letter: 'A',
  Column_Name: 'ClientID',
  Data_Type: 'id',
  Allowed_Values: '',
  Data_Class: 'internal',
  Owner_Persona: 'Alfred',
  Required: 'yes',
  Schema_Version: '0.9',
  Last_Verified: '2026-10-31',
  Notes: 'Fixture intentionally differs from HUD expected schema version 1.0.',
}, {
  Registry_ID: 'REG-Clients-P',
  Database: 'Master Control',
  Tab: 'Clients',
  Column_Letter: 'B',
  Column_Name: 'ContactEmail',
  Data_Type: 'text',
  Allowed_Values: '',
  Data_Class: 'pii',
  Owner_Persona: 'Pamela',
  Required: 'no',
  Schema_Version: '1.0',
  Last_Verified: '2026-10-31',
  Notes: 'Fixture classification only; no contact data is included.',
}, {
  Registry_ID: 'REG-Clients-Q',
  Database: 'Master Control',
  Tab: 'Clients',
  Column_Letter: 'C',
  Column_Name: 'Owner_Phone',
  Data_Type: 'text',
  Allowed_Values: '',
  Data_Class: 'pii',
  Owner_Persona: 'Pamela',
  Required: 'no',
  Schema_Version: '1.0',
  Last_Verified: '2026-10-31',
  Notes: 'Fixture classification only; no contact data is included.',
}];

const MOCK_SCHEMA_CHANGES: SchemaChange[] = [{
  Change_ID: 'SCH-0001',
  Logged_At: '2026-10-31T12:00:00.000Z',
  Requested_By: 'Alfred',
  Target_Database: 'Master Control',
  Target_Tab: 'Clients',
  Target_Column: 'ClientID',
  Change_Type: 'Other',
  Reason: 'Example schema change fixture.',
  Impact: 'Example only.',
  Severity: 'INFO',
  Status: 'Noted',
  Approved_By: '',
  Applied_Version: '',
  Police_Check_Result: '',
  Rollback_Note: '',
  Source: 'seed',
}];

function filterSnapshot(snapshot: Snapshot, clientId?: string): Snapshot {
  if (!clientId) return snapshot;
  const clients = snapshot.clients.filter((client) => client.ClientID === clientId);
  const clientIds = new Set(clients.map((client) => client.ClientID));
  return {
    clients,
    projects: snapshot.projects.filter((project) => clientIds.has(project.ClientID)),
    financeRows: snapshot.financeRows.filter((row) => clientIds.has(row.ClientID)),
  };
}

export class MockAdapter implements DataAdapter {
  private readonly snapshot: Snapshot;
  private readonly alerts: Alert[];
  private readonly registry: SchemaRegistryRow[];
  private readonly changes: SchemaChange[];

  constructor() {
    this.snapshot = parseSnapshot({
      clients: MOCK_CLIENTS,
      projects: MOCK_PROJECTS,
      financeRows: MOCK_FINANCE_ROWS,
    });
    this.alerts = parseRows('Alerts', MOCK_ALERTS, AlertSchema);
    this.registry = parseRows('Schema registry', MOCK_SCHEMA_REGISTRY, SchemaRegistryRowSchema);
    this.changes = parseRows('Schema change log', MOCK_SCHEMA_CHANGES, SchemaChangeSchema);
  }

  async getSnapshot(clientId?: string): Promise<Snapshot> {
    return filterSnapshot(this.snapshot, clientId);
  }

  async getAlerts(): Promise<Alert[]> {
    return this.alerts;
  }

  async getSchemaRegistry(): Promise<SchemaRegistryRow[]> {
    return this.registry;
  }

  async getSchemaChangeLog(): Promise<SchemaChange[]> {
    return this.changes;
  }

  getRejectedRows(): RejectedSnapshotRow[] {
    return [];
  }

  getFileCounts(): Record<keyof SnapshotCsvFiles, SnapshotFileCount> {
    return {
      'clients.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'projects.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'finances.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'alerts.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'services_rates.csv': { loaded: 0, rejected: 0, ignored: 0 },
    };
  }

  status(): AdapterStatus {
    return 'mock';
  }
}

export class SnapshotAdapter implements DataAdapter {
  private loadPromise: Promise<ReturnType<typeof parseSnapshotCsvFiles>> | null = null;
  private loadResult: ReturnType<typeof parseSnapshotCsvFiles> | null = null;

  constructor(private readonly loadFiles: () => Promise<SnapshotCsvFiles> = async () => {
    const snapshotFiles = await import('./snapshotFiles');
    return snapshotFiles.SNAPSHOT_CSV_FILES;
  }) {}

  status(): AdapterStatus {
    return 'snapshot';
  }

  private load(): Promise<ReturnType<typeof parseSnapshotCsvFiles>> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadFiles().then((files) => {
        this.loadResult = parseSnapshotCsvFiles(files);
        return this.loadResult;
      });
    }
    return this.loadPromise;
  }

  async getSnapshot(clientId?: string): Promise<Snapshot> {
    return filterSnapshot((await this.load()).snapshot, clientId);
  }

  async getAlerts(): Promise<Alert[]> {
    return (await this.load()).alerts;
  }

  async getSchemaRegistry(): Promise<SchemaRegistryRow[]> {
    return [];
  }

  async getSchemaChangeLog(): Promise<SchemaChange[]> {
    return [];
  }

  getRejectedRows(): RejectedSnapshotRow[] {
    return this.loadResult?.rejectedRows ?? [];
  }

  async getLoadReport(): Promise<ReturnType<typeof parseSnapshotCsvFiles>> {
    return this.load();
  }

  getFileCounts(): Record<keyof SnapshotCsvFiles, SnapshotFileCount> {
    return this.loadResult?.fileCounts ?? {
      'clients.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'projects.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'finances.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'alerts.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'services_rates.csv': { loaded: 0, rejected: 0, ignored: 0 },
    };
  }
}

export class LiveAdapter implements DataAdapter {
  private payloadPromise: Promise<MasterControlReadSnapshot> | null = null;
  private loadPromise: Promise<ReturnType<typeof parseMasterControlTables>> | null = null;
  private loadResult: ReturnType<typeof parseMasterControlTables> | null = null;
  private registryPromise: Promise<SchemaRegistryRow[]> | null = null;
  private changesPromise: Promise<SchemaChange[]> | null = null;
  private payloadWarnings: string[] = [];
  private metadataWarnings: string[] = [];

  constructor(
    private readonly accessToken?: string | null,
    private readonly readSnapshot: typeof fetchMasterControlSnapshot = fetchMasterControlSnapshot,
  ) {}

  status(): AdapterStatus {
    return this.accessToken ? 'live' : 'offline';
  }

  private getPayload(): Promise<MasterControlReadSnapshot> {
    if (!this.accessToken) {
      throw new Error('Google sign-in is required to read live Master Control data.');
    }
    if (!this.payloadPromise) {
      this.payloadPromise = this.readSnapshot(this.accessToken);
    }
    return this.payloadPromise;
  }

  private async load(): Promise<ReturnType<typeof parseMasterControlTables>> {
    if (!this.loadPromise) {
      this.loadPromise = this.getPayload().then((payload) => {
        const tables: MasterControlTables = {
          clients: payload.clients,
          projects: payload.projects,
          finances: payload.finances,
          servicesRates: payload.servicesRates,
          alerts: payload.alerts,
        };
        this.payloadWarnings = payload.warnings;
        this.loadResult = parseMasterControlTables(tables);
        return this.loadResult;
      });
    }
    return this.loadPromise;
  }

  async getSnapshot(clientId?: string): Promise<Snapshot> {
    return filterSnapshot((await this.load()).snapshot, clientId);
  }

  async getAlerts(): Promise<Alert[]> {
    return (await this.load()).alerts;
  }

  async getSchemaRegistry(): Promise<SchemaRegistryRow[]> {
    if (!this.registryPromise) {
      this.registryPromise = this.getPayload().then((payload) => {
        const parsed = parseRowsSkippingInvalid(
          'Schema registry',
          payload.schemaRegistry,
          SchemaRegistryRowSchema,
        );
        this.metadataWarnings.push(...summarizeMetadataWarnings('Schema registry', parsed.warnings));
        return parsed.rows;
      });
    }
    return this.registryPromise;
  }

  async getSchemaChangeLog(): Promise<SchemaChange[]> {
    if (!this.changesPromise) {
      this.changesPromise = this.getPayload().then((payload) => {
        const parsed = parseRowsSkippingInvalid(
          'Schema change log',
          payload.schemaChangeLog,
          SchemaChangeSchema,
        );
        this.metadataWarnings.push(...summarizeMetadataWarnings('Schema change log', parsed.warnings));
        return parsed.rows;
      });
    }
    return this.changesPromise;
  }

  getRejectedRows(): RejectedSnapshotRow[] {
    return this.loadResult?.rejectedRows ?? [];
  }

  warnings(): string[] {
    return [...this.payloadWarnings, ...this.metadataWarnings];
  }

  getFileCounts(): Record<keyof SnapshotCsvFiles, SnapshotFileCount> {
    return this.loadResult?.fileCounts ?? {
      'clients.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'projects.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'finances.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'alerts.csv': { loaded: 0, rejected: 0, ignored: 0 },
      'services_rates.csv': { loaded: 0, rejected: 0, ignored: 0 },
    };
  }
}

export function createDataAdapter(accessToken?: string | null): DataAdapter {
  if (DATA_ADAPTER_MODE === 'live') return new LiveAdapter(accessToken);
  if (DATA_ADAPTER_MODE === 'snapshot') return new SnapshotAdapter();
  return new MockAdapter();
}

export const EXPECTED_SCHEMA_VERSION = '1.0';

export function findSchemaVersionMismatches(rows: SchemaRegistryRow[]): SchemaRegistryRow[] {
  return rows.filter((row) => row.Schema_Version !== EXPECTED_SCHEMA_VERSION);
}

export function validateAdapterPayload(value: unknown): Snapshot {
  return SnapshotSchema.parse(value);
}

export const adapterSchemas = {
  clients: ClientSchema,
  projects: ProjectSchema,
  financeRows: FinanceRowSchema,
  alerts: AlertSchema,
  schemaRegistry: SchemaRegistryRowSchema,
  schemaChanges: SchemaChangeSchema,
};
