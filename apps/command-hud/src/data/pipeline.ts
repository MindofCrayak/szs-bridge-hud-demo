import { AccountPhase, ClientFinanceSummary, SprintStage } from '../types';

export interface AccountPhaseColumnConfig {
  id: string;
  phase: AccountPhase;
  title: string;
  badge: string;
}

export const ACCOUNT_PHASES: AccountPhaseColumnConfig[] = [
  { id: 'phase-01', phase: '01: Intake', title: 'INTAKE', badge: 'LEADS' },
  { id: 'phase-02', phase: '02: Session Zero', title: 'SESSION ZERO', badge: 'DISCOVERY' },
  { id: 'phase-03', phase: '03: Active Sprints', title: 'ACTIVE SPRINTS', badge: 'EXECUTION' },
  { id: 'phase-04', phase: '04: Liftoff', title: 'LIFTOFF', badge: 'HANDOVER' },
  { id: 'phase-05', phase: '05: Complete', title: 'COMPLETE', badge: 'MAINTENANCE' },
  { id: 'phase-06', phase: '06: Archived/Sunset', title: 'SUNSET / RETAINER', badge: 'ARCHIVED' },
];

export interface SprintStageColumnConfig {
  id: string;
  stage: SprintStage;
  title: string;
  badge: string;
  phaseGrouping: AccountPhase;
}

export const SPRINT_STAGES: SprintStageColumnConfig[] = [
  { id: 'stage-00', stage: '00: Discovery', title: '00: DISCOVERY', badge: 'INGEST', phaseGrouping: '01: Intake' },
  { id: 'stage-01', stage: '01: Vibecheck', title: '01: VIBECHECK', badge: 'TRIAGE', phaseGrouping: '01: Intake' },
  { id: 'stage-02', stage: '02: Contract & Inception', title: '02: CONTRACT & INCEPTION', badge: 'GATED', phaseGrouping: '02: Session Zero' },
  { id: 'stage-03', stage: '03: Deep Intelligence', title: '03: DEEP INTELLIGENCE', badge: 'OSINT', phaseGrouping: '02: Session Zero' },
  { id: 'stage-04', stage: '04: Session Zero Kickoff', title: '04: SESSION ZERO KICKOFF', badge: 'KICKOFF', phaseGrouping: '02: Session Zero' },
  { id: 'stage-05', stage: '05: Architecture & Builds', title: '05: ARCHITECTURE & BUILDS', badge: 'BUILD', phaseGrouping: '03: Active Sprints' },
  { id: 'stage-06', stage: '06: Mid-Flight Review', title: '06: MID-FLIGHT REVIEW', badge: 'REVIEW', phaseGrouping: '03: Active Sprints' },
  { id: 'stage-07', stage: '07: Final Staging & QA', title: '07: FINAL STAGING & QA', badge: 'QA', phaseGrouping: '03: Active Sprints' },
  { id: 'stage-08', stage: '08: Liftoff & Handover', title: '08: LIFTOFF & HANDOVER', badge: 'LAUNCH', phaseGrouping: '04: Liftoff' },
  { id: 'stage-09', stage: '09: Sunset / Retainer', title: '09: SUNSET / RETAINER', badge: 'ARCHIVE', phaseGrouping: '06: Archived/Sunset' },
];

export const normalizeAccountPhase = (val: string): AccountPhase => {
  const clean = val.toLowerCase().trim();
  if (clean.includes('01') || clean.includes('intake')) return '01: Intake';
  if (clean.includes('02') || clean.includes('session zero')) return '02: Session Zero';
  if (clean.includes('03') || clean.includes('active') || clean.includes('sprint') || clean.includes('build')) return '03: Active Sprints';
  if (clean.includes('04') || clean.includes('liftoff')) return '04: Liftoff';
  if (clean.includes('05') || clean.includes('complete')) return '05: Complete';
  if (clean.includes('06') || clean.includes('sunset') || clean.includes('archive') || clean.includes('09')) return '06: Archived/Sunset';
  return '01: Intake';
};

export const normalizeSprintStage = (val: string): SprintStage => {
  const clean = val.toLowerCase().trim();
  if (clean.includes('00') || clean.includes('discovery')) return '00: Discovery';
  if (clean.includes('01') || clean.includes('vibecheck') || clean.includes('pitch')) return '01: Vibecheck';
  if (clean.includes('02') || clean.includes('contract') || clean.includes('inception')) return '02: Contract & Inception';
  if (clean.includes('03') || clean.includes('deep') || clean.includes('intel') || clean.includes('strategy')) return '03: Deep Intelligence';
  if (clean.includes('04') || clean.includes('kickoff')) return '04: Session Zero Kickoff';
  if (clean.includes('05') || clean.includes('architecture') || clean.includes('build')) return '05: Architecture & Builds';
  if (clean.includes('06') || clean.includes('mid-flight') || clean.includes('review')) return '06: Mid-Flight Review';
  if (clean.includes('07') || clean.includes('staging') || clean.includes('qa')) return '07: Final Staging & QA';
  if (clean.includes('08') || clean.includes('liftoff') || clean.includes('handover')) return '08: Liftoff & Handover';
  if (clean.includes('09') || clean.includes('sunset') || clean.includes('retainer')) return '09: Sunset / Retainer';
  return '00: Discovery';
};

export function deriveAccountPhase(
  projects: readonly { SprintStage: SprintStage }[],
  sheetPhase: AccountPhase,
): AccountPhase {
  if (sheetPhase === '05: Complete' || projects.length === 0) return sheetPhase;

  const stages = projects.map(({ SprintStage }) => Number.parseInt(SprintStage.slice(0, 2), 10));
  if (stages.some((stage) => stage >= 5 && stage <= 7)) return '03: Active Sprints';
  if (stages.some((stage) => stage >= 2 && stage <= 4)) return '02: Session Zero';
  if (stages.some((stage) => stage >= 0 && stage <= 1)) return '01: Intake';
  if (stages.every((stage) => stage === 8)) return '04: Liftoff';
  if (stages.some((stage) => stage === 9)) return '06: Archived/Sunset';
  return sheetPhase;
}

export const normalizePipelineStage = (stage: string): string => normalizeSprintStage(stage);

/** Per-client finance summary: balance from contract rows, tax total, latest margin, and the invoice list. */
export function financeSummary(
  financeRows: readonly {
    ClientID: string; InvoiceID: string; ProjectID?: string; MilestoneStage?: string; Amount: number; Status: string;
    Remaining_Balance?: number; EstimatedQuarterlyTax?: number; NetMargin?: number;
  }[],
  clientId: string,
): ClientFinanceSummary | undefined {
  const rows = financeRows.filter((row) => row.ClientID === clientId);
  if (rows.length === 0) return undefined;
  const contracts = rows.filter((row) => row.MilestoneStage === 'Contract');
  const cents = (value: number | undefined) => Math.round((value ?? 0) * 100);
  const taxes = rows.map((row) => row.EstimatedQuarterlyTax).filter((value): value is number => typeof value === 'number');
  const margins = rows.map((row) => row.NetMargin).filter((value): value is number => typeof value === 'number');
  return {
    remainingBalance: contracts.reduce((sum, row) => sum + cents(row.Remaining_Balance), 0) / 100,
    estimatedTax: taxes.length ? taxes.reduce((sum, value) => sum + cents(value), 0) / 100 : null,
    netMargin: margins.length ? margins[margins.length - 1] ?? null : null,
    invoices: rows
      .filter((row) => row.MilestoneStage !== 'Contract')
      .map((row) => ({ InvoiceID: row.InvoiceID, ProjectID: row.ProjectID, MilestoneStage: row.MilestoneStage, Amount: row.Amount, Status: row.Status })),
  };
}

/**
 * Default invoice schedule (Plan v3.1 section 3): equal thirds, remainder on the final invoice,
 * exact to the cent. Mirrors vala_defaultSchedule_ in engines/master-control/Finance_Model.gs.
 */
export function defaultInvoiceSchedule(total: number): [number, number, number] {
  const cents = Math.round(total * 100);
  const third = Math.floor(cents / 3);
  return [third / 100, third / 100, (cents - 2 * third) / 100];
}

/**
 * Finances is the master (Plan v3.1 section 3): a client's contract value is the sum of its
 * contract-row TCVs. Returns null when the client has no contract rows (fall back to Clients.ContractValue).
 */
export function contractRollup(
  financeRows: readonly { ClientID: string; MilestoneStage?: string; TotalContractValue?: number }[],
  clientId: string,
): number | null {
  const contracts = financeRows.filter((row) => row.ClientID === clientId && row.MilestoneStage === 'Contract');
  if (contracts.length === 0) return null;
  const cents = contracts.reduce((sum, row) => sum + Math.round((row.TotalContractValue ?? 0) * 100), 0);
  return cents / 100;
}
