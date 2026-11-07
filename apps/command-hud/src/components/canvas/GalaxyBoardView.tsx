import React, { useEffect, useRef, useState } from 'react';
import type { ClientRecord, SprintStage } from '../../types';
import type { ProjectTaskSummary } from '../../data/api';
import { SPRINT_STAGES, deriveAccountPhase } from '../../data/pipeline';

interface GalaxyBoardViewProps {
  clients: ClientRecord[];
  selectedClientId: string | null;
  manuallySetClientIds: ReadonlySet<string>;
  moveMode: 'snapshot' | 'live' | 'readonly';
  canMove: boolean;
  pendingWriteKeys: ReadonlySet<string>;
  projectTaskSummaries: Readonly<Record<string, ProjectTaskSummary>>;
  pendingTaskReads: ReadonlySet<string>;
  projectTaskReadErrors: Readonly<Record<string, string>>;
  galaxyZoom: number;
  setGalaxyZoom: (scale: number | ((prev: number) => number)) => void;
  resetRequest: number;
  onSelectClient: (clientId: string) => void;
  onOpenSolar: (clientId: string, projectId: string) => void;
  onSetSprintStage: (projectId: string, stage: SprintStage) => void | Promise<void>;
  onLoadProjectTasks: (projectId: string) => void | Promise<void>;
  /** Phase G3: right-click a card for the client actions menu (reports). */
  onOpenClientMenu?: (x: number, y: number, clientId: string, projectId?: string) => void;
}

const PHASE_COLORS: Record<string, string> = {
  '01: Intake': '#086375',
  '02: Session Zero': '#3C91E6',
  '03: Active Sprints': '#5F0F40',
  '04: Liftoff': '#E0CA3C',
  '05: Complete': '#7B8794',
  '06: Archived/Sunset': '#FE5F00',
};

export const GalaxyBoardView: React.FC<GalaxyBoardViewProps> = ({
  clients,
  selectedClientId,
  manuallySetClientIds,
  moveMode,
  canMove,
  pendingWriteKeys,
  projectTaskSummaries,
  pendingTaskReads,
  projectTaskReadErrors,
  resetRequest,
  onSelectClient,
  onOpenSolar,
  onSetSprintStage,
  onLoadProjectTasks,
  onOpenClientMenu,
}) => {
  // Owner 2026-11-05: Galaxy is a normal board now (no zoom/pan canvas): readable columns with gaps, a native
  // horizontal scrollbar, empty stages collapsed to narrow drop strips, and edge scrolling while dragging a card.
  const boardRef = useRef<HTMLDivElement>(null);
  const [expandedEmpty, setExpandedEmpty] = useState<ReadonlySet<SprintStage>>(() => new Set());
  const [showEmpty, setShowEmpty] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<SprintStage | null>(null);
  const previousResetRequest = useRef(resetRequest);
  useEffect(() => {
    if (previousResetRequest.current === resetRequest) return;
    previousResetRequest.current = resetRequest;
    boardRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [resetRequest]);
  const lastEdgeScroll = useRef(0);
  const handleEdgeScroll = (event: React.DragEvent) => {
    const board = boardRef.current;
    if (!board) return;
    const now = Date.now();
    if (now - lastEdgeScroll.current < 25) return;
    const rect = board.getBoundingClientRect();
    const edge = 120;
    const step = event.clientX < rect.left + edge ? -36 : event.clientX > rect.right - edge ? 36 : 0;
    if (!step) return;
    lastEdgeScroll.current = now;
    board.scrollLeft += step;
  };
  const dropProps = (stage: SprintStage) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!canMove) return;
      event.preventDefault();
      if (dragOverStage !== stage) setDragOverStage(stage);
    },
    onDragLeave: () => setDragOverStage((current) => (current === stage ? null : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragOverStage(null);
      const projectId = event.dataTransfer.getData('text/plain');
      if (canMove && projectId) onSetSprintStage(projectId, stage);
    },
  });

  const visibleClients = selectedClientId
    ? clients.filter((client) => client.ClientID === selectedClientId)
    : clients;
  const projectCount = visibleClients.reduce((total, client) => total + client.activeProjects.length, 0);
  const selectedClientName = clients.find((client) => client.ClientID === selectedClientId)?.Company_Name;

  return (
    <div className="flex h-full w-full flex-col bg-[#020500] p-3 pb-16 text-[#DDFBD0]">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#086375]/50 pb-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-sm font-bold tracking-widest text-[#E0CA3C]">
            GALAXY / SPRINT STAGES{selectedClientId ? ` · ${selectedClientName || selectedClientId}` : ''}
          </h1>
          <p className="mt-1 text-hud-3 text-[#DDFBD0]/60">
            {projectCount} project{projectCount === 1 ? '' : 's'}.
            {' '}{moveMode === 'snapshot'
              ? 'Snapshot moves stay local.'
              : moveMode === 'live' ? 'Stage changes are audited and confirmed by Master Control.' : 'Demo and disconnected data are read-only.'}
            {' '}Drag a card onto a stage (the board scrolls at the edges), or use ⋮ → Move to stage.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-hud-3 text-[#DDFBD0]/80">
            <input type="checkbox" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} className="accent-[#E0CA3C]" />
            Show empty stages
          </label>
          {selectedClientId && (
            <button
              type="button"
              onClick={() => onSelectClient('')}
              className="rounded border border-[#086375]/60 px-2 py-1 text-hud-3 hover:border-[#E0CA3C]"
            >
              Show all projects
            </button>
          )}
        </div>
      </div>
      <div ref={boardRef} onDragOver={handleEdgeScroll} className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2" aria-label="Sprint stage board">
        {SPRINT_STAGES.map(({ stage, title }) => {
          const projects = visibleClients.flatMap((client) => client.activeProjects
            .filter((project) => project.SprintStage === stage)
            .map((project) => ({ client, project })));
          const isTarget = dragOverStage === stage;
          if (projects.length === 0 && !showEmpty && !expandedEmpty.has(stage)) {
            return (
              <button
                key={stage}
                type="button"
                {...dropProps(stage)}
                onClick={() => setExpandedEmpty((current) => new Set(current).add(stage))}
                title={`${title}: no projects. Click to expand; drop a card here to move it.`}
                aria-label={`${stage}, empty. Expand`}
                className={`flex w-14 shrink-0 flex-col items-center gap-2 rounded-lg border border-dashed py-3 text-hud-3 font-bold text-[#DDFBD0]/60 hover:border-[#E0CA3C] hover:text-[#E0CA3C] ${isTarget ? 'border-[#E0CA3C] bg-[#E0CA3C]/15 text-[#E0CA3C]' : 'border-[#086375]/60'}`}
              >
                <span>{stage.slice(0, 2)}</span>
                <span className="[writing-mode:vertical-rl]">{title}</span>
              </button>
            );
          }
          return (
            <section
              key={stage}
              {...dropProps(stage)}
              className={`flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-[#06100c]/70 ${isTarget ? 'border-[#E0CA3C] ring-2 ring-[#E0CA3C]/40' : 'border-[#086375]/60'}`}
              aria-label={`${stage} projects, ${projects.length}`}
            >
              <header className="flex min-h-12 items-center justify-between gap-1 border-b border-[#086375]/50 bg-[#020500]/95 px-3 py-2">
                <h2 className="text-hud-4 font-bold leading-tight">{title}</h2>
                <div className="flex items-center gap-1">
                  <span className="shrink-0 rounded bg-[#086375]/20 px-1.5 py-0.5 text-hud-3">{projects.length}</span>
                  {projects.length === 0 && expandedEmpty.has(stage) && !showEmpty && (
                    <button type="button" onClick={() => setExpandedEmpty((current) => { const next = new Set(current); next.delete(stage); return next; })}
                      aria-label={`Collapse ${stage}`} className="rounded px-1 text-[#DDFBD0]/60 hover:text-white">›</button>
                  )}
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
                  {projects.map(({ client, project }) => {
                    const isSaving = pendingWriteKeys.has(`client:${client.ClientID}`)
                      || pendingWriteKeys.has(`project:${project.ProjectID}`);
                    const phase = manuallySetClientIds.has(client.ClientID)
                      || client.AccountPhase_Mode === 'manual'
                      ? client.AccountPhase
                      : deriveAccountPhase(client.activeProjects, client.AccountPhase);
                    return (
                      <article
                        key={project.ProjectID}
                        draggable={canMove && !isSaving}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', project.ProjectID);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDoubleClick={() => onOpenSolar(client.ClientID, project.ProjectID)}
                        onContextMenu={onOpenClientMenu ? (event) => { event.preventDefault(); onOpenClientMenu(event.clientX, event.clientY, client.ClientID, project.ProjectID); } : undefined}
                        onClick={() => onSelectClient(client.ClientID)}
                        className={`cursor-pointer rounded-md border bg-[#020500] p-2 hover:bg-[#0b1812] ${selectedClientId === client.ClientID ? 'ring-1 ring-[#E0CA3C]' : ''}`}
                        style={{ borderLeftWidth: 3, borderLeftColor: PHASE_COLORS[phase] }}
                        title={`Double-click to open Solar for ${project.ProjectID}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="text-hud-3 font-bold leading-tight">{project.Title || project.ProjectID}</h3>
                          {onOpenClientMenu && (
                            <button
                              type="button"
                              aria-label={`Actions for ${client.Company_Name || client.ClientID}`}
                              title="Client actions (status, invoice, OSINT, Sunset). Right-click the card works too."
                              onClick={(event) => { event.stopPropagation(); const r = event.currentTarget.getBoundingClientRect(); onOpenClientMenu(r.left, r.bottom + 4, client.ClientID, project.ProjectID); }}
                              onDoubleClick={(event) => event.stopPropagation()}
                              className="shrink-0 rounded border border-[#086375]/60 px-1.5 text-[0.85rem] font-bold leading-none text-[#DDFBD0]/80 hover:border-[#E0CA3C] hover:text-[#E0CA3C]"
                            >
                              ⋮
                            </button>
                          )}
                        </div>
                        <p className="mt-1 truncate text-hud-1 text-[#E0CA3C]">{client.Company_Name}</p>
                        <p className="truncate text-hud-1 text-[#DDFBD0]/50">{project.ProjectID} · {project.AssignedRateTier}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-2 text-hud-1 text-[#DDFBD0]/65">
                          <span>Est {project.Est_Hours ?? '—'}h</span>
                          <span>Actual {project.Actual_Hours ?? '—'}h</span>
                        </div>
                        {project.Google_Tasklist_ID ? (
                          <button
                            type="button"
                            disabled={pendingTaskReads.has(project.ProjectID)}
                            onClick={(event) => {
                              event.stopPropagation();
                              onLoadProjectTasks(project.ProjectID);
                            }}
                            onDoubleClick={(event) => event.stopPropagation()}
                            className="mt-1 rounded border border-[#086375]/50 px-1.5 py-0.5 text-left text-hud-1 text-[#DDFBD0]/60 hover:border-[#E0CA3C] disabled:cursor-wait disabled:opacity-50"
                            aria-label={`Read task count for ${project.ProjectID}`}
                          >
                            {pendingTaskReads.has(project.ProjectID)
                              ? 'Reading task list…'
                              : projectTaskSummaries[project.ProjectID]
                                ? `${projectTaskSummaries[project.ProjectID].open} open / ${projectTaskSummaries[project.ProjectID].total} total`
                                : 'Read task count'}
                          </button>
                        ) : (
                          <p className="mt-1 text-hud-1 text-[#DDFBD0]/40">No task list configured</p>
                        )}
                        {projectTaskReadErrors[project.ProjectID] && (
                          <p role="status" className="mt-1 text-hud-1 text-alert-orange">
                            {projectTaskReadErrors[project.ProjectID]}
                          </p>
                        )}
                        {isSaving && (
                          <p className="mt-1 text-hud-1 text-[#E0CA3C]">Saving stage…</p>
                        )}
                      </article>
                    );
                  })}
                  {projects.length === 0 && (
                    <p className="py-3 text-center text-hud-1 text-[#DDFBD0]/30">No projects</p>
                  )}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
};
