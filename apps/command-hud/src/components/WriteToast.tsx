import React, { useEffect } from 'react';

/**
 * Owner 2026-11-05: save results were only a tiny status-bar line ("WRITE ISSUE"), so failures looked like nothing
 * happened. Green = saved (fades after 6 s), amber = saved with a warning, red = not saved (stays until dismissed).
 */
export interface ToastItem { id: number; kind: 'ok' | 'warn' | 'error'; text: string }

export const WriteToasts: React.FC<{ items: ToastItem[]; onDismiss: (id: number) => void }> = ({ items, onDismiss }) => {
  useEffect(() => {
    const timers = items.filter((item) => item.kind !== 'error').map((item) => window.setTimeout(() => onDismiss(item.id), 6000));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [items, onDismiss]);
  if (!items.length) return null;
  const colors = { ok: 'border-emerald-400/70 text-emerald-300', warn: 'border-amber-400/70 text-amber-300', error: 'border-red-500/80 text-red-300' };
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[9500] flex w-96 max-w-[90vw] flex-col gap-2" aria-live="polite">
      {items.slice(-4).map((item) => (
        <div key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border-2 bg-[#020500]/97 px-3 py-2 text-hud-4 shadow-xl ${colors[item.kind]}`}>
          <span className="flex-1 leading-snug">{item.text}</span>
          <button type="button" onClick={() => onDismiss(item.id)} aria-label="Dismiss" className="shrink-0 text-[#DDFBD0]/70 hover:text-white">✕</button>
        </div>
      ))}
    </div>
  );
};
