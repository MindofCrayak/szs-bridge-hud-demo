import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffSnapshots, MAX_EVENT_DEPTH, publishHudEvent } from './events';
import type { Link } from './links';
import type { HudRule } from './rules';
import { RULES } from './rules';
import { MockAdapter } from '../data/adapter';
import type { Snapshot } from '../data/contracts';
import { CLIENT_FACING_ROUTE_LABEL } from './proposals';

const link: Link = {
  id: 'phase2-test-link',
  clientId: 'phase2-test-client',
  fromNodeId: 'node-pamela',
  fromPin: 'right',
  toNodeId: 'node-vala',
  toPin: 'left',
  kind: 'dependency',
  mode: 'push',
  label: 'test',
  enabled: true,
  origin: 'user',
  createdAt: 1,
};

test('events enforce depth and same-tick deduplication, then reset', async () => {
  const unblockRule: HudRule = {
    id: 'test-unblock',
    status: 'approved',
    on: 'msa.signed',
    from: 'pamela',
    kind: 'dependency',
    to: 'vala',
    effect: 'unblock',
    note: 'Test rule.',
  };
  const event = {
    id: 'phase2-test-event',
    type: 'msa.signed' as const,
    source: 'system' as const,
    sourceNodeId: 'node-pamela',
    clientId: link.clientId,
  };
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = () => {};
  console.warn = () => {};

  try {
    assert.equal(
      publishHudEvent(event, [link], { rules: [unblockRule], depth: MAX_EVENT_DEPTH + 1 }).unblockedLinkIds.length,
      0,
    );
    assert.deepEqual(publishHudEvent(event, [link], { rules: [unblockRule] }).unblockedLinkIds, [link.id]);
    assert.deepEqual(publishHudEvent(event, [link], { rules: [unblockRule] }).unblockedLinkIds, []);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    assert.deepEqual(publishHudEvent(event, [link], { rules: [unblockRule] }).unblockedLinkIds, [link.id]);
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
});

test('production suggestions stay inert and approved money rules create gated proposals', async () => {
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const suggestedRule: HudRule = {
      id: 'test-suggested',
      status: 'suggested',
      on: 'milestone.done',
      from: 'dolores',
      kind: 'trigger',
      to: 'vala',
      effect: 'propose',
      proposal: 'draft_invoice',
      moneyGate: true,
      note: 'Test proposal.',
    };
    const approvedRule = { ...suggestedRule, id: 'test-approved', status: 'approved' as const };
    const event = {
      id: 'phase2-money-event',
      type: 'milestone.done' as const,
      source: 'system' as const,
      sourceNodeId: 'node-dolores',
      clientId: link.clientId,
    };
    const triggerLink = {
      ...link,
      id: 'phase2-money-link',
      fromNodeId: 'node-dolores',
      kind: 'trigger' as const,
    };

    assert.equal(publishHudEvent(event, [triggerLink], { rules: [suggestedRule] }).proposals.length, 0);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const proposals = publishHudEvent(event, [triggerLink], { rules: [approvedRule] }).proposals;
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].requiresMoneyGate, true);
  } finally {
    console.info = originalInfo;
  }
});

test('snapshot diff emits stable phase, stage, milestone, component, and invoice events', async () => {
  const previous = await new MockAdapter().getSnapshot();
  const next: Snapshot = {
    clients: previous.clients.map((client) => client.ClientID === 'AAA'
      ? { ...client, AccountPhase: '02: Session Zero' }
      : client),
    projects: previous.projects.map((project) => project.ProjectID === 'AAA-01'
      ? {
        ...project,
        SprintStage: '01: Vibecheck',
        MilestonesDone: 1,
        ActiveComponents: ['comp_example'],
      }
      : project),
    financeRows: previous.financeRows.map((row) => row.InvoiceID === 'INV-AAA-26-001'
      ? { ...row, Status: 'Paid' }
      : row),
  };

  const events = diffSnapshots(previous, next);
  assert.deepEqual(
    events.map((event) => event.type).sort(),
    ['component.installed', 'invoice.paid', 'milestone.done', 'phase.changed', 'stage.changed'].sort(),
  );
  assert.equal(events.every((event) => event.source === 'external' && event.id.startsWith('evt-')), true);
  assert.deepEqual(events.map((event) => event.id), diffSnapshots(previous, next).map((event) => event.id));
  assert.deepEqual(diffSnapshots(next, next), []);
});

test('project final delivery emits completion for Daisy routing before Sunset', async () => {
  const previous = await new MockAdapter().getSnapshot();
  const next: Snapshot = {
    ...previous,
    projects: previous.projects.map((project) => project.ProjectID === 'EEE-01'
      ? { ...project, SprintStage: '08: Liftoff & Handover' }
      : project),
  };
  const completion = diffSnapshots(previous, next).find((event) => event.type === 'project.completed');
  assert.equal(completion?.projectId, 'EEE-01');
  assert.equal(completion?.sourceNodeId, 'node-vala');
});

test('Police-sourced snapshot diffs do not match rules or animate wires', async () => {
  const previous = await new MockAdapter().getSnapshot();
  const next: Snapshot = {
    ...previous,
    projects: previous.projects.map((project) => project.ProjectID === 'AAA-01'
      ? { ...project, MilestonesDone: project.MilestonesDone + 1 }
      : project),
  };
  const [event] = diffSnapshots(previous, next, 'police_correction');
  const approvedRule: HudRule = {
    id: 'police-diff-rule',
    status: 'approved',
    on: 'milestone.done',
    from: 'dolores',
    kind: 'trigger',
    to: 'vala',
    effect: 'propose',
    proposal: 'draft_invoice',
    note: 'Must not fire for a Police correction.',
  };
  const policeDiffLink: Link = {
    ...link,
    fromNodeId: 'node-dolores',
    toNodeId: 'node-vala',
    kind: 'trigger',
  };
  assert.equal(event.source, 'police_correction');
  const result = publishHudEvent(event, [policeDiffLink], { rules: [approvedRule] });
  assert.deepEqual(result.activeLinkIds, []);
  assert.deepEqual(result.unblockedLinkIds, []);
  assert.deepEqual(result.traces, []);
  assert.deepEqual(result.alerts, []);
});

test('Police events create alerts only and never produce wire traces', () => {
  const result = publishHudEvent({
    id: 'police-schema-event',
    type: 'police.schema',
    source: 'police_correction',
    sourceNodeId: 'core-node',
    clientId: link.clientId,
  }, [link]);
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(result.traces, []);
  assert.deepEqual(result.activeLinkIds, []);
  assert.deepEqual(result.proposals, []);
});

test('client-facing proposals use the Daisy route label and proposal-only effect', async () => {
  const clientFacingRule: HudRule = {
    id: 'client-facing-test',
    status: 'approved',
    on: 'task.overdue',
    from: 'dolores',
    kind: 'trigger',
    to: 'daisy',
    effect: 'propose',
    proposal: 'client_checkin',
    clientFacing: true,
    note: 'Prepare a message for Daisy to review.',
  };
  const event = {
    id: 'client-facing-event',
    type: 'task.overdue' as const,
    source: 'external' as const,
    sourceNodeId: 'node-dolores',
    clientId: link.clientId,
  };
  const routeLink = { ...link, fromNodeId: 'node-dolores', toNodeId: 'node-daisy', kind: 'trigger' as const };
  const proposal = publishHudEvent(event, [routeLink], { rules: [clientFacingRule] }).proposals[0];
  assert.equal(proposal.clientFacing, true);
  assert.equal(proposal.effect, 'propose');
  assert.equal(CLIENT_FACING_ROUTE_LABEL, 'via Daisy');
});

test('draft relay rules remain suggested and do not route Daisy at milestone or invoice-paid', () => {
  assert.equal(RULES.every((rule) => rule.status === 'suggested'), true);
  assert.equal(RULES.some((rule) =>
    (rule.on === 'milestone.done' || rule.on === 'invoice.paid') && rule.to === 'daisy'), false);
});

test('signed addenda create one proposal that offers both project outcomes', () => {
  const result = publishHudEvent({
    id: 'addendum-choice-event',
    type: 'addendum.signed',
    source: 'external',
    sourceNodeId: 'core-node',
    clientId: link.clientId,
    projectId: 'project-a',
  }, []);

  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].type, 'addendum_options');
  assert.match(result.proposals[0].detail, /expand the existing project or spawn a separate project/);
  assert.equal(result.proposals[0].effect, 'propose');
});
