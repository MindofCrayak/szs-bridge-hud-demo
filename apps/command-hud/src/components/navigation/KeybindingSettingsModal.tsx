import React, { useState } from 'react';
import { KeymapConfig, saveStoredKeymap } from '../../hooks/useBridgeKeybindings';
import { UiScaleControl } from './UiScaleControl';
import { DockLayoutControls } from './DockLayoutControls';
import { DEFAULT_DOCK_LAYOUT, saveDockLayout } from '../../ui/dockLayout';
import { applyUiScale } from '../../ui/uiScale';

interface KeybindingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKeymap: KeymapConfig;
  onUpdateKeymap: (newKeymap: KeymapConfig) => void;
  onLogTerminal?: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
}

export const KeybindingSettingsModal: React.FC<KeybindingSettingsModalProps> = ({
  isOpen,
  onClose,
  currentKeymap,
  onUpdateKeymap,
  onLogTerminal,
}) => {
  const [activeTab, setActiveTab] = useState<'display' | 'keybindings'>('display');
  const [keymap, setKeymap] = useState<KeymapConfig>(currentKeymap);

  const [canvasTheme, setCanvasTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('szs_canvas_theme') || 'obsidian-grid';
    } catch {
      return 'obsidian-grid';
    }
  });

  if (!isOpen) return null;

  const handleCanvasThemeChange = (theme: string) => {
    setCanvasTheme(theme);
    try {
      localStorage.setItem('szs_canvas_theme', theme);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  const handleSave = () => {
    saveStoredKeymap(keymap);
    onUpdateKeymap(keymap);
    try {
      localStorage.setItem('szs_canvas_theme', canvasTheme);


      window.dispatchEvent(new Event('storage'));
    } catch {}
    onLogTerminal?.('Bridge display ergonomics and keybinding matrix saved.', 'action');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-mono select-none">
      <div className="w-full max-w-xl rounded-xl border-2 border-[#E0CA3C] bg-[#020500] p-5 shadow-[0_0_50px_rgba(224,202,60,0.35)] text-[#DDFBD0] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#086375] pb-2 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-gear text-[#E0CA3C]" />
            <h2 className="font-display font-bold text-sm text-[#E0CA3C] tracking-wide">
              SYSTEM SETTINGS & ERGONOMICS ENGINE
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-xs text-[#FE5F00] hover:text-white px-2 py-0.5 rounded border border-[#FE5F00]/40 font-bold cursor-pointer"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* 2 Unified Tabs */}
        <div className="flex border-b border-[#086375]/50 mb-3 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('display')}
            className={`flex-1 py-1.5 text-center font-bold transition-colors cursor-pointer ${
              activeTab === 'display'
                ? 'border-b-2 border-[#E0CA3C] text-[#E0CA3C] bg-[#E0CA3C]/10'
                : 'text-[#DDFBD0]/60 hover:text-[#DDFBD0]'
            }`}
          >
            <i className="fa-solid fa-sliders mr-1.5" />
            TAB 1: DISPLAY & ERGONOMICS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('keybindings')}
            className={`flex-1 py-1.5 text-center font-bold transition-colors cursor-pointer ${
              activeTab === 'keybindings'
                ? 'border-b-2 border-[#E0CA3C] text-[#E0CA3C] bg-[#E0CA3C]/10'
                : 'text-[#DDFBD0]/60 hover:text-[#DDFBD0]'
            }`}
          >
            <i className="fa-solid fa-keyboard mr-1.5" />
            TAB 2: KEYBINDINGS & RTS GROUPS
          </button>
        </div>

        {/* Tab 1: Display & Ergonomics */}
        {activeTab === 'display' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs custom-scrollbar">
            <div className="p-3 rounded-lg border border-[#086375]/60 bg-[#086375]/10">
              <UiScaleControl />
              <p className="mt-1 text-hud-2 text-[#DDFBD0]/55">Makes all HUD text and panels bigger (100-125%). The Solar canvas keeps its own zoom.</p>
            </div>
            {/* Owner 2026-11-06: console scale + per-bay widths restored (live, kept per browser). */}
            <DockLayoutControls />

            {/* Reactive Canvas Background Theme Selector */}
            <div className="p-3 rounded-lg border border-[#086375]/60 bg-[#086375]/10 space-y-1.5">
              <span className="font-bold block text-[#E0CA3C]">Canvas Background Environment:</span>
              <div className="grid grid-cols-3 gap-2 text-hud-4">
                <button
                  type="button"
                  onClick={() => handleCanvasThemeChange('obsidian-grid')}
                  className={`py-1.5 rounded border transition-colors cursor-pointer ${
                    canvasTheme === 'obsidian-grid'
                      ? 'border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C] font-bold'
                      : 'border-[#086375] bg-[#020500] text-[#DDFBD0]/70'
                  }`}
                >
                  OBSIDIAN GRID
                </button>
                <button
                  type="button"
                  onClick={() => handleCanvasThemeChange('tactical-hex')}
                  className={`py-1.5 rounded border transition-colors cursor-pointer ${
                    canvasTheme === 'tactical-hex'
                      ? 'border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C] font-bold'
                      : 'border-[#086375] bg-[#020500] text-[#DDFBD0]/70'
                  }`}
                >
                  TACTICAL HEX
                </button>
                <button
                  type="button"
                  onClick={() => handleCanvasThemeChange('void')}
                  className={`py-1.5 rounded border transition-colors cursor-pointer ${
                    canvasTheme === 'void'
                      ? 'border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C] font-bold'
                      : 'border-[#086375] bg-[#020500] text-[#DDFBD0]/70'
                  }`}
                >
                  ABSOLUTE VOID
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Keybindings & RTS Groups */}
        {activeTab === 'keybindings' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs custom-scrollbar">
            <div className="p-3 rounded-lg border border-[#086375]/60 bg-[#086375]/10">
              <span className="font-bold block text-[#E0CA3C] mb-2">Tactical Macro Pad (Q..C):</span>
              <div className="grid grid-cols-3 gap-2">
                {(['Q', 'W', 'E', 'A', 'S', 'D', 'Z', 'X', 'C'] as const).map((key) => (
                  <div key={key} className="flex items-center justify-between border border-[#086375]/50 bg-[#020500] p-1.5 rounded">
                    <span className="font-bold text-[#E0CA3C]">{key}:</span>
                    <input
                      type="text"
                      maxLength={1}
                      value={keymap.macroPad[key]}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        if (val) setKeymap((prev) => ({ ...prev, macroPad: { ...prev.macroPad, [key]: val } }));
                      }}
                      className="w-8 text-center bg-[#086375]/20 border border-[#086375] rounded text-white font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#086375]/60 bg-[#086375]/10 space-y-1">
              <span className="font-bold block text-[#E0CA3C]">RTS Control Groups (StarCraft Style):</span>
              <p className="text-hud-3 text-[#DDFBD0]/60">
                • <strong className="text-white">Shift + 1..9:</strong> Bind the selected client to that group slot.
              </p>
              <p className="text-hud-3 text-[#DDFBD0]/60">
                • <strong className="text-white">1..9:</strong> Jump to that group&apos;s client in Solar. 0 clears.
              </p>
              <p className="text-hud-3 text-[#DDFBD0]/60">
                • <strong className="text-white">Backspace:</strong> Back one level. <strong className="text-white">Ctrl + K:</strong> command palette. <strong className="text-white">F1:</strong> this window.
              </p>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-between border-t border-[#086375] pt-3 mt-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              saveDockLayout(DEFAULT_DOCK_LAYOUT);
              applyUiScale(1);
              handleCanvasThemeChange('obsidian-grid');
            }}
            className="text-hud-3 text-[#DDFBD0]/60 hover:text-white underline cursor-pointer"
          >
            Reset Defaults
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded border border-[#086375] text-[#DDFBD0]/70 hover:bg-[#086375]/20 transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1 rounded bg-[#E0CA3C] text-black font-bold hover:brightness-110 transition-all cursor-pointer text-xs shadow-[0_0_12px_rgba(224,202,60,0.4)]"
            >
              SAVE CONFIG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
