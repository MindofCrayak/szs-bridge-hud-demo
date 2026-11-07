import React, { useEffect, useState } from 'react';
import { UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP, applyUiScale, readUiScale } from '../../ui/uiScale';

/** − 100% + control for the HUD size; used in MENU and in Settings. */
export const UiScaleControl: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [scale, setScale] = useState(readUiScale);
  useEffect(() => {
    const onChange = (event: Event) => setScale(Number((event as CustomEvent<number>).detail) || 1);
    window.addEventListener('hud-ui-scale', onChange);
    return () => window.removeEventListener('hud-ui-scale', onChange);
  }, []);
  const set = (value: number) => setScale(applyUiScale(value));
  const btn = 'rounded border border-[#086375]/60 px-2 py-0.5 text-hud-3 font-bold text-[#DDFBD0] hover:border-[#E0CA3C] hover:text-[#E0CA3C] disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="HUD size">
      {!compact && <span className="mr-auto text-hud-3 text-[#DDFBD0]/80">HUD size</span>}
      <button type="button" className={btn} onClick={() => set(scale - UI_SCALE_STEP)} disabled={scale <= UI_SCALE_MIN} aria-label="Smaller HUD">−</button>
      <button type="button" className={`${btn} min-w-14 tabular-nums`} onClick={() => set(1)} title="Back to 100%" aria-label={`HUD size ${Math.round(scale * 100)}%, reset to 100%`}>
        {Math.round(scale * 100)}%
      </button>
      <button type="button" className={btn} onClick={() => set(scale + UI_SCALE_STEP)} disabled={scale >= UI_SCALE_MAX} aria-label="Larger HUD">+</button>
    </div>
  );
};
