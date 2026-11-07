/**
 * HUD size (owner 2026-11-06: "there used to be a UI scaling system"). The old slider set a CSS variable nothing
 * used. This one scales every HUD text size (text-hud-1..5) and everything sized in rem (Tailwind text-xs/sm,
 * spacing) through --ui-scale. The canvas keeps its own zoom. Range 100-125%: below 100% text would drop under
 * 11px (owner rule).
 */
export const UI_SCALE_MIN = 1;
export const UI_SCALE_MAX = 1.25;
export const UI_SCALE_STEP = 0.05;
const KEY = 'szs_ui_scale';

export function clampUiScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const stepped = Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Number(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, stepped)).toFixed(2));
}

export function readUiScale(): number {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === null ? 1 : clampUiScale(Number(stored));
  } catch {
    return 1;
  }
}

export function applyUiScale(value: number): number {
  const scale = clampUiScale(value);
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--ui-scale', String(scale));
  try { localStorage.setItem(KEY, String(scale)); } catch { /* per-browser convenience only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hud-ui-scale', { detail: scale }));
  return scale;
}
