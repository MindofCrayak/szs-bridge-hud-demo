import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

/** Diagnostics (owner 2026-11-05: menu did not appear live): open/close reasons go to the HUD status terminal. */
function reportMenu(state: 'opened' | 'closed', reason: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hud-client-menu', { detail: { state, reason } }));
}
import { AccountPhase, ClientRecord, SprintStage } from '../types';
import { ACCOUNT_PHASES, SPRINT_STAGES } from '../data/pipeline';

/** Client actions menu. Retyped to the live ClientRecord (Plan v3.1 G3; was the old demo ClientUnit shape). */
interface CardContextMenuProps {
  x: number;
  y: number;
  client: ClientRecord;
  onClose: () => void;
  onAdvanceStage: (client: ClientRecord) => void;
  onDraftInvoice: (client: ClientRecord) => void;
  onFlagBlocker: (client: ClientRecord) => void;
  onSunsetClient: (client: ClientRecord) => void;
  /** Undo of a final message: move the client folder from Sanctum Inactive back to Sanctum Active (absent = hidden). */
  onRestoreFolder?: (client: ClientRecord) => void;
  /** Phase G3 reports (absent = hidden). */
  onStatusSummary?: (client: ClientRecord) => void;
  onRequestOsint?: (client: ClientRecord) => void;
  /** Live writes need sign-in; demo-only actions are disabled otherwise. */
  canWrite?: boolean;
  canAdvance?: boolean;
  /** Owner 2026-11-05: moves without long drags. Phase for the client; stage for the project the menu was opened on. */
  onSetPhase?: (client: ClientRecord, phase: AccountPhase) => void;
  onResetPhase?: (client: ClientRecord) => void;
  projectId?: string;
  onSetStage?: (projectId: string, stage: SprintStage) => void;
  /** Phase/stage moves: live (audited) or snapshot (local), same rule as card drags. */
  canMove?: boolean;
}

export const CardContextMenu: React.FC<CardContextMenuProps> = ({
  x,
  y,
  client,
  onClose,
  onAdvanceStage,
  onDraftInvoice,
  onFlagBlocker,
  onSunsetClient,
  onRestoreFolder,
  onStatusSummary,
  onRequestOsint,
  canWrite = false,
  canAdvance = false,
  onSetPhase,
  onResetPhase,
  projectId,
  onSetStage,
  canMove = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    x: Number.isFinite(x) ? x : 8,
    y: Number.isFinite(y) ? y : 8,
  });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const requestedX = Number.isFinite(x) ? x : 8;
    const requestedY = Number.isFinite(y) ? y : 8;
    setPosition({
      x: Math.max(8, Math.min(requestedX, window.innerWidth - bounds.width - 8)),
      y: Math.max(8, Math.min(requestedY, window.innerHeight - bounds.height - 8)),
    });
  }, [x, y]);

  // The latest onClose without re-subscribing listeners on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    reportMenu('opened', client.ClientID);
    const openedAt = Date.now();
    const close = (reason: string) => { reportMenu('closed', reason); onCloseRef.current(); };
    // Closes only on an outside press (not the press that opened it) or Escape. Scrolling never closes it:
    // live auto-scrolling closed it instantly before (owner 2026-11-05).
    const handlePointerDown = (event: MouseEvent) => {
      if (Date.now() - openedAt < 250) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close('outside click');
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('Escape');
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Mount once per opened menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUrl = (url: string | undefined) => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') window.open(parsed.href, '_blank', 'noopener,noreferrer');
    } finally {
      onClose();
    }
  };

  const itemClass = 'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-text-mana hover:bg-primary-plum hover:text-highlight-gold disabled:cursor-not-allowed disabled:opacity-40';

  return ReactDOM.createPortal((
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${client.Company_Name || client.ClientID} actions`}
      className="fixed z-[9000] max-h-[calc(100vh-16px)] w-60 overflow-y-auto rounded border border-accent-teal bg-bg-obsidian/95 p-1 font-mono shadow-2xl backdrop-blur-md"
      style={{ top: position.y, left: position.x, maxHeight: `calc(100vh - ${Math.round(position.y) + 8}px)` }}
    >
      <div className="truncate border-b border-accent-teal px-3 py-2 text-hud-3 font-bold uppercase tracking-wider text-highlight-gold">
        {client.Company_Name || client.ClientID || 'Unassigned node'}
      </div>
      <div className="space-y-0.5 py-1">
        <button type="button" role="menuitem" className={itemClass} disabled={!client.DriveFolderUrl} onClick={() => openUrl(client.DriveFolderUrl)}>
          <i className="fa-solid fa-folder w-4 text-center" /> Open Drive Folder
        </button>
        <button type="button" role="menuitem" className={itemClass} disabled={!client.NotesDocUrl} onClick={() => openUrl(client.NotesDocUrl)}>
          <i className="fa-solid fa-file-lines w-4 text-center" /> Open Meeting Notes
        </button>
        <button type="button" role="menuitem" className={itemClass} disabled={!client.ChatSpaceUrl} onClick={() => openUrl(client.ChatSpaceUrl)}>
          <i className="fa-solid fa-comments w-4 text-center" /> Dolores: Chat Space
        </button>
        <div className="my-1 border-t border-accent-teal/40" />
        {onStatusSummary && (
          <button type="button" role="menuitem" className={itemClass} onClick={() => { onStatusSummary(client); onClose(); }}>
            <i className="fa-solid fa-clipboard-list w-4 text-center" /> Status Summary
          </button>
        )}
        <button type="button" role="menuitem" className={itemClass} disabled={!canAdvance} title={canAdvance ? undefined : 'Demo fleet only; drag the card in Galaxy instead.'} onClick={() => { onAdvanceStage(client); onClose(); }}>
          <i className="fa-solid fa-forward w-4 text-center" /> Advance Stage
        </button>
        <button type="button" role="menuitem" className={itemClass} disabled={!canWrite} onClick={() => { onDraftInvoice(client); onClose(); }}>
          <i className="fa-solid fa-file-invoice-dollar w-4 text-center" /> Draft Invoice…
        </button>
        {onRequestOsint && (
          <button type="button" role="menuitem" className={itemClass} disabled={!canWrite} onClick={() => { onRequestOsint(client); onClose(); }}>
            <i className="fa-solid fa-satellite-dish w-4 text-center" /> Request OSINT Sweep
          </button>
        )}
        <button type="button" role="menuitem" className={`${itemClass} text-alert-orange`} disabled={!canWrite} title={canWrite ? 'Save a roadblock note and raise a BLOCK alert' : 'Sign in to live Master Control first.'} onClick={() => { onFlagBlocker(client); onClose(); }}>
          <i className="fa-solid fa-triangle-exclamation w-4 text-center" /> Flag Blocker
        </button>
        <div className="my-1 border-t border-accent-teal/40" />
        {onSetPhase && (
          <details className="rounded">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs text-text-mana hover:bg-primary-plum hover:text-highlight-gold">
              <i className="fa-solid fa-arrows-left-right w-4 text-center" /> Move phase ▸ <span className="text-hud-2 text-text-mana/60">(now {client.AccountPhase})</span>
            </summary>
            <div className="ml-4 border-l border-accent-teal/40 pl-1">
              {ACCOUNT_PHASES.map(({ phase }) => (
                <button key={phase} type="button" role="menuitem" className={itemClass} disabled={!canMove || phase === client.AccountPhase}
                  onClick={() => { onSetPhase(client, phase); onClose(); }}>
                  {phase === client.AccountPhase ? '● ' : ''}{phase}
                </button>
              ))}
              {onResetPhase && (
                <button type="button" role="menuitem" className={itemClass} disabled={!canMove || client.AccountPhase_Mode !== 'manual'}
                  title={client.AccountPhase_Mode === 'manual' ? 'Let the projects decide the phase again' : 'Already automatic'}
                  onClick={() => { onResetPhase(client); onClose(); }}>
                  ↺ Reset phase to auto
                </button>
              )}
            </div>
          </details>
        )}
        {onSetStage && projectId && (() => {
          const current = client.activeProjects.find((project) => project.ProjectID === projectId)?.SprintStage;
          return (
            <details className="rounded">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs text-text-mana hover:bg-primary-plum hover:text-highlight-gold">
                <i className="fa-solid fa-forward w-4 text-center" /> Move {projectId} to stage ▸
              </summary>
              <div className="ml-4 max-h-64 overflow-auto border-l border-accent-teal/40 pl-1">
                {SPRINT_STAGES.map(({ stage }) => (
                  <button key={stage} type="button" role="menuitem" className={itemClass} disabled={!canMove || stage === current}
                    onClick={() => { onSetStage(projectId, stage); onClose(); }}>
                    {stage === current ? '● ' : ''}{stage}
                  </button>
                ))}
              </div>
            </details>
          );
        })()}
        {onSetStage && projectId && (
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-alert-orange hover:bg-alert-orange/20`}
            disabled={!canMove || client.activeProjects.find((project) => project.ProjectID === projectId)?.SprintStage === '09: Sunset / Retainer'}
            onClick={() => { onSetStage(projectId, '09: Sunset / Retainer'); onClose(); }}
          >
            <i className="fa-solid fa-moon w-4 text-center" /> Sunset this project ({projectId} → 09)
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className={`${itemClass} text-alert-orange hover:bg-alert-orange/20`}
          disabled={!canWrite}
          onClick={() => {
            onSunsetClient(client);
            onClose();
          }}
        >
          <i className="fa-solid fa-box-archive w-4 text-center" /> Sunset whole client (06: Archived/Sunset)
        </button>
        {onRestoreFolder && ['05: Complete', '06: Archived/Sunset'].includes(client.AccountPhase) && (
          <button type="button" role="menuitem" className={itemClass} disabled={!canWrite || !client.DriveFolderUrl}
            title="Undo a final message: move the client folder from Sanctum Inactive back to Sanctum Active"
            onClick={() => { onRestoreFolder(client); onClose(); }}>
            <i className="fa-solid fa-folder-open w-4 text-center" /> Restore client folder to Sanctum Active
          </button>
        )}
      </div>
    </div>
  ), document.body);
};
