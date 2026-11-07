import React, { useEffect, useRef, useState } from 'react';
import type { AccountPhase, ClientRecord, SprintStage } from '../../types';
import type { AlfredAlert } from '../../types';
import type { ProjectTaskSummary } from '../../data/api';
import { ACCOUNT_PHASES, SPRINT_STAGES, deriveAccountPhase } from '../../data/pipeline';
import { GalaxyBoardView } from './GalaxyBoardView';

type BoardLevel = 'universe' | 'galaxy';

interface UniverseGalaxyViewProps {
  level: BoardLevel;
  clients: ClientRecord[];
  alerts: AlfredAlert[];
  selectedClientId: string | null;
  galaxyZoom: number;
  setGalaxyZoom: (scale: number | ((prev: number) => number)) => void;
  resetRequest: number;
  manuallySetClientIds: ReadonlySet<string>;
  moveMode: 'snapshot' | 'live' | 'readonly';
  canMove: boolean;
  pendingWriteKeys: ReadonlySet<string>;
  projectTaskSummaries: Readonly<Record<string, ProjectTaskSummary>>;
  pendingTaskReads: ReadonlySet<string>;
  projectTaskReadErrors: Readonly<Record<string, string>>;
  onSelectClient: (clientId: string) => void;
  onOpenGalaxy: (clientId: string) => void;
  onOpenSolar: (clientId: string, projectId: string) => void;
  onSetAccountPhase: (clientId: string, phase: AccountPhase) => void | Promise<void>;
  onResetAccountPhase: (clientId: string) => void | Promise<void>;
  onSetSprintStage: (projectId: string, stage: SprintStage) => void | Promise<void>;
  onLoadProjectTasks: (projectId: string) => void | Promise<void>;
  /** Phase G3: right-click a card for the client actions menu (reports). */
  onOpenClientMenu?: (x: number, y: number, clientId: string, projectId?: string) => void;
}

const PHASE_COLORS: Record<AccountPhase, string> = {
  '01: Intake': '#086375',
  '02: Session Zero': '#3C91E6',
  '03: Active Sprints': '#5F0F40',
  '04: Liftoff': '#E0CA3C',
  '05: Complete': '#7B8794',
  '06: Archived/Sunset': '#FE5F00',
};

const COLLAPSED_PHASES: readonly AccountPhase[] = ['05: Complete', '06: Archived/Sunset'];

function displayedPhase(client: ClientRecord, isManual: boolean): AccountPhase {
  return isManual || client.AccountPhase_Mode === 'manual'
    ? client.AccountPhase
    : deriveAccountPhase(client.activeProjects, client.AccountPhase);
}

function advancedProject(client: ClientRecord): ClientRecord['activeProjects'][number] | undefined {
  return [...client.activeProjects].sort((a, b) => Number(b.SprintStage.slice(0, 2)) - Number(a.SprintStage.slice(0, 2)))[0];
}

/** Plan v3.1 E6: open / total tasks across a client's projects that have a Google Tasks list. */
export function clientTaskCount(
  client: ClientRecord,
  summaries: Readonly<Record<string, ProjectTaskSummary>>,
  pending: ReadonlySet<string>,
): string {
  const listed = client.activeProjects.filter((project) => project.Google_Tasklist_ID);
  if (listed.length === 0) return 'No list';
  const loaded = listed.map((project) => summaries[project.ProjectID]).filter(Boolean);
  if (loaded.length === 0) return listed.some((project) => pending.has(project.ProjectID)) ? 'Reading…' : '—';
  const open = loaded.reduce((sum, summary) => sum + summary.open, 0);
  const total = loaded.reduce((sum, summary) => sum + summary.total, 0);
  return `${open} / ${total}${loaded.length < listed.length ? '+' : ''}`;
}

/**
 * Owner decision 2026-11-05: Universe shows one card per PROJECT, in the phase its stage belongs to, so a client with
 * one project in Sunset/Retainer and another in Active Sprints appears in both columns. A client set to Complete or
 * Sunset as a whole keeps all its projects there; clients without projects keep a client card.
 */
export type UniverseCard =
  | { key: string; kind: 'client'; client: ClientRecord; phase: AccountPhase; first: true }
  | { key: string; kind: 'project'; client: ClientRecord; project: ClientRecord['activeProjects'][number]; phase: AccountPhase; first: boolean };

export function projectPhase(stage: SprintStage): AccountPhase {
  return SPRINT_STAGES.find((entry) => entry.stage === stage)?.phaseGrouping ?? '01: Intake';
}

/** Where a project card dropped on a phase column goes: that phase's first stage (Complete is client-level). */
export const PHASE_ENTRY_STAGE: Partial<Record<AccountPhase, SprintStage>> = {
  '01: Intake': '00: Discovery',
  '02: Session Zero': '02: Contract & Inception',
  '03: Active Sprints': '05: Architecture & Builds',
  '04: Liftoff': '08: Liftoff & Handover',
  '06: Archived/Sunset': '09: Sunset / Retainer',
};

export function universeCards(clients: readonly ClientRecord[], manuallySetClientIds: ReadonlySet<string>): UniverseCard[] {
  return clients.flatMap((client): UniverseCard[] => {
    const clientPhase = displayedPhase(client, manuallySetClientIds.has(client.ClientID));
    if (client.activeProjects.length === 0) return [{ key: `client:${client.ClientID}`, kind: 'client', client, phase: clientPhase, first: true }];
    const wholeClient = (client.AccountPhase_Mode === 'manual' || manuallySetClientIds.has(client.ClientID))
      && (client.AccountPhase === '05: Complete' || client.AccountPhase === '06: Archived/Sunset');
    return client.activeProjects.map((project, index) => ({
      key: `project:${project.ProjectID}`,
      kind: 'project' as const,
      client,
      project,
      phase: wholeClient ? client.AccountPhase : projectPhase(project.SprintStage),
      first: index === 0,
    }));
  });
}

function openAlertCount(alerts: AlfredAlert[], clientId: string): number {
  return alerts.filter((alert) => alert.clientId === clientId && !alert.dismissed).length;
}

export const UniverseGalaxyView: React.FC<UniverseGalaxyViewProps> = ({
  level,
  clients,
  alerts,
  selectedClientId,
  galaxyZoom,
  setGalaxyZoom,
  resetRequest,
  manuallySetClientIds,
  moveMode,
  canMove,
  pendingWriteKeys,
  projectTaskSummaries,
  pendingTaskReads,
  projectTaskReadErrors,
  onSelectClient,
  onOpenGalaxy,
  onOpenSolar,
  onSetAccountPhase,
  onResetAccountPhase,
  onSetSprintStage,
  onLoadProjectTasks,
  onOpenClientMenu,
}) => {
  // Owner 2026-11-05: Complete/Sunset start collapsed only while empty, so a client moved there stays visible.
  const [collapsedPhases, setCollapsedPhases] = useState<Set<AccountPhase>>(
    () => new Set(COLLAPSED_PHASES.filter((phase) => !universeCards(clients, manuallySetClientIds).some((card) => card.phase === phase))),
  );
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  // Owner 2026-11-05: a client moved into a collapsed column (e.g. Sunset) opens that column so the card stays visible.
  const membershipRef = useRef<Record<string, AccountPhase>>({});
  useEffect(() => {
    const next: Record<string, AccountPhase> = {};
    const arrived = new Set<AccountPhase>();
    universeCards(clients, manuallySetClientIds).forEach((card) => {
      next[card.key] = card.phase;
      const before = membershipRef.current[card.key];
      if (before && before !== card.phase) arrived.add(card.phase);
    });
    membershipRef.current = next;
    if (arrived.size) {
      setCollapsedPhases((current) => {
        if (![...arrived].some((phase) => current.has(phase))) return current;
        const updated = new Set(current);
        arrived.forEach((phase) => updated.delete(phase));
        return updated;
      });
    }
  }, [clients, manuallySetClientIds]);

  const cards = universeCards(clients, manuallySetClientIds);

  /** A project's card in Universe (client name on it; ⋮ opens the client menu with this project's stage moves). */
  const renderProjectCard = (card: Extract<UniverseCard, { kind: 'project' }>, phase: AccountPhase) => {
    const { client, project } = card;
    const isManual = manuallySetClientIds.has(client.ClientID) || client.AccountPhase_Mode === 'manual';
    const isSaving = pendingWriteKeys.has(`project:${project.ProjectID}`) || pendingWriteKeys.has(`client:${client.ClientID}`);
    const summary = projectTaskSummaries[project.ProjectID];
    const contractMismatch = card.first && client.ContractValueSource === 'finances' && client.SheetContractValue !== undefined
      && Math.round(client.SheetContractValue * 100) !== Math.round(client.ContractValue * 100);
    return (
      <article
        key={card.key}
        draggable={canMove && !isSaving}
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-hud-project', project.ProjectID);
          event.dataTransfer.setData('text/plain', '');
          event.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => onSelectClient(client.ClientID)}
        onDoubleClick={() => onOpenSolar(client.ClientID, project.ProjectID)}
        onContextMenu={onOpenClientMenu ? (event) => { event.preventDefault(); onOpenClientMenu(event.clientX, event.clientY, client.ClientID, project.ProjectID); } : undefined}
        className={`cursor-pointer rounded-lg border bg-[#020500] p-2 transition-colors hover:bg-[#0b1812] ${selectedClientId === client.ClientID ? 'ring-1 ring-[#E0CA3C]' : ''}`}
        style={{ borderColor: `${PHASE_COLORS[phase]}88` }}
        title={`Double-click to open ${project.ProjectID} in Solar. Drag to another phase to move this project.`}
        aria-label={`Project ${project.ProjectID}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-hud-4 font-bold">{project.Title || project.ProjectID}</h3>
            <p className="truncate text-hud-2 text-[#E0CA3C]">{client.Company_Name || client.ClientID} · {project.ProjectID}</p>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <span className="shrink-0 rounded px-1.5 py-0.5 text-hud-1" style={{ color: PHASE_COLORS[phase], backgroundColor: `${PHASE_COLORS[phase]}20` }}>
              {isSaving ? 'SAVING…' : project.SprintStage.slice(0, 2)}
            </span>
            {onOpenClientMenu && (
              <button
                type="button"
                aria-label={`Actions for ${client.Company_Name || client.ClientID} ${project.ProjectID}`}
                title="Project and client actions (move stage, Sunset, status, invoice, OSINT)."
                onClick={(event) => { event.stopPropagation(); const r = event.currentTarget.getBoundingClientRect(); onOpenClientMenu(r.left, r.bottom + 4, client.ClientID, project.ProjectID); }}
                onDoubleClick={(event) => event.stopPropagation()}
                className="shrink-0 rounded border border-[#086375]/60 px-1.5 text-[0.85rem] font-bold leading-none text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C]"
              >
                ⋮
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-hud-2 text-[#DDFBD0]/75">
          <span>Stage</span><strong className="truncate text-right">{project.SprintStage}</strong>
          <span>Contract (client)</span><strong className="text-right">${client.ContractValue.toLocaleString()}</strong>
          <span>Deposit</span><strong className="text-right">{client.DepositPaid ? 'Paid' : 'Due'}</strong>
          <span>Open tasks</span><strong className="text-right">{summary ? `${summary.open} / ${summary.total}` : project.Google_Tasklist_ID ? '…' : 'No list'}</strong>
          {card.first && <><span>Open alerts</span><strong className="text-right">{openAlertCount(alerts, client.ClientID)}</strong></>}
        </div>
        {contractMismatch && (
          <p className="mt-2 border-t border-[#E63946]/30 pt-1.5 text-hud-2 text-[#E63946]">
            Contract mismatch: Clients sheet says ${client.SheetContractValue!.toLocaleString()}; Finances says ${client.ContractValue.toLocaleString()}
          </p>
        )}
        {card.first && isManual && (
          <button
            type="button"
            disabled={!canMove || isSaving}
            onClick={(event) => { event.stopPropagation(); onResetAccountPhase(client.ClientID); }}
            title={`${client.ClientID} phase is set by hand (${client.AccountPhase}); reset lets its projects decide.`}
            className="mt-2 rounded border border-[#086375]/50 px-2 py-1 text-hud-1 text-[#DDFBD0]/70 hover:border-[#E0CA3C] disabled:cursor-wait disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : `Reset ${client.ClientID} phase to auto`}
          </button>
        )}
      </article>
    );
  };

  const dropOnPhase = (phase: AccountPhase) => (event: React.DragEvent) => {
                  event.preventDefault();
                  if (!canMove) return;
                  const projectId = event.dataTransfer.getData('application/x-hud-project');
                  if (projectId) {
                    // A project card moves its own project: to this phase's first stage; Complete is client-level.
                    const card = cards.find((item) => item.kind === 'project' && item.project.ProjectID === projectId);
                    const entry = PHASE_ENTRY_STAGE[phase];
                    if (card && card.phase !== phase) {
                      if (entry) onSetSprintStage(projectId, entry);
                      else onSetAccountPhase(card.client.ClientID, phase);
                    }
                    setDraggedClientId(null);
                    return;
                  }
                  const clientId = event.dataTransfer.getData('text/plain') || draggedClientId;
                  if (clientId) {
                    onSetAccountPhase(clientId, phase);
                    setDraggedClientId(null);
                  }
  };

  if (level === 'universe') {
    return (
      <div className="h-full overflow-auto bg-[#020500] p-3 text-[#DDFBD0]">
        {/* Owner 2026-11-06: the title/help banner took a full row for nothing; phase counts are on each column and
            money is in the top bar. Only a non-live board says so, because then moves behave differently. */}
        {moveMode !== 'live' && (
          <p role="status" className="mb-2 rounded border border-[#E0CA3C]/40 bg-[#E0CA3C]/5 px-2 py-1 text-hud-3 text-[#E0CA3C]">
            {moveMode === 'snapshot'
              ? 'Offline snapshot: moves stay in this browser and are not written to Master Control.'
              : 'Read-only: sign in to live Master Control to move cards.'}
          </p>
        )}
        <div className={`grid ${moveMode === 'live' ? 'h-full' : 'h-[calc(100%-2.25rem)]'} min-h-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6`}>
          {ACCOUNT_PHASES.map(({ phase, title }) => {
            const phaseCards = cards.filter((card) => card.phase === phase);
            const phaseClients = phaseCards;
            const isCollapsed = collapsedPhases.has(phase);
            const canCollapse = COLLAPSED_PHASES.includes(phase);
            if (isCollapsed && canCollapse) {
              return (
                <button
                  type="button"
                  key={phase}
                  onDragOver={(event) => { if (canMove) event.preventDefault(); }}
                  onDrop={dropOnPhase(phase)}
                  onClick={() => setCollapsedPhases((current) => {
                    const next = new Set(current);
                    next.delete(phase);
                    return next;
                  })}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-2 py-3 text-hud-4 font-bold text-[#DDFBD0]/80 hover:bg-[#086375]/20"
                  style={{ borderColor: `${PHASE_COLORS[phase]}99` }}
                  aria-label={`Expand ${phase}, ${phaseClients.length} clients`}
                >
                  <span aria-hidden="true">‹</span>
                  <span className="text-center">{phase}</span>
                  <span>{phaseClients.length}</span>
                </button>
              );
            }
            return (
              <section
                key={phase}
                onDragOver={(event) => {
                  if (canMove) event.preventDefault();
                }}
                onDrop={dropOnPhase(phase)}
                className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-[#06100c]/70"
                style={{ borderColor: `${PHASE_COLORS[phase]}70` }}
                aria-label={`${phase} clients`}
              >
                <header className="flex items-center justify-between gap-1 border-b bg-black/30 px-2 py-2" style={{ borderColor: `${PHASE_COLORS[phase]}50` }}>
                  <div className="min-w-0">
                    <h2 className="truncate text-hud-4 font-bold text-[#DDFBD0]">{phase}</h2>
                    <p className="truncate text-hud-1 text-[#DDFBD0]/50">{title}{phase === '05: Complete' ? ' · whole client' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-black/40 px-1.5 py-0.5 text-hud-2 font-bold">{phaseClients.length}</span>
                    {canCollapse && (
                      <button
                        type="button"
                        onClick={() => setCollapsedPhases((current) => new Set(current).add(phase))}
                        className="rounded px-1 text-[#DDFBD0]/60 hover:text-white"
                        aria-label={`Collapse ${phase}`}
                      >
                        ›
                      </button>
                    )}
                  </div>
                </header>
                <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
                  {phaseCards.map((card) => {
                    const client = card.client;
                    if (card.kind === 'project') return renderProjectCard(card, phase);
                    const project = advancedProject(client);
                    const isManual = manuallySetClientIds.has(client.ClientID)
                      || client.AccountPhase_Mode === 'manual';
                    const sheetPhase = client.SheetAccountPhase ?? client.AccountPhase;
                    const derived = deriveAccountPhase(client.activeProjects, sheetPhase);
                    const mismatch = !isManual && sheetPhase !== derived;
                    const isSaving = pendingWriteKeys.has(`client:${client.ClientID}`);
                    return (
                      <article
                        key={client.ClientID}
                        draggable={canMove && !isSaving}
                        onDragStart={(event) => {
                          setDraggedClientId(client.ClientID);
                          event.dataTransfer.setData('text/plain', client.ClientID);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDraggedClientId(null)}
                        onClick={() => onSelectClient(client.ClientID)}
                        onDoubleClick={() => onOpenGalaxy(client.ClientID)}
                        onContextMenu={onOpenClientMenu ? (event) => { event.preventDefault(); onOpenClientMenu(event.clientX, event.clientY, client.ClientID); } : undefined}
                        className={`cursor-pointer rounded-lg border bg-[#020500] p-2 transition-colors hover:bg-[#0b1812] ${selectedClientId === client.ClientID ? 'ring-1 ring-[#E0CA3C]' : ''}`}
                        style={{ borderColor: `${PHASE_COLORS[phase]}88` }}
                        title="Double-click to open this client's Galaxy"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-hud-4 font-bold">{client.Company_Name || client.ClientID}</h3>
                            <p className="text-hud-2 text-[#E0CA3C]">{client.ClientID}</p>
                          </div>
                          <div className="flex shrink-0 items-start gap-1">
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-hud-1" style={{ color: PHASE_COLORS[phase], backgroundColor: `${PHASE_COLORS[phase]}20` }}>
                              {isSaving ? 'SAVING…' : isManual ? 'MANUAL' : 'AUTO'}
                            </span>
                            {onOpenClientMenu && (
                              <button
                                type="button"
                                aria-label={`Actions for ${client.Company_Name || client.ClientID}`}
                                title="Client actions (status, invoice, OSINT, Sunset). Right-click the card works too."
                                onClick={(event) => { event.stopPropagation(); const r = event.currentTarget.getBoundingClientRect(); onOpenClientMenu(r.left, r.bottom + 4, client.ClientID); }}
                                onDoubleClick={(event) => event.stopPropagation()}
                                className="shrink-0 rounded border border-[#086375]/60 px-1.5 text-[0.85rem] font-bold leading-none text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C]"
                              >
                                ⋮
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-hud-2 text-[#DDFBD0]/75">
                          <span>Contract</span><strong className="text-right">${client.ContractValue.toLocaleString()}</strong>
                          <span>Deposit</span><strong className="text-right">{client.DepositPaid ? 'Paid' : 'Due'}</strong>
                          <span>Advanced stage</span><strong className="truncate text-right">{project?.SprintStage ?? 'No project'}</strong>
                          <span>Open alerts</span><strong className="text-right">{openAlertCount(alerts, client.ClientID)}</strong>
                          <span>Open tasks</span><strong className="text-right">{clientTaskCount(client, projectTaskSummaries, pendingTaskReads)}</strong>
                        </div>
                        {mismatch && (
                          <p className="mt-2 border-t border-[#E0CA3C]/20 pt-1.5 text-hud-2 text-[#E0CA3C]">
                            Sheet says {sheetPhase}; projects derive {derived}
                          </p>
                        )}
                        {client.ContractValueSource === 'finances'
                          && client.SheetContractValue !== undefined
                          && Math.round(client.SheetContractValue * 100) !== Math.round(client.ContractValue * 100) && (
                          <p className="mt-2 border-t border-[#E63946]/30 pt-1.5 text-hud-2 text-[#E63946]">
                            Contract mismatch: Clients sheet says ${client.SheetContractValue.toLocaleString()}; Finances says ${client.ContractValue.toLocaleString()}
                          </p>
                        )}
                        {isManual && (
                          <button
                            type="button"
                            disabled={!canMove || isSaving}
                            onClick={(event) => {
                              event.stopPropagation();
                              onResetAccountPhase(client.ClientID);
                            }}
                            className="mt-2 rounded border border-[#086375]/50 px-2 py-1 text-hud-1 text-[#DDFBD0]/70 hover:border-[#E0CA3C] disabled:cursor-wait disabled:opacity-40"
                          >
                            {isSaving ? 'Saving…' : 'Reset to auto'}
                          </button>
                        )}
                      </article>
                    );
                  })}
                  {phaseClients.length === 0 && (
                    <p className="py-4 text-center text-hud-2 text-[#DDFBD0]/35">Nothing in this phase.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <GalaxyBoardView
      clients={clients}
      selectedClientId={selectedClientId}
      manuallySetClientIds={manuallySetClientIds}
      moveMode={moveMode}
      canMove={canMove}
      pendingWriteKeys={pendingWriteKeys}
      projectTaskSummaries={projectTaskSummaries}
      pendingTaskReads={pendingTaskReads}
      projectTaskReadErrors={projectTaskReadErrors}
      galaxyZoom={galaxyZoom}
      setGalaxyZoom={setGalaxyZoom}
      resetRequest={resetRequest}
      onSelectClient={onSelectClient}
      onOpenSolar={onOpenSolar}
      onSetSprintStage={onSetSprintStage}
      onLoadProjectTasks={onLoadProjectTasks}
      onOpenClientMenu={onOpenClientMenu}
    />
  );
};
