/**
 * Bottom console layout (owner 2026-11-06: restore the per-bay sliders and the console scale that "worked great").
 * History: 2026-10-24 each bay had a width slider (--bay-*-w) and "Master UI Scale" scaled the console. 2026-10-26
 * the dock rewrite dropped the scale; 2026-10-30 widths became clamp(..vw..) so the sliders could only shrink a
 * bay; 2026-11-01 the dead scale slider was removed; saved widths were never re-applied on reload.
 * Now: a set width is used exactly; unset = the responsive default. Everything applies live and is kept per browser.
 */
export interface BayDefinition {
  id: 'calendar' | 'center' | 'dossier' | 'macro';
  label: string;
  cssVar: string;
  storageKey: string;
  defaultPx: number;
  min: number;
  max: number;
}

export const BAYS: BayDefinition[] = [
  { id: 'calendar', label: 'Bay 1 (Calendar)', cssVar: '--bay-calendar-w', storageKey: 'szs_bay_cal', defaultPx: 280, min: 140, max: 700 },
  { id: 'center', label: 'Bay 2 (Alfred Core)', cssVar: '--bay-center-w', storageKey: 'szs_bay_center', defaultPx: 440, min: 220, max: 1000 },
  { id: 'dossier', label: 'Bay 3 (Client Dossier)', cssVar: '--bay-dossier-w', storageKey: 'szs_bay_dossier', defaultPx: 270, min: 140, max: 700 },
  { id: 'macro', label: 'Bay 4 (Macro Pad)', cssVar: '--bay-macro-w', storageKey: 'szs_bay_macro', defaultPx: 280, min: 140, max: 700 },
];

export const DOCK_SCALE = { cssVar: '--dock-scale', storageKey: 'szs_dock_scale', min: 0.75, max: 1.25, step: 0.05 };

export interface DockLayout {
  /** px per bay; null = responsive default. */
  widths: Record<BayDefinition['id'], number | null>;
  scale: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pure: stored strings -> a valid layout (bad or missing values fall back to defaults). */
export function parseDockLayout(get: (key: string) => string | null): DockLayout {
  const widths = {} as DockLayout['widths'];
  BAYS.forEach((bay) => {
    const raw = get(bay.storageKey);
    const value = raw === null || raw === '' ? Number.NaN : Number(raw);
    widths[bay.id] = Number.isFinite(value) && value > 0 ? Math.round(clamp(value, bay.min, bay.max)) : null;
  });
  const rawScale = Number(get(DOCK_SCALE.storageKey));
  const scale = Number.isFinite(rawScale) && rawScale > 0
    ? Number(clamp(Math.round(rawScale / DOCK_SCALE.step) * DOCK_SCALE.step, DOCK_SCALE.min, DOCK_SCALE.max).toFixed(2))
    : 1;
  return { widths, scale };
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* per-browser convenience only */ }
}

export function readDockLayout(): DockLayout {
  return parseDockLayout((key) => { try { return localStorage.getItem(key); } catch { return null; } });
}

export function applyDockLayout(layout: DockLayout): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  BAYS.forEach((bay) => {
    const px = layout.widths[bay.id];
    if (px === null) root.removeProperty(bay.cssVar);
    else root.setProperty(bay.cssVar, `${px}px`);
  });
  root.setProperty(DOCK_SCALE.cssVar, String(layout.scale));
}

/** Applies and keeps one change. */
export function saveDockLayout(layout: DockLayout): void {
  BAYS.forEach((bay) => store(bay.storageKey, layout.widths[bay.id] === null ? null : String(layout.widths[bay.id])));
  store(DOCK_SCALE.storageKey, layout.scale === 1 ? null : String(layout.scale));
  applyDockLayout(layout);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hud-dock-layout'));
}

export const DEFAULT_DOCK_LAYOUT: DockLayout = { widths: { calendar: null, center: null, dossier: null, macro: null }, scale: 1 };
