import type { AlfredAlert, ClientRecord, TerminalLog } from '../types';
import type { AdapterStatus } from '../data/adapter';
import type { DepartmentNotification, NotificationDepartment } from '../notifications/summary';
import { cadenceDay, computeHudStats, type HudStats } from '../data/hudStats';

/**
 * Owner 2026-11-06: the cockpit (side screen, 762x1366 portrait) was all fixed demo numbers. It now shows a feed the
 * main HUD window builds from its loaded data and sends over a BroadcastChannel, so the side window needs no
 * sign-in of its own. The cockpit sends back a few commands (refresh, go to a level, open a department).
 */
export const COCKPIT_CHANNEL = 'szs-cockpit';

export interface CockpitProject {
  projectId: string;
  clientId: string;
  company: string;
  title: string;
  stage: string;
  day: number | null;
  roadblock: string;
}

export interface CockpitFeed {
  at: string;
  adapterStatus: AdapterStatus;
  selectedClient: string | null;
  stats: HudStats;
  departments: DepartmentNotification[];
  alerts: Pick<AlfredAlert, 'id' | 'severity' | 'subRoutine' | 'companyName' | 'clientId' | 'message' | 'timestamp'>[];
  projects: CockpitProject[];
  logs: TerminalLog[];
}

export type CockpitCommand =
  | { type: 'refresh' }
  | { type: 'level'; level: 'universe' | 'galaxy' | 'solar' }
  | { type: 'department'; department: NotificationDepartment }
  | { type: 'client'; clientId: string };

export type CockpitMessage = { kind: 'feed'; feed: CockpitFeed } | { kind: 'hello' } | { kind: 'command'; command: CockpitCommand };

const SEVERITY_RANK: Record<string, number> = { BLOCK: 0, WARN: 1, INFO: 2 };

export function buildCockpitFeed(input: {
  clients: readonly ClientRecord[];
  alerts: readonly AlfredAlert[];
  departments: DepartmentNotification[];
  logs: readonly TerminalLog[];
  adapterStatus: AdapterStatus;
  selectedClient: string | null;
  now?: Date;
}): CockpitFeed {
  const now = input.now ?? new Date();
  const projects: CockpitProject[] = [];
  for (const client of input.clients) {
    for (const project of client.activeProjects) {
      if (String(project.SprintStage).startsWith('09')) continue;
      projects.push({
        projectId: project.ProjectID,
        clientId: client.ClientID,
        company: client.Company_Name || client.ClientID,
        title: project.Title || project.ProjectID,
        stage: project.SprintStage,
        day: cadenceDay(project.Kickoff_Date, now),
        roadblock: client.roadblock?.trim() ?? '',
      });
    }
  }
  projects.sort((a, b) => b.stage.localeCompare(a.stage) || a.projectId.localeCompare(b.projectId));
  const alerts = input.alerts
    .filter((alert) => !alert.dismissed)
    .sort((a, b) => (SEVERITY_RANK[a.severity?.toUpperCase()] ?? 3) - (SEVERITY_RANK[b.severity?.toUpperCase()] ?? 3)
      || String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 12)
    .map(({ id, severity, subRoutine, companyName, clientId, message, timestamp }) => ({ id, severity, subRoutine, companyName, clientId, message, timestamp }));
  return {
    at: now.toISOString(),
    adapterStatus: input.adapterStatus,
    selectedClient: input.selectedClient,
    stats: computeHudStats(input.clients, input.alerts),
    departments: input.departments,
    alerts,
    projects,
    logs: input.logs.slice(-8),
  };
}

/** BroadcastChannel is missing in some embedded browsers; every caller copes with null. */
export function openCockpitChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(COCKPIT_CHANNEL);
  } catch {
    return null;
  }
}
