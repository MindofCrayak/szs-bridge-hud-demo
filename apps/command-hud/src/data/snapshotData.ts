import { z } from 'zod';
import {
  ACCOUNT_PHASES,
  SPRINT_STAGES,
  Alert,
  AlertSchema,
  Client,
  ClientSchema,
  FinanceRowSchema,
  ProjectSchema,
  Snapshot,
} from './contracts';
import { normalizeSprintStage } from './pipeline';

export type SnapshotCsvName = 'clients.csv' | 'projects.csv' | 'finances.csv' | 'alerts.csv' | 'services_rates.csv';
export type SnapshotCsvFiles = Record<SnapshotCsvName, string>;

export interface RejectedSnapshotRow {
  fileName: SnapshotCsvName;
  rowNumber: number;
  reason: string;
}

export interface SnapshotFileCount {
  loaded: number;
  rejected: number;
  ignored: number;
}

export interface ParsedSnapshotFiles {
  snapshot: Snapshot;
  alerts: Alert[];
  rejectedRows: RejectedSnapshotRow[];
  unmappedColumns: Partial<Record<SnapshotCsvName, string[]>>;
  fileCounts: Record<SnapshotCsvName, SnapshotFileCount>;
}

export interface MasterControlTables {
  clients: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  finances: Record<string, unknown>[];
  servicesRates: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
}

interface CsvRecord {
  cells: string[];
  rowNumber: number;
  error?: string;
}

const COLUMN_ALIASES = {
  clients: {
    ClientID: ['clientid', 'id'],
    Company_Name: ['companyname', 'clientname', 'company'],
    First_Name: ['firstname'],
    Last_Name: ['lastname'],
    AccountPhase: ['accountphase', 'pipelinestage', 'currentstage', 'stage'],
    AccountPhase_Mode: ['accountphase_mode', 'accountphasemode', 'phasemode'],
    ContractValue: ['contractvalue', 'contractamount', 'totalcontractvalue'],
    DepositPaid: ['depositpaid', 'depositstatus', 'depositcleared'],
    CurrentMilestone: ['currentmilestone'],
    CompletedMilestones: ['completedmilestones'],
    TotalMilestones: ['totalmilestones'],
    PrimaryContact: ['primarycontact', 'contactname'],
    ContactEmail: ['contactemail', 'email'],
    GoogleGroupEmail: ['googlegroupemail'],
    DriveFolderUrl: ['drivefolderurl'],
    NotesDocUrl: ['notesdocurl', 'meetingnotesurl'],
    MSA_DocID: ['msadocid', 'msaid'],
    ChatSpaceUrl: ['chatspaceurl'],
    Roadblock: ['roadblock', 'activeroadblock', 'activepebble', 'blocker'],
    Lead_Source: ['leadsource'],
    Archetype: ['archetype', 'servicearea'],
    Tech_Stack: ['techstack'],
    MCC_Subscriber_ID: ['mccsubscriberid'],
    Oracle_Baseline_ID: ['oraclebaselineid'],
    activeComponents: ['activecomponents', 'installedservices'],
  },
  projects: {
    ProjectID: ['projectid', 'id'],
    ClientID: ['clientid'],
    SprintStage: ['sprintstage', 'stage', 'currentstage'],
    MilestonesTotal: ['milestonestotal', 'totalmilestones', 'milestonecount'],
    MilestonesDone: ['milestonesdone', 'completedmilestones'],
    AssignedRateTier: ['assignedratetier', 'ratetier', 'servicetier'],
    Title: ['title', 'projectname', 'projecttitle'],
    SOW_DocID: ['sowdocid', 'sowid'],
    Est_Hours: ['esthours', 'estimatedhours'],
    Actual_Hours: ['actualhours'],
    Google_Tasklist_ID: ['googletasklistid', 'googletaskslistid', 'tasklistid'],
    Project_Brief_DocID: ['projectbriefdocid'],
    Project_Outline_DocID: ['projectoutlinedocid'],
    COMS_Sheet_URL: ['comssheeturl'],
    MeetingNotes_DriveFolderID: ['meetingnotesdrivefolderid'],
    ChatSpace_URL: ['chatspaceurl'],
    ChatSpace_Internal_URL: ['chatspaceinternalurl'],
    Dashboard_Sheet_ID: ['dashboardsheetid'],
    Kickoff_Date: ['kickoffdate'],
    ParentProjectID: ['parentprojectid'],
    AddendumRef: ['addendumref'],
    ActiveComponents: ['activecomponents', 'installedservices'],
  },
  finances: {
    InvoiceID: ['invoiceid', 'id'],
    ClientID: ['clientid'],
    ProjectID: ['projectid'],
    InvoiceNumber: ['invoicenumber'],
    MilestoneStage: ['milestonestage'],
    TotalContractValue: ['totalcontractvalue'],
    DepositAmount: ['depositamount'],
    InvoiceAmount: ['invoiceamount'],
    DepositPaid: ['depositpaid'],
    Remaining_Balance: ['remainingbalance'],
    InvoiceStatus: ['invoicestatus'],
    PaymentDate: ['paymentdate'],
    Est_Hours_Allocation: ['esthoursallocation'],
    Actual_Hours_Worked: ['actualhoursworked'],
    EffectiveHourlyRate: ['effectivehourlyrate'],
    EstimatedQuarterlyTax: ['estimatedquarterlytax'],
    OverheadCosts: ['overheadcosts'],
    NetMargin: ['netmargin'],
    Amount: ['amount', 'invoiceamount', 'depositamount', 'totalamount'],
    Status: ['status', 'invoicestatus', 'paymentstatus'],
    DueDate: ['duedate'],
    PaidDate: ['paiddate', 'paymentdate'],
  },
  alerts: {
    Alert_ID: ['alertid', 'id'],
    Created_At: ['createdat', 'timestamp', 'created'],
    Source_Module: ['sourcemodule', 'source', 'subroutine'],
    Department: ['department', 'category', 'assignedlead', 'ownerpersona'],
    Client_ID: ['clientid', 'client'],
    Project_ID: ['projectid', 'project'],
    Entity_Reference: ['entityreference', 'reference'],
    Severity: ['severity', 'priority'],
    Trigger_Condition: ['triggercondition', 'condition', 'message'],
    Prescribed_Action: ['prescribedaction', 'action', 'actionurl', 'recommendedaction'],
    Due_SLA: ['duesla', 'due'],
    Assigned_Lead: ['assignedlead', 'owner', 'ownerpersona'],
    Action_Status: ['actionstatus', 'dismissedstatus', 'status'],
    Resolved_At: ['resolvedat'],
  },
} as const;

const ServiceRateRowSchema = z.record(z.string(), z.string()).refine(
  (row) => Object.values(row).some((value) => value.trim().length > 0),
  'Row is empty.',
);

const normalizeHeader = (header: string): string =>
  header.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseCsvRecords(csv: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let value = '';
  let quoted = false;
  let rowNumber = 1;
  let rowHasContent = false;

  const finishCell = () => {
    cells.push(value);
    value = '';
  };
  const finishRow = (error?: string) => {
    finishCell();
    if (cells.some((cell) => cell.trim() !== '') || error) records.push({ cells, rowNumber, error });
    cells = [];
    rowNumber += 1;
    rowHasContent = false;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      rowHasContent = true;
      continue;
    }

    if (character === '"' && value.length === 0) {
      quoted = true;
      rowHasContent = true;
    } else if (character === ',') {
      finishCell();
      rowHasContent = true;
    } else if (character === '\n') {
      finishRow();
    } else if (character !== '\r') {
      value += character;
      rowHasContent = true;
    }
  }
  if (rowHasContent || value.length > 0 || cells.length > 0) {
    finishRow(quoted ? 'This row contains an unclosed quoted field.' : undefined);
  }
  return records;
}

function tableToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (headers.length === 0) return '';
  const encode = (value: unknown): string => {
    let text: string;
    if (value == null) {
      text = '';
    } else if (value instanceof Date) {
      text = value.toISOString();
    } else if (typeof value === 'object') {
      text = JSON.stringify(value);
    } else {
      text = String(value);
    }
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    headers.map(encode).join(','),
    ...rows.map((row) => headers.map((header) => encode(row[header])).join(',')),
  ].join('\n');
}

export function parseMasterControlTables(tables: MasterControlTables): ParsedSnapshotFiles {
  return parseSnapshotCsvFiles({
    'clients.csv': tableToCsv(tables.clients),
    'projects.csv': tableToCsv(tables.projects),
    'finances.csv': tableToCsv(tables.finances),
    'alerts.csv': tableToCsv(tables.alerts),
    'services_rates.csv': tableToCsv(tables.servicesRates),
  });
}

export function countCsvDataRows(csv: string): number {
  const records = parseCsvRecords(csv);
  return Math.max(0, records.length - 1);
}

function normalizeRow(
  headers: string[],
  cells: string[],
  aliases: Record<string, readonly string[]>,
): Record<string, string> {
  const normalizedAliases = new Map<string, string>();
  for (const [field, names] of Object.entries(aliases)) {
    for (const name of names) normalizedAliases.set(normalizeHeader(name), field);
  }
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = cells[index]?.trim() ?? '';
    row[`__raw_${header.trim().toLowerCase()}`] = value;
    const normalized = normalizeHeader(header);
    const field = normalizedAliases.get(normalized) || normalized;
    if (value || row[field] === undefined) row[field] = value;
  });
  return row;
}

function findUnmappedColumns(headers: string[], aliases: Record<string, readonly string[]>): string[] {
  const known = new Set(
    Object.entries(aliases).flatMap(([field, names]) => [
      normalizeHeader(field),
      ...names.map(normalizeHeader),
    ]),
  );
  return headers.filter((header) => !known.has(normalizeHeader(header)));
}

function cleanOptional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  return value?.trim() ? parseNumber(value) : undefined;
}

function parseNumber(value: string | undefined): number {
  if (!value?.trim()) return Number.NaN;
  const parsed = Number(value.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'));
  return parsed;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', 'yes', 'y', '1', 'paid', 'complete', 'completed'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'unpaid', 'open', 'not paid'].includes(normalized)) return false;
  return undefined;
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeRateTier(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized?.startsWith('premium')) return 'Premium';
  if (normalized?.startsWith('reduced')) return 'Reduced';
  if (normalized?.startsWith('fixed')) return 'Fixed';
  if (normalized?.startsWith('normal') || normalized?.startsWith('standard')) return 'Normal';
  return value?.trim() ?? '';
}

function normalizeAlertSeverity(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'block' || normalized === 'blocker' || normalized === 'critical') return 'BLOCK';
  if (normalized === 'warn' || normalized === 'warning' || normalized === 'action') return 'WARN';
  if (normalized === 'info' || normalized === 'informational') return 'INFO';
  return value?.trim().toUpperCase() ?? '';
}

function normalizeAlertDepartment(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (normalized?.includes('graduat')) return 'Daisy';
  if (normalized?.includes('finance') || normalized?.includes('billing')) return 'Vala';
  if (normalized?.includes('task') || normalized?.includes('workspace')) return 'Dolores';
  if (normalized?.includes('intake') || normalized?.includes('pipeline')) return 'Pamela';
  if (normalized?.includes('alert') || normalized?.includes('alfred') || normalized?.includes('police')
    || normalized?.includes('system') || normalized?.includes('webhook')) return 'Housekeeping';
  if (normalized?.includes('offboard') || normalized?.includes('sunset')) return 'Daisy';
  const department = ['Housekeeping', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy']
    .find((candidate) => candidate.toLowerCase() === normalized);
  return department ?? value?.trim() ?? '';
}

function normalizeAlertStatus(status: string | undefined): string {
  const normalized = status?.trim().toLowerCase();
  if (!normalized || ['false', 'no', 'n', '0', 'open', 'active', 'pending'].includes(normalized)) return 'Open';
  if (['true', 'yes', 'y', '1', 'dismissed', 'resolved', 'closed'].includes(normalized)) return 'Resolved';
  return status?.trim() ?? '';
}

function normalizeAlertDate(value: string | undefined): string {
  if (!value?.trim()) return '';
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value.trim() : new Date(timestamp).toISOString();
}

function normalizeClientPhase(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  if ((ACCOUNT_PHASES as readonly string[]).includes(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (normalized.includes('intake') || normalized.includes('discovery') || normalized.includes('pitch')) return '01: Intake';
  if (normalized.includes('session zero') || normalized.includes('contract') || normalized.includes('deep intelligence')) return '02: Session Zero';
  if (normalized.includes('active sprint') || normalized.includes('build') || normalized.includes('mid-flight') || normalized.includes('staging')) return '03: Active Sprints';
  if (normalized.includes('liftoff') || normalized.includes('handover')) return '04: Liftoff';
  if (normalized.includes('complete')) return '05: Complete';
  if (normalized.includes('sunset') || normalized.includes('archive') || normalized.includes('retainer')) return '06: Archived/Sunset';

  const stage = Number(raw.match(/^(\d{1,2})/)?.[1]);
  if (!Number.isInteger(stage) || stage < 0 || stage > 9) return '';
  if (stage <= 1) return '01: Intake';
  if (stage <= 3) return '02: Session Zero';
  if (stage <= 7) return '03: Active Sprints';
  if (stage === 8) return '04: Liftoff';
  return '06: Archived/Sunset';
}

function normalizeProjectStageStrict(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  if ((SPRINT_STAGES as readonly string[]).includes(raw)) return raw;
  const normalized = raw.toLowerCase();
  const knownStage = /\b(discovery|vibecheck|pitch|contract|inception|intelligence|intel|strategy|kickoff|architecture|build|review|staging|qa|liftoff|handover|sunset|retainer)\b/.test(normalized);
  const hasStageNumber = /^\d{1,2}\s*:/.test(raw);
  return knownStage || hasStageNumber ? normalizeSprintStage(raw) : '';
}

function parseComponents(value: string | undefined): string[] | undefined {
  return parseList(value);
}

function zodReason(result: { success: false; error: z.ZodError }): string {
  return result.error.issues
    .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
    .join('; ');
}

function parseRows<T>(
  fileName: SnapshotCsvName,
  csv: string,
  aliases: Record<string, readonly string[]> | null,
  schema: z.ZodType<T>,
  map: (row: Record<string, string>) => unknown,
  rejectedRows: RejectedSnapshotRow[],
  requiredKey?: string,
): { rows: T[]; count: SnapshotFileCount; unmappedColumns: string[] } {
  const records = parseCsvRecords(csv);
  if (records.length === 0) return { rows: [], count: { loaded: 0, rejected: 0, ignored: 0 }, unmappedColumns: [] };
  const headers = records[0].cells;
  const unmappedColumns = aliases ? findUnmappedColumns(headers, aliases) : [];
  const rows: T[] = [];
  let rejected = 0;
  let ignored = 0;

  for (const record of records.slice(1)) {
    if (record.error) {
      rejected += 1;
      rejectedRows.push({ fileName, rowNumber: record.rowNumber, reason: record.error });
      continue;
    }
    if (record.cells.length !== headers.length) {
      rejected += 1;
      rejectedRows.push({
        fileName,
        rowNumber: record.rowNumber,
        reason: `This row has ${record.cells.length} values, but the header has ${headers.length} columns.`,
      });
      continue;
    }
    const normalized = aliases ? normalizeRow(headers, record.cells, aliases) : Object.fromEntries(
      headers.map((header, index) => [normalizeHeader(header), record.cells[index]?.trim() ?? '']),
    );
    if (fileName === 'finances.csv' && !normalized.InvoiceID) {
      normalized.InvoiceID = normalized.InvoiceNumber
        ?? normalized.__raw_invoicenumber
        ?? normalized.invoicenumber
        ?? '';
    }
    // Finances contract rows (one per project, MilestoneStage = Contract) carry no InvoiceID by design.
    const isFinanceContractRow = fileName === 'finances.csv' && normalized.MilestoneStage?.trim() === 'Contract';
    if (requiredKey && !isFinanceContractRow && !normalized[requiredKey]?.trim()) {
      const hasMeaningfulValue = headers.some((header, index) => {
        const value = record.cells[index]?.trim() ?? '';
        if (!value) return false;
        if (normalizeHeader(header) === 'depositpaid' && parseBoolean(value) === false) return false;
        return true;
      });
      if (!hasMeaningfulValue) {
        ignored += 1;
        continue;
      }
      rejected += 1;
      rejectedRows.push({
        fileName,
        rowNumber: record.rowNumber,
        reason: `This row is missing its required ${requiredKey} value.`,
      });
      continue;
    }
    let mapped: unknown;
    try {
      mapped = map(normalized);
    } catch (error) {
      rejected += 1;
      rejectedRows.push({
        fileName,
        rowNumber: record.rowNumber,
        reason: error instanceof Error ? error.message : 'The row could not be mapped.',
      });
      continue;
    }
    const parsed = schema.safeParse(mapped);
    if (!parsed.success) {
      rejected += 1;
      rejectedRows.push({ fileName, rowNumber: record.rowNumber, reason: zodReason(parsed) });
      continue;
    }
    rows.push(parsed.data);
  }
  return { rows, count: { loaded: rows.length, rejected, ignored }, unmappedColumns };
}

function mapClientRow(row: Record<string, string>): unknown {
  const accountPhaseMode = cleanOptional(row.AccountPhase_Mode)?.toLowerCase();
  if (accountPhaseMode && accountPhaseMode !== 'auto' && accountPhaseMode !== 'manual') {
    throw new Error('AccountPhase_Mode must be "auto" or "manual".');
  }
  return {
    ClientID: row.ClientID,
    First_Name: cleanOptional(row.First_Name),
    Last_Name: cleanOptional(row.Last_Name),
    Company_Name: cleanOptional(row.Company_Name)
      ?? [row.First_Name, row.Last_Name].map((name) => name?.trim()).filter(Boolean).join(' '),
    AccountPhase: normalizeClientPhase(row.AccountPhase),
    AccountPhase_Mode: accountPhaseMode || 'auto',
    ContractValue: parseNumber(row.ContractValue),
    DepositPaid: parseBoolean(row.DepositPaid),
    CurrentMilestone: cleanOptional(row.CurrentMilestone),
    CompletedMilestones: parseOptionalNumber(row.CompletedMilestones),
    TotalMilestones: parseOptionalNumber(row.TotalMilestones),
    PrimaryContact: cleanOptional(row.PrimaryContact)
      ?? [row.First_Name, row.Last_Name].map((name) => name?.trim()).filter(Boolean).join(' '),
    ContactEmail: cleanOptional(row.ContactEmail),
    GoogleGroupEmail: cleanOptional(row.GoogleGroupEmail),
    DriveFolderUrl: cleanOptional(row.DriveFolderUrl),
    NotesDocUrl: cleanOptional(row.NotesDocUrl),
    MSA_DocID: cleanOptional(row.MSA_DocID),
    ChatSpaceUrl: cleanOptional(row.ChatSpaceUrl),
    Roadblock: cleanOptional(row.Roadblock),
    Lead_Source: cleanOptional(row.Lead_Source),
    Archetype: cleanOptional(row.Archetype),
    Tech_Stack: cleanOptional(row.Tech_Stack),
    MCC_Subscriber_ID: cleanOptional(row.MCC_Subscriber_ID),
    Oracle_Baseline_ID: cleanOptional(row.Oracle_Baseline_ID),
    activeComponents: parseComponents(row.activeComponents),
  };
}

function mapProjectRow(row: Record<string, string>, clientsById: Map<string, Client>): unknown {
  const client = clientsById.get(row.ClientID);
  return {
    ProjectID: row.ProjectID,
    ClientID: row.ClientID,
    SprintStage: normalizeProjectStageStrict(row.SprintStage),
    MilestonesTotal: parseOptionalNumber(row.MilestonesTotal) ?? client?.TotalMilestones ?? 0,
    MilestonesDone: parseOptionalNumber(row.MilestonesDone) ?? client?.CompletedMilestones ?? 0,
    AssignedRateTier: normalizeRateTier(row.AssignedRateTier),
    Title: cleanOptional(row.Title),
    SOW_DocID: cleanOptional(row.SOW_DocID),
    Est_Hours: parseOptionalNumber(row.Est_Hours),
    Actual_Hours: parseOptionalNumber(row.Actual_Hours),
    Google_Tasklist_ID: cleanOptional(row.Google_Tasklist_ID),
    Project_Brief_DocID: cleanOptional(row.Project_Brief_DocID),
    Project_Outline_DocID: cleanOptional(row.Project_Outline_DocID),
    COMS_Sheet_URL: cleanOptional(row.COMS_Sheet_URL),
    MeetingNotes_DriveFolderID: cleanOptional(row.MeetingNotes_DriveFolderID),
    ChatSpace_URL: cleanOptional(row.ChatSpace_URL),
    ChatSpace_Internal_URL: cleanOptional(row.ChatSpace_Internal_URL),
    Dashboard_Sheet_ID: cleanOptional(row.Dashboard_Sheet_ID),
    Kickoff_Date: cleanOptional(row.Kickoff_Date),
    ParentProjectID: cleanOptional(row.ParentProjectID),
    AddendumRef: cleanOptional(row.AddendumRef),
    ActiveComponents: parseComponents(row.ActiveComponents),
  };
}

function mapFinanceRow(row: Record<string, string>): unknown {
  if (!row.ClientID?.trim()) {
    throw new Error('This finance row is missing ClientID, so it cannot be matched to a client.');
  }
  const isContractRow = cleanOptional(row.MilestoneStage) === 'Contract';
  return {
    InvoiceID: row.InvoiceID?.trim() ?? '',
    ClientID: row.ClientID,
    ProjectID: cleanOptional(row.ProjectID),
    InvoiceNumber: cleanOptional(row.InvoiceNumber) ?? cleanOptional(row.__raw_invoicenumber),
    MilestoneStage: cleanOptional(row.MilestoneStage),
    TotalContractValue: parseOptionalNumber(row.TotalContractValue),
    DepositAmount: parseOptionalNumber(row.__raw_depositamount) ?? parseOptionalNumber(row.DepositAmount),
    InvoiceAmount: parseOptionalNumber(row.__raw_invoiceamount) ?? parseOptionalNumber(row.InvoiceAmount),
    DepositPaid: parseBoolean(row.DepositPaid),
    Remaining_Balance: parseOptionalNumber(row.Remaining_Balance),
    InvoiceStatus: cleanOptional(row.__raw_invoicestatus) ?? cleanOptional(row.InvoiceStatus),
    PaymentDate: cleanOptional(row.__raw_paymentdate) ?? cleanOptional(row.PaymentDate),
    Est_Hours_Allocation: parseOptionalNumber(row.Est_Hours_Allocation),
    Actual_Hours_Worked: parseOptionalNumber(row.Actual_Hours_Worked),
    EffectiveHourlyRate: parseOptionalNumber(row.EffectiveHourlyRate),
    EstimatedQuarterlyTax: parseOptionalNumber(row.EstimatedQuarterlyTax),
    OverheadCosts: parseOptionalNumber(row.OverheadCosts),
    NetMargin: parseOptionalNumber(row.NetMargin),
    Amount: isContractRow
      ? parseNumber(row.TotalContractValue)
      : parseNumber(row.__raw_invoiceamount || row.__raw_depositamount || row.__raw_amount || row.Amount),
    Status: isContractRow && !row.Status?.trim() ? 'Contract' : row.Status,
    DueDate: row.DueDate ?? '',
    PaidDate: row.PaidDate ?? row.PaymentDate ?? '',
  };
}

function mapAlertRow(row: Record<string, string>): unknown {
  const sourceValue = (...names: string[]): string | undefined => names
    .map((name) => row[`__raw_${name.toLowerCase()}`]?.trim())
    .find((value) => Boolean(value));
  const rawCategory = sourceValue('Category');
  const department = normalizeAlertDepartment(
    sourceValue('Department') || sourceValue('Assigned_Lead') || rawCategory || row.Department,
  );
  const assignedLead = sourceValue('Assigned_Lead') || department;
  const actionStatus = normalizeAlertStatus(
    sourceValue('Action_Status') || sourceValue('Dismissed_Status') || row.Action_Status,
  );
  return {
    Alert_ID: row.Alert_ID,
    Created_At: normalizeAlertDate(sourceValue('Created_At') || sourceValue('Timestamp') || row.Created_At),
    Source_Module: sourceValue('Source_Module') || rawCategory || department,
    Department: department,
    Client_ID: sourceValue('Client_ID') || sourceValue('ClientID') || row.Client_ID?.trim() || null,
    Project_ID: sourceValue('Project_ID') || sourceValue('ProjectID') || row.Project_ID?.trim() || null,
    Entity_Reference: row.Entity_Reference?.trim() || null,
    Severity: normalizeAlertSeverity(sourceValue('Severity') || sourceValue('Priority') || row.Severity),
    Trigger_Condition: sourceValue('Trigger_Condition') || sourceValue('Message') || row.Trigger_Condition,
    Prescribed_Action: sourceValue('Prescribed_Action') || sourceValue('Action_URL')
      || row.Prescribed_Action || 'Review this alert in Master Control.',
    Due_SLA: row.Due_SLA?.trim() || null,
    Assigned_Lead: assignedLead,
    Action_Status: actionStatus,
    Resolved_At: sourceValue('Resolved_At') || row.Resolved_At?.trim() || null,
  };
}

export function parseSnapshotCsvFiles(files: SnapshotCsvFiles): ParsedSnapshotFiles {
  const rejectedRows: RejectedSnapshotRow[] = [];
  const clients = parseRows('clients.csv', files['clients.csv'], COLUMN_ALIASES.clients, ClientSchema, mapClientRow, rejectedRows, 'ClientID');
  const clientsById = new Map(clients.rows.map((client) => [client.ClientID, client]));
  const projects = parseRows(
    'projects.csv',
    files['projects.csv'],
    COLUMN_ALIASES.projects,
    ProjectSchema,
    (row) => mapProjectRow(row, clientsById),
    rejectedRows,
    'ProjectID',
  );
  const financeRows = parseRows('finances.csv', files['finances.csv'], COLUMN_ALIASES.finances, FinanceRowSchema, mapFinanceRow, rejectedRows, 'InvoiceID');
  const alerts = parseRows('alerts.csv', files['alerts.csv'], COLUMN_ALIASES.alerts, AlertSchema, mapAlertRow, rejectedRows, 'Alert_ID');
  const serviceRates = parseRows(
    'services_rates.csv',
    files['services_rates.csv'],
    null,
    ServiceRateRowSchema,
    (row) => row,
    rejectedRows,
  );
  const fileCounts = {
    'clients.csv': clients.count,
    'projects.csv': projects.count,
    'finances.csv': financeRows.count,
    'alerts.csv': alerts.count,
    'services_rates.csv': serviceRates.count,
  };
  return {
    snapshot: { clients: clients.rows, projects: projects.rows, financeRows: financeRows.rows },
    alerts: alerts.rows,
    rejectedRows,
    unmappedColumns: {
      'clients.csv': clients.unmappedColumns,
      'projects.csv': projects.unmappedColumns,
      'finances.csv': financeRows.unmappedColumns,
      'alerts.csv': alerts.unmappedColumns,
    },
    fileCounts,
  };
}
