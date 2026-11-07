import React from 'react';
import { COMMAND_ABILITIES } from '../data/initialFleet';
import { CommandKey } from '../types';

interface MacroMatrixViewProps {
  onTriggerCommand: (key: CommandKey) => void;
  onNavigateToDashboard: () => void;
}

export const MacroMatrixView: React.FC<MacroMatrixViewProps> = ({
  onTriggerCommand,
  onNavigateToDashboard,
}) => (
  <main className="min-h-0 flex-1 overflow-y-auto bg-bg-obsidian p-5">
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-alert-orange">Google Workspace</p>
          <h1 className="font-display text-2xl font-bold text-text-mana">Workspace Actions</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNavigateToDashboard}
            className="rounded-lg bg-alert-orange px-4 py-2 font-accent text-bg-obsidian"
          >
            Open dashboard
          </button>
        </div>
      </div>

      <p className="mb-4 max-w-2xl text-sm text-text-mana/70">
        Use a button or its keyboard shortcut to start a common client workflow. Actions open the related draft, notes, or onboarding flow.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {COMMAND_ABILITIES.map((command) => (
          <button
            key={command.key}
            onClick={() => {
              if (command.disabled) return;
              onTriggerCommand(command.key);
            }}
            disabled={command.disabled}
            className="group relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-accent-teal bg-primary-plum/35 p-4 text-center transition-colors hover:border-alert-orange hover:bg-primary-plum disabled:cursor-not-allowed disabled:opacity-45"
            title={`${command.description} (${command.key})`}
          >
            <span className="absolute right-3 top-2 font-mono text-xs text-alert-orange">{command.key}</span>
            <i className={`${command.icon} text-2xl text-alert-orange group-hover:text-text-mana`} />
            <span className="font-display text-sm font-bold text-text-mana">{command.label}</span>
            <span className="text-xs text-text-mana/60">{command.description}</span>
          </button>
        ))}
      </div>
    </div>
  </main>
);
