import { z } from 'zod';

export const ACCOUNT_PHASES = [
  '01: Intake',
  '02: Session Zero',
  '03: Active Sprints',
  '04: Liftoff',
  '05: Complete',
  '06: Archived/Sunset',
] as const;

export const SPRINT_STAGES = [
  '00: Discovery',
  '01: Vibecheck',
  '02: Contract & Inception',
  '03: Deep Intelligence',
  '04: Session Zero Kickoff',
  '05: Architecture & Builds',
  '06: Mid-Flight Review',
  '07: Final Staging & QA',
  '08: Liftoff & Handover',
  '09: Sunset / Retainer',
] as const;

export const DATA_DEPARTMENTS = ['Housekeeping', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy'] as const;
export const SEVERITIES = ['INFO', 'WARN', 'BLOCK'] as const;

// Master Plan v3.1 section 3. Legacy shapes were removed by the Phase C wipe.
const clientIdPattern = /^[A-Z]{3}\d{0,2}$/;
const projectIdPattern = /^[A-Z]{3}\d{0,2}-\d{2,3}$/;
const invoiceIdPattern = /^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$/;
const legacyComsClientIdPattern = /^(?:CLT|CLI)-\d{3}$/;
const legacyComsProjectIdPattern = /^PRJ-\d{4}-\d{2}$/;

export const isValidClientId = (value: string): boolean => clientIdPattern.test(value);
export const isValidProjectId = (value: string): boolean => projectIdPattern.test(value);
export const isValidInvoiceId = (value: string): boolean => invoiceIdPattern.test(value);
export const isValidLegacyComsClientId = (value: string): boolean => legacyComsClientIdPattern.test(value);
export const isValidLegacyComsProjectId = (value: string): boolean => legacyComsProjectIdPattern.test(value);

export const ClientIdSchema = z.string().regex(clientIdPattern, 'Invalid ClientID format.');
export const ProjectIdSchema = z.string().regex(projectIdPattern, 'Invalid ProjectID format.');
export const InvoiceIdSchema = z.string().regex(invoiceIdPattern, 'Invalid InvoiceID format.');
export const LegacyComsClientIdSchema = z.string().regex(legacyComsClientIdPattern, 'Invalid legacy COMS client ID format.');
export const LegacyComsProjectIdSchema = z.string().regex(legacyComsProjectIdPattern, 'Invalid legacy COMS project ID format.');

export const ClientSchema = z.object({
  ClientID: ClientIdSchema,
  Company_Name: z.string().trim().min(1),
  First_Name: z.string().optional(),
  Last_Name: z.string().optional(),
  AccountPhase: z.enum(ACCOUNT_PHASES),
  AccountPhase_Mode: z.enum(['auto', 'manual']).optional(),
  ContractValue: z.number().finite().nonnegative(),
  DepositPaid: z.boolean(),
  CurrentMilestone: z.string().optional(),
  CompletedMilestones: z.number().int().nonnegative().optional(),
  TotalMilestones: z.number().int().nonnegative().optional(),
  PrimaryContact: z.string().optional(),
  ContactEmail: z.string().optional(),
  GoogleGroupEmail: z.string().optional(),
  DriveFolderUrl: z.string().optional(),
  NotesDocUrl: z.string().optional(),
  MSA_DocID: z.string().optional(),
  ChatSpaceUrl: z.string().optional(),
  Roadblock: z.string().optional(),
  Lead_Source: z.string().optional(),
  Archetype: z.string().optional(),
  Tech_Stack: z.string().optional(),
  MCC_Subscriber_ID: z.string().optional(),
  Oracle_Baseline_ID: z.string().optional(),
  activeComponents: z.array(z.string().trim().min(1)).optional(),
});

export const ProjectSchema = z.object({
  ProjectID: ProjectIdSchema,
  ClientID: ClientIdSchema,
  SprintStage: z.enum(SPRINT_STAGES),
  MilestonesTotal: z.number().int().nonnegative(),
  MilestonesDone: z.number().int().nonnegative(),
  AssignedRateTier: z.enum(['Normal', 'Premium', 'Reduced', 'Fixed']),
  ActiveComponents: z.array(z.string().trim().min(1)).optional(),
  Title: z.string().trim().min(1).optional(),
  SOW_DocID: z.string().optional(),
  Est_Hours: z.number().finite().nonnegative().optional(),
  Actual_Hours: z.number().finite().nonnegative().optional(),
  Google_Tasklist_ID: z.string().optional(),
  Project_Brief_DocID: z.string().optional(),
  Project_Outline_DocID: z.string().optional(),
  COMS_Sheet_URL: z.string().optional(),
  MeetingNotes_DriveFolderID: z.string().optional(),
  ChatSpace_URL: z.string().optional(),
  ChatSpace_Internal_URL: z.string().optional(),
  Dashboard_Sheet_ID: z.string().optional(),
  Kickoff_Date: z.string().optional(),
  ParentProjectID: z.string().optional(),
  AddendumRef: z.string().optional(),
});

/** Finances rows: invoices carry an InvoiceID; the one contract row per project (MilestoneStage = Contract) does not. */
export const CONTRACT_MILESTONE = 'Contract';

const FinanceRowObject = z.object({
  InvoiceID: z.string().trim(),
  ClientID: ClientIdSchema,
  ProjectID: ProjectIdSchema.optional(),
  InvoiceNumber: z.string().optional(),
  MilestoneStage: z.string().optional(),
  TotalContractValue: z.number().finite().nonnegative().optional(),
  DepositAmount: z.number().finite().nonnegative().optional(),
  InvoiceAmount: z.number().finite().nonnegative().optional(),
  DepositPaid: z.boolean().optional(),
  Remaining_Balance: z.number().finite().optional(),
  InvoiceStatus: z.string().optional(),
  PaymentDate: z.string().optional(),
  Est_Hours_Allocation: z.number().finite().nonnegative().optional(),
  Actual_Hours_Worked: z.number().finite().nonnegative().optional(),
  EffectiveHourlyRate: z.number().finite().optional(),
  EstimatedQuarterlyTax: z.number().finite().nonnegative().optional(),
  OverheadCosts: z.number().finite().nonnegative().optional(),
  NetMargin: z.number().finite().optional(),
  Amount: z.number().finite().nonnegative(),
  Status: z.string().trim().min(1),
  DueDate: z.string().optional(),
  PaidDate: z.string().optional(),
});

export const FinanceRowSchema = FinanceRowObject.superRefine((row, ctx) => {
  if (row.MilestoneStage === CONTRACT_MILESTONE && row.InvoiceID === '') return;
  if (!InvoiceIdSchema.safeParse(row.InvoiceID).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['InvoiceID'], message: 'Invalid InvoiceID format.' });
  }
});

export const AlertSchema = z.object({
  Alert_ID: z.string().trim().min(1),
  Created_At: z.string().datetime({ offset: true }),
  Source_Module: z.string().trim().min(1),
  Department: z.enum(DATA_DEPARTMENTS),
  Client_ID: ClientIdSchema.nullable(),
  Project_ID: ProjectIdSchema.nullable(),
  Entity_Reference: z.string().nullable(),
  Severity: z.enum(SEVERITIES),
  Trigger_Condition: z.string().trim().min(1),
  Prescribed_Action: z.string().trim().min(1),
  Due_SLA: z.string().nullable(),
  Assigned_Lead: z.string().trim().min(1),
  Action_Status: z.string().trim().min(1),
  Resolved_At: z.string().nullable(),
});

// Sheet cells arrive raw from Apps Script: "0.1" can be a number and blanks can be null.
const sheetText = () => z.preprocess((value) => (value == null ? '' : String(value)), z.string());
const sheetEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value), z.enum(values));

export const SchemaRegistryRowSchema = z.object({
  Registry_ID: z.string().trim().min(1),
  Database: z.string().trim().min(1),
  Tab: z.string().trim().min(1),
  Column_Letter: z.string().trim().min(1),
  Column_Name: z.string().trim().min(1),
  Data_Type: sheetEnum(['text', 'number', 'date', 'enum', 'id', 'currency', 'boolean', 'json']),
  Allowed_Values: sheetText(),
  Data_Class: sheetEnum(['public', 'internal', 'pii', 'secret']),
  Owner_Persona: z.string().trim().min(1),
  Required: sheetEnum(['yes', 'no']),
  Schema_Version: sheetText().pipe(z.string().trim().min(1)),
  Last_Verified: sheetText(),
  Notes: sheetText(),
});

export const SchemaChangeSchema = z.object({
  Change_ID: z.string().trim().min(1),
  Logged_At: z.string().datetime({ offset: true }),
  Requested_By: z.string().trim().min(1),
  Target_Database: z.string(),
  Target_Tab: z.string(),
  Target_Column: z.string(),
  Change_Type: z.enum([
    'Add column',
    'Rename column',
    'Remove column',
    'Add allowed value',
    'Change type',
    'New tab',
    'ID format',
    'Process',
    'Other',
  ]),
  Reason: z.string().trim().min(1),
  Impact: z.string(),
  Severity: z.enum(SEVERITIES),
  Status: z.enum(['Noted', 'Requested', 'Approved', 'Applied', 'Verified', 'Rejected']),
  Approved_By: z.string(),
  Applied_Version: z.string(),
  Police_Check_Result: z.enum(['PASS', 'FAIL', '']),
  Rollback_Note: z.string(),
  Source: z.enum(['seed', 'police.schema', 'hud.draft', 'manual']),
});

export const SnapshotSchema = z.object({
  clients: z.array(ClientSchema),
  projects: z.array(ProjectSchema),
  financeRows: z.array(FinanceRowSchema),
});

export type Client = z.infer<typeof ClientSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type FinanceRow = z.infer<typeof FinanceRowSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type SchemaRegistryRow = z.infer<typeof SchemaRegistryRowSchema>;
export type SchemaChange = z.infer<typeof SchemaChangeSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;

export class DataContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataContractError';
  }
}

export const parseRows = <T>(
  label: string,
  rows: unknown,
  schema: z.ZodType<T>,
): T[] => {
  if (!Array.isArray(rows)) {
    throw new DataContractError(`${label} must be an array.`);
  }
  return rows.map((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
        .join('; ');
      throw new DataContractError(`${label} row ${index + 1} is invalid: ${details}`);
    }
    return result.data;
  });
};

export const parseRowsSkippingInvalid = <T>(
  label: string,
  rows: unknown,
  schema: z.ZodType<T>,
): { rows: T[]; warnings: string[] } => {
  if (!Array.isArray(rows)) {
    throw new DataContractError(`${label} must be an array.`);
  }

  const parsedRows: T[] = [];
  const warnings: string[] = [];
  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
        .join('; ');
      warnings.push(`${label} row ${index + 1} skipped: ${details}`);
      return;
    }
    parsedRows.push(result.data);
  });
  return { rows: parsedRows, warnings };
};

export function parseSnapshot(value: unknown): Snapshot {
  const result = SnapshotSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'snapshot'}: ${issue.message}`)
      .join('; ');
    throw new DataContractError(`Master Control data contract validation failed: ${details}`);
  }
  return result.data;
}
