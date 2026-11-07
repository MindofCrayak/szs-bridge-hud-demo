import React, { useEffect, useRef, useState } from 'react';

/**
 * Solar canvas controls: mode, satellites, zoom, recenter. Owner 2026-11-06: they used to sit in the top bar and
 * overlapped UNIVERSE; they now live in the Solar workbench's own ribbon (the "← Galaxy view / client" pill).
 */
export const CanvasControls: React.FC<{
  interactionMode: 'drag' | 'lock' | 'edit';
  onSetInteractionMode: (mode: 'drag' | 'lock' | 'edit') => void;
  showNonStructural: boolean;
  onToggleNonStructural: () => void;
  canvasZoom: number;
  onSetCanvasZoom: (scale: number | ((prev: number) => number)) => void;
  onResetCanvas: () => void;
}> = ({ interactionMode, onSetInteractionMode, showNonStructural, onToggleNonStructural, canvasZoom, onSetCanvasZoom, onResetCanvas }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const zoomBy = (step: number) => onSetCanvasZoom((zoom) => Math.min(3, Math.max(0.1, Number((zoom + step).toFixed(2)))));

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setIsOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [isOpen]);

  const small = 'rounded border border-[#086375]/60 px-1.5 py-0.5 text-hud-3 font-bold text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C]';
  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <button type="button" onClick={() => zoomBy(-0.1)} aria-label="Zoom out" title="Zoom out" className={small}>−</button>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label="Open canvas controls"
        title="Canvas controls: mode, satellites, zoom"
        className="rounded border border-[#086375]/60 bg-[#086375]/15 px-2 py-0.5 text-hud-3 tabular-nums text-[#E0CA3C] hover:border-[#E0CA3C]"
      >
        <i className="fa-solid fa-sliders" aria-hidden="true" /> {Math.round(canvasZoom * 100)}%
      </button>
      <button type="button" onClick={() => zoomBy(0.1)} aria-label="Zoom in" title="Zoom in" className={small}>+</button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-[#086375] bg-[#020500] p-2 font-mono shadow-xl">
          <div className="grid grid-cols-3 gap-1">
            {(['drag', 'lock', 'edit'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSetInteractionMode(mode)}
                aria-pressed={interactionMode === mode}
                className={`rounded border px-1.5 py-1 text-hud-2 font-bold ${interactionMode === mode ? 'border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C]' : 'border-[#086375]/50 text-[#DDFBD0]/70 hover:border-[#E0CA3C]'}`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleNonStructural}
            aria-pressed={showNonStructural}
            className="mt-1 w-full rounded border border-[#086375]/50 px-2 py-1 text-left text-hud-2 text-[#DDFBD0]/80 hover:border-[#E0CA3C]"
          >
            Satellites: {showNonStructural ? 'visible' : 'hidden'}
          </button>
          <label className="mt-2 flex items-center justify-between gap-2 text-hud-2 text-[#DDFBD0]/70">
            <span>Zoom {Math.round(canvasZoom * 100)}%</span>
            <input aria-label="Canvas zoom" type="range" min="10" max="300" step="5" value={Math.round(canvasZoom * 100)}
              onChange={(event) => onSetCanvasZoom(Number(event.target.value) / 100)} className="w-28 accent-[#E0CA3C]" />
          </label>
          <button type="button" onClick={() => { onResetCanvas(); setIsOpen(false); }}
            className="mt-1 w-full rounded border border-[#086375]/50 px-2 py-1 text-hud-2 text-[#DDFBD0]/80 hover:border-[#E0CA3C]">
            Recenter (100%)
          </button>
        </div>
      )}
    </div>
  );
};
