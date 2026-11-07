import type { AccountPhase, ClientRecord, SprintStage } from '../types';
import { deriveAccountPhase } from './pipeline';

export interface SnapshotOverlay {
  clients: Record<string, AccountPhase>;
  clientModes: Record<string, 'auto' | 'manual'>;
  projects: Record<string, SprintStage>;
}

export const SNAPSHOT_OVERLAY_KEY = 'szs.overlay.v1';

const ACCOUNT_PHASES: readonly AccountPhase[] = [
  '01: Intake',
  '02: Session Zero',
  '03: Active Sprints',
  '04: Liftoff',
  '05: Complete',
  '06: Archived/Sunset',
];

const SPRINT_STAGES: readonly SprintStage[] = [
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
];

export const emptySnapshotOverlay = (): SnapshotOverlay => ({ clients: {}, clientModes: {}, projects: {} });

export function parseSnapshotOverlay(value: string | null): SnapshotOverlay {
  if (!value) return emptySnapshotOverlay();
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved local changes are not a valid object.');
  }
  const record = parsed as Record<string, unknown>;
  const clients = record.clients ?? {};
  const clientModes = record.clientModes ?? {};
  const projects = record.projects ?? {};
  if (!clients || typeof clients !== 'object' || Array.isArray(clients)
    || !clientModes || typeof clientModes !== 'object' || Array.isArray(clientModes)
    || !projects || typeof projects !== 'object' || Array.isArray(projects)) {
    throw new Error('Saved local changes have an invalid client or project map.');
  }
  const clientEntries = Object.entries(clients);
  const clientModeEntries = Object.entries(clientModes);
  const projectEntries = Object.entries(projects);
  if (clientEntries.some(([, phase]) => !ACCOUNT_PHASES.includes(phase as AccountPhase))) {
    throw new Error('Saved local changes contain an unknown account phase.');
  }
  if (clientModeEntries.some(([, mode]) => mode !== 'auto' && mode !== 'manual')) {
    throw new Error('Saved local changes contain an unknown account phase mode.');
  }
  if (projectEntries.some(([, stage]) => !SPRINT_STAGES.includes(stage as SprintStage))) {
    throw new Error('Saved local changes contain an unknown sprint stage.');
  }
  return {
    clients: Object.fromEntries(clientEntries) as Record<string, AccountPhase>,
    clientModes: Object.fromEntries(clientModeEntries) as Record<string, 'auto' | 'manual'>,
    projects: Object.fromEntries(projectEntries) as Record<string, SprintStage>,
  };
}

export function applySnapshotOverlay(
  clients: readonly ClientRecord[],
  overlay: SnapshotOverlay,
): ClientRecord[] {
  return clients.map((client) => ({
    ...client,
    SheetAccountPhase: client.SheetAccountPhase ?? client.AccountPhase,
    activeProjects: client.activeProjects.map((project) => ({
      ...project,
      SprintStage: overlay.projects[project.ProjectID] ?? project.SprintStage,
    })),
  })).map((client) => {
    const mode = (overlay.clientModes ?? {})[client.ClientID]
      ?? (overlay.clients[client.ClientID] ? 'manual' : client.AccountPhase_Mode ?? 'auto');
    return {
      ...client,
      AccountPhase_Mode: mode,
      AccountPhase: mode === 'manual'
        ? overlay.clients[client.ClientID] ?? client.SheetAccountPhase ?? client.AccountPhase
        : deriveAccountPhase(client.activeProjects, client.SheetAccountPhase ?? client.AccountPhase),
    };
  });
}

export function countSnapshotOverlayChanges(overlay: SnapshotOverlay): number {
  const changedClientIds = new Set([
    ...Object.keys(overlay.clients),
    ...Object.keys(overlay.clientModes ?? {}),
  ]);
  return changedClientIds.size + Object.keys(overlay.projects).length;
}

export function withClientPhase(
  overlay: SnapshotOverlay,
  clientId: string,
  phase: AccountPhase,
): SnapshotOverlay {
  return {
    ...overlay,
    clients: { ...overlay.clients, [clientId]: phase },
    clientModes: { ...(overlay.clientModes ?? {}), [clientId]: 'manual' },
  };
}

export function withClientPhaseMode(
  overlay: SnapshotOverlay,
  clientId: string,
  mode: 'auto' | 'manual',
): SnapshotOverlay {
  const clients = { ...overlay.clients };
  delete clients[clientId];
  return {
    ...overlay,
    clients,
    clientModes: { ...(overlay.clientModes ?? {}), [clientId]: mode },
  };
}

export function withoutClientPhase(
  overlay: SnapshotOverlay,
  clientId: string,
): SnapshotOverlay {
  const clients = { ...overlay.clients };
  const clientModes = { ...(overlay.clientModes ?? {}) };
  delete clients[clientId];
  delete clientModes[clientId];
  return { ...overlay, clients, clientModes };
}

export function withProjectStage(
  overlay: SnapshotOverlay,
  projectId: string,
  stage: SprintStage,
): SnapshotOverlay {
  return { ...overlay, projects: { ...overlay.projects, [projectId]: stage } };
}

export function withoutProjectStage(
  overlay: SnapshotOverlay,
  projectId: string,
): SnapshotOverlay {
  const projects = { ...overlay.projects };
  delete projects[projectId];
  return { ...overlay, projects };
}
