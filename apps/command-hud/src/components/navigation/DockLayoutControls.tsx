import React, { useEffect, useState } from 'react';
import { BAYS, DEFAULT_DOCK_LAYOUT, DOCK_SCALE, readDockLayout, saveDockLayout, type DockLayout } from '../../ui/dockLayout';

/** Settings › Display: the bottom console's scale and each bay's width, applied live and kept per browser. */
export const DockLayoutControls: React.FC = () => {
  const [layout, setLayout] = useState<DockLayout>(readDockLayout);
  const update = (next: DockLayout) => { setLayout(next); saveDockLayout(next); };
  useEffect(() => {
    const sync = () => setLayout(readDockLayout());
    window.addEventListener('hud-dock-layout', sync);
    return () => window.removeEventListener('hud-dock-layout', sync);
  }, []);
  const measured = (cssVar: string, fallback: number) => {
    // Unset bays show their current on-screen width so the slider starts where the bay is.
    const el = document.querySelector<HTMLElement>(`[data-bay-var="${cssVar}"]`);
    return el ? Math.round(el.getBoundingClientRect().width / layout.scale) : fallback;
  };
  return (
    <div className="space-y-2 rounded-lg border border-[#086375]/60 bg-[#086375]/10 p-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[#E0CA3C]">Bottom console</span>
        <button type="button" onClick={() => update(DEFAULT_DOCK_LAYOUT)}
          className="rounded border border-[#086375]/60 px-2 py-0.5 text-hud-3 text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C]">
          Reset to default
        </button>
      </div>
      <label className="flex items-center justify-between gap-3 text-hud-4">
        <span>Console scale: <b className="text-[#E0CA3C]">{Math.round(layout.scale * 100)}%</b></span>
        <input type="range" aria-label="Bottom console scale" min={DOCK_SCALE.min} max={DOCK_SCALE.max} step={DOCK_SCALE.step} value={layout.scale}
          onChange={(event) => update({ ...layout, scale: Number(event.target.value) })} className="w-48 cursor-pointer accent-[#E0CA3C]" />
      </label>
      {layout.scale < 1 && <p className="text-hud-2 text-[#FE5F00]/80">Below 100% the console text is smaller than 11px.</p>}
      {BAYS.map((bay) => {
        const value = layout.widths[bay.id] ?? measured(bay.cssVar, bay.defaultPx);
        return (
          <label key={bay.id} className="flex items-center justify-between gap-3 text-hud-4">
            <span>{bay.label}: <b className="text-[#E0CA3C]">{value}px</b>{layout.widths[bay.id] === null && <span className="text-[#DDFBD0]/50"> (auto)</span>}</span>
            <input type="range" aria-label={`${bay.label} width`} min={bay.min} max={bay.max} step={10} value={value}
              onChange={(event) => update({ ...layout, widths: { ...layout.widths, [bay.id]: Number(event.target.value) } })}
              className="w-48 cursor-pointer accent-[#E0CA3C]" />
          </label>
        );
      })}
      <p className="text-hud-2 text-[#DDFBD0]/55">Changes apply at once and are kept in this browser. &quot;auto&quot; = fits the screen.</p>
    </div>
  );
};
