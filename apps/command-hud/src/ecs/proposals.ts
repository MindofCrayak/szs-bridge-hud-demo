export type ProposalType =
  | 'create_task'
  | 'create_tasks'
  | 'draft_invoice'
  | 'ledger_increment'
  | 'send_email'
  | 'nurture_step'
  | 'unlock_next_phase'
  | 'client_checkin'
  | 'stage_crisis_override'
  | 'addendum_options';

export interface PendingProposal {
  id: string;
  proposer: 'Alfred' | 'Event engine';
  eventId?: string;
  type: ProposalType;
  title: string;
  detail: string;
  clientId: string;
  surface: 'MultiAgentDispatch Priority Feed';
  effect: 'propose';
  requiresMoneyGate: boolean;
  clientFacing: boolean;
  stagedState?: { state: 'staged'; requiresSignoff: true };
  status: 'pending';
  createdAt: number;
}

export const CLIENT_FACING_ROUTE_LABEL = 'via Daisy';

export interface AlfredProposalParseResult {
  text: string;
  proposals: PendingProposal[];
}

const ALFRED_PROPOSAL_TYPES = new Set<ProposalType>([
  'create_task',
  'draft_invoice',
  'send_email',
]);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ID_PATTERN = /\b[A-Za-z0-9_-]{44}\b/g;
const URL_PATTERN = /\bhttps?:\/\/\S+/gi;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function cleanProposalText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(EMAIL_PATTERN, '[redacted]')
    .replace(ID_PATTERN, '[redacted]')
    .replace(URL_PATTERN, '[redacted]')
    .trim()
    .slice(0, limit);
}

export function createPendingProposal(input: Omit<PendingProposal, 'id' | 'createdAt' | 'status' | 'surface' | 'effect'> & {
  id?: string;
}): PendingProposal {
  return {
    ...input,
    id: input.id || `proposal:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    surface: 'MultiAgentDispatch Priority Feed',
    effect: 'propose',
    status: 'pending',
    createdAt: Date.now(),
  };
}

export function parseAlfredProposals(text: string, clientId: string): AlfredProposalParseResult {
  if (!clientId) return { text, proposals: [] };

  const proposals: PendingProposal[] = [];
  const displayText = text.replace(/```proposal\s*([\s\S]*?)```/gi, (block, json: string) => {
    let value: unknown;
    try {
      value = JSON.parse(json) as unknown;
    } catch {
      return block;
    }

    if (!isRecord(value) || typeof value.type !== 'string' || !ALFRED_PROPOSAL_TYPES.has(value.type as ProposalType)) {
      return block;
    }

    const title = cleanProposalText(value.title, 160);
    const detail = cleanProposalText(value.detail, 1_000);
    if (!title || !detail) return block;

    const type = value.type as 'create_task' | 'draft_invoice' | 'send_email';
    proposals.push(createPendingProposal({
      proposer: 'Alfred',
      type,
      title,
      detail,
      clientId,
      requiresMoneyGate: type === 'draft_invoice',
      clientFacing: type === 'send_email',
    }));
    return '';
  });

  return { text: displayText.trim(), proposals };
}
