import type { ProjectRecord } from '../types';
import type { Link, LinkState } from './links';

/**
 * Multi-sun Solar (owner-approved design 2026-11-05, docs/archive/MULTI_SUN_SOLAR_DESIGN.md):
 * - One sun per open project. The primary sun keeps the node id `core-node`, so existing wires stay valid.
 * - Each other open project is a `sun-<ProjectID>` node with default department wires (shared ring, option A).
 * - A project at 09 Sunset/Retainer "goes out": no sun, and its default sun wires are removed.
 * - Cross-project wires are allowed (suns are wireable like the core sun).
 */

export const SUN_PREFIX = 'sun-';
export const SUNSET_STAGE = '09: Sunset / Retainer';
export const sunNodeId = (projectId: string) => `${SUN_PREFIX}${projectId}`;
export const isSunNodeId = (id: string) => id.startsWith(SUN_PREFIX);
export const projectIdFromSun = (id: string) => (isSunNodeId(id) ? id.slice(SUN_PREFIX.length) : '');

export const SUN_WIDTH = 360;
export const SUN_HEIGHT = 220;

export interface SunPlan<P extends Pick<ProjectRecord, 'ProjectID' | 'SprintStage'>> {
  primary: P | undefined;
  /** True when every project is in Sunset: the primary sun is shown dimmed ("going out"). */
  primaryOut: boolean;
  secondary: P[];
}

export function planSuns<P extends Pick<ProjectRecord, 'ProjectID' | 'SprintStage'>>(projects: readonly P[], selectedProjectId: string | null): SunPlan<P> {
  const open = projects.filter((project) => project.SprintStage !== SUNSET_STAGE);
  const selected = projects.find((project) => project.ProjectID === selectedProjectId);
  const primary = selected && selected.SprintStage !== SUNSET_STAGE ? selected : open[0] ?? selected ?? projects[0];
  return {
    primary,
    primaryOut: Boolean(primary && primary.SprintStage === SUNSET_STAGE),
    secondary: open.filter((project) => project.ProjectID !== primary?.ProjectID),
  };
}

/** Top-left of the n-th secondary sun, outside the department ring (primary sun centred at 0,0). */
export function sunLayout(index: number): { x: number; y: number } {
  const slots = [{ x: 400, y: -110 }, { x: -780, y: -110 }, { x: -180, y: 320 }, { x: 400, y: 320 }, { x: -780, y: 320 }];
  if (index < slots.length) return slots[index];
  return { x: 840, y: -110 + (index - slots.length) * 260 };
}

const SUN_DEFAULT_DEPARTMENTS: Array<{ dept: string; label: string; mode: Link['mode'] }> = [
  { dept: 'pamela', label: 'Legal and vault status', mode: 'push' },
  { dept: 'oracle', label: 'Internal summary only', mode: 'push' },
  { dept: 'dolores', label: 'Tasks and Gantt status', mode: 'sync' },
  { dept: 'vala', label: 'Billing status', mode: 'sync' },
  { dept: 'daisy', label: 'Client journey status', mode: 'push' },
];

export const sunDefaultKey = (projectId: string, dept: string) => `sun:${projectId}:${dept}`;

/** Adds the department → sun default wires for each secondary sun; drops sun defaults of projects without a sun. */
export function withSunDefaults(state: LinkState, secondaryProjectIds: readonly string[]): LinkState {
  const wanted = new Set(secondaryProjectIds);
  const suppressed = new Set(state.suppressedDefaults);
  const kept = state.links.filter((link) => {
    if (!link.defaultKey?.startsWith('sun:')) return true;
    return wanted.has(link.defaultKey.split(':')[1]);
  });
  const existingKeys = new Set(kept.map((link) => link.defaultKey).filter(Boolean));
  const added: Link[] = [];
  secondaryProjectIds.forEach((projectId) => {
    SUN_DEFAULT_DEPARTMENTS.forEach(({ dept, label, mode }) => {
      const key = sunDefaultKey(projectId, dept);
      if (existingKeys.has(key) || suppressed.has(key)) return;
      added.push({
        id: `default:${state.clientId}:${key}`,
        clientId: state.clientId,
        fromNodeId: `node-${dept}`,
        fromPin: 'right',
        toNodeId: sunNodeId(projectId),
        toPin: 'left',
        kind: 'context',
        mode,
        label: `${label} (${projectId})`,
        enabled: true,
        origin: 'default',
        defaultKey: key,
        createdAt: 0,
      });
    });
  });
  if (!added.length && kept.length === state.links.length) return state;
  return { ...state, links: [...kept, ...added] };
}

/** The sun nearest to a world point (sun centres given). */
export function nearestSun<T extends { cx: number; cy: number }>(point: { x: number; y: number }, suns: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  suns.forEach((sun) => {
    const distance = Math.hypot(sun.cx - point.x, sun.cy - point.y);
    if (distance < bestDistance) { best = sun; bestDistance = distance; }
  });
  return best;
}
