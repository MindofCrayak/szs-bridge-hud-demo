import React from 'react';
import { useDockSkin } from './DockSkinContext';
import { dockAsset } from './dockSkins';
import { PowerCrystal } from './PowerCrystal';

/**
 * The mechanical pieces between bays. All of them sit on the hinge line,
 * half the collapsed bay height (22px) above the dock baseline.
 */
const BAY_H = 44;
const HINGE_H = 42;
const CAP_H = 40;
const CORE_H = 70;
const CRYSTAL_H = 84;

export const PowerCore: React.FC = () => {
  const { race, skin, mode, random, cycleMode, cycleFrame, toggleRandom } = useDockSkin();
  if (!race || !skin) {
    // Classic (no skin): keep a small crystal so the skins can be cycled back on.
    return (
      <button
        type="button"
        className="szs-joint pointer-events-auto mx-1 flex h-[44px] w-9 items-center justify-center rounded-lg border border-[#086375]/70 bg-[#0d1513]/95 text-[#E0CA3C] hover:border-[#E0CA3C]"
        aria-label="Dock skin: Classic. Click for the next skin; right-click toggles a random skin on each load."
        title="Dock skin: Classic. Click for the next skin; right-click toggles a random skin on each load."
        data-mode={mode}
        onClick={() => cycleMode()}
        onContextMenu={(e) => { e.preventDefault(); toggleRandom(); }}
      >
        ◆
      </button>
    );
  }
  const s = skin.socket;
  const w = Math.round(CORE_H * s.ar);
  const [hx, hy, , hh] = s.hole;
  const label = `Dock skin: ${skin.label}${random ? ' (random each load)' : ''}. Click for next skin, Shift+click for next frame, right-click to toggle random each load.`;
  return (
    <button
      type="button"
      className="szs-joint szs-core pointer-events-auto"
      style={{ width: w, height: CORE_H }}
      aria-label={label}
      title={label}
      data-mode={mode}
      onClick={(e) => (e.shiftKey ? cycleFrame() : cycleMode())}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleRandom();
      }}
    >
      <img className="szs-joint-layer szs-l2" src={dockAsset(s.src)} alt="" draggable={false} />
      <PowerCrystal race={race} skin={skin} height={CRYSTAL_H} x={hx * w} bottomY={(hy + hh * 0.3) * CORE_H} anchorId="core-crystal" />
      <img className="szs-joint-layer szs-l4" src={dockAsset(s.cut)} alt="" draggable={false} />
    </button>
  );
};

export const ReelHinge: React.FC = () => {
  const { skin } = useDockSkin();
  if (!skin) return null;
  const h = skin.reelHinge;
  const w = Math.round(HINGE_H * h.ar);
  const d = h.win[2] * w * 1.04;
  return (
    <div className="szs-joint" style={{ width: w, height: BAY_H }} aria-hidden="true" data-dock-anchor="reel">
      <img className="szs-joint-layer szs-l2" style={{ height: HINGE_H, bottom: 1 }} src={dockAsset(h.src)} alt="" draggable={false} />
      <img
        className="szs-rotor"
        src={dockAsset(skin.rotor)}
        alt=""
        draggable={false}
        style={{ width: d, height: d, left: h.win[0] * w - d / 2, bottom: 1 + HINGE_H * (1 - h.win[1]) - d / 2 }}
      />
    </div>
  );
};

export const ShardHinge: React.FC<{ alert?: boolean }> = ({ alert }) => {
  const { race, skin } = useDockSkin();
  if (!race || !skin) return null;
  const sh = skin.shardHinge;
  const w = Math.round(HINGE_H * sh.ar);
  const [x0, y0, x1, y1] = sh.slot;
  const slotH = (y1 - y0) * HINGE_H;
  const slotBottom = BAY_H - 1 - HINGE_H * (1 - y1);
  return (
    <div className="szs-joint" style={{ width: w, height: BAY_H }} aria-hidden="true">
      <div
        className="szs-slot-back"
        style={{ left: x0 * w, width: (x1 - x0) * w, bottom: 1 + HINGE_H * (1 - y1), height: slotH }}
      />
      <PowerCrystal race={race} skin={skin} small alert={alert} height={slotH * 1.05} x={((x0 + x1) / 2) * w} bottomY={slotBottom + slotH * 0.04} />
      <img className="szs-joint-layer szs-l4" style={{ height: HINGE_H, bottom: 1 }} src={dockAsset(sh.src)} alt="" draggable={false} />
    </div>
  );
};

export const EndCap: React.FC<{ side: 'left' | 'right' }> = ({ side }) => {
  const { skin } = useDockSkin();
  if (!skin) return null;
  const w = Math.round(CAP_H * skin.cap.ar);
  return (
    <div className={`szs-joint szs-cap ${side === 'right' ? 'is-right' : ''}`} style={{ width: w, height: BAY_H }} aria-hidden="true">
      <img className="szs-joint-layer szs-l2" style={{ height: CAP_H, bottom: 2 }} src={dockAsset(skin.cap.src)} alt="" draggable={false} />
    </div>
  );
};
