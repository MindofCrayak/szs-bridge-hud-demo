import { useEffect, useRef } from 'react';

export interface KeymapConfig {
  departments: Record<string, string>; // e.g. "Alt+1": "dashboard"
  macroPad: Record<string, string>;    // e.g. "Q": "Q"
}

export const DEFAULT_KEYMAP: KeymapConfig = {
  departments: {
    'Alt+1': 'dashboard',
    'Alt+2': 'osint',
    'Alt+3': 'symphony',
    'Alt+4': 'treasure',
    'Alt+5': 'archive',
    'Alt+6': 'clients',
    'Alt+7': 'actions',
    'Alt+8': 'cockpit',
  },
  macroPad: {
    'Q': 'Q',
    'W': 'W',
    'E': 'E',
    'A': 'A',
    'S': 'S',
    'D': 'D',
    'Z': 'Z',
    'X': 'X',
    'C': 'C',
  },
};

export const STORAGE_KEYMAP_KEY = 'szs_bridge_keymap';

export function loadStoredKeymap(): KeymapConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYMAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KeymapConfig>;
      return {
        departments: { ...DEFAULT_KEYMAP.departments, ...(parsed.departments || {}) },
        macroPad: { ...DEFAULT_KEYMAP.macroPad, ...(parsed.macroPad || {}) },
      };
    }
  } catch (e) {
    console.warn('Failed to load keymap from localStorage', e);
  }
  return DEFAULT_KEYMAP;
}

export function saveStoredKeymap(config: KeymapConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYMAP_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save keymap to localStorage', e);
  }
}

export function useBridgeKeybindings({
  keymap,
  onSwitchDepartment,
  onBindClientSlot,
  onRecallClientSlot,
  onTriggerMacro,
  onToggleSettings,
  onToggleSidebar,
}: {
  keymap: KeymapConfig;
  onSwitchDepartment: (view: string) => void;
  onBindClientSlot: (slot: number) => void;
  onRecallClientSlot: (slot: number) => void;
  onTriggerMacro: (actionId: string) => void;
  onToggleSettings: () => void;
  onToggleSidebar?: () => void;
}) {
  const isInputActive = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a textarea, search input, or intercom prompt
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA'].includes(target.tagName) ||
          target.isContentEditable ||
          (target as HTMLInputElement).type === 'search')
      ) {
        if (e.key === 'Escape') target.blur();
        return;
      }

      // Quick access to Settings / Remap Overlay (Ctrl + , or F1)
      if ((e.ctrlKey && e.key === ',') || e.key === 'F1') {
        e.preventDefault();
        onToggleSettings();
        return;
      }

      // Ctrl + B to toggle left drawer collapse
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // 1. Department Switcher (Alt + 1..0)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const altCombo = `Alt+${e.key}`;
        if (keymap.departments[altCombo]) {
          e.preventDefault();
          onSwitchDepartment(keymap.departments[altCombo]);
          return;
        }
      }

      // 2. Command palette (Ctrl+K). Ctrl+1..9 are left alone: Windows browsers keep them for switching tabs.
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onSwitchDepartment('actions');
        return;
      }

      // 3. RTS Client Control Group Binding: Shift + 1..9 or Shift + 0 to clear
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const digit = parseInt(e.key, 10);
        if (!isNaN(digit) && digit >= 1 && digit <= 9) {
          e.preventDefault();
          onBindClientSlot(digit);
          return;
        }
        if (digit === 0) {
          e.preventDefault();
          onRecallClientSlot(0); // clear active lock
          return;
        }
      }

      // 4. Instant Client Recall (1..9 unmodified) & Clear View Snap (0)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        const digit = parseInt(e.key, 10);
        if (!isNaN(digit) && digit >= 1 && digit <= 9) {
          e.preventDefault();
          onRecallClientSlot(digit);
          return;
        }
        if (digit === 0) {
          e.preventDefault();
          onRecallClientSlot(0); // clear client lock
          return;
        }
      }

      // 5. Hardware Macro Pad Grid (Q, W, E, A, S, D, Z, X, C unmodified)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        const upperKey = e.key.toUpperCase();
        if (keymap.macroPad[upperKey]) {
          e.preventDefault();
          onTriggerMacro(keymap.macroPad[upperKey]);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    keymap,
    onSwitchDepartment,
    onBindClientSlot,
    onRecallClientSlot,
    onTriggerMacro,
    onToggleSettings,
    onToggleSidebar,
  ]);

  return { isInputActive };
}
