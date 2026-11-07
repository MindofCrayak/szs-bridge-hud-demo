import { Department } from './catalog';

export type LinkKind = 'context' | 'dependency' | 'trigger';
export type FlowMode = 'push' | 'pull' | 'sync';
export type Pin = 'top' | 'bottom' | 'left' | 'right';

export interface Link {
  id: string;
  clientId: string;
  fromNodeId: string;
  fromPin: Pin;
  toNodeId: string;
  toPin: Pin;
  kind: LinkKind;
  mode: FlowMode;
  label?: string;
  enabled: boolean;
  origin: 'default' | 'user';
  defaultKey?: string;
  createdAt: number;
}

export interface LinkState {
  version: 2;
  clientId: string;
  links: Link[];
  suppressedDefaults: string[];
  connectors: ProjectConnector[];
}

export interface LinkExport extends LinkState {
  exportedAt: number;
}

export type ConnectorKind = 'expands' | 'spawns' | 'depends_on' | 'shares';

export interface ProjectConnector {
  id: string;
  clientId: string;
  fromProjectId: string;
  toProjectId: string;
  kind: ConnectorKind;
  createdAt: number;
}

export interface WireNodeOption {
  id: string;
  label: string;
  type: 'agent' | 'component' | 'core';
}

export type WireEditableFields = Pick<Link, 'kind' | 'mode' | 'label' | 'enabled'>;

export interface WireCreateInput {
  fromNodeId: string;
  fromPin: Pin;
  toNodeId: string;
  toPin: Pin;
  kind: LinkKind;
  mode: FlowMode;
  label: string;
}

export interface WirePanelSnapshot {
  clientId: string;
  clientName: string;
  nodes: WireNodeOption[];
  links: Link[];
  selectedWireId: string | null;
  contextMenuOpen: boolean;
}

export interface WirePanelActions {
  create: (input: WireCreateInput) => boolean;
  select: (linkId: string | null) => void;
  update: (linkId: string, updates: Partial<WireEditableFields>) => void;
  reverse: (linkId: string) => void;
  remove: (linkId: string) => void;
}

const STORAGE_PREFIX = 'szs.links.v1:';
const PINS: Pin[] = ['top', 'bottom', 'left', 'right'];
const LINK_KINDS: LinkKind[] = ['context', 'dependency', 'trigger'];
const FLOW_MODES: FlowMode[] = ['push', 'pull', 'sync'];
const CONNECTOR_KINDS: ConnectorKind[] = ['expands', 'spawns', 'depends_on', 'shares'];

const DEFAULT_LINKS: Array<{
  key: string;
  from: string;
  to: string;
  department: Department;
  kind: LinkKind;
  mode: FlowMode;
  label: string;
}> = [
  { key: 'pamela-sun', from: 'node-pamela', to: 'core-node', department: 'pamela', kind: 'context', mode: 'push', label: 'Legal and vault status' },
  { key: 'oracle-sun', from: 'node-oracle', to: 'core-node', department: 'oracle', kind: 'context', mode: 'push', label: 'Internal summary only' },
  { key: 'dolores-sun', from: 'node-dolores', to: 'core-node', department: 'dolores', kind: 'context', mode: 'sync', label: 'Tasks and Gantt status' },
  { key: 'vala-sun', from: 'node-vala', to: 'core-node', department: 'vala', kind: 'context', mode: 'sync', label: 'Billing status' },
  { key: 'daisy-sun', from: 'node-daisy', to: 'core-node', department: 'daisy', kind: 'context', mode: 'push', label: 'Client journey status' },
  { key: 'pamela-oracle', from: 'node-pamela', to: 'node-oracle', department: 'pamela', kind: 'trigger', mode: 'push', label: 'Gate PASS intake brief' },
  { key: 'pamela-alfred', from: 'node-pamela', to: 'core-node', department: 'pamela', kind: 'trigger', mode: 'push', label: 'Gate result to Alfred' },
  { key: 'oracle-alfred', from: 'node-oracle', to: 'core-node', department: 'oracle', kind: 'trigger', mode: 'push', label: 'Summary only' },
  { key: 'dolores-vala', from: 'node-dolores', to: 'node-vala', department: 'dolores', kind: 'trigger', mode: 'push', label: 'Milestone gate' },
  { key: 'vala-daisy', from: 'node-vala', to: 'node-daisy', department: 'vala', kind: 'trigger', mode: 'push', label: 'Completion review / client-facing proposal via Daisy' },
  { key: 'pamela-daisy-client-facing', from: 'node-pamela', to: 'node-daisy', department: 'pamela', kind: 'trigger', mode: 'push', label: 'Client-facing proposal via Daisy' },
  { key: 'oracle-daisy-client-facing', from: 'node-oracle', to: 'node-daisy', department: 'oracle', kind: 'trigger', mode: 'push', label: 'Summary proposal via Daisy' },
  { key: 'dolores-daisy-client-facing', from: 'node-dolores', to: 'node-daisy', department: 'dolores', kind: 'trigger', mode: 'push', label: 'Client-facing proposal via Daisy' },
  { key: 'alfred-daisy-client-facing', from: 'core-node', to: 'node-daisy', department: 'core', kind: 'trigger', mode: 'push', label: 'Client-facing proposal via Daisy' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isProjectConnector(value: unknown, clientId: string): value is ProjectConnector {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.clientId === clientId
    && typeof value.fromProjectId === 'string'
    && value.fromProjectId.length > 0
    && typeof value.toProjectId === 'string'
    && value.toProjectId.length > 0
    && value.fromProjectId !== value.toProjectId
    && CONNECTOR_KINDS.includes(value.kind as ConnectorKind)
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt);
}

function isLink(value: unknown, clientId: string): value is Link {
  if (!isRecord(value)) return false;
  return value.clientId === clientId
    && typeof value.id === 'string'
    && typeof value.fromNodeId === 'string'
    && PINS.includes(value.fromPin as Pin)
    && typeof value.toNodeId === 'string'
    && PINS.includes(value.toPin as Pin)
    && LINK_KINDS.includes(value.kind as LinkKind)
    && FLOW_MODES.includes(value.mode as FlowMode)
    && typeof value.enabled === 'boolean'
    && (value.origin === 'default' || value.origin === 'user')
    && (value.origin !== 'default' || typeof value.defaultKey === 'string')
    && typeof value.createdAt === 'number'
    && (value.defaultKey === undefined || typeof value.defaultKey === 'string')
    && (value.label === undefined || typeof value.label === 'string');
}

function seedDefaultLinks(clientId: string, suppressedDefaults: string[]): Link[] {
  const suppressed = new Set(suppressedDefaults);
  return DEFAULT_LINKS.filter((link) => !suppressed.has(link.key)).map((link) => ({
    id: `default:${clientId}:${link.key}`,
    clientId,
    fromNodeId: link.from,
    fromPin: 'right',
    toNodeId: link.to,
    toPin: 'left',
    kind: link.kind,
    mode: link.mode,
    label: link.label,
    enabled: true,
    origin: 'default',
    defaultKey: link.key,
    createdAt: 0,
  }));
}

export function createLinkState(clientId: string): LinkState {
  return {
    version: 2,
    clientId,
    links: seedDefaultLinks(clientId, []),
    suppressedDefaults: [],
    connectors: [],
  };
}

export function loadLinkState(clientId: string): LinkState {
  const key = `${STORAGE_PREFIX}${clientId}`;
  const raw = localStorage.getItem(key);
  if (raw === null) return createLinkState(clientId);

  return parseLinkState(raw, clientId);
}

export function parseLinkState(raw: string, clientId: string): LinkState {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Wire data is invalid JSON.');
  }
  if (
    !isRecord(value)
    || (value.version !== 1 && value.version !== 2)
    || value.clientId !== clientId
    || !Array.isArray(value.links)
    || !value.links.every((link) => isLink(link, clientId))
    || !Array.isArray(value.suppressedDefaults)
    || !value.suppressedDefaults.every((entry) => typeof entry === 'string')
    || (value.version === 2 && (!Array.isArray(value.connectors)
      || !value.connectors.every((connector) => isProjectConnector(connector, clientId))))
  ) {
    throw new Error('Wire data does not match the current format.');
  }
  const ids = new Set<string>();
  const connections = new Set<string>();
  const connectorIds = new Set<string>();
  const connectorConnections = new Set<string>();
  const parsedLinks = value.links as Link[];
  for (const link of parsedLinks) {
    if (ids.has(link.id)) throw new Error('Wire data contains duplicate link IDs.');
    ids.add(link.id);
    const connection = `${link.fromNodeId}\u0000${link.toNodeId}\u0000${link.kind}`;
    if (connections.has(connection)) throw new Error('Wire data contains duplicate connections.');
    connections.add(connection);
  }
  if (value.version === 2) {
    for (const connector of value.connectors as ProjectConnector[]) {
      if (connectorIds.has(connector.id)) throw new Error('Wire data contains duplicate connector IDs.');
      connectorIds.add(connector.id);
      const connection = `${connector.kind}\u0000${connector.fromProjectId}\u0000${connector.toProjectId}`;
      if (connectorConnections.has(connection)) throw new Error('Wire data contains duplicate project connectors.');
      connectorConnections.add(connection);
    }
  }
  return {
    version: 2,
    clientId,
    links: [
      ...parsedLinks,
      ...seedDefaultLinks(clientId, value.suppressedDefaults).filter((seeded) =>
        !parsedLinks.some((link) => link.defaultKey === seeded.defaultKey)),
    ],
    suppressedDefaults: value.suppressedDefaults,
    connectors: value.version === 2 ? value.connectors as ProjectConnector[] : [],
  };
}

export function exportLinkState(state: LinkState): LinkExport {
  return { ...state, exportedAt: Date.now() };
}

export function parseLinkExport(raw: string, clientId: string, validNodeIds: ReadonlySet<string>): LinkState {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Wire export is invalid JSON.');
  }
  if (!isRecord(envelope) || typeof envelope.exportedAt !== 'number' || !Number.isFinite(envelope.exportedAt)) {
    throw new Error('Wire export is missing a valid export timestamp.');
  }
  const parsed = parseLinkState(raw, clientId);
  if (parsed.links.some((link) => !validNodeIds.has(link.fromNodeId) || !validNodeIds.has(link.toNodeId))) {
    throw new Error('Wire export references a node that is not available in this workbench.');
  }
  return {
    version: parsed.version,
    clientId: parsed.clientId,
    links: parsed.links,
    suppressedDefaults: parsed.suppressedDefaults,
    connectors: parsed.connectors,
  };
}

export function saveLinkState(state: LinkState): void {
  localStorage.setItem(`${STORAGE_PREFIX}${state.clientId}`, JSON.stringify(state));
}

export function createUserLink(input: Omit<Link, 'id' | 'createdAt' | 'origin'>): Link {
  return {
    ...input,
    id: `wire:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    origin: 'user',
    createdAt: Date.now(),
  };
}

export function createProjectConnector(
  input: Omit<ProjectConnector, 'id' | 'createdAt'>,
): ProjectConnector {
  if (!input.clientId || !input.fromProjectId || !input.toProjectId || input.fromProjectId === input.toProjectId) {
    throw new Error('Project connectors require two distinct project IDs and a client ID.');
  }
  if (!CONNECTOR_KINDS.includes(input.kind)) throw new Error('Project connector kind is invalid.');
  return {
    ...input,
    id: `connector:${input.clientId}:${input.kind}:${input.fromProjectId}:${input.toProjectId}`,
    createdAt: Date.now(),
  };
}

export function saveProjectConnectors(state: LinkState, connectors: ProjectConnector[]): LinkState {
  const ids = new Set<string>();
  const connections = new Set<string>();
  for (const connector of connectors) {
    if (!isProjectConnector(connector, state.clientId)) {
      throw new Error('Project connector data does not match the current client.');
    }
    const connection = `${connector.kind}\u0000${connector.fromProjectId}\u0000${connector.toProjectId}`;
    if (ids.has(connector.id) || connections.has(connection)) {
      throw new Error('Project connector data contains duplicates.');
    }
    ids.add(connector.id);
    connections.add(connection);
  }
  const next = { ...state, connectors };
  saveLinkState(next);
  return next;
}

export function allowedKinds(fromType: string, toType: string): LinkKind[] {
  const allowed: Record<string, LinkKind[]> = {
    'agent>agent': ['context', 'dependency', 'trigger'],
    'agent>core': ['context', 'trigger'],
    'core>agent': ['context', 'trigger'],
    'component>agent': ['context', 'trigger'],
    'component>core': ['context'],
    'agent>component': ['context'],
    'core>component': ['context'],
  };
  return allowed[`${fromType}>${toType}`] ?? [];
}
