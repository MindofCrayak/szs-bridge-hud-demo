import type { Department } from './catalog';
import type { ProposalType } from './proposals';
import type { HudEventType } from './events';
import type { LinkKind } from './links';

export type RuleStatus = 'suggested' | 'approved';
export type RuleSource = Department | 'component';
export type RuleTarget = Department | '*';

export interface HudRule {
  id: string;
  status: RuleStatus;
  on: HudEventType;
  from: RuleSource;
  kind: LinkKind;
  to: RuleTarget;
  effect: 'unblock' | 'propose' | 'context';
  proposal?: ProposalType;
  moneyGate?: boolean;
  clientFacing?: boolean;
  note: string;
}

export const RULES: readonly HudRule[] = [
  { id: 'pamela-gate-oracle', status: 'suggested', on: 'msa.signed', from: 'pamela', kind: 'trigger', to: 'oracle', effect: 'context', note: 'Gate PASS may hand off the approved intake brief to Oracle.' },
  { id: 'pamela-gate-alfred', status: 'suggested', on: 'msa.signed', from: 'pamela', kind: 'trigger', to: 'core', effect: 'context', note: 'Route the gate result to Alfred; include no raw Oracle internals.' },
  { id: 'oracle-summary-alfred', status: 'suggested', on: 'sweep.complete', from: 'oracle', kind: 'trigger', to: 'core', effect: 'context', note: 'Forward a summary only; never expose Oracle internals.' },
  { id: 'dolores-milestone-vala', status: 'suggested', on: 'milestone.done', from: 'dolores', kind: 'trigger', to: 'vala', effect: 'propose', proposal: 'draft_invoice', moneyGate: true, note: 'Prepare an invoice proposal for the Financial Mutation gate.' },
  { id: 'vala-completion-daisy', status: 'suggested', on: 'project.completed', from: 'vala', kind: 'trigger', to: 'daisy', effect: 'propose', proposal: 'nurture_step', note: 'Prepare a completion and offboarding review for Daisy.' },
  { id: 'dolores-overdue-daisy', status: 'suggested', on: 'task.overdue', from: 'dolores', kind: 'trigger', to: 'daisy', effect: 'propose', proposal: 'client_checkin', clientFacing: true, note: 'Prepare a client check-in for Daisy to review and route.' },
  { id: 'client-facing-pamela-daisy', status: 'suggested', on: 'client-facing.proposed', from: 'pamela', kind: 'trigger', to: 'daisy', effect: 'context', note: 'Route client-facing proposals through Daisy.' },
  { id: 'client-facing-oracle-daisy', status: 'suggested', on: 'client-facing.proposed', from: 'oracle', kind: 'trigger', to: 'daisy', effect: 'context', note: 'Route client-facing proposals through Daisy; share summary only.' },
  { id: 'client-facing-dolores-daisy', status: 'suggested', on: 'client-facing.proposed', from: 'dolores', kind: 'trigger', to: 'daisy', effect: 'context', note: 'Route client-facing proposals through Daisy.' },
  { id: 'client-facing-vala-daisy', status: 'suggested', on: 'client-facing.proposed', from: 'vala', kind: 'trigger', to: 'daisy', effect: 'context', note: 'Route client-facing proposals through Daisy.' },
  { id: 'client-facing-alfred-daisy', status: 'suggested', on: 'client-facing.proposed', from: 'core', kind: 'trigger', to: 'daisy', effect: 'context', note: 'Route client-facing proposals through Daisy.' },
];
