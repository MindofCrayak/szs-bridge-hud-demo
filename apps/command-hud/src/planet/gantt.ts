import type { HudTask } from '../types';

/**
 * Phase F (Master Plan v3.1): pure layout for the Planet Gantt. Day 0 = Kickoff_Date (45-day cadence).
 * Bars run from the notes `Start:` line to the due date; a task with no start is a marker on its due date.
 */

export type GanttState = 'completed' | 'overdue' | 'upcoming';

export interface GanttRow {
  kind: 'parent' | 'task';
  task: HudTask;
  /** Day offsets from kickoff; null when the task has no dates at all. */
  startDay: number | null;
  endDay: number | null;
  marker: boolean;
  state: GanttState;
}

export interface GanttLayout {
  kickoff: string;
  days: number;
  todayDay: number;
  stages: { label: string; day: number }[];
  rows: GanttRow[];
}

/** SprintStage start days on the 45-day cadence (first base-lifecycle task of each stage in Master Control). */
export const STAGE_DAYS: { label: string; day: number }[] = [
  { label: '00 Discovery', day: 0 },
  { label: '01 Vibecheck', day: 3 },
  { label: '02 Contract', day: 5 },
  { label: '03 Intelligence', day: 9 },
  { label: '04 Kickoff', day: 14 },
  { label: '05 Builds', day: 17 },
  { label: '06 Mid-Flight', day: 27 },
  { label: '07 QA', day: 36 },
  { label: '08 Liftoff', day: 42 },
  { label: '09 Sunset', day: 45 },
];

const DAY_MS = 86_400_000;
const isoDay = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');
const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const dayOffset = (fromIso: string, toIso: string) => Math.round((toUtc(toIso) - toUtc(fromIso)) / DAY_MS);
export const addDays = (iso: string, days: number) => new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);

export function taskState(task: HudTask, todayIso: string): GanttState {
  if (task.status === 'completed') return 'completed';
  return task.due && task.due < todayIso ? 'overdue' : 'upcoming';
}

/** Parents in list order, each followed by its children sorted by start/due; orphans last. */
export function orderTasks(tasks: readonly HudTask[]): { task: HudTask; depth: 0 | 1 }[] {
  const ids = new Set(tasks.map((task) => task.id));
  const byDate = (a: HudTask, b: HudTask) => (a.start || a.due || '9').localeCompare(b.start || b.due || '9') || a.title.localeCompare(b.title);
  const out: { task: HudTask; depth: 0 | 1 }[] = [];
  tasks.filter((task) => !task.parentId).forEach((parent) => {
    out.push({ task: parent, depth: 0 });
    tasks.filter((task) => task.parentId === parent.id).sort(byDate).forEach((child) => out.push({ task: child, depth: 1 }));
  });
  tasks.filter((task) => task.parentId && !ids.has(task.parentId)).sort(byDate).forEach((task) => out.push({ task, depth: 1 }));
  return out;
}

export function buildGantt(tasks: readonly HudTask[], kickoffIso: string | undefined, todayIso: string): GanttLayout {
  const dated = tasks.flatMap((task) => [isoDay(task.start), isoDay(task.due)]).filter(Boolean).sort();
  const kickoff = isoDay(kickoffIso ?? '') || dated[0] || todayIso;
  const span = (task: HudTask) => {
    const due = isoDay(task.due);
    const start = isoDay(task.start);
    if (!due && !start) return { startDay: null, endDay: null, marker: false };
    const end = dayOffset(kickoff, due || start);
    return start && due ? { startDay: Math.min(dayOffset(kickoff, start), end), endDay: end, marker: false } : { startDay: end, endDay: end, marker: true };
  };
  const rows: GanttRow[] = orderTasks(tasks).map(({ task, depth }) => {
    if (depth === 1) return { kind: 'task', task, ...span(task), state: taskState(task, todayIso) };
    const children = tasks.filter((child) => child.parentId === task.id);
    const spans = children.map(span).filter((s) => s.startDay !== null) as { startDay: number; endDay: number }[];
    const state: GanttState = children.length && children.every((child) => child.status === 'completed') ? 'completed'
      : children.some((child) => taskState(child, todayIso) === 'overdue') ? 'overdue' : taskState(task, todayIso);
    return spans.length
      ? { kind: 'parent', task, startDay: Math.min(...spans.map((s) => s.startDay)), endDay: Math.max(...spans.map((s) => s.endDay)), marker: false, state }
      : { kind: 'parent', task, ...span(task), state };
  });
  const lastDay = Math.max(45, ...rows.map((row) => row.endDay ?? 0));
  return { kickoff, days: lastDay + 2, todayDay: dayOffset(kickoff, todayIso), stages: STAGE_DAYS, rows };
}

/** Windowing for long lists: which rows to render for a scroll position (fixed row height). */
export function visibleWindow(count: number, scrollTop: number, rowHeight: number, viewportHeight: number, overscan = 8) {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { first, last, padTop: first * rowHeight, padBottom: (count - last) * rowHeight };
}
