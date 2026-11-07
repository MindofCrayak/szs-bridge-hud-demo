/**
 * Dock skin manifest — generated from the Stitch asset sheets.
 * Paths are relative to /assets/hud/dock/ (apps/command-hud/public).
 * Every metric is a fraction of the sprite's own width/height so art can be
 * swapped without code changes. To add a variation, append to an array
 * (frames today; any slot can become an array later) and drop the files in.
 */

export type DockRace = 'terran' | 'protoss' | 'zerg' | 'cassette';
export const DOCK_RACES: DockRace[] = ['terran', 'protoss', 'zerg', 'cassette'];

export interface DockFrameKit { src: string; sliceX: number; sliceY: number; repeat: 'round' | 'stretch' }
export interface DockBarRow { L: string; R: string; f1: string; f2: string; C?: string; Lar: number; Rar: number; Car: number }
export interface DockSkin {
  label: string;
  /** Visual border thickness (px at a 120px corner slice). */
  frameWidth: number;
  frames: DockFrameKit[];
  /** hole = [centerX, centerY, width, height] of the crystal socket opening. */
  socket: { src: string; cut: string; ar: number; hole: [number, number, number, number] };
  /** win = [centerX, centerY, diameter/width] of the rotor window. */
  reelHinge: { src: string; ar: number; win: [number, number, number] };
  rotor: string;
  /** slot = [x0, y0, x1, y1] of the crystal slot. */
  shardHinge: { src: string; ar: number; slot: [number, number, number, number] };
  cap: { src: string; ar: number };
  ornament: { src: string; ar: number };
  conduit: string;
  crystal: { src: string; ar: number };
  bar?: {
    full: DockBarRow[];
    empty: DockBarRow;
    /** Where the fill window starts, as a fraction of the left cap width. */
    windowStart: number;
    /** Vertical band of the fill window [top, bottom] as fractions of bar height. */
    band: [number, number];
    /** Which `full` row to use per state. */
    state: { ok: number; warn: number; alert: number };
  };
  /** Optional keycap art for the macro pad: [idle, lit, hover]. */
  keycaps?: string[];
  fx: { arc: string; spark: string; glow: string; alertHue: number };
}

export const DOCK_SKINS: Record<DockRace, DockSkin> = {
  "terran": {
    "frames": [
      {
        "src": "terran/frame-1.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "round"
      },
      {
        "src": "terran/frame-2.webp",
        "sliceX": 119,
        "sliceY": 120,
        "repeat": "round"
      },
      {
        "src": "terran/frame-3.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "round"
      }
    ],
    "socket": {
      "src": "terran/socket.webp",
      "cut": "terran/socket-cut.webp",
      "ar": 1.202,
      "hole": [
        0.499,
        0.211,
        0.117,
        0.158
      ]
    },
    "reelHinge": {
      "src": "terran/hinge-reel.webp",
      "ar": 1.021,
      "win": [
        0.5,
        0.48,
        0.24
      ]
    },
    "rotor": "terran/rotor.webp",
    "shardHinge": {
      "src": "terran/hinge-shard.webp",
      "ar": 1.114,
      "slot": [
        0.461,
        0.162,
        0.539,
        0.833
      ]
    },
    "cap": {
      "src": "terran/cap.webp",
      "ar": 0.951
    },
    "ornament": {
      "src": "terran/ornament.webp",
      "ar": 1.699
    },
    "conduit": "terran/conduit.webp",
    "crystal": {
      "src": "terran/crystal.webp",
      "ar": 0.432
    },
    "bar": {
      "full": [
        {
          "L": "terran/bar-a-l.webp",
          "R": "terran/bar-a-r.webp",
          "f1": "terran/bar-a-f1.webp",
          "f2": "terran/bar-a-f2.webp",
          "Lar": 1.92,
          "Rar": 1.92,
          "Car": 0
        },
        {
          "L": "terran/bar-b-l.webp",
          "R": "terran/bar-b-r.webp",
          "f1": "terran/bar-b-f1.webp",
          "f2": "terran/bar-b-f2.webp",
          "Lar": 1.92,
          "Rar": 1.92,
          "Car": 0
        },
        {
          "L": "terran/bar-c-l.webp",
          "R": "terran/bar-c-r.webp",
          "f1": "terran/bar-c-f1.webp",
          "f2": "terran/bar-c-f2.webp",
          "Lar": 1.92,
          "Rar": 1.92,
          "Car": 0
        }
      ],
      "empty": {
        "L": "terran/bar-empty-l.webp",
        "R": "terran/bar-empty-r.webp",
        "f1": "terran/bar-empty-f1.webp",
        "f2": "terran/bar-empty-f2.webp",
        "Lar": 1.932,
        "Rar": 1.932,
        "Car": 0
      },
      "windowStart": 0.425,
      "state": {
        "ok": 0,
        "warn": 1,
        "alert": 2
      },
      "band": [
        0.36,
        0.67
      ]
    },
    "label": "Terran",
    "frameWidth": 22,
    "fx": {
      "arc": "120,220,255",
      "spark": "#d8f6ff",
      "glow": "#38c8ff",
      "alertHue": 190
    }
  },
  "protoss": {
    "frames": [
      {
        "src": "protoss/frame-1.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "stretch"
      },
      {
        "src": "protoss/frame-2.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "stretch"
      },
      {
        "src": "protoss/frame-3.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "round"
      },
      {
        "src": "protoss/frame-4.webp",
        "sliceX": 119,
        "sliceY": 120,
        "repeat": "round"
      }
    ],
    "socket": {
      "src": "protoss/socket.webp",
      "cut": "protoss/socket-cut.webp",
      "ar": 1.182,
      "hole": [
        0.498,
        0.22,
        0.115,
        0.153
      ]
    },
    "reelHinge": {
      "src": "protoss/hinge-reel.webp",
      "ar": 1.019,
      "win": [
        0.5,
        0.47,
        0.2
      ]
    },
    "rotor": "protoss/rotor.webp",
    "shardHinge": {
      "src": "protoss/hinge-shard.webp",
      "ar": 1.124,
      "slot": [
        0.461,
        0.131,
        0.539,
        0.866
      ]
    },
    "cap": {
      "src": "protoss/cap.webp",
      "ar": 0.957
    },
    "ornament": {
      "src": "protoss/ornament.webp",
      "ar": 2.162
    },
    "conduit": "protoss/conduit.webp",
    "crystal": {
      "src": "protoss/crystal.webp",
      "ar": 0.368
    },
    "bar": {
      "full": [
        {
          "L": "protoss/bar-a-l.webp",
          "R": "protoss/bar-a-r.webp",
          "f1": "protoss/bar-a-f1.webp",
          "f2": "protoss/bar-a-f2.webp",
          "Lar": 1.162,
          "Rar": 1.162,
          "Car": 0.838,
          "C": "protoss/bar-a-c.webp"
        },
        {
          "L": "protoss/bar-b-l.webp",
          "R": "protoss/bar-b-r.webp",
          "f1": "protoss/bar-b-f1.webp",
          "f2": "protoss/bar-b-f2.webp",
          "Lar": 1.175,
          "Rar": 1.175,
          "Car": 0.847,
          "C": "protoss/bar-b-c.webp"
        },
        {
          "L": "protoss/bar-c-l.webp",
          "R": "protoss/bar-c-r.webp",
          "f1": "protoss/bar-c-f1.webp",
          "f2": "protoss/bar-c-f2.webp",
          "Lar": 1.15,
          "Rar": 1.15,
          "Car": 0.828,
          "C": "protoss/bar-c-c.webp"
        }
      ],
      "empty": {
        "L": "protoss/bar-empty-l.webp",
        "R": "protoss/bar-empty-r.webp",
        "f1": "protoss/bar-empty-f1.webp",
        "f2": "protoss/bar-empty-f2.webp",
        "Lar": 1.123,
        "Rar": 1.123,
        "Car": 0.802,
        "C": "protoss/bar-empty-c.webp"
      },
      "windowStart": 0.69,
      "state": {
        "ok": 0,
        "warn": 1,
        "alert": 2
      },
      "band": [
        0.3,
        0.72
      ]
    },
    "label": "Protoss",
    "frameWidth": 26,
    "fx": {
      "arc": "255,205,110",
      "spark": "#ffe49a",
      "glow": "#ffb52e",
      "alertHue": -22
    }
  },
  "zerg": {
    "frames": [
      {
        "src": "zerg/frame-1.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "stretch"
      },
      {
        "src": "zerg/frame-2.webp",
        "sliceX": 119,
        "sliceY": 120,
        "repeat": "stretch"
      },
      {
        "src": "zerg/frame-3.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "stretch"
      }
    ],
    "socket": {
      "src": "zerg/socket.webp",
      "cut": "zerg/socket-cut.webp",
      "ar": 1.082,
      "hole": [
        0.5,
        0.221,
        0.123,
        0.148
      ]
    },
    "reelHinge": {
      "src": "zerg/hinge-reel.webp",
      "ar": 0.998,
      "win": [
        0.49,
        0.5,
        0.3
      ]
    },
    "rotor": "zerg/rotor.webp",
    "shardHinge": {
      "src": "zerg/hinge-shard.webp",
      "ar": 1.11,
      "slot": [
        0.449,
        0.194,
        0.551,
        0.808
      ]
    },
    "cap": {
      "src": "zerg/cap.webp",
      "ar": 0.951
    },
    "ornament": {
      "src": "zerg/ornament.webp",
      "ar": 1.599
    },
    "conduit": "zerg/conduit.webp",
    "crystal": {
      "src": "zerg/crystal.webp",
      "ar": 0.79
    },
    "bar": {
      "full": [
        {
          "L": "zerg/bar-a-l.webp",
          "R": "zerg/bar-a-r.webp",
          "f1": "zerg/bar-a-f1.webp",
          "f2": "zerg/bar-a-f2.webp",
          "Lar": 1.326,
          "Rar": 1.326,
          "Car": 2.058,
          "C": "zerg/bar-a-c.webp"
        },
        {
          "L": "zerg/bar-b-l.webp",
          "R": "zerg/bar-b-r.webp",
          "f1": "zerg/bar-b-f1.webp",
          "f2": "zerg/bar-b-f2.webp",
          "Lar": 1.362,
          "Rar": 1.362,
          "Car": 2.119,
          "C": "zerg/bar-b-c.webp"
        },
        {
          "L": "zerg/bar-c-l.webp",
          "R": "zerg/bar-c-r.webp",
          "f1": "zerg/bar-c-f1.webp",
          "f2": "zerg/bar-c-f2.webp",
          "Lar": 1.408,
          "Rar": 1.408,
          "Car": 2.184,
          "C": "zerg/bar-c-c.webp"
        }
      ],
      "empty": {
        "L": "zerg/bar-empty-l.webp",
        "R": "zerg/bar-empty-r.webp",
        "f1": "zerg/bar-empty-f1.webp",
        "f2": "zerg/bar-empty-f2.webp",
        "Lar": 1.392,
        "Rar": 1.392,
        "Car": 2.155,
        "C": "zerg/bar-empty-c.webp"
      },
      "windowStart": 0.6,
      "state": {
        "ok": 1,
        "warn": 2,
        "alert": 0
      },
      "band": [
        0.3,
        0.72
      ]
    },
    "label": "Zerg",
    "frameWidth": 30,
    "fx": {
      "arc": "255,70,130",
      "spark": "#ff7aa2",
      "glow": "#ff2f63",
      "alertHue": 38
    }
  },
  "cassette": {
    "frames": [
      {
        "src": "cassette/frame-1.webp",
        "sliceX": 120,
        "sliceY": 120,
        "repeat": "round"
      },
      {
        "src": "cassette/frame-2.webp",
        "sliceX": 120,
        "sliceY": 119,
        "repeat": "round"
      }
    ],
    "socket": {
      "src": "cassette/socket.webp",
      "cut": "cassette/socket-cut.webp",
      "ar": 1.107,
      "hole": [
        0.498,
        0.193,
        0.115,
        0.144
      ]
    },
    "reelHinge": {
      "src": "cassette/hinge-reel.webp",
      "ar": 0.998,
      "win": [
        0.5,
        0.48,
        0.27
      ]
    },
    "rotor": "cassette/rotor.webp",
    "shardHinge": {
      "src": "cassette/hinge-shard.webp",
      "ar": 1.119,
      "slot": [
        0.461,
        0.158,
        0.537,
        0.839
      ]
    },
    "cap": {
      "src": "cassette/cap.webp",
      "ar": 0.945
    },
    "ornament": {
      "src": "cassette/ornament.webp",
      "ar": 2.25
    },
    "conduit": "cassette/conduit.webp",
    "crystal": {
      "src": "cassette/crystal.webp",
      "ar": 0.433
    },
    "bar": {
      "full": [
        {
          "L": "cassette/bar-a-l.webp",
          "R": "cassette/bar-a-r.webp",
          "f1": "cassette/bar-a-f1.webp",
          "f2": "cassette/bar-a-f2.webp",
          "Lar": 1.974,
          "Rar": 1.948,
          "Car": 1.144,
          "C": "cassette/bar-a-c.webp"
        },
        {
          "L": "cassette/bar-b-l.webp",
          "R": "cassette/bar-b-r.webp",
          "f1": "cassette/bar-b-f1.webp",
          "f2": "cassette/bar-b-f2.webp",
          "Lar": 1.961,
          "Rar": 1.935,
          "Car": 1.136,
          "C": "cassette/bar-b-c.webp"
        },
        {
          "L": "cassette/bar-c-l.webp",
          "R": "cassette/bar-c-r.webp",
          "f1": "cassette/bar-c-f1.webp",
          "f2": "cassette/bar-c-f2.webp",
          "Lar": 1.948,
          "Rar": 1.923,
          "Car": 1.129,
          "C": "cassette/bar-c-c.webp"
        }
      ],
      "empty": {
        "L": "cassette/bar-empty-l.webp",
        "R": "cassette/bar-empty-r.webp",
        "f1": "cassette/bar-empty-f1.webp",
        "f2": "cassette/bar-empty-f2.webp",
        "Lar": 1.961,
        "Rar": 1.935,
        "Car": 1.136,
        "C": "cassette/bar-empty-c.webp"
      },
      "windowStart": 0.35,
      "state": {
        "ok": 1,
        "warn": 0,
        "alert": 2
      },
      "band": [
        0.33,
        0.67
      ]
    },
    "keycaps": [
      "cassette/keycap-idle.webp",
      "cassette/keycap-lit.webp",
      "cassette/keycap-hover.webp"
    ],
    "label": "Cassette",
    "frameWidth": 22,
    "fx": {
      "arc": "120,255,180",
      "spark": "#b9ffd8",
      "glow": "#1fff8c",
      "alertHue": -128
    }
  }
} as unknown as Record<DockRace, DockSkin>;

export const dockAsset = (path: string) => `${import.meta.env.BASE_URL}assets/hud/dock/${path}`;
