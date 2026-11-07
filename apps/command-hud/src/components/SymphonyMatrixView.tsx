import React, { useState } from 'react';
import { ClientUnit } from '../types';

interface SymphonyMatrixViewProps {
  units: ClientUnit[];
  activeUnit: ClientUnit | null;
  onSelectUnit: (id: string) => void;
  onNavigateToDashboard: () => void;
  onLogTerminal: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
}

interface SprintMilestone {
  day: number;
  label: string;
  department: string;
  deliverable: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'QUEUED' | 'LOCKED';
}

export const SymphonyMatrixView: React.FC<SymphonyMatrixViewProps> = ({
  units,
  activeUnit,
  onNavigateToDashboard,
  onLogTerminal,
}) => {
  const currentClient = activeUnit || units[0] || null;
  const [selectedDay, setSelectedDay] = useState<number>(15);

  const milestones: SprintMilestone[] = [
    { day: 1, label: 'Stage 00-01: Discovery & Pitch', department: 'Alfred', deliverable: 'Scouting dossier, discovery intake call', status: 'COMPLETED' },
    { day: 5, label: 'Stage 02: Contract & Inception', department: 'Pamela', deliverable: 'MSA signed, 50% mobilization deposit invoice', status: currentClient?.depositPaid ? 'COMPLETED' : 'IN_PROGRESS' },
    { day: 10, label: 'Stage 03: Deep Intelligence', department: 'Oracle', deliverable: 'Competitor radar, KGR extraction, case_file.json', status: 'COMPLETED' },
    { day: 15, label: 'Stage 04: Session Zero Kickoff', department: 'Dolores', deliverable: 'Shared Chat Space, kickoff meeting notes doc', status: 'IN_PROGRESS' },
    { day: 25, label: 'Stage 05: Core Architecture & Builds', department: 'Symphony', deliverable: 'Database schemas, automated pipelines, UI scaffolds', status: 'QUEUED' },
    { day: 35, label: 'Stage 06: Mid-Flight Review', department: 'Vala', deliverable: 'Milestone 2 demonstration, mid-term invoice draft', status: 'QUEUED' },
    { day: 40, label: 'Stage 07: Final Staging & QA', department: 'Alfred Police', deliverable: 'End-to-end integration smoke tests & permission audit', status: 'LOCKED' },
    { day: 45, label: 'Stage 08: Liftoff & Handover', department: 'Daisy', deliverable: 'Staff video walkthrough, Google Group access, production sign-off', status: 'LOCKED' },
  ];

  const tasks = [
    { id: 'TSK-101', title: 'Initialize Google Group client-{id}@sessionzero.solutions', done: true, assignee: 'Dolores' },
    { id: 'TSK-102', title: 'Provision Dual Google Chat Spaces (Internal War Room + Client Delegation)', done: Boolean(currentClient?.chatSpaceUrl), assignee: 'Dolores' },
    { id: 'TSK-103', title: 'Scaffold 45-day Session Zero Notes Roadmap document', done: Boolean(currentClient?.notesDocUrl), assignee: 'Dolores' },
    { id: 'TSK-104', title: 'Verify DepositPaid in Master Control Finances sheet', done: Boolean(currentClient?.depositPaid), assignee: 'Vala' },
    { id: 'TSK-105', title: 'Connect Google Tasks API punch list for Stage 02 entry', done: true, assignee: 'Alfred' },
  ];

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-bg-obsidian text-text-mana p-4 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent-teal/60 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary-plum animate-pulse-glow" />
            <p className="font-mono text-xs uppercase tracking-widest text-highlight-gold">Dolores Sub-Routine // Delivery Cadence</p>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-text-mana">Symphony Matrix // 45-Day Sprint Roadmap</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="flex items-center gap-1.5 rounded border border-accent-teal px-3 py-1.5 font-display text-xs text-text-mana hover:bg-accent-teal/20"
          >
            <i className="fa-solid fa-diagram-project" />
            <span>Return to Tactical Canvas</span>
          </button>
        </div>
      </div>

      {/* Target Client Bar */}
      <div className="mb-4 flex items-center justify-between p-3 rounded-lg border border-accent-teal/40 bg-primary-plum/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-highlight-gold bg-bg-obsidian font-display font-bold text-highlight-gold">
            {currentClient?.avatar || 'SZ'}
          </div>
          <div>
            <span className="font-display text-sm font-bold text-text-mana">
              {currentClient?.companyName || currentClient?.name || 'Active Client'}
            </span>
            <span className="block font-mono text-hud-3 text-text-mana/60">
              Stage: {currentClient?.pipelineStage || '04: Session Zero Kickoff'} · Lead: {currentClient?.primaryContact || 'Drake Austin'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLogTerminal(`Dolores generated Google Tasks sprint punchlist for ${currentClient?.id}.`, 'action')}
            className="rounded border border-accent-teal px-3 py-1 font-mono text-xs text-highlight-gold hover:bg-accent-teal/20"
          >
            <i className="fa-solid fa-sync mr-1.5" />
            Sync Tasks API Hook
          </button>
        </div>
      </div>

      {/* 45-Day Interactive Gantt Timeline */}
      <div className="mb-6 rounded-xl border border-accent-teal bg-primary-plum/20 p-4">
        <h2 className="font-display text-sm font-bold text-highlight-gold uppercase mb-3 flex items-center justify-between">
          <span>45-Day Sprint Cadence Pipeline</span>
          <span className="font-mono text-xs text-text-mana/60">DAY 01 → DAY 45</span>
        </h2>

        {/* Timeline Visual Track */}
        <div className="relative mb-6 pt-2">
          <div className="h-2 w-full bg-bg-obsidian rounded-full overflow-hidden border border-accent-teal/30">
            <div className="h-full bg-gradient-to-r from-accent-teal via-highlight-gold to-alert-orange" style={{ width: '42%' }} />
          </div>

          <div className="grid grid-cols-8 gap-2 mt-3">
            {milestones.map((m) => {
              const isSelected = selectedDay === m.day;
              return (
                <button
                  key={m.day}
                  type="button"
                  onClick={() => setSelectedDay(m.day)}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all text-center ${
                    isSelected
                      ? 'border-highlight-gold bg-primary-plum/80 shadow-[0_0_10px_rgba(224,202,60,0.3)]'
                      : 'border-accent-teal/30 bg-bg-obsidian/60 hover:border-accent-teal'
                  }`}
                >
                  <span className="font-mono text-hud-3 text-highlight-gold font-bold">DAY {String(m.day).padStart(2, '0')}</span>
                  <span className="font-display text-hud-4 text-text-mana mt-1 truncate w-full" title={m.label}>{m.label.split(':')[1] || m.label}</span>
                  <span className={`mt-1.5 px-1 rounded text-hud-1 font-mono font-bold ${
                    m.status === 'COMPLETED' ? 'bg-text-mana/20 text-text-mana' :
                    m.status === 'IN_PROGRESS' ? 'bg-highlight-gold/20 text-highlight-gold' :
                    'bg-accent-teal/20 text-text-mana/40'
                  }`}>
                    {m.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Milestone Detail */}
        {milestones.find((m) => m.day === selectedDay) && (
          <div className="p-3 rounded-lg bg-bg-obsidian border border-accent-teal/50 font-mono text-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-highlight-gold font-bold">Milestone Focus: </span>
              <span>{milestones.find((m) => m.day === selectedDay)?.label}</span>
              <p className="text-text-mana/70 text-hud-4 mt-0.5">
                Deliverable: {milestones.find((m) => m.day === selectedDay)?.deliverable}
              </p>
            </div>
            <span className="text-hud-3 text-accent-teal">
              Orchestrating Sub-Routine: {milestones.find((m) => m.day === selectedDay)?.department}
            </span>
          </div>
        )}
      </div>

      {/* Task Checklist & Integration Hook */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-accent-teal bg-primary-plum/20 p-4">
          <div className="flex items-center justify-between mb-3 border-b border-accent-teal/40 pb-2">
            <h3 className="font-display text-sm font-bold text-text-mana">Google Tasks Live Punch List</h3>
            <span className="font-mono text-hud-3 text-highlight-gold">LIST ID: {currentClient?.taskListId || 'TL-DEFAULT'}</span>
          </div>

          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded bg-bg-obsidian border border-accent-teal/30 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${t.done ? 'fa-circle-check text-highlight-gold' : 'fa-circle text-text-mana/30'}`} />
                  <span className={t.done ? 'line-through text-text-mana/60' : 'text-text-mana'}>{t.title}</span>
                </div>
                <span className="text-hud-3 text-accent-teal px-1.5 py-0.5 rounded bg-primary-plum">{t.assignee}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-accent-teal bg-primary-plum/20 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-accent-teal/40 pb-2">
              <h3 className="font-display text-sm font-bold text-text-mana">Dual Chat Space Provisioning Status</h3>
              <span className="font-mono text-hud-3 text-text-mana/60">GOOGLE WORKSPACE API</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded bg-bg-obsidian border border-accent-teal/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-highlight-gold">1. Internal War Room Space</span>
                  <span className="text-text-mana text-hud-3">SZS-OPERATORS ONLY</span>
                </div>
                <p className="text-hud-4 text-text-mana/70">
                  Secure tactical channel for Drake, Dolores, and bot dispatch webhooks.
                </p>
              </div>

              <div className="p-3 rounded bg-bg-obsidian border border-accent-teal/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-highlight-gold">2. Client Delegation Space</span>
                  <span className="text-text-mana text-hud-3">CLIENT SHARED</span>
                </div>
                <p className="text-hud-4 text-text-mana/70">
                  External collaboration portal for {currentClient?.companyName || 'the client team'} and meeting recaps.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onLogTerminal(`Dual Chat Spaces pinged for ${currentClient?.id}.`, 'action')}
            className="mt-4 w-full rounded border border-accent-teal bg-accent-teal/20 py-2 font-display text-xs font-bold text-text-mana hover:bg-accent-teal/30 transition-colors"
          >
            <i className="fa-solid fa-comments mr-1.5" />
            Launch Google Chat Delegation Portal
          </button>
        </div>
      </div>
    </main>
  );
};
