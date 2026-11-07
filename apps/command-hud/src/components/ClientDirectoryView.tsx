import React, { useMemo, useState } from 'react';
import { ClientUnit } from '../types';

interface ClientDirectoryViewProps {
  units: ClientUnit[];
  onSelectUnit: (id: string) => void;
  onUpdateUnit: (unit: ClientUnit) => void;
  onNavigateToDashboard: () => void;
  onLogTerminal: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
  onOpenIntake: () => void;
}

export const ClientDirectoryView: React.FC<ClientDirectoryViewProps> = ({
  units,
  onSelectUnit,
  onUpdateUnit,
  onNavigateToDashboard,
  onLogTerminal,
  onOpenIntake,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredClients = useMemo(
    () =>
      units.filter((client) =>
        `${client.name} ${client.serviceArea} ${client.currentMilestone} ${client.pipelineStage}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [units, searchTerm]
  );
  const pipelineValue = units.reduce((sum, client) => sum + (client?.ContractValue ?? client?.contractValue ?? 0), 0);
  const blockedCount = units.filter((client) => Boolean(client.roadblock)).length;

  const handleAdvanceMilestone = (client: ClientUnit) => {
    if (client.completedMilestones >= client.totalMilestones) return;
    const completedMilestones = client.completedMilestones + 1;
    const projectComplete = completedMilestones >= client.totalMilestones;
    const updatedClient = {
      ...client,
      completedMilestones,
      currentMilestone: projectComplete ? 'Project complete' : `Milestone ${completedMilestones + 1}`,
      pipelineStage: projectComplete ? '04: Liftoff' : client.pipelineStage,
      posX: projectComplete ? 785 : client.posX,
    };
    onUpdateUnit(updatedClient);
    onLogTerminal(`Milestone Advanced: ${client.name} moved to ${updatedClient.currentMilestone}.`, 'action');
  };

  const handleClearRoadblock = (client: ClientUnit) => {
    if (!client.roadblock) return;
    onUpdateUnit({ ...client, roadblock: '' });
    onLogTerminal(`Roadblock cleared for ${client.name}.`, 'action');
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-bg-obsidian px-5 py-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-alert-orange">Client relationships</p>
            <h1 className="font-display text-2xl font-bold text-text-mana">Client Directory</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onOpenIntake}
              className="rounded-lg bg-alert-orange px-4 py-2 font-accent text-bg-obsidian"
            >
              New project onboarding
            </button>
            <button
              onClick={              onNavigateToDashboard}
              className="rounded-lg border border-accent-teal px-4 py-2 font-accent text-text-mana hover:border-alert-orange"
            >
              Open dashboard
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-accent-teal bg-primary-plum/35 p-4">
            <div className="font-mono text-xs text-text-mana/65">CLIENTS</div>
            <div className="font-display text-2xl text-text-mana">{units.length}</div>
          </div>
          <div className="rounded-xl border border-accent-teal bg-primary-plum/35 p-4">
            <div className="font-mono text-xs text-text-mana/65">CONTRACT VALUE</div>
            <div className="font-display text-2xl text-text-mana">${pipelineValue.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-accent-teal bg-primary-plum/35 p-4">
            <div className="font-mono text-xs text-text-mana/65">OPEN ROADBLOCKS</div>
            <div className="font-display text-2xl text-alert-orange">{blockedCount}</div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-text-mana">All clients</h2>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search clients..."
            aria-label="Search clients"
            className="w-full max-w-xs rounded-lg border border-accent-teal bg-primary-plum/35 px-3 py-2 text-sm text-text-mana placeholder:text-text-mana/45 focus:border-alert-orange focus:outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-accent-teal">
          <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] gap-3 bg-primary-plum px-4 py-2 font-mono text-hud-3 uppercase text-text-mana/65 md:grid">
            <span>Client</span><span>Pipeline stage</span><span>Milestone</span><span>Contract</span><span>Roadblock</span><span>Actions</span>
          </div>
          {filteredClients.map((client) => (
            <div key={client.id} className="grid gap-3 border-t border-accent-teal/40 bg-bg-obsidian/80 p-4 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] md:items-center">
              <button
                onClick={() => {
                  onSelectUnit(client.id);
                  onNavigateToDashboard();
                }}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-plum font-display text-xs text-alert-orange">{client.avatar}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-text-mana">{client.name}</span>
                  <span className="block truncate text-xs text-text-mana/60">{client.serviceArea}</span>
                </span>
              </button>
              <span className="text-sm text-text-mana">{client.pipelineStage}</span>
              <span className="text-sm text-text-mana">{client.currentMilestone} · {client.completedMilestones}/{client.totalMilestones}</span>
              <span className="text-sm text-text-mana">
                ${(client?.ContractValue ?? client?.contractValue ?? 0).toLocaleString()}
                <span className="ml-1 text-xs text-text-mana/55">{client.depositPaid ? 'deposit paid' : 'deposit due'}</span>
              </span>
              <span className="truncate text-sm text-text-mana/70">{client.roadblock || 'None'}</span>
              <div className="flex gap-2 md:flex-col">
                <button
                  onClick={() => handleAdvanceMilestone(client)}
                  disabled={client.completedMilestones >= client.totalMilestones}
                  className="rounded border border-accent-teal px-2 py-1 text-xs text-text-mana hover:border-alert-orange disabled:opacity-40"
                >
                  Advance
                </button>
                <button
                  onClick={() => handleClearRoadblock(client)}
                  disabled={!client.roadblock}
                  className="rounded border border-accent-teal px-2 py-1 text-xs text-text-mana hover:border-alert-orange disabled:opacity-40"
                >
                  Clear blocker
                </button>
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="bg-bg-obsidian/80 p-8 text-center text-sm text-text-mana/60">No clients match your search.</div>
          )}
        </div>
      </div>
    </main>
  );
};
