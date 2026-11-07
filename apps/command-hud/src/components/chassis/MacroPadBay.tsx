import React from 'react';
import { CommandKey, ViewportContext, ClientRecord } from '../../types';
import { useMacroPad } from '../../hooks/useMacroPad';

interface MacroPadBayProps {
  onTriggerCommand: (key: CommandKey) => void;
  context?: ViewportContext;
  selectedClient?: ClientRecord | null;
  controlGroups?: Record<number, string[]>;
  activeGroupNum?: number | null;
  onRecallControlGroup?: (group: number) => void;
}

export const MacroPadBay: React.FC<MacroPadBayProps> = ({
  onTriggerCommand,
  context = 'GLOBAL',
  selectedClient = null,
}) => {
  const { abilities } = useMacroPad(context, selectedClient, onTriggerCommand);

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs font-mono select-none">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between border-b border-[#086375]/40 pb-1.5 shrink-0 px-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <h2 className="font-display text-sm font-bold text-[#DDFBD0] truncate">
            {context === 'CLIENT_WORKBENCH' ? 'Client Macro Pad' : 'Global Macro Pad'}
          </h2>
          {context === 'CLIENT_WORKBENCH' && (
            <span className="text-hud-1 px-1 py-0.2 rounded bg-[#5F0F40] text-[#E0CA3C] font-bold shrink-0">
              TIER 2
            </span>
          )}
        </div>
        <span className="text-hud-2 text-[#DDFBD0]/60 shrink-0">KEYS Q–C</span>
      </div>

      {/* 3x3 Tactile Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-1.5 p-0.5">
        {abilities.map((command) => (
          <button
            key={command.key}
            onClick={() => onTriggerCommand(command.key)}
            disabled={command.disabled}
            className={`szs-keycap has-art group relative flex min-h-0 flex-col items-center justify-center rounded-lg border p-1 text-center text-[#DDFBD0] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.2),inset_-1px_-1px_3px_rgba(0,0,0,0.8),0_2px_6px_rgba(0,0,0,0.7)] transition-all active:border-[#FE5F00] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${
              context === 'CLIENT_WORKBENCH'
                ? 'border-[#5F0F40] bg-gradient-to-br from-[#2a1325] via-[#150a12] to-[#020500] hover:border-[#E0CA3C] hover:shadow-[0_0_10px_rgba(224,202,60,0.35)]'
                : 'border-[#086375] bg-gradient-to-br from-[#284638] via-[#10251b] to-[#020500] hover:border-[#E0CA3C] hover:shadow-[0_0_10px_rgba(224,202,60,0.35)]'
            }`}
            title={`${command.action} (${command.description}) — [${command.key}]`}
          >
            <span className="absolute right-1 top-0.5 rounded-xs border border-[#086375] bg-[#020500]/90 px-1 font-mono text-hud-1 font-bold text-[#E0CA3C]">
              {command.key}
            </span>
            <i className={`${command.icon} mb-0.5 text-sm ${context === 'CLIENT_WORKBENCH' ? 'text-[#E0CA3C]' : 'text-[#FE5F00]'} group-hover:text-[#DDFBD0]`} />
            <span className="font-accent text-hud-3 leading-tight truncate max-w-[72px]">
              {command.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
