import React, { useLayoutEffect, useRef, useState } from 'react';
import { useDockSkin } from './DockSkinContext';
import { DockBarRow, dockAsset } from './dockSkins';

export type VitalState = 'ok' | 'warn' | 'alert';

interface VitalsMeterProps {
  label: string;
  value: string;
  state: VitalState;
  /** 0–100 */
  fill: number;
}

const BAR_H = 24;

/**
 * One client-vitals meter. Uses the active race's Stitch status bar
 * (empty bar underneath, the state-coloured bar clipped to `fill` on top);
 * falls back to a plain glowing meter on the classic skin.
 */
export const VitalsMeter: React.FC<VitalsMeterProps> = ({ label, value, state, fill }) => {
  const { skin } = useDockSkin();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const pct = Math.max(0, Math.min(100, fill));

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const bar = skin?.bar;
  let art: React.ReactNode = null;
  if (bar && width > 0) {
    const fullRow = bar.full[bar.state[state]] ?? bar.full[0];
    const parts = (row: DockBarRow) => [row.Lar, row.C ? row.Car : 0, bar.empty.Rar];
    const sum = (row: DockBarRow) => parts(row).reduce((a, b) => a + b * BAR_H, 0);
    const k = Math.min(1, (width * 0.8) / sum(bar.empty));
    const lw = bar.empty.Lar * BAR_H * k;
    const rw = bar.empty.Rar * BAR_H * k;
    const start = lw * bar.windowStart;
    const end = width - rw;
    const x = start + (end - start) * (pct / 100);
    const row = (r: DockBarRow, cls: string, style?: React.CSSProperties) => (
      <div className={`szs-meter-row ${cls}`} style={style}>
        <img src={dockAsset(r.L)} alt="" style={{ width: r.Lar * BAR_H * k }} draggable={false} />
        <i style={{ backgroundImage: `url(${dockAsset(r.f1)})` }} />
        {r.C && <img src={dockAsset(r.C)} alt="" style={{ width: r.Car * BAR_H * k }} draggable={false} />}
        {r.C && <i style={{ backgroundImage: `url(${dockAsset(r.f2)})` }} />}
        <img src={dockAsset(bar.empty.R)} alt="" style={{ width: rw }} draggable={false} />
      </div>
    );
    art = (
      <>
        {row(bar.empty, 'is-empty')}
        {row(fullRow, `is-fill is-${state}`, {
          clipPath: `inset(${bar.band[0] * BAR_H}px ${Math.max(0, width - x)}px ${(1 - bar.band[1]) * BAR_H}px 0)`,
        })}
      </>
    );
  }

  return (
    <div className="szs-vital" data-state={state}>
      <div className="szs-vital-top">
        <span className="szs-vital-label">{label}</span>
        <span className={`szs-vital-value ${state === 'alert' ? 'is-hot' : ''}`}>{value}</span>
      </div>
      <div
        ref={boxRef}
        className={`szs-meter ${bar ? 'has-art' : ''}`}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={value}
      >
        {bar ? art : <div className="szs-meter-fill" style={{ width: `calc(${pct}% - 4px)` }} />}
      </div>
    </div>
  );
};
