import React, { useEffect, useRef } from 'react';
import { DockRace, DockSkin, dockAsset } from './dockSkins';
import { onDockFx, prefersReducedMotion } from './dockFx';

interface PowerCrystalProps {
  race: DockRace;
  skin: DockSkin;
  /** Rendered height in px; width follows the art's aspect ratio. */
  height: number;
  /** Centre-bottom anchor inside the parent, in px. */
  x: number;
  bottomY: number;
  /** Small crystals react half as strongly. */
  small?: boolean;
  /** Flash toward plasma orange (e.g. a missing dossier link). */
  alert?: boolean;
  anchorId?: string;
}

/**
 * The painted Stitch crystal, animated in 2D: per-race idle motion,
 * a light sweep across the facets, a star glint, and reactions to dock FX.
 */
export const PowerCrystal: React.FC<PowerCrystalProps> = ({ race, skin, height, x, bottomY, small, alert, anchorId }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const glintRef = useRef<HTMLDivElement>(null);
  const energy = useRef(0);
  const alertRef = useRef(alert);
  alertRef.current = alert;

  const width = height * skin.crystal.ar;
  const src = dockAsset(skin.crystal.src);

  useEffect(
    () =>
      onDockFx((e) => {
        if (e.type === 'pulse') energy.current = Math.min(1.5, energy.current + (small ? 0.4 : 0.8));
        if (e.type === 'surge') energy.current = Math.min(1.5, energy.current + (small ? 0.7 : 1.4));
      }),
    [small],
  );

  useEffect(() => {
    const img = imgRef.current;
    const root = rootRef.current;
    const glint = glintRef.current;
    if (!img || !root || !glint) return;
    if (prefersReducedMotion()) {
      img.style.filter = `drop-shadow(0 0 ${small ? 4 : 8}px ${skin.fx.glow})`;
      return;
    }
    let raf = 0;
    let last = performance.now();
    let glintT = 1 + Math.random() * 2;
    let gx = 0.5;
    let gy = 0.3;
    const tick = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      const t = now / 1000;
      const e = energy.current;
      energy.current = Math.max(0, e - dt * 0.02);
      let b = 1;
      let sc = 1;
      let ty = 0;
      let gl = 8;
      if (race === 'terran') {
        const ph = t % 3.6;
        const beacon = ph < 0.09 || (ph > 0.18 && ph < 0.27) ? 1 : 0;
        b = 1 + beacon * 0.45 + e * 0.6 * (Math.sin(t * 40) > 0 ? 1 : 0.3);
        gl = 8 + beacon * 10 + e * 14;
      } else if (race === 'protoss') {
        const p = 0.5 + 0.5 * Math.sin(t * 2.4);
        b = 0.95 + p * 0.25 + e * 0.5;
        ty = Math.sin(t * 1.7) * (small ? 1 : 2.2);
        gl = 7 + p * 8 + e * 14;
        sc = 1 + e * 0.05;
      } else if (race === 'zerg') {
        const ph = t % 2.2;
        const beat = Math.exp(-((ph - 0.1) ** 2) / 0.004) + 0.7 * Math.exp(-((ph - 0.36) ** 2) / 0.004);
        b = 0.92 + beat * 0.35 + e * 0.5;
        sc = 1 + beat * 0.045 + e * 0.07;
        gl = 6 + beat * 12 + e * 12;
      } else {
        const fl = 0.6 + 0.4 * Math.abs(Math.sin(t * 23 + Math.sin(t * 7) * 3)) * (Math.random() < 0.04 ? 0.3 : 1);
        b = 0.9 + fl * 0.3 + e * 0.5;
        gl = 6 + fl * 8 + e * 12;
      }
      const isAlert = Boolean(alertRef.current) && Math.sin(t * 2.2) > 0.1;
      const k = small ? 0.5 : 1;
      img.style.filter =
        `brightness(${b.toFixed(3)})` +
        (isAlert ? ` hue-rotate(${skin.fx.alertHue}deg) saturate(1.4)` : '') +
        ` drop-shadow(0 0 ${(gl * k).toFixed(1)}px ${isAlert ? '#ff7a2a' : skin.fx.glow})`;
      root.style.transform = `translateY(${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;

      glintT -= dt / 60;
      if (glintT <= 0) {
        glintT = 1.8 + Math.random() * 2.8;
        gx = 0.32 + Math.random() * 0.36;
        gy = 0.1 + Math.random() * 0.45;
      }
      const gp = Math.max(0, 1 - Math.abs(glintT - 1.2) / 0.25);
      const gs = width * (small ? 1.4 : 0.9) * gp;
      glint.style.opacity = gp.toFixed(3);
      glint.style.width = `${gs}px`;
      glint.style.height = `${gs}px`;
      glint.style.left = `${gx * width - gs / 2}px`;
      glint.style.top = `${gy * height - gs / 2}px`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [race, skin, small, width, height]);

  return (
    <div
      ref={rootRef}
      className="szs-crystal"
      data-race={race}
      data-dock-anchor={anchorId}
      aria-hidden="true"
      style={{ width, height, left: x - width / 2, top: bottomY - height }}
    >
      <img ref={imgRef} src={src} alt="" draggable={false} />
      <div className="szs-crystal-shim" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />
      <div ref={glintRef} className="szs-crystal-glint" />
    </div>
  );
};
