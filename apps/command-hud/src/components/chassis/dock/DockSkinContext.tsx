import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DOCK_RACES, DOCK_SKINS, DockRace, DockSkin } from './dockSkins';

/**
 * Dock skin state.
 * - `classic` keeps the original flat chassis look (no art).
 * - `random` picks a race on every load; the pick is fixed for the session.
 * - Frame variant is remembered per race.
 */
export type DockSkinMode = 'classic' | DockRace;
const MODES: DockSkinMode[] = ['classic', ...DOCK_RACES];
const STORAGE_KEY = 'szs_dock_skin_v1';

interface StoredPref {
  mode: DockSkinMode;
  random: boolean;
  frame: Partial<Record<DockRace, number>>;
}

const DEFAULT_PREF: StoredPref = { mode: 'protoss', random: false, frame: {} };

function readPref(): StoredPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREF;
    const parsed = JSON.parse(raw) as Partial<StoredPref>;
    return {
      mode: MODES.includes(parsed.mode as DockSkinMode) ? (parsed.mode as DockSkinMode) : DEFAULT_PREF.mode,
      random: Boolean(parsed.random),
      frame: parsed.frame && typeof parsed.frame === 'object' ? parsed.frame : {},
    };
  } catch {
    return DEFAULT_PREF;
  }
}

function writePref(pref: StoredPref) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* storage unavailable: keep in-memory state only */
  }
}

interface DockSkinValue {
  mode: DockSkinMode;
  race: DockRace | null;
  skin: DockSkin | null;
  frameIndex: number;
  random: boolean;
  cycleMode: () => void;
  cycleFrame: () => void;
  toggleRandom: () => void;
}

const DockSkinCtx = createContext<DockSkinValue>({
  mode: 'classic',
  race: null,
  skin: null,
  frameIndex: 0,
  random: false,
  cycleMode: () => {},
  cycleFrame: () => {},
  toggleRandom: () => {},
});

export const DockSkinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pref, setPref] = useState<StoredPref>(readPref);
  // Random mode rolls once per load, then behaves like a fixed race for the session.
  const [sessionMode, setSessionMode] = useState<DockSkinMode>(() => {
    const p = readPref();
    if (!p.random) return p.mode;
    return DOCK_RACES[Math.floor(Math.random() * DOCK_RACES.length)];
  });

  const update = useCallback((next: StoredPref) => {
    setPref(next);
    writePref(next);
  }, []);

  const cycleMode = useCallback(() => {
    const next = MODES[(MODES.indexOf(sessionMode) + 1) % MODES.length];
    setSessionMode(next);
    update({ ...pref, mode: next });
  }, [sessionMode, pref, update]);

  const race = sessionMode === 'classic' ? null : sessionMode;
  const skin = race ? DOCK_SKINS[race] : null;
  const frameIndex = race && skin ? (pref.frame[race] ?? 0) % skin.frames.length : 0;

  const cycleFrame = useCallback(() => {
    if (!race || !skin) return;
    update({ ...pref, frame: { ...pref.frame, [race]: (frameIndex + 1) % skin.frames.length } });
  }, [race, skin, frameIndex, pref, update]);

  const toggleRandom = useCallback(() => update({ ...pref, random: !pref.random }), [pref, update]);

  const value = useMemo<DockSkinValue>(
    () => ({ mode: sessionMode, race, skin, frameIndex, random: pref.random, cycleMode, cycleFrame, toggleRandom }),
    [sessionMode, race, skin, frameIndex, pref.random, cycleMode, cycleFrame, toggleRandom],
  );

  return <DockSkinCtx.Provider value={value}>{children}</DockSkinCtx.Provider>;
};

export const useDockSkin = () => useContext(DockSkinCtx);
