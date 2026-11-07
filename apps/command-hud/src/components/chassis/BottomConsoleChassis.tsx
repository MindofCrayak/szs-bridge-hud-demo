import React, { useState, useEffect, useRef } from 'react';
import { ClientCommsHandlers, ClientRecord, CommandKey, ProjectTaskHandlers } from '../../types';
import { CalendarBay } from './CalendarBay';
import { DualCenterBay } from './DualCenterBay';
import { ClientDossierBay } from './ClientDossierBay';
import { MacroPadBay } from './MacroPadBay';
import { useCalendarFeed } from '../../hooks/useCalendarFeed';
import { eventDay, eventState } from '../../data/calendar';
import { PendingProposal } from '../../ecs/proposals';
import type { PendingAgentDispatch } from '../../ecs/agentDispatch';
import type { StaffMeetingInput } from '../../agents/personas.config';
import { DockSkinProvider, useDockSkin } from './dock/DockSkinContext';
import { BayFrame, DockConduit } from './dock/BayFrame';
import { EndCap, PowerCore, ReelHinge, ShardHinge } from './dock/DockJoints';
import { DockFxLayer } from './dock/DockFxLayer';
import { emitDockFx, onDockFx } from './dock/dockFx';
import { dockAsset } from './dock/dockSkins';
import './dock/dock.css';

interface BottomConsoleChassisProps {
  selectedClient: ClientRecord | null;
  staffMeetingInput?: StaffMeetingInput;
  onUpdateClient?: (updated: ClientRecord) => void;
  onTriggerCommand: (key: CommandKey) => void;
  onLogTerminal?: (message: string, type?: 'normal' | 'action' | 'server' | 'alert') => void;
  controlGroups?: Record<number, string[]>;
  activeGroupNum?: number | null;
  onRecallControlGroup?: (group: number) => void;
  /** Calendar bay (owner 2026-11-06): read-only Google Calendar with the signed-in token. */
  calendar?: { accessToken: string | null; clients: ClientRecord[]; onOpenClient?: (clientId: string) => void };
  context?: import('../../types').ViewportContext;
  onProposal?: (proposal: PendingProposal) => void;
  pendingAgentDispatch?: PendingAgentDispatch | null;
  onAgentDispatchHandled?: (dispatchId: number) => void;
  /** Live only: "Send to client" in the Client Dossier's Projects section (Plan v3.1 E5). */
  clientComms?: ClientCommsHandlers;
  /** Phase E6: task panel in the Client Dossier (live only). */
  projectTasks?: ProjectTaskHandlers;
}

type BayId = 'calendar' | 'alfred' | 'dossier' | 'macropad';

// Owner dock skins (2026-11-05 bundle): skinnable bottom console (Classic / Terran / Protoss / Zerg / Cassette).
export const BottomConsoleChassis: React.FC<BottomConsoleChassisProps> = (props) => (
  <DockSkinProvider>
    <BottomConsoleChassisInner {...props} />
  </DockSkinProvider>
);

const BottomConsoleChassisInner: React.FC<BottomConsoleChassisProps> = ({
  selectedClient,
  staffMeetingInput,
  onUpdateClient,
  onTriggerCommand,
  onLogTerminal,
  controlGroups = {},
  activeGroupNum = 1,
  onRecallControlGroup,
  calendar,
  context = 'GLOBAL',
  onProposal,
  pendingAgentDispatch,
  onAgentDispatchHandled,
  clientComms,
  projectTasks,
}) => {
  // Loaded here (always mounted) so the bay header can say what is on today even while the bay is closed.
  const calendarFeed = useCalendarFeed(calendar?.accessToken ?? null, calendar?.clients ?? []);
  const calendarHeadline = (() => {
    if (calendarFeed.status === 'signed-out') return '(sign in)';
    if (calendarFeed.status === 'error') return '(needs attention)';
    if (calendarFeed.status === 'loading' && !calendarFeed.loadedAt) return '(reading…)';
    const now = new Date();
    const today = calendarFeed.events.filter((event) => eventDay(event) === eventDay({ start: now.toISOString(), allDay: false }));
    const live = today.find((event) => eventState(event, now) === 'LIVE');
    if (live) return `(now: ${live.title})`;
    const left = today.filter((event) => eventState(event, now) === 'UPCOMING').length;
    return `(${left} left today)`;
  })();

  // Pinned state persisted in localStorage
  const [pinnedBays, setPinnedBays] = useState<Record<BayId, boolean>>(() => {
    try {
      const stored = localStorage.getItem('szs_hud_dock_pinned');
      return stored ? JSON.parse(stored) : { calendar: false, alfred: false, dossier: false, macropad: false };
    } catch {
      return { calendar: false, alfred: false, dossier: false, macropad: false };
    }
  });

  // Hover state with debounced timeouts (150ms in, 300ms out)
  const [hoveredBays, setHoveredBays] = useState<Record<BayId, boolean>>({
    calendar: false,
    alfred: false,
    dossier: false,
    macropad: false,
  });

  // Track if Alfred input has focus or text to prevent collapse
  const [isAlfredActive, setIsAlfredActive] = useState(false);

  // Dock skin + effects
  const { race, skin } = useDockSkin();
  const [isThinking, setIsThinking] = useState(false);
  useEffect(() => onDockFx((e) => { if (e.type === 'think') setIsThinking(e.on); }), []);
  const dossierMissing = Boolean(
    selectedClient &&
      (!selectedClient.DriveFolderUrl || !selectedClient.NotesDocUrl || !selectedClient.ChatSpaceUrl || !selectedClient.MSA_DocID || !selectedClient.SOW_DocID),
  );
  const triggerCommand = (key: CommandKey) => {
    emitDockFx('pulse');
    onTriggerCommand(key);
  };

  const hoverEnterTimeoutRef = useRef<Record<BayId, NodeJS.Timeout | null>>({
    calendar: null,
    alfred: null,
    dossier: null,
    macropad: null,
  });
  const hoverLeaveTimeoutRef = useRef<Record<BayId, NodeJS.Timeout | null>>({
    calendar: null,
    alfred: null,
    dossier: null,
    macropad: null,
  });

  const togglePin = (bay: BayId) => {
    emitDockFx('pulse');
    setPinnedBays((prev) => {
      const updated = { ...prev, [bay]: !prev[bay] };
      try {
        localStorage.setItem('szs_hud_dock_pinned', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleMouseEnter = (bay: BayId) => {
    if (hoverLeaveTimeoutRef.current[bay]) {
      clearTimeout(hoverLeaveTimeoutRef.current[bay]!);
      hoverLeaveTimeoutRef.current[bay] = null;
    }
    hoverEnterTimeoutRef.current[bay] = setTimeout(() => {
      setHoveredBays((prev) => ({ ...prev, [bay]: true }));
    }, 150);
  };

  const handleMouseLeave = (bay: BayId) => {
    if (hoverEnterTimeoutRef.current[bay]) {
      clearTimeout(hoverEnterTimeoutRef.current[bay]!);
      hoverEnterTimeoutRef.current[bay] = null;
    }
    hoverLeaveTimeoutRef.current[bay] = setTimeout(() => {
      setHoveredBays((prev) => ({ ...prev, [bay]: false }));
    }, 300);
  };

  // Close unpinned bays on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedBays({ calendar: false, alfred: false, dossier: false, macropad: false });
        try {
          localStorage.setItem('szs_hud_dock_pinned', JSON.stringify({ calendar: false, alfred: false, dossier: false, macropad: false }));
        } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to focus/blur inside Alfred Core bay to keep it open while active
  const alfredBayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = alfredBayRef.current;
    if (!el) return;

    const handleFocusIn = () => setIsAlfredActive(true);
    const handleFocusOut = () => {
      setTimeout(() => {
        const input = el.querySelector('input, textarea') as HTMLInputElement | null;
        if (input && input.value.trim().length > 0) {
          setIsAlfredActive(true);
        } else if (!el.contains(document.activeElement)) {
          setIsAlfredActive(false);
        }
      }, 50);
    };
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.value.trim().length > 0) {
        setIsAlfredActive(true);
      }
    };

    let thinkTimer: ReturnType<typeof setTimeout> | null = null;
    const handleSubmit = () => {
      emitDockFx('surge');
      emitDockFx({ type: 'think', on: true });
      if (thinkTimer) clearTimeout(thinkTimer);
      thinkTimer = setTimeout(() => emitDockFx({ type: 'think', on: false }), 2500);
    };

    el.addEventListener('focusin', handleFocusIn);
    el.addEventListener('focusout', handleFocusOut);
    el.addEventListener('input', handleInput);
    el.addEventListener('submit', handleSubmit);

    return () => {
      el.removeEventListener('focusin', handleFocusIn);
      el.removeEventListener('focusout', handleFocusOut);
      el.removeEventListener('input', handleInput);
      el.removeEventListener('submit', handleSubmit);
      if (thinkTimer) clearTimeout(thinkTimer);
    };
  }, []);

  const isExpanded = (bay: BayId) => {
    if (bay === 'alfred' && (isAlfredActive || pendingAgentDispatch)) return true;
    // A Send-to-client draft or post in flight keeps Alfred Core open; the draft is an overlay there (owner 2026-11-05).
    if (bay === 'alfred' && clientComms?.busy) return true;
    return Boolean(pinnedBays[bay] || hoveredBays[bay]);
  };

  return (
    <footer
      className={`szs-dock relative z-30 flex w-full flex-row items-end justify-center select-none bg-transparent px-1 pb-2 pointer-events-none sm:px-4 ${skin ? 'gap-0' : 'gap-1 sm:gap-3'}`}
      data-dock-race={race ?? undefined}
      data-thinking={isThinking ? 'true' : undefined}
      data-keycaps={skin?.keycaps ? 'true' : undefined}
      style={
        skin?.keycaps
          ? ({
              '--szs-keycap-idle': `url(${dockAsset(skin.keycaps[0])})`,
              '--szs-keycap-lit': `url(${dockAsset(skin.keycaps[1])})`,
              '--szs-keycap-hover': `url(${dockAsset(skin.keycaps[2])})`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <DockConduit />
      <DockFxLayer />
      <EndCap side="left" />
      {/* ── BAY 1: CALENDAR BAY ─────────────────────────────────── */}
      <div
        onMouseEnter={() => handleMouseEnter('calendar')}
        onMouseLeave={() => handleMouseLeave('calendar')}
        className={`szs-bay relative pointer-events-auto flex flex-col rounded-xl border border-[#1a2b27] bg-[#0d1513]/95 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200 ease-out shrink-0 overflow-hidden ${
          isExpanded('calendar')
            ? 'h-[45vh] shadow-[0_0_25px_rgba(8,99,117,0.4)]'
            : 'h-[44px]'
        }`}
        data-bay-var="--bay-calendar-w" style={{ width: 'var(--bay-calendar-w, clamp(72px, 16vw, 280px))' }}
      >
        <BayFrame />
        {/* Collapsed Header Bar (~44px) */}
        <div
          onClick={() => togglePin('calendar')}
          className="szs-bay-head h-[44px] shrink-0 flex items-center justify-between px-3 cursor-pointer hover:bg-[#10201c] transition-colors border-b border-[#086375]/30"
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-xs text-[#086375]" />
            <span className="font-display text-xs font-bold text-[#DDFBD0]">Calendar</span>
            <span className="text-hud-2 text-[#DDFBD0]/60">{calendarHeadline}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pinnedBays.calendar && (
              <span className="text-hud-1 px-1 py-0.2 rounded bg-[#086375]/40 text-[#E0CA3C] font-bold">PINNED</span>
            )}
            <i className={`fa-solid fa-chevron-up text-hud-2 text-[#DDFBD0]/60 transition-transform duration-200 ${isExpanded('calendar') ? 'rotate-180 text-[#E0CA3C]' : ''}`} />
          </div>
        </div>

        {/* Expanded Content Layer */}
        {isExpanded('calendar') && (
          <div className="szs-bay-body relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#040706] p-2.5">
            <div className="crm-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
              <CalendarBay feed={calendarFeed} clients={calendar?.clients ?? []} onOpenClient={calendar?.onOpenClient} />
            </div>
          </div>
        )}
      </div>

      <PowerCore />

      {/* ── BAY 2: DUAL CENTER BAY (ALFRED CORE) ────────────────── */}
      <div
        ref={alfredBayRef}
        onMouseEnter={() => handleMouseEnter('alfred')}
        onMouseLeave={() => handleMouseLeave('alfred')}
        className={`szs-bay relative pointer-events-auto flex min-w-0 flex-1 flex-col rounded-xl border border-[#1a2b27] bg-[#0d1513]/95 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200 ease-out max-w-[560px] overflow-hidden ${
          isExpanded('alfred')
            ? 'h-[45vh] shadow-[0_0_30px_rgba(8,99,117,0.5)] border-[#086375]/60'
            : 'h-[44px]'
        }`}
        data-bay-var="--bay-center-w" style={{ width: 'var(--bay-center-w, clamp(160px, 29vw, 440px))' }}
      >
        <BayFrame ornament={isExpanded('alfred')} />
        {/* Collapsed Header Bar (~44px) */}
        <div
          onClick={() => togglePin('alfred')}
          className="szs-bay-head h-[44px] shrink-0 flex items-center justify-between px-3 cursor-pointer hover:bg-[#10201c] transition-colors border-b border-[#086375]/30"
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-terminal text-xs text-[#E0CA3C]" />
            <span className="font-display text-xs font-bold text-[#DDFBD0]">Alfred Core</span>
            <span className="text-hud-2 text-[#DDFBD0]/50 truncate max-w-[140px]">
              {selectedClient ? selectedClient.Company_Name : 'Ready'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isAlfredActive && !pinnedBays.alfred && (
              <span className="text-hud-1 px-1 py-0.2 rounded bg-[#FE5F00]/30 text-[#FE5F00] font-bold animate-pulse">ACTIVE</span>
            )}
            {pinnedBays.alfred && (
              <span className="text-hud-1 px-1 py-0.2 rounded bg-[#086375]/40 text-[#E0CA3C] font-bold">PINNED</span>
            )}
            <i className={`fa-solid fa-chevron-up text-hud-2 text-[#DDFBD0]/60 transition-transform duration-200 ${isExpanded('alfred') ? 'rotate-180 text-[#E0CA3C]' : ''}`} />
          </div>
        </div>

        {/* Expanded Content Layer */}
        {isExpanded('alfred') && (
          <div className="szs-bay-body relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#040706] p-2.5 shadow-[inset_0_0_20px_rgba(8,99,117,0.15)]">
            <div className="crm-grid pointer-events-none absolute inset-0 opacity-25" />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
              <DualCenterBay
                selectedClient={selectedClient}
                staffMeetingInput={staffMeetingInput}
                onUpdateClient={onUpdateClient}
                onLogTerminal={onLogTerminal}
                onProposal={onProposal}
                pendingAgentDispatch={pendingAgentDispatch}
                onAgentDispatchHandled={onAgentDispatchHandled}
                clientComms={clientComms}
              />
            </div>
          </div>
        )}
      </div>

      <ReelHinge />

      {/* ── BAY 3: CLIENT DOSSIER BAY ──────────────────────────── */}
      <div
        onMouseEnter={() => handleMouseEnter('dossier')}
        onMouseLeave={() => handleMouseLeave('dossier')}
        className={`szs-bay relative pointer-events-auto flex flex-col rounded-xl border border-[#1a2b27] bg-[#0d1513]/95 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200 ease-out shrink-0 overflow-hidden ${
          isExpanded('dossier')
            ? 'h-[45vh] shadow-[0_0_25px_rgba(8,99,117,0.4)]'
            : 'h-[44px]'
        }`}
        data-bay-var="--bay-dossier-w" style={{ width: 'var(--bay-dossier-w, clamp(72px, 15vw, 270px))' }}
      >
        <BayFrame />
        {/* Collapsed Header Bar (~44px) */}
        <div
          onClick={() => togglePin('dossier')}
          className="szs-bay-head h-[44px] shrink-0 flex items-center justify-between px-3 cursor-pointer hover:bg-[#10201c] transition-colors border-b border-[#086375]/30"
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-folder-open text-xs text-[#3C91E6]" />
            <span className="font-display text-xs font-bold text-[#DDFBD0]">Client Dossier</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pinnedBays.dossier && (
              <span className="text-hud-1 px-1 py-0.2 rounded bg-[#086375]/40 text-[#E0CA3C] font-bold">PINNED</span>
            )}
            <i className={`fa-solid fa-chevron-up text-hud-2 text-[#DDFBD0]/60 transition-transform duration-200 ${isExpanded('dossier') ? 'rotate-180 text-[#E0CA3C]' : ''}`} />
          </div>
        </div>

        {/* Expanded Content Layer */}
        {isExpanded('dossier') && (
          <div className="szs-bay-body relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#040706] p-2.5">
            <div className="crm-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
              <ClientDossierBay client={selectedClient} clientComms={clientComms} projectTasks={projectTasks} />
            </div>
          </div>
        )}
      </div>

      <ShardHinge alert={dossierMissing} />

      {/* ── BAY 4: GLOBAL / CLIENT MACRO PAD ────────────────────── */}
      <div
        onMouseEnter={() => handleMouseEnter('macropad')}
        onMouseLeave={() => handleMouseLeave('macropad')}
        className={`szs-bay relative pointer-events-auto flex flex-col rounded-xl border border-[#1a2b27] bg-[#0d1513]/95 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200 ease-out shrink-0 overflow-hidden ${
          isExpanded('macropad')
            ? 'h-[45vh] shadow-[0_0_25px_rgba(8,99,117,0.4)]'
            : 'h-[44px]'
        }`}
        data-bay-var="--bay-macro-w" style={{ width: 'var(--bay-macro-w, clamp(72px, 15vw, 280px))' }}
      >
        <BayFrame />
        {/* Collapsed Header Bar (~44px) */}
        <div
          onClick={() => togglePin('macropad')}
          className="szs-bay-head h-[44px] shrink-0 flex items-center justify-between px-3 cursor-pointer hover:bg-[#10201c] transition-colors border-b border-[#086375]/30"
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-grip text-xs text-[#E0CA3C]" />
            <span className="font-display text-xs font-bold text-[#DDFBD0]">
              {context === 'CLIENT_WORKBENCH' ? 'Client Pad' : 'Macro Pad'}
            </span>
            <span className="text-hud-2 text-[#DDFBD0]/50">Q–C</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pinnedBays.macropad && (
              <span className="text-hud-1 px-1 py-0.2 rounded bg-[#086375]/40 text-[#E0CA3C] font-bold">PINNED</span>
            )}
            <i className={`fa-solid fa-chevron-up text-hud-2 text-[#DDFBD0]/60 transition-transform duration-200 ${isExpanded('macropad') ? 'rotate-180 text-[#E0CA3C]' : ''}`} />
          </div>
        </div>

        {/* Expanded Content Layer */}
        {isExpanded('macropad') && (
          <div className="szs-bay-body relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#040706] p-2.5">
            <div className="crm-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
              <MacroPadBay
                onTriggerCommand={triggerCommand}
                controlGroups={controlGroups}
                activeGroupNum={activeGroupNum}
                onRecallControlGroup={onRecallControlGroup}
                context={context}
                selectedClient={selectedClient}
              />
            </div>
          </div>
        )}
      </div>
      <EndCap side="right" />
    </footer>
  );
};
