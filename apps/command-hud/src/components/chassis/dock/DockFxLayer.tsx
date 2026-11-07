import React, { useEffect, useRef } from 'react';
import { useDockSkin } from './DockSkinContext';
import { onDockFx, prefersReducedMotion } from './dockFx';
import type { DockRace, DockSkin } from './dockSkins';

/**
 * L3 effects canvas for the dock: crystal halo, sparks, lightning arcs and
 * shockwave rings. Sits over the footer (and a band above it, so arcs can
 * leave the crystal) and never takes pointer events.
 */
interface Spark { x: number; y: number; vx: number; vy: number; life: number; c: string }
interface Arc { pts: [number, number][]; life: number; color: string }
interface Ring { x: number; y: number; r: number; life: number; color: string }

const ABOVE = 140;

export const DockFxLayer: React.FC = () => {
  const { race, skin } = useDockSkin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skinRef = useRef<{ race: DockRace | null; skin: DockSkin | null }>({ race, skin });
  skinRef.current = { race, skin };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || prefersReducedMotion()) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const sparks: Spark[] = [];
    const arcs: Arc[] = [];
    const rings: Ring[] = [];
    let W = 0;
    let H = 0;

    const size = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      cv.width = Math.max(1, Math.round(W * d));
      cv.height = Math.max(1, Math.round(H * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);

    /** Crystal geometry in canvas space, read from the DOM each frame. */
    const crystal = () => {
      const el = cv.parentElement?.querySelector<HTMLElement>('[data-dock-anchor="core-crystal"]');
      if (!el) return null;
      const c = cv.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (!r.width) return null;
      return { x: r.left - c.left + r.width / 2, top: r.top - c.top, h: r.height, w: r.width };
    };

    const zap = (x: number, y: number, len: number, color: string, anyDir = false) => {
      const pts: [number, number][] = [[x, y]];
      let a = anyDir ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      let px = x;
      let py = y;
      const n = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        a += (Math.random() - 0.5) * 1.1;
        px += (Math.cos(a) * len) / n;
        py += (Math.sin(a) * len) / n;
        pts.push([px, py]);
      }
      arcs.push({ pts, life: 1, color });
    };

    const react = (big: boolean) => {
      const { race: rc, skin: sk } = skinRef.current;
      const c = crystal();
      if (!rc || !sk || !c) return;
      const { arc, spark } = sk.fx;
      if (rc === 'terran') {
        for (let i = 0; i < (big ? 4 : 2); i++) zap(c.x, c.top + c.h * 0.4, 26, arc, true);
        for (let i = 0; i < (big ? 16 : 8); i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 1.5 + Math.random() * 4;
          sparks.push({ x: c.x, y: c.top + c.h * 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, c: Math.random() < 0.4 ? '#fff' : spark });
        }
      } else if (rc === 'protoss') {
        rings.push({ x: c.x, y: c.top + c.h * 0.55, r: 6, life: 1, color: arc });
        if (big) rings.push({ x: c.x, y: c.top + c.h * 0.55, r: 2, life: 0.8, color: arc });
      } else if (rc === 'zerg') {
        for (let i = 0; i < (big ? 4 : 2); i++) zap(c.x, c.top + c.h * 0.1, 40 + Math.random() * 40, arc);
      } else {
        for (let i = 0; i < (big ? 12 : 6); i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          const v = 2 + Math.random() * 3;
          sparks.push({ x: c.x, y: c.top + 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.5 ? '#fff' : spark });
        }
        zap(c.x, c.top + 8, 30, arc);
      }
    };

    const off = onDockFx((e) => {
      if (e.type === 'pulse') react(false);
      if (e.type === 'surge') react(true);
    });

    let raf = 0;
    let last = performance.now();
    let idle = 0;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      idle += dt;
      ctx.clearRect(0, 0, W, H);
      const { race: rc, skin: sk } = skinRef.current;
      const c = crystal();
      if (rc && sk && c) {
        ctx.globalCompositeOperation = 'lighter';
        const fl = 0.6 + 0.4 * Math.sin(now / 230) * Math.sin(now / 83);
        const gx = c.x;
        const gy = c.top + c.h * 0.45;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 70);
        g.addColorStop(0, `rgba(${sk.fx.arc},${(0.3 * fl).toFixed(3)})`);
        g.addColorStop(1, `rgba(${sk.fx.arc},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(gx - 70, gy - 70, 140, 140);
        if (idle > 78) {
          idle = 0;
          if (rc === 'terran' && Math.random() < 0.6) zap(c.x + (Math.random() - 0.5) * 6, c.top + c.h * (0.3 + Math.random() * 0.3), 14, sk.fx.arc, true);
          else if (Math.random() < 0.25) react(false);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        a.life -= 0.06 * dt;
        if (a.life <= 0) {
          arcs.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(${a.color},${a.life})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = `rgba(${a.color},1)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        a.pts.forEach(([x, y], j) => {
          const jx = x + (Math.random() - 0.5) * 3;
          const jy = y + (Math.random() - 0.5) * 3;
          if (j) ctx.lineTo(jx, jy);
          else ctx.moveTo(jx, jy);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life -= 0.025 * dt;
        r.r += 2.2 * dt;
        if (r.life <= 0) {
          rings.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(${r.color},${r.life * 0.8})`;
        ctx.lineWidth = 2 * r.life + 0.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 0.18 * dt;
        s.life -= 0.028 * dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = s.c;
        ctx.globalAlpha = s.life;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 2, s.y - s.vy * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  }, []);

  if (!skin) return null;
  return <canvas ref={canvasRef} className="szs-dock-fx" style={{ top: -ABOVE }} aria-hidden="true" />;
};
