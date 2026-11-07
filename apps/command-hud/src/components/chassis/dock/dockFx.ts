/**
 * Tiny event bus for dock effects. Anything in the HUD can call
 * `emitDockFx('pulse')` (small reaction) or `emitDockFx('surge')` (big one)
 * and the power crystal + FX canvas respond in the active race's style.
 * `think` toggles the "Alfred is working" state (fast reels).
 */
export type DockFxEvent =
  | { type: 'pulse' }
  | { type: 'surge' }
  | { type: 'think'; on: boolean };

type Listener = (event: DockFxEvent) => void;
const listeners = new Set<Listener>();

export function emitDockFx(event: DockFxEvent | 'pulse' | 'surge') {
  const e: DockFxEvent = typeof event === 'string' ? { type: event } : event;
  listeners.forEach((fn) => {
    try {
      fn(e);
    } catch {
      /* one bad listener must not break the others */
    }
  });
}

export function onDockFx(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
