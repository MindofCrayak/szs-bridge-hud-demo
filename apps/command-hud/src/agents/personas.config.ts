import { createPendingProposal } from '../ecs/proposals.ts';
import type { PendingProposal } from '../ecs/proposals.ts';

export type PersonaName = 'Alfred' | 'Pamela' | 'Oracle' | 'Dolores' | 'Vala' | 'Daisy';
export type AutonomyTier = 'proposal-only' | 'read-only' | 'staged-proposal' | 'workspace';
const AUTONOMY_LEVELS: readonly AutonomyTier[] = ['proposal-only', 'read-only', 'staged-proposal', 'workspace'];
export const HUD_CAP: AutonomyTier = 'proposal-only';

export interface PersonaReport {
  status: string;
  bottlenecks: string[];
  risks: string[];
  asks: string[];
}

export interface StaffMeetingInput {
  clients: Array<{
    clientId: string;
    phase: string;
    projectStages: string[];
    depositPaid?: boolean;
  }>;
  alerts: Array<{
    department: string;
    severity: string;
  }>;
  proposals: Array<{
    title: string;
    type: string;
    requiresMoneyGate: boolean;
    clientFacing: boolean;
  }>;
  schemaRegistry?: Array<{ Column_Name: string; Data_Class: string }>;
}

export interface StaffMeetingBrief {
  persona: PersonaName;
  report: PersonaReport;
}

export interface PersonaConfig {
  name: PersonaName;
  role: string;
  voice: { archetype: string; tone: string; signatureQuote?: string; candor: number; wit: number };
  behavior: { compliance: number; proactivity: number; drift: number };
  authority: { sheetTier: number; hudCap: AutonomyTier; effectiveAutonomy: AutonomyTier };
  routing: string;
  grounding: string;
  report: (input: StaffMeetingInput) => PersonaReport;
}

const isOpenAlert = (alert: StaffMeetingInput['alerts'][number], department: string): boolean =>
  alert.department.toLowerCase() === department.toLowerCase();

const departmentAlertReport = (
  input: StaffMeetingInput,
  department: string,
  role: string,
): PersonaReport => {
  const alerts = input.alerts.filter((alert) => isOpenAlert(alert, department));
  const blockers = alerts.filter((alert) => alert.severity === 'BLOCK');
  return {
    status: `${role}: ${alerts.length} supplied alert${alerts.length === 1 ? '' : 's'}.`,
    bottlenecks: blockers.length ? [`${blockers.length} BLOCK alert${blockers.length === 1 ? '' : 's'} need review.`] : [],
    risks: alerts.filter((alert) => alert.severity === 'WARN').length
      ? [`${alerts.filter((alert) => alert.severity === 'WARN').length} WARN alert(s) remain open.`]
      : [],
    asks: [],
  };
};

const PERSONA_ORDER: PersonaName[] = ['Alfred', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy'];

export function deriveEffectiveAutonomy(sheetTier: number, hudCap: AutonomyTier = HUD_CAP): AutonomyTier {
  const sheetLevel = Math.max(0, Math.min(AUTONOMY_LEVELS.length - 1, Math.floor(sheetTier)));
  const capLevel = AUTONOMY_LEVELS.indexOf(hudCap);
  return AUTONOMY_LEVELS[Math.min(sheetLevel, capLevel)] || 'proposal-only';
}

export const PERSONAS: Record<PersonaName, PersonaConfig> = {
  Alfred: {
    name: 'Alfred',
    role: 'Chief of Staff, orchestrator, System Policer, schema registry custodian',
    voice: { archetype: 'Chief of Staff', tone: 'crisp, pragmatic, polished, terminal-style', candor: 0.4, wit: 0.7 },
    behavior: { compliance: 0.9, proactivity: 0.95, drift: 0.3 },
    authority: { sheetTier: 3, hudCap: 'proposal-only', effectiveAutonomy: deriveEffectiveAutonomy(3) },
    routing: 'System event, then routes to the designated persona.',
    grounding: 'Status telemetry and verified API route status; no unsupplied facts.',
    report: (input) => ({
      status: `${input.clients.length} client summaries, ${input.alerts.length} alerts, ${input.proposals.length} pending proposals supplied.`,
      bottlenecks: input.alerts.filter((alert) => alert.severity === 'BLOCK').length
        ? [`${input.alerts.filter((alert) => alert.severity === 'BLOCK').length} BLOCK alert(s) require review.`]
        : [],
      risks: [],
      asks: [],
    }),
  },
  Pamela: {
    name: 'Pamela',
    role: 'Intake and lead qualification',
    voice: { archetype: 'Intake and lead qualification', tone: 'direct, confident, intake-focused', candor: 0.85, wit: 0.6 },
    behavior: { compliance: 0.65, proactivity: 0.8, drift: 0.5 },
    authority: { sheetTier: 2, hudCap: 'proposal-only', effectiveAutonomy: deriveEffectiveAutonomy(2) },
    routing: 'Green Form, then Oracle and Alfred.',
    grounding: 'Intake and Session Zero phase summaries only.',
    report: (input) => {
      const intake = input.clients.filter((client) => client.phase === '01: Intake');
      const missingDeposit = intake.filter((client) => client.depositPaid === false).length;
      return {
        status: `${intake.length} supplied client summary/summaries are in Intake.`,
        bottlenecks: missingDeposit ? [`${missingDeposit} Intake client(s) have no paid-deposit flag.`] : [],
        risks: [],
        asks: [],
      };
    },
  },
  Oracle: {
    name: 'Oracle',
    role: 'Marketing intelligence and COMS summaries',
    voice: { archetype: 'Marketing intelligence', tone: 'analytical, concise, evidence-led', candor: 0.9, wit: 0.1 },
    behavior: { compliance: 0.95, proactivity: 0.85, drift: 0.15 },
    authority: { sheetTier: 1, hudCap: 'proposal-only', effectiveAutonomy: deriveEffectiveAutonomy(1) },
    routing: 'Drake command or Pamela pass, then Alfred.',
    grounding: 'Internal summary only. Raw case files, scraping, and unconfigured integrations are unavailable.',
    report: () => ({
      status: 'No Oracle internal summary was supplied for this meeting.',
      bottlenecks: [],
      risks: ['No external intelligence or raw case-file data was consulted.'],
      asks: [],
    }),
  },
  Dolores: {
    name: 'Dolores',
    role: 'Workspace, tasks, and schema change workflow',
    voice: { archetype: 'Workspace and task operations', tone: 'precise, operational, checklist-driven', candor: -0.2, wit: 0.3 },
    behavior: { compliance: 1, proactivity: 0.9, drift: 0.4 },
    authority: { sheetTier: 3, hudCap: 'proposal-only', effectiveAutonomy: deriveEffectiveAutonomy(3) },
    routing: 'SOW signed, then Vala at milestone gates.',
    grounding: 'Supplied project stages and Dolores alert summaries; task connector status is not inferred.',
    report: (input) => {
      const stages = input.clients.flatMap((client) => client.projectStages);
      return {
        ...departmentAlertReport(input, 'Dolores', 'Workspace and delivery'),
        asks: stages.length ? [] : ['No project-stage summaries were supplied.'],
      };
    },
  },
  Vala: {
    name: 'Vala',
    role: 'Milestone billing',
    voice: { archetype: 'Milestone billing', tone: 'measured, candid, financially cautious', candor: 0.75, wit: 0.7 },
    behavior: { compliance: 0.5, proactivity: 0.8, drift: 0.6 },
    authority: { sheetTier: 2, hudCap: 'proposal-only', effectiveAutonomy: deriveEffectiveAutonomy(2) },
    routing: 'Milestone gates, then Daisy on completion.',
    grounding: 'Deposit flags, milestone/project stages, and Vala alert summaries; no ledger rows were supplied.',
    report: (input) => {
      const unpaid = input.clients.filter((client) => client.depositPaid === false).length;
      const moneyProposals = input.proposals.filter((proposal) => proposal.requiresMoneyGate).length;
      return {
        ...departmentAlertReport(input, 'Vala', 'Milestone billing'),
        bottlenecks: [
          ...departmentAlertReport(input, 'Vala', 'Milestone billing').bottlenecks,
          ...(unpaid ? [`${unpaid} supplied client summary/summaries have an unpaid deposit flag.`] : []),
        ],
        risks: moneyProposals ? [`${moneyProposals} pending proposal(s) require the Financial Mutation gate.`] : [],
        asks: [],
      };
    },
  },
  Daisy: {
    name: 'Daisy',
    role: 'Client journey manager, offboarding, and Mail Command Center overseer',
    voice: { archetype: 'Client journey and offboarding', tone: 'warm, concise, client-conscious', candor: -0.4, wit: 0.5 },
    behavior: { compliance: 0.8, proactivity: 0.7, drift: 0.55 },
    authority: { sheetTier: 2, hudCap: 'proposal-only', effectiveAutonomy: deriveEffectiveAutonomy(2) },
    routing: 'Every client-facing proposal routes through Daisy; final delivery leads to Sunset.',
    grounding: 'Client-safe proposal summaries only; Daisy owns the staged client-comms queue.',
    report: (input) => {
      const clientMessages = input.proposals.filter((proposal) => proposal.clientFacing).length;
      return {
        ...departmentAlertReport(input, 'Daisy', 'Client journey and offboarding'),
        status: `${clientMessages} pending client-facing proposal(s) in Daisy's review queue.`,
        asks: clientMessages ? ['Review consent, frequency, and tone before any staged send.'] : [],
      };
    },
  },
};

export function getPersonaOrder(): readonly PersonaName[] {
  return PERSONA_ORDER;
}

export function buildStaffMeetingBriefs(input: StaffMeetingInput): StaffMeetingBrief[] {
  return PERSONA_ORDER.map((persona) => ({
    persona,
    report: PERSONAS[persona].report(input),
  }));
}

export function getContextWhitelist(
  registry: readonly { Column_Name: string; Data_Class: string }[] = [],
): ReadonlySet<string> {
  const forbidden = new Set(
    registry
      .filter((row) => row.Data_Class === 'pii' || row.Data_Class === 'secret')
      .map((row) => row.Column_Name),
  );
  return new Set(['ClientID', 'AccountPhase', 'SprintStage', 'DepositPaid', 'Severity', 'Department', 'ProposalType']
    .filter((column) => !forbidden.has(column)));
}

export function stageCrisisOverrideFromBlockAlert(
  alert: { id: string; clientId: string; severity: string },
  requestedState: string,
): (PendingProposal & {
  alertId: string;
  requestedState: string;
  stagedState: { state: 'staged'; requiresSignoff: true };
  requiresSignoff: true;
}) | null {
  const state = requestedState.trim().slice(0, 100);
  if (alert.severity !== 'BLOCK' || !alert.id.trim() || !state) return null;
  return {
    ...createPendingProposal({
      id: `crisis:${alert.id}:${state}`,
      proposer: 'Alfred',
      type: 'stage_crisis_override',
      title: `Stage crisis override: ${state}`,
      detail: 'Proposed state only. Master Drake sign-off is required; no action was performed.',
      clientId: alert.clientId,
      requiresMoneyGate: false,
      clientFacing: false,
    }),
    alertId: alert.id,
    requestedState: state,
    stagedState: { state: 'staged', requiresSignoff: true },
    requiresSignoff: true,
  };
}
