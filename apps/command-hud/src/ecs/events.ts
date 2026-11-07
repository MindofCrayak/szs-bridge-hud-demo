import type { Snapshot } from '../data/contracts';
import type { Department } from './catalog';
import type { Link } from './links';
import { createPendingProposal } from './proposals';
import type { PendingProposal, ProposalType } from './proposals';
import { RULES } from './rules';
import type { HudRule } from './rules';

export type HudEventType =
  | 'msa.signed'
  | 'sweep.complete'
  | 'stage.changed'
  | 'phase.changed'
  | 'component.installed'
  | 'milestone.done'
  | 'invoice.paid'
  | 'task.overdue'
  | 'project.completed'
  | 'client-facing.proposed'
  | 'addendum.signed'
  | 'police.corrected'
  | 'police.schema';

export type HudEventSource = 'user_write' | 'police_correction' | 'external' | 'system';

export interface HudEvent {
  id: string;
  type: HudEventType;
  source: HudEventSource;
  sourceNodeId: string;
  clientId: string;
  projectId?: string;
  payload?: Record<string, unknown>;
}

export interface HudEventTrace {
  source: string;
  target: string | null;
  kind: Link['kind'] | null;
  type: HudEventType;
  time: number;
}

export interface PublishEventResult {
  proposals: PendingProposal[];
  traces: HudEventTrace[];
  activeLinkIds: string[];
  unblockedLinkIds: string[];
  alerts: HudEvent[];
}

interface PublishEventOptions {
  rules?: readonly HudRule[];
  getDepartment?: (nodeId: string) => Department | 'component' | null;
  depth?: number;
}

export const MAX_EVENT_DEPTH = 3;
let firedThisTick = new Set<string>();
let resetScheduled = false;

const DEPARTMENTS: Department[] = ['pamela', 'oracle', 'dolores', 'vala', 'daisy', 'core'];

function getDefaultDepartment(nodeId: string): Department | 'component' | null {
  if (nodeId === 'core-node' || nodeId.startsWith('sun-')) return 'core';
  const suffix = nodeId.startsWith('node-') ? nodeId.slice(5) : nodeId;
  if (DEPARTMENTS.includes(suffix as Department)) return suffix as Department;
  return nodeId.startsWith('node-') ? 'component' : null;
}

function scheduleTickReset(): void {
  if (resetScheduled) return;
  resetScheduled = true;
  queueMicrotask(() => {
    firedThisTick = new Set();
    resetScheduled = false;
  });
}

function proposalTitle(type: ProposalType): string {
  return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x1505;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x01000193);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function createDiffEvent(
  type: HudEventType,
  entityType: 'client' | 'project' | 'invoice' | 'component',
  entityId: string,
  field: string,
  previousValue: string | number | boolean,
  value: string | number | boolean,
  clientId: string,
  sourceNodeId: string,
  source: HudEventSource,
  projectId?: string,
): HudEvent {
  const version = `${String(previousValue)}=>${String(value)}`;
  const identity = `${entityType}:${entityId}:${field}:${version}`;
  return {
    id: `evt-${stableHash(identity)}`,
    type,
    source,
    sourceNodeId,
    clientId,
    ...(projectId ? { projectId } : {}),
    payload: { entityType, entityId, field, previousValue, value, version },
  };
}

export function diffSnapshots(
  previous: Snapshot,
  next: Snapshot,
  source: HudEventSource = 'external',
): HudEvent[] {
  const events: HudEvent[] = [];
  const previousClients = new Map(previous.clients.map((client) => [client.ClientID, client]));
  const previousProjects = new Map(previous.projects.map((project) => [project.ProjectID, project]));
  const previousInvoices = new Map(previous.financeRows.map((row) => [row.InvoiceID, row]));

  for (const client of next.clients) {
    const oldClient = previousClients.get(client.ClientID);
    if (oldClient && oldClient.AccountPhase !== client.AccountPhase) {
      events.push(createDiffEvent(
        'phase.changed', 'client', client.ClientID, 'AccountPhase', oldClient.AccountPhase,
        client.AccountPhase, client.ClientID, 'core-node', source,
      ));
    }
  }

  for (const project of next.projects) {
    const oldProject = previousProjects.get(project.ProjectID);
    if (!oldProject) continue;

    if (oldProject.SprintStage !== project.SprintStage) {
      events.push(createDiffEvent(
        'stage.changed', 'project', project.ProjectID, 'SprintStage', oldProject.SprintStage,
        project.SprintStage, project.ClientID, 'core-node', source, project.ProjectID,
      ));
      if (project.SprintStage === '08: Liftoff & Handover') {
        events.push(createDiffEvent(
          'project.completed', 'project', project.ProjectID, 'SprintStage', oldProject.SprintStage,
          project.SprintStage, project.ClientID, 'node-vala', source, project.ProjectID,
        ));
      }
    }

    if (project.MilestonesDone > oldProject.MilestonesDone) {
      events.push(createDiffEvent(
        'milestone.done', 'project', project.ProjectID, 'MilestonesDone', oldProject.MilestonesDone,
        project.MilestonesDone, project.ClientID, 'node-dolores', source, project.ProjectID,
      ));
    }

    const oldComponents = new Set(oldProject.ActiveComponents || []);
    for (const componentId of [...(project.ActiveComponents || [])].sort()) {
      if (oldComponents.has(componentId)) continue;
      events.push(createDiffEvent(
        'component.installed', 'component', `${project.ProjectID}:${componentId}`,
        'ActiveComponents', false, true, project.ClientID, `node-${componentId}`,
        source, project.ProjectID,
      ));
    }
  }

  for (const invoice of next.financeRows) {
    const oldInvoice = previousInvoices.get(invoice.InvoiceID);
    if (!oldInvoice || oldInvoice.Status.trim().toLowerCase() === 'paid'
        || invoice.Status.trim().toLowerCase() !== 'paid') continue;
    events.push(createDiffEvent(
      'invoice.paid', 'invoice', invoice.InvoiceID, 'Status', oldInvoice.Status,
      invoice.Status, invoice.ClientID, 'node-vala', source,
    ));
  }

  // Tasks and addenda stay out of the diff until their typed sources are part of Snapshot.
  return events;
}

function matchesRule(
  rule: HudRule,
  event: HudEvent,
  link: Link,
  getDepartment: (nodeId: string) => Department | 'component' | null,
): boolean {
  const sourceDepartment = getDepartment(link.fromNodeId);
  const targetDepartment = getDepartment(link.toNodeId);
  return rule.status === 'approved'
    && rule.on === event.type
    && rule.from === sourceDepartment
    && rule.kind === link.kind
    && (rule.to === '*' || rule.to === targetDepartment);
}

export function publishHudEvent(
  event: HudEvent,
  links: readonly Link[],
  options: PublishEventOptions = {},
): PublishEventResult {
  const result: PublishEventResult = {
    proposals: [],
    traces: [],
    activeLinkIds: [],
    unblockedLinkIds: [],
    alerts: [],
  };

  if (event.type === 'police.corrected' || event.type === 'police.schema') {
    result.alerts.push(event);
    return result;
  }
  if (event.source === 'police_correction') return result;
  if (options.depth && options.depth > MAX_EVENT_DEPTH) {
    console.warn('[HUD events] Maximum event depth reached.', event.type);
    return result;
  }

  if (event.type === 'addendum.signed') {
    result.proposals.push(createPendingProposal({
      id: `${event.id}:addendum-options`,
      proposer: 'Event engine',
      eventId: event.id,
      type: 'addendum_options',
      title: 'Choose how to handle the signed addendum',
      detail: `For project ${event.projectId || 'with no project ID supplied'}, review both options: expand the existing project or spawn a separate project. No project data has been changed.`,
      clientId: event.clientId,
      requiresMoneyGate: false,
      clientFacing: false,
    }));
    return result;
  }

  const eventId = event.id;
  const getDepartment = options.getDepartment || getDefaultDepartment;
  const rules = options.rules || RULES;
  const directLinks = links.filter((link) =>
    link.clientId === event.clientId
    && link.fromNodeId === event.sourceNodeId
    && link.enabled);

  scheduleTickReset();
  for (const link of directLinks) {
    const trace: HudEventTrace = {
      source: link.fromNodeId,
      target: link.toNodeId,
      kind: link.kind,
      type: event.type,
      time: Date.now(),
    };
    result.traces.push(trace);
    console.info('[HUD event]', trace);

    const firedKey = `${link.id}:${event.type}`;
    if (firedThisTick.has(firedKey)) continue;
    firedThisTick.add(firedKey);

    for (const rule of rules) {
      if (!matchesRule(rule, event, link, getDepartment)) continue;
      result.activeLinkIds.push(link.id);
      if (rule.effect === 'unblock') {
        result.unblockedLinkIds.push(link.id);
        continue;
      }
      if (rule.effect !== 'propose' || !rule.proposal) continue;

      const proposal = createPendingProposal({
        id: `${eventId}:${rule.id}:${link.id}`,
        proposer: 'Event engine',
        eventId,
        type: rule.proposal,
        title: proposalTitle(rule.proposal),
        detail: rule.note,
        clientId: event.clientId,
        requiresMoneyGate: Boolean(rule.moneyGate),
        clientFacing: Boolean(rule.clientFacing),
      });
      result.proposals.push(proposal);
    }
  }

  return result;
}
