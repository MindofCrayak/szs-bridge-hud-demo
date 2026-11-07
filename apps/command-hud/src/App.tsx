/**
 * @license
 * Session Zero Solutions // SZS Command HUD 2.0 Root Architecture
 */

import { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TokenResponse } from '@react-oauth/google';
import { 
  AlfredAlert, 
  ClientRecord, 
  CommandKey, 
  ActiveModal, 
  HudTelemetry, 
  ScreenView, 
  TerminalLog,
} from './types';
import { CanvasControls } from './components/navigation/CanvasControls';
import { SkyHeader } from './components/navigation/SkyHeader';
import { BottomStatusStrip } from './components/navigation/BottomStatusStrip';
import { MultiAgentDispatch } from './components/navigation/MultiAgentDispatch';
import { TacticalCanvas } from './components/canvas/TacticalCanvas';
import { BottomConsoleChassis } from './components/chassis/BottomConsoleChassis';
import { AvionicsCockpitView } from './components/cockpit/AvionicsCockpitView';
import { CockpitWindow } from './components/cockpit/CockpitWindow';
import { buildCockpitFeed, openCockpitChannel, type CockpitCommand, type CockpitMessage } from './cockpit/cockpitFeed';
import { CardContextMenu } from './components/CardContextMenu';
import { CommandModals } from './components/CommandModals';
import { ClientDirectoryView } from './components/ClientDirectoryView';
import { MacroMatrixView } from './components/MacroMatrixView';
import { GoogleSignIn } from './components/GoogleSignIn';
import { ReactiveBridgeCanvas } from './components/ReactiveBridgeCanvas';
import { OsintWarRoomView } from './components/OsintWarRoomView';
import { SymphonyMatrixView } from './components/SymphonyMatrixView';
import { TreasureLedgerView } from './components/TreasureLedgerView';
import { MailCommandCenter } from './components/departments/MailCommandCenter';
import { DATA_ADAPTER_MODE } from './data/adapterMode';
import { fetchClientMessagePreview, fetchMasterControlProjectTasks, summarizeProjectTasks, writeMasterControl } from './data/api';
import type { ProjectTaskSummary } from './data/api';
import {
  createDataAdapter,
  EXPECTED_SCHEMA_VERSION,
  findSchemaVersionMismatches,
  MockAdapter,
  SnapshotAdapter,
} from './data/adapter';
import type { AdapterStatus } from './data/adapter';
import type { Alert, SchemaChange, SchemaRegistryRow, Snapshot } from './data/contracts';
import { parseRows, ClientSchema } from './data/contracts';
import { toClientUnit } from './data/clientUnit';
import { computeHudStats } from './data/hudStats';
import { contractRollup, deriveAccountPhase, financeSummary, normalizeAccountPhase, normalizeSprintStage } from './data/pipeline';
import { DropConfirmDialog } from './components/canvas/workbench/DropConfirmDialog';
import { DEMO_CLIENT_UNITS, DEMO_ALERTS, DEMO_TELEMETRY } from './data/demoFleet';
import { useBridgeKeybindings, loadStoredKeymap, KeymapConfig } from './hooks/useBridgeKeybindings';
import { KeybindingSettingsModal } from './components/navigation/KeybindingSettingsModal';
import { HudErrorBoundary } from './components/HudErrorBoundary';
import { WireCreateInput, WireEditableFields, WirePanelActions, WirePanelSnapshot } from './ecs/links';
import { PendingProposal } from './ecs/proposals';
import { publishHudEvent } from './ecs/events';
import type { HudEvent } from './ecs/events';
import { MAX_ANIMATED } from './ecs/wireTheme';
import type { HudRule } from './ecs/rules';
import type { AgentCallsign, AlfredNodeContext, PendingAgentDispatch } from './ecs/agentDispatch';
import type { StaffMeetingInput } from './agents/personas.config';
import { stageCrisisOverrideFromBlockAlert } from './agents/personas.config';
import { summarizeDepartmentNotifications } from './notifications/summary';
import type { NotificationDepartment } from './notifications/summary';
import { loadSeenNotificationIds, persistSeenNotificationIds } from './notifications/seenState';
import type { RejectedSnapshotRow } from './data/snapshotData';
import { UniverseGalaxyView } from './components/canvas/UniverseGalaxyView';
import {
  applySnapshotOverlay,
  countSnapshotOverlayChanges,
  emptySnapshotOverlay,
  parseSnapshotOverlay,
  SNAPSHOT_OVERLAY_KEY,
  withClientPhase,
  withClientPhaseMode,
  withProjectStage,
  withoutClientPhase,
  withoutProjectStage,
} from './data/localOverlay';
import type { SnapshotOverlay } from './data/localOverlay';
import type { AccountPhase, ClientCommsHandlers, ClientSendState, HudTask, ProjectTaskHandlers, SprintStage, TaskDraft } from './types';

import { parsePlanetPath, planetPath } from './planet/route';
import type { PlanetRoute } from './planet/route';

/** Phase F: the Planet page is lazy-loaded (its own chunk). */
const PlanetView = lazy(() => import('./components/planet/PlanetView'));
import { FlagBlockerModal, InvoiceDraftModal, StatusSummaryModal, type BlockerOp } from './components/reports/ReportModals';
import { WriteToasts } from './components/WriteToast';
import type { ToastItem } from './components/WriteToast';

const isLocalDataMode = DATA_ADAPTER_MODE === 'snapshot' || DATA_ADAPTER_MODE === 'mock';
const SCREEN_VIEWS: ScreenView[] = [
  'dashboard', 'pipeline', 'osint', 'symphony', 'treasure', 'archive', 'cockpit', 'clients', 'actions',
];
type DashboardLevel = 'universe' | 'galaxy' | 'solar';

function readStoredScreen(): ScreenView {
  try {
    const stored = localStorage.getItem('szs.current-screen');
    if (stored === 'pipeline') return 'dashboard';
    return SCREEN_VIEWS.includes(stored as ScreenView) ? stored as ScreenView : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

function readStoredCanvasZoom(key: string): number {
  try {
    const stored = Number(localStorage.getItem(key));
    return Number.isFinite(stored) && stored >= 0.1 && stored <= 3 ? stored : 1;
  } catch {
    return 1;
  }
}

function readStoredDashboardLevel(): DashboardLevel {
  try {
    const stored = localStorage.getItem('szs.dashboard-level');
    return stored === 'galaxy' || stored === 'solar' ? stored : 'universe';
  } catch {
    return 'universe';
  }
}

function readStoredId(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function loadSnapshotOverlay(): { overlay: SnapshotOverlay; error: string | null } {
  try {
    return {
      overlay: parseSnapshotOverlay(localStorage.getItem(SNAPSHOT_OVERLAY_KEY)),
      error: null,
    };
  } catch (error) {
    return {
      overlay: emptySnapshotOverlay(),
      error: error instanceof Error ? error.message : 'Saved local changes could not be read.',
    };
  }
}

function mapLocalAlert(
  alert: Alert,
  clients: ClientRecord[],
): AlfredAlert {
  const client = clients.find((candidate) => candidate.ClientID === alert.Client_ID);
  return {
    id: alert.Alert_ID,
    timestamp: alert.Created_At,
    severity: alert.Severity === 'BLOCK' ? 'BLOCKER' : alert.Severity === 'WARN' ? 'WARNING' : alert.Severity,
    subRoutine: alert.Department,
    clientId: alert.Client_ID ?? '',
    companyName: client?.Company_Name ?? (alert.Client_ID ? `Client ${alert.Client_ID}` : 'Master Control'),
    message: `${alert.Trigger_Condition}: ${alert.Prescribed_Action}`,
    dismissed: !['open', 'active', 'pending', 'requested'].includes(alert.Action_Status.toLowerCase()),
    actionStatus: alert.Action_Status,
    ...blockerNoteOf(alert.Trigger_Condition),
  };
}

/** Flag Blocker alerts carry "Blocker: <note>" (older ones: "Blocker flagged from the HUD"). */
function blockerNoteOf(trigger: string): { blockerNote?: string } {
  if (trigger.startsWith('Blocker: ')) return { blockerNote: trigger.slice('Blocker: '.length).trim() };
  if (trigger === 'Blocker flagged from the HUD') return { blockerNote: '(earlier blocker, no note recorded)' };
  return {};
}

function mapSnapshotClients(snapshot: Snapshot): ClientRecord[] {
  return snapshot.clients.map((client, index) => {
    const projects = snapshot.projects.filter((project) => project.ClientID === client.ClientID);
    const activeComponents = Array.from(new Set([
      ...(client.activeComponents ?? []),
      ...projects.flatMap((project) => project.ActiveComponents ?? []),
    ]));
    const accountPhaseMode = client.AccountPhase_Mode ?? 'auto';
    const rollup = contractRollup(snapshot.financeRows, client.ClientID);
    return {
      ClientID: client.ClientID,
      Company_Name: client.Company_Name,
      PrimaryContact: client.PrimaryContact ?? '',
      ContactEmail: client.ContactEmail ?? '',
      AccountPhase: accountPhaseMode === 'manual'
        ? client.AccountPhase
        : deriveAccountPhase(projects, client.AccountPhase),
      AccountPhase_Mode: accountPhaseMode,
      SheetAccountPhase: client.AccountPhase,
      ContractValue: rollup ?? client.ContractValue,
      SheetContractValue: client.ContractValue,
      ContractValueSource: rollup === null ? 'clients' : 'finances',
      GoogleGroupEmail: client.GoogleGroupEmail ?? '',
      Tech_Stack: client.Tech_Stack ?? '',
      MCC_Subscriber_ID: client.MCC_Subscriber_ID ?? '',
      Oracle_Baseline_ID: client.Oracle_Baseline_ID ?? '',
      finance: financeSummary(snapshot.financeRows, client.ClientID),
      DepositPaid: client.DepositPaid,
      DriveFolderUrl: client.DriveFolderUrl ?? '',
      NotesDocUrl: client.NotesDocUrl ?? '',
      MSA_DocID: client.MSA_DocID ?? '',
      SOW_DocID: projects.find((project) => project.SOW_DocID)?.SOW_DocID ?? '',
      ChatSpaceUrl: client.ChatSpaceUrl ?? '',
      activeProjects: projects.map((project) => ({
        ProjectID: project.ProjectID,
        ClientID: project.ClientID,
        SprintStage: project.SprintStage,
        MilestonesTotal: project.MilestonesTotal,
        MilestonesDone: project.MilestonesDone,
        AssignedRateTier: project.AssignedRateTier,
        Title: project.Title,
        Est_Hours: project.Est_Hours,
        Actual_Hours: project.Actual_Hours,
        Google_Tasklist_ID: project.Google_Tasklist_ID,
        SOW_DocID: project.SOW_DocID,
        Project_Brief_DocID: project.Project_Brief_DocID,
        Project_Outline_DocID: project.Project_Outline_DocID,
        COMS_Sheet_URL: project.COMS_Sheet_URL,
        MeetingNotes_DriveFolderID: project.MeetingNotes_DriveFolderID,
        ChatSpace_URL: project.ChatSpace_URL,
        ChatSpace_Internal_URL: project.ChatSpace_Internal_URL,
        Dashboard_Sheet_ID: project.Dashboard_Sheet_ID,
        Kickoff_Date: project.Kickoff_Date,
        ParentProjectID: project.ParentProjectID,
        AddendumRef: project.AddendumRef,
        ActiveComponents: project.ActiveComponents ?? [],
      })),
      activeComponents,
      activePebble: client.Roadblock,
      roadblock: client.Roadblock,
      leadSource: client.Lead_Source,
      archetype: client.Archetype,
      serviceArea: client.Archetype ?? '',
      avatar: client.Company_Name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      posX: 120 + (index % 3) * 340,
      posY: 140 + Math.floor(index / 3) * 280,
    };
  });
}

function getPhaseMismatchAlerts(clients: ClientRecord[]): AlfredAlert[] {
  return clients.flatMap((client) => {
    const sheetPhase = client.SheetAccountPhase ?? client.AccountPhase;
    if (client.AccountPhase_Mode === 'manual' || sheetPhase === client.AccountPhase) return [];
    return [{
      id: `DERIVED-PHASE-${client.ClientID}`,
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      subRoutine: 'Housekeeping',
      clientId: client.ClientID,
      companyName: client.Company_Name,
      message: `Project stages derive ${client.AccountPhase}; the sheet lists ${sheetPhase}.`,
      dismissed: false,
    }];
  });
}

function createWriteRequestId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('This browser cannot create a secure write request ID.');
  }
  return globalThis.crypto.randomUUID();
}

const ACCOUNT_PHASE_VALUES: readonly AccountPhase[] = [
  '01: Intake',
  '02: Session Zero',
  '03: Active Sprints',
  '04: Liftoff',
  '05: Complete',
  '06: Archived/Sunset',
];

const SPRINT_STAGE_VALUES: readonly SprintStage[] = [
  '00: Discovery',
  '01: Vibecheck',
  '02: Contract & Inception',
  '03: Deep Intelligence',
  '04: Session Zero Kickoff',
  '05: Architecture & Builds',
  '06: Mid-Flight Review',
  '07: Final Staging & QA',
  '08: Liftoff & Handover',
  '09: Sunset / Retainer',
];

function isAccountPhase(value: unknown): value is AccountPhase {
  return ACCOUNT_PHASE_VALUES.some((phase) => phase === value);
}

function isSprintStage(value: unknown): value is SprintStage {
  return SPRINT_STAGE_VALUES.some((stage) => stage === value);
}

interface AppProps {
  isDemoModeInitial?: boolean;
}

export default function App({ isDemoModeInitial = false }: AppProps) {
  // Module 5: Strict route isolation for secondary cockpit window
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/cockpit')) {
    return (
      <div className="w-screen h-screen max-h-[1366px] overflow-hidden bg-[#020500] flex items-center justify-center">
        <CockpitWindow />
      </div>
    );
  }

  const [currentScreen, setCurrentScreen] = useState<ScreenView>(readStoredScreen);
  const [dashboardLevel, setDashboardLevel] = useState<DashboardLevel>(readStoredDashboardLevel);
  /** Phase F: /client/:clientId/project/:projectId; Solar stays mounted underneath so its camera is kept. */
  const [planet, setPlanet] = useState<PlanetRoute | null>(() => (typeof window === 'undefined' ? null : parsePlanetPath(window.location.pathname)));
  const planetRef = useRef<PlanetRoute | null>(planet);
  planetRef.current = planet;
  const planetCloseRef = useRef<() => void>(() => {});
  const [isDemoMode, setIsDemoMode] = useState<boolean>(isDemoModeInitial && !isLocalDataMode);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [alerts, setAlerts] = useState<AlfredAlert[]>([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([]);
  const seenNotificationIdsRef = useRef<string[]>([]);
  const [notificationStateError, setNotificationStateError] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [telemetry, setTelemetry] = useState<HudTelemetry | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<string>('Alfred');
  const [openNotificationDepartment, setOpenNotificationDepartment] = useState<NotificationDepartment | null>(null);
  const [pendingAgentDispatch, setPendingAgentDispatch] = useState<PendingAgentDispatch | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => readStoredId('szs.selected-client'));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => readStoredId('szs.selected-project'));
  const [snapshotOverlay, setSnapshotOverlay] = useState<SnapshotOverlay>(() => loadSnapshotOverlay().overlay);
  const snapshotOverlayRef = useRef(snapshotOverlay);
  const [snapshotOverlayError, setSnapshotOverlayError] = useState<string | null>(() => loadSnapshotOverlay().error);
  const [pendingWriteKeys, setPendingWriteKeys] = useState<ReadonlySet<string>>(() => new Set());
  const pendingWriteKeysRef = useRef<Set<string>>(new Set());
  const [writeError, setWriteError] = useState<string | null>(null);
  const [clientSends, setClientSends] = useState<Record<string, ClientSendState>>({});
  const [findingConfirm, setFindingConfirm] = useState<{
    alertId: string; clientName: string; financesValue: number; clientsValue: number;
  } | null>(null);
  const [findingConfirmError, setFindingConfirmError] = useState<string | null>(null);
  const [pendingTaskReads, setPendingTaskReads] = useState<ReadonlySet<string>>(() => new Set());
  const pendingTaskReadsRef = useRef<Set<string>>(new Set());
  const [projectTaskReadErrors, setProjectTaskReadErrors] = useState<Record<string, string>>({});
  /** Phase E6: full task lists (counts derive from these) and the open Dossier task panel. */
  const [projectTasks, setProjectTasks] = useState<Record<string, HudTask[]>>({});
  const [taskPanelProjectId, setTaskPanelProjectId] = useState<string | null>(null);
  const autoTaskReadsRef = useRef<Set<string>>(new Set());
  const projectTaskSummaries = useMemo<Record<string, ProjectTaskSummary>>(() => Object.fromEntries(
    Object.entries(projectTasks).map(([projectId, tasks]) => [projectId, summarizeProjectTasks(projectId, tasks)]),
  ), [projectTasks]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; client: ClientRecord; projectId?: string } | null>(null);
  /** Phase G3 report modals (opened from the client menu or a Dispatch money proposal). */
  const [statusSummaryClientId, setStatusSummaryClientId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pushToast = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-5), { id, kind, text }]);
    return id;
  }, []);
  const loadToastRef = useRef<number | null>(null);
  const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((item) => item.id !== id)), []);
  const [invoiceDraft, setInvoiceDraft] = useState<{ clientId: string; reason?: string } | null>(null);
  const [blockerTarget, setBlockerTarget] = useState<{ clientId: string; projectId?: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSourceReason, setDataSourceReason] = useState<string | null>(null);
  const [adapterStatus, setAdapterStatus] = useState<AdapterStatus>(
    isLocalDataMode ? DATA_ADAPTER_MODE : isDemoModeInitial ? 'mock' : 'offline',
  );
  const [rejectedRows, setRejectedRows] = useState<RejectedSnapshotRow[]>([]);
  const [staffSchemaRegistry, setStaffSchemaRegistry] = useState<StaffMeetingInput['schemaRegistry']>([]);
  const [schemaRegistry, setSchemaRegistry] = useState<SchemaRegistryRow[]>([]);
  const [schemaChanges, setSchemaChanges] = useState<SchemaChange[]>([]);
  const [schemaDataStatus, setSchemaDataStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [schemaDataError, setSchemaDataError] = useState<string | null>(null);
  const [oauthError, setOAuthError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  useEffect(() => {
    snapshotOverlayRef.current = snapshotOverlay;
  }, [snapshotOverlay]);

  useEffect(() => {
    try {
      localStorage.setItem('szs.current-screen', currentScreen);
      localStorage.setItem('szs.dashboard-level', dashboardLevel);
      if (selectedClientId) localStorage.setItem('szs.selected-client', selectedClientId);
      else localStorage.removeItem('szs.selected-client');
      if (selectedProjectId) localStorage.setItem('szs.selected-project', selectedProjectId);
      else localStorage.removeItem('szs.selected-project');
    } catch {
      setSnapshotOverlayError('The current view could not be saved in this browser.');
    }
  }, [currentScreen, dashboardLevel, selectedClientId, selectedProjectId]);

  useEffect(() => {
    if (DATA_ADAPTER_MODE !== 'mock') {
      setSchemaDataStatus('unavailable');
      setSchemaDataError('The selected adapter does not include schema registry or change-log data.');
      return;
    }
    let active = true;
    const adapter = new MockAdapter();
    void Promise.all([adapter.getSchemaRegistry(), adapter.getSchemaChangeLog()])
      .then(([rows, changes]) => {
        if (active) {
          setSchemaRegistry(rows);
          setSchemaChanges(changes);
          setStaffSchemaRegistry(rows.map(({ Column_Name, Data_Class }) => ({ Column_Name, Data_Class })));
          setSchemaDataStatus('available');
          setSchemaDataError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Unable to load mock schema data.';
          setSchemaDataStatus('unavailable');
          setSchemaDataError(message);
          setLoadError(message);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const saved = loadSeenNotificationIds();
    seenNotificationIdsRef.current = saved.ids;
    setSeenNotificationIds(saved.ids);
    setNotificationStateError(saved.error || null);
  }, []);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const [keymap, setKeymap] = useState<KeymapConfig>(loadStoredKeymap);
  const [isKeymapModalOpen, setIsKeymapModalOpen] = useState(false);
  const [controlGroups, setControlGroups] = useState<Record<number, string[]>>({ 1: [] });
  const [activeGroupNum, setActiveGroupNum] = useState<number | null>(1);

  const [currentSkin, setCurrentSkin] = useState<string>(() => {
    try {
      return localStorage.getItem('szs_chassis_skin') || 'heraldry-gold';
    } catch {
      return 'heraldry-gold';
    }
  });

  const [canvasZoom, setCanvasZoom] = useState<number>(() => readStoredCanvasZoom('szs.solar-zoom'));
  const [galaxyZoom, setGalaxyZoom] = useState<number>(() => readStoredCanvasZoom('szs.galaxy-zoom'));
  const [canvasResetRequest, setCanvasResetRequest] = useState(0);
  const [workbenchClient, setWorkbenchClient] = useState<ClientRecord | null>(null);
  const [interactionMode, setInteractionMode] = useState<'drag' | 'lock' | 'edit'>('drag');
  const [showNonStructural, setShowNonStructural] = useState<boolean>(true);
  const [wirePanel, setWirePanel] = useState<WirePanelSnapshot | null>(null);
  const [activeWireIds, setActiveWireIds] = useState<string[]>([]);
  const [completedNodeIdsByClient, setCompletedNodeIdsByClient] = useState<Record<string, string[]>>({});
  const activeWireTimeoutRef = useRef<number | null>(null);
  const wirePanelActionsRef = useRef<WirePanelActions | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('szs.solar-zoom', String(canvasZoom));
      localStorage.setItem('szs.galaxy-zoom', String(galaxyZoom));
    } catch {
      setSnapshotOverlayError('A canvas zoom setting could not be saved in this browser.');
    }
  }, [canvasZoom, galaxyZoom]);

  const handleWirePanelChange = useCallback((snapshot: WirePanelSnapshot | null) => {
    setWirePanel(snapshot);
  }, []);

  const handleWirePanelActionsChange = useCallback((actions: WirePanelActions | null) => {
    wirePanelActionsRef.current = actions;
  }, []);

  const handleAddProposal = useCallback((proposal: PendingProposal) => {
    setPendingProposals((previous) => [
      ...previous.filter((item) => item.id !== proposal.id),
      proposal,
    ].slice(-50));
  }, []);

  const handleDismissProposal = useCallback((proposalId: string) => {
    setPendingProposals((previous) => previous.filter((proposal) => proposal.id !== proposalId));
  }, []);

  const handleAcknowledgeNotification = useCallback((notificationId: string) => {
    if (seenNotificationIdsRef.current.includes(notificationId)) return;
    const next = [...seenNotificationIdsRef.current, notificationId];
    const error = persistSeenNotificationIds(next);
    if (error) {
      setNotificationStateError(error);
      return;
    }
    seenNotificationIdsRef.current = next;
    setSeenNotificationIds(next);
    setNotificationStateError(null);
  }, []);

  const handleDispatchAgent = useCallback((agent: AgentCallsign, nodeContext: AlfredNodeContext) => {
    const prompt = `@${agent} inspect [Node: ${nodeContext.label} (${nodeContext.id})]`;
    setActiveDepartment(agent);
    setPendingAgentDispatch({ id: Date.now(), agent, prompt, nodeContext });
  }, []);

  const handleAgentDispatchHandled = useCallback((dispatchId: number) => {
    setPendingAgentDispatch((current) => current?.id === dispatchId ? null : current);
  }, []);

  const activateWires = useCallback((linkIds: string[]) => {
    if (linkIds.length === 0) return;
    setActiveWireIds((previous) =>
      [...new Set([...previous, ...linkIds])].slice(-MAX_ANIMATED));
    if (activeWireTimeoutRef.current !== null) {
      window.clearTimeout(activeWireTimeoutRef.current);
    }
    activeWireTimeoutRef.current = window.setTimeout(() => {
      setActiveWireIds([]);
      activeWireTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleHudEventResult = useCallback((event: HudEvent, result: ReturnType<typeof publishHudEvent>) => {
    result.proposals.forEach(handleAddProposal);
    activateWires(result.activeLinkIds);
    result.alerts.forEach((policeEvent) => {
      const payloadMessage = policeEvent.payload?.message;
      const payloadSeverity = policeEvent.payload?.severity;
      const message = typeof payloadMessage === 'string'
        ? payloadMessage
        : `Master Control reported ${policeEvent.type.replaceAll('.', ' ')}.`;
      const severity = payloadSeverity === 'BLOCK' ? 'BLOCKER'
        : payloadSeverity === 'INFO' ? 'INFO' : 'WARNING';
      setAlerts((previous) => previous.some((alert) => alert.id === policeEvent.id)
        ? previous
        : [{
          id: policeEvent.id,
          timestamp: new Date().toISOString(),
          severity,
          subRoutine: 'Housekeeping',
          clientId: policeEvent.clientId,
          companyName: 'Housekeeping',
          message,
          dismissed: false,
        }, ...previous]);
      if (payloadSeverity === 'BLOCK' && typeof policeEvent.payload?.requestedCrisisState === 'string') {
        const proposal = stageCrisisOverrideFromBlockAlert({
          id: policeEvent.id,
          clientId: policeEvent.clientId,
          severity: 'BLOCK',
        }, policeEvent.payload.requestedCrisisState);
        if (proposal) handleAddProposal(proposal);
      }
    });
    if (event.clientId !== wirePanel?.clientId || result.unblockedLinkIds.length === 0) return;
    const unblockedLinkIds = new Set(result.unblockedLinkIds);
    const completedNodeIds = wirePanel.links
      .filter((link) => unblockedLinkIds.has(link.id))
      .map((link) => link.fromNodeId);
    if (completedNodeIds.length === 0) return;
    setCompletedNodeIdsByClient((previous) => ({
      ...previous,
      [event.clientId]: [...new Set([...(previous[event.clientId] || []), ...completedNodeIds])],
    }));
  }, [activateWires, handleAddProposal, wirePanel]);

  const handlePublishHudEvent = useCallback((event: HudEvent) => {
    handleHudEventResult(event, publishHudEvent(event, wirePanel?.links || []));
  }, [handleHudEventResult, wirePanel]);

  const handleSimulateHudEvent = useCallback((event: HudEvent) => {
    const simulationRules: readonly HudRule[] = [
      {
        id: 'dev-milestone-proposal-preview',
        status: 'approved',
        on: 'milestone.done',
        from: 'dolores',
        kind: 'context',
        to: '*',
        effect: 'propose',
        proposal: 'draft_invoice',
        moneyGate: true,
        note: 'Development-only preview; no invoice or ledger action was performed.',
      },
    ];
    const result = publishHudEvent(event, wirePanel?.links || [], { rules: simulationRules });
    handleHudEventResult(event, result);
  }, [handleHudEventResult, wirePanel]);

  const handleSimulateUnblockHudEvent = useCallback((event: HudEvent) => {
    const simulationRules: readonly HudRule[] = [
      {
        id: 'dev-msa-unblock-preview',
        status: 'approved',
        on: 'msa.signed',
        from: 'pamela',
        kind: 'dependency',
        to: 'vala',
        effect: 'unblock',
        note: 'Development-only preview; dependency status was not persisted.',
      },
    ];
    const result = publishHudEvent(event, wirePanel?.links || [], { rules: simulationRules });
    handleHudEventResult(event, result);
  }, [handleHudEventResult, wirePanel]);

  useEffect(() => () => {
    if (activeWireTimeoutRef.current !== null) {
      window.clearTimeout(activeWireTimeoutRef.current);
    }
  }, []);

  const handleCreateWire = useCallback((input: WireCreateInput) => {
    return wirePanelActionsRef.current?.create(input) ?? false;
  }, []);

  const handleSelectWire = useCallback((linkId: string | null) => {
    wirePanelActionsRef.current?.select(linkId);
  }, []);

  const handleUpdateWire = useCallback((linkId: string, updates: Partial<WireEditableFields>) => {
    wirePanelActionsRef.current?.update(linkId, updates);
  }, []);

  const handleReverseWire = useCallback((linkId: string) => {
    wirePanelActionsRef.current?.reverse(linkId);
  }, []);

  const handleRemoveWire = useCallback((linkId: string) => {
    wirePanelActionsRef.current?.remove(linkId);
  }, []);

  const handleToggleSkin = useCallback(() => {
    setCurrentSkin((prev) => {
      const next = prev === 'heraldry-gold' ? 'stealth-obsidian' : 'heraldry-gold';
      document.documentElement.setAttribute('data-skin', next);
      try { localStorage.setItem('szs_chassis_skin', next); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', currentSkin);
  }, [currentSkin]);

  // Load state from Master Control API or Fallback Demo Fleet
  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      if (isLocalDataMode) {
        const adapter = createDataAdapter();
        setIsLoading(true);
        setLoadError(null);
        setDataSourceReason(null);
        setAdapterStatus(adapter.status());
        try {
          const [snapshot, snapshotAlerts] = await Promise.all([
            adapter.getSnapshot(),
            adapter.getAlerts(),
          ]);
          if (controller.signal.aborted) return;
          const baseClients = mapSnapshotClients(snapshot);
          const localOverlay = adapter.status() === 'snapshot'
            ? snapshotOverlayRef.current
            : emptySnapshotOverlay();
          const mappedClients = applySnapshotOverlay(baseClients, localOverlay);
          const mappedAlerts = [
            ...snapshotAlerts.map((alert) => mapLocalAlert(alert, mappedClients)),
            ...getPhaseMismatchAlerts(mappedClients),
          ];
          setClients(mappedClients);
          setAlerts(mappedAlerts);
          setRejectedRows(adapter.getRejectedRows());
          setAdapterStatus(adapter.status());
          setTelemetry({
            pipelineMrr: mappedClients.reduce((sum, client) => sum + client.ContractValue, 0),
            activeSprints: mappedClients.filter((client) => client.AccountPhase === '03: Active Sprints').length,
            missingDeposits: mappedClients.filter((client) => client.AccountPhase === '02: Session Zero' && !client.DepositPaid).length,
            activeAlertsCount: mappedAlerts.filter((alert) => !alert.dismissed).length,
            lastSynced: adapter.status() === 'snapshot' ? 'Local CSV snapshot' : 'Mock data',
          });
          const storedClientId = readStoredId('szs.selected-client');
          const selectedClient = storedClientId
            ? mappedClients.find((client) => client.ClientID === storedClientId) ?? mappedClients[0] ?? null
            : dashboardLevel === 'galaxy' ? null : mappedClients[0] ?? null;
          setSelectedClientId(selectedClient?.ClientID ?? null);
          const storedProjectId = readStoredId('szs.selected-project');
          setSelectedProjectId(selectedClient?.activeProjects.some((project) => project.ProjectID === storedProjectId)
            ? storedProjectId
            : selectedClient?.activeProjects[0]?.ProjectID ?? null);
        } catch (error) {
          if (!controller.signal.aborted) {
            setLoadError(error instanceof Error ? error.message : 'Unable to load local data.');
            setAdapterStatus('offline');
            setClients([]);
            setAlerts([]);
            setRejectedRows([]);
            setTelemetry(null);
          }
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
        return;
      }

      if (isDemoMode) {
        setIsLoading(false);
        setLoadError(null);
        setDataSourceReason(null);
        setAdapterStatus('mock');
        const mappedClients: ClientRecord[] = DEMO_CLIENT_UNITS.map((u) => ({
          ClientID: u.id,
          Company_Name: u.companyName || u.name,
          PrimaryContact: u.primaryContact || '',
          ContactEmail: u.contactEmail || '',
          AccountPhase: normalizeAccountPhase(u.pipelineStage || '01: Intake'),
          ContractValue: u.contractValue,
          DepositPaid: u.depositPaid,
          DriveFolderUrl: u.driveFolderUrl || '',
          NotesDocUrl: u.notesDocUrl || '',
          MSA_DocID: u.MSA_DocID || '',
          SOW_DocID: u.SOW_DocID || '',
          ChatSpaceUrl: u.chatSpaceUrl || '',
          activeProjects: [
            {
              ProjectID: `PRJ-${u.id}-01`,
              ClientID: u.id,
              SprintStage: normalizeSprintStage(u.pipelineStage || '00: Discovery'),
              MilestonesTotal: u.totalMilestones || 4,
              MilestonesDone: u.completedMilestones || 1,
              AssignedRateTier: 'Normal',
              Title: u.currentMilestone || 'Sprint Architecture & Execution',
            },
          ],
          activePebble: u.activePebble,
          roadblock: u.roadblock,
          avatar: u.avatar,
          archetype: u.archetype,
          caseFileJsonUrl: u.caseFileJsonUrl,
          osintGenerated: u.osintGenerated,
          leadSource: u.leadSource,
        }));
        parseRows('Demo clients', mappedClients, ClientSchema);
        setClients(mappedClients);
        const mockAlerts = await new MockAdapter().getAlerts();
        setAlerts([
          ...DEMO_ALERTS,
          ...mockAlerts.map((alert) => ({
            id: alert.Alert_ID,
            timestamp: alert.Created_At,
            severity: alert.Severity,
            subRoutine: alert.Department,
            clientId: mappedClients.some((client) => client.ClientID === alert.Client_ID)
              ? alert.Client_ID || ''
              : '',
            companyName: alert.Client_ID ? `Mock client ${alert.Client_ID}` : 'Mock system alert',
            message: `${alert.Trigger_Condition}: ${alert.Prescribed_Action}`,
            dismissed: alert.Action_Status.toLowerCase() !== 'open',
          })),
        ]);
        setTelemetry(DEMO_TELEMETRY);
        setSelectedClientId(mappedClients[0]?.ClientID || null);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setDataSourceReason(null);

      try {
        const adapter = createDataAdapter(accessToken);
        const [snapshot, liveAlerts, registry, changes] = await Promise.all([
          adapter.getSnapshot(),
          adapter.getAlerts(),
          adapter.getSchemaRegistry(),
          adapter.getSchemaChangeLog(),
        ]);
        if (controller.signal.aborted) return;
        const mappedClients = mapSnapshotClients(snapshot);
        const mappedAlerts = [
          ...liveAlerts.map((alert) => mapLocalAlert(alert, mappedClients)),
          ...getPhaseMismatchAlerts(mappedClients),
        ];
        setClients(mappedClients);
        setAlerts(mappedAlerts);
        setRejectedRows(adapter.getRejectedRows());
        setSchemaRegistry(registry);
        setSchemaChanges(changes);
        setAdapterStatus('live');
        setDataSourceReason(adapter.warnings?.().join(' ') || null);
        setTelemetry({
          pipelineMrr: mappedClients.reduce((sum, client) => sum + client.ContractValue, 0),
          activeSprints: mappedClients.filter((client) => client.AccountPhase === '03: Active Sprints').length,
          missingDeposits: mappedClients.filter((client) => client.AccountPhase === '02: Session Zero' && !client.DepositPaid).length,
          activeAlertsCount: mappedAlerts.filter((alert) => !alert.dismissed).length,
          lastSynced: new Date().toLocaleString(),
        });
        const storedClientId = readStoredId('szs.selected-client');
        const selectedClient = storedClientId
          ? mappedClients.find((client) => client.ClientID === storedClientId) ?? mappedClients[0] ?? null
          : dashboardLevel === 'galaxy' ? null : mappedClients[0] ?? null;
        setSelectedClientId(selectedClient?.ClientID ?? null);
        const storedProjectId = readStoredId('szs.selected-project');
        setSelectedProjectId(selectedClient?.activeProjects.some((project) => project.ProjectID === storedProjectId)
          ? storedProjectId
          : selectedClient?.activeProjects[0]?.ProjectID ?? null);
      } catch (error) {
        if (!controller.signal.aborted) {
          const liveError = error instanceof Error ? error.message : 'The live Master Control read failed.';
          try {
            const fallback = new SnapshotAdapter();
            const [snapshot, snapshotAlerts, registry, changes] = await Promise.all([
              fallback.getSnapshot(),
              fallback.getAlerts(),
              fallback.getSchemaRegistry(),
              fallback.getSchemaChangeLog(),
            ]);
            if (controller.signal.aborted) return;
            const mappedClients = applySnapshotOverlay(
              mapSnapshotClients(snapshot),
              snapshotOverlayRef.current,
            );
            const mappedAlerts = [
              ...snapshotAlerts.map((alert) => mapLocalAlert(alert, mappedClients)),
              ...getPhaseMismatchAlerts(mappedClients),
            ];
            setClients(mappedClients);
            setAlerts(mappedAlerts);
            setRejectedRows(fallback.getRejectedRows());
            setSchemaRegistry(registry);
            setSchemaChanges(changes);
            setAdapterStatus('stale');
            const fallbackReason = `Live Master Control read failed; showing the local CSV snapshot instead. ${liveError}`;
            setLoadError(fallbackReason);
            setDataSourceReason(fallbackReason);
            setTelemetry({
              pipelineMrr: mappedClients.reduce((sum, client) => sum + client.ContractValue, 0),
              activeSprints: mappedClients.filter((client) => client.AccountPhase === '03: Active Sprints').length,
              missingDeposits: mappedClients.filter((client) => client.AccountPhase === '02: Session Zero' && !client.DepositPaid).length,
              activeAlertsCount: mappedAlerts.filter((alert) => !alert.dismissed).length,
              lastSynced: 'Local CSV snapshot fallback',
            });
            const storedClientId = readStoredId('szs.selected-client');
            const selectedClient = storedClientId
              ? mappedClients.find((client) => client.ClientID === storedClientId) ?? mappedClients[0] ?? null
              : dashboardLevel === 'galaxy' ? null : mappedClients[0] ?? null;
            setSelectedClientId(selectedClient?.ClientID ?? null);
            const storedProjectId = readStoredId('szs.selected-project');
            setSelectedProjectId(selectedClient?.activeProjects.some((project) => project.ProjectID === storedProjectId)
              ? storedProjectId
              : selectedClient?.activeProjects[0]?.ProjectID ?? null);
          } catch (fallbackError) {
            const fallbackMessage = fallbackError instanceof Error
              ? fallbackError.message
              : 'The local CSV snapshot could not be loaded.';
            setLoadError(`Live Master Control read failed (${liveError}); snapshot fallback failed (${fallbackMessage}).`);
            setDataSourceReason(`Live read and snapshot fallback failed: ${fallbackMessage}`);
            setAdapterStatus('offline');
            setClients([]);
            setAlerts([]);
            setRejectedRows([]);
            setTelemetry(null);
          }
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadData();
    return () => controller.abort();
  }, [accessToken, fetchAttempt, isDemoMode]);

  useEffect(() => {
    if (DATA_ADAPTER_MODE !== 'live' || !accessToken || isLoading) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setFetchAttempt((attempt) => attempt + 1);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [accessToken, isLoading]);

  const activeClient = clients.find((c) => c.ClientID === selectedClientId) || clients[0] || null;
  // Parking lot D4: the prototype screens read the old ClientUnit shape; map live records instead of `as any`.
  const clientUnits = useMemo(() => clients.map(toClientUnit), [clients]);
  const activeClientUnit = activeClient ? toClientUnit(activeClient) : null;

  useEffect(() => {
    if (currentScreen !== 'dashboard') return;
    if (dashboardLevel !== 'solar') {
      setWorkbenchClient(null);
      return;
    }
    if (activeClient) setWorkbenchClient(activeClient);
  }, [currentScreen, dashboardLevel, selectedClientId, clients]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || activeModal || isKeymapModalOpen || contextMenu) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="dialog"]')) return;
      if (planetRef.current) {
        planetCloseRef.current();
        return;
      }
      if (dashboardLevel === 'solar') {
        setDashboardLevel('galaxy');
        setWorkbenchClient(null);
      } else if (dashboardLevel === 'galaxy') {
        setDashboardLevel('universe');
        setSelectedProjectId(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeModal, contextMenu, dashboardLevel, isKeymapModalOpen]);

  const staffMeetingInput: StaffMeetingInput = {
    clients: clients.map((client) => ({
      clientId: client.ClientID,
      phase: client.AccountPhase,
      projectStages: client.activeProjects.map((project) => project.SprintStage),
      depositPaid: client.DepositPaid,
    })),
    alerts: alerts
      .filter((alert) => !alert.dismissed)
      .map((alert) => ({
        department: alert.subRoutine === 'Alfred' ? 'Housekeeping' : alert.subRoutine,
        severity: alert.severity === 'BLOCKER' ? 'BLOCK'
          : alert.severity === 'WARNING' ? 'WARN' : alert.severity,
      })),
    proposals: pendingProposals
      .filter((proposal) => proposal.status === 'pending')
      .map((proposal) => ({
        title: proposal.title,
        type: proposal.type,
        requiresMoneyGate: proposal.requiresMoneyGate,
        clientFacing: proposal.clientFacing,
      })),
    schemaRegistry: staffSchemaRegistry,
  };

  const handleLogTerminal = (text: string, type: TerminalLog['type'] = 'normal') => {
    const now = new Date();
    setTerminalLogs((previous) => [
      ...previous.slice(-49),
      {
        id: now.toISOString(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text,
        type,
      },
    ]);
  };

  const handleUpdateClient = (updated: ClientRecord) => {
    setClients((prev) => prev.map((c) => (c.ClientID === updated.ClientID ? updated : c)));
    setWorkbenchClient((current) => current?.ClientID === updated.ClientID ? updated : current);
  };

  const saveSnapshotOverlay = (next: SnapshotOverlay): boolean => {
    if (adapterStatus !== 'snapshot') return false;
    try {
      localStorage.setItem(SNAPSHOT_OVERLAY_KEY, JSON.stringify(next));
    } catch (error) {
      setSnapshotOverlayError(error instanceof Error
        ? `Local changes could not be saved: ${error.message}`
        : 'Local changes could not be saved in this browser.');
      return false;
    }
    snapshotOverlayRef.current = next;
    setSnapshotOverlay(next);
    setSnapshotOverlayError(null);
    return true;
  };

  const setWritePending = (keys: string[], pending: boolean) => {
    const next = new Set(pendingWriteKeysRef.current);
    keys.forEach((key) => pending ? next.add(key) : next.delete(key));
    pendingWriteKeysRef.current = next;
    setPendingWriteKeys(next);
  };

  const updateClientRecord = (clientId: string, update: (client: ClientRecord) => ClientRecord) => {
    setClients((previous) => previous.map((client) => (
      client.ClientID === clientId ? update(client) : client
    )));
    setWorkbenchClient((current) => (
      current?.ClientID === clientId ? update(current) : current
    ));
  };

  const clearConfirmedOverlayEntry = (kind: 'client' | 'project', id: string) => {
    const next = kind === 'client'
      ? withoutClientPhase(snapshotOverlayRef.current, id)
      : withoutProjectStage(snapshotOverlayRef.current, id);
    try {
      localStorage.setItem(SNAPSHOT_OVERLAY_KEY, JSON.stringify(next));
    } catch (error) {
      setSnapshotOverlayError(error instanceof Error
        ? `Confirmed sheet data could not clear its local overlay: ${error.message}`
        : 'Confirmed sheet data could not clear its local overlay.');
      return;
    }
    snapshotOverlayRef.current = next;
    setSnapshotOverlay(next);
    setSnapshotOverlayError(null);
  };

  const persistAccountPhase = async (
    clientId: string,
    mode: 'auto' | 'manual',
    phase?: AccountPhase,
  ) => {
    if (adapterStatus === 'snapshot') {
      const next = mode === 'manual' && phase
        ? withClientPhase(snapshotOverlayRef.current, clientId, phase)
        : withClientPhaseMode(snapshotOverlayRef.current, clientId, 'auto');
      if (!saveSnapshotOverlay(next)) return;
      setClients((previous) => applySnapshotOverlay(previous, next));
      return;
    }
    if (adapterStatus !== 'live') return;
    if (!accessToken) {
      setWriteError('Sign in to Master Control before making a live account-phase change.');
      return;
    }

    const client = clients.find((candidate) => candidate.ClientID === clientId);
    const keys = [`client:${clientId}`];
    if (!client) {
      setWriteError(`Client ${clientId} is no longer available in the HUD.`);
      return;
    }
    if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
    let requestId: string;
    try {
      requestId = createWriteRequestId();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Could not create a secure write request ID.');
      return;
    }

    const previous = client;
    const optimisticPhase = mode === 'manual' && phase
      ? phase
      : deriveAccountPhase(client.activeProjects, client.SheetAccountPhase ?? client.AccountPhase);
    updateClientRecord(clientId, (current) => ({
      ...current,
      AccountPhase: optimisticPhase,
      AccountPhase_Mode: mode,
    }));
    setWriteError(null);
    setWritePending(keys, true);
    try {
      const result = await writeMasterControl(accessToken, 'setAccountPhase', {
        clientId,
        mode,
        ...(phase ? { phase } : {}),
      }, requestId);
      const confirmedPhase = result.after.AccountPhase;
      if (result.after.clientId !== clientId
        || !isAccountPhase(confirmedPhase)
        || result.after.AccountPhase_Mode !== mode
        || (mode === 'manual' && confirmedPhase !== phase)) {
        throw new Error('Master Control returned an unexpected account-phase read-back.');
      }
      updateClientRecord(clientId, (current) => ({
        ...current,
        AccountPhase: confirmedPhase,
        SheetAccountPhase: confirmedPhase,
        AccountPhase_Mode: mode,
      }));
      clearConfirmedOverlayEntry('client', clientId);
      const sunsetAlertId = result.after.sunsetAlertId;
      if (typeof sunsetAlertId === 'string'
        && result.after.sunsetAlertStatus === 'Requested'
        && result.after.sunsetAlertDepartment === 'Daisy') {
        setAlerts((previousAlerts) => [{
          id: sunsetAlertId,
          timestamp: new Date().toISOString(),
          severity: 'INFO',
          subRoutine: 'Daisy',
          clientId,
          companyName: client.Company_Name,
          message: 'Client sunset requested: Review the sunset request.',
          dismissed: false,
          actionStatus: 'Requested',
        }, ...previousAlerts.filter((alert) => alert.id !== sunsetAlertId)]);
      }
    } catch (error) {
      updateClientRecord(clientId, (current) => ({
        ...current,
        AccountPhase: previous.AccountPhase,
        SheetAccountPhase: previous.SheetAccountPhase,
        AccountPhase_Mode: previous.AccountPhase_Mode,
      }));
      setWriteError(error instanceof Error
        ? `Account phase was not saved: ${error.message}`
        : 'Account phase was not saved. Master Control returned an unknown error.');
    } finally {
      setWritePending(keys, false);
    }
  };

  const handleSetAccountPhase = (clientId: string, phase: AccountPhase) =>
    persistAccountPhase(clientId, 'manual', phase);

  const handleResetAccountPhase = (clientId: string) =>
    persistAccountPhase(clientId, 'auto');

  const handleSetSprintStage = async (projectId: string, stage: SprintStage) => {
    if (adapterStatus === 'snapshot') {
      const next = withProjectStage(snapshotOverlayRef.current, projectId, stage);
      if (!saveSnapshotOverlay(next)) return;
      setClients((previous) => applySnapshotOverlay(previous, next));
      return;
    }
    if (adapterStatus !== 'live') return;
    if (!accessToken) {
      setWriteError('Sign in to Master Control before making a live sprint-stage change.');
      return;
    }

    const client = clients.find((candidate) =>
      candidate.activeProjects.some((project) => project.ProjectID === projectId),
    );
    const project = client?.activeProjects.find((candidate) => candidate.ProjectID === projectId);
    if (!client || !project) {
      setWriteError(`Project ${projectId} is no longer available in the HUD.`);
      return;
    }
    const keys = [`client:${client.ClientID}`, `project:${projectId}`];
    if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
    let requestId: string;
    try {
      requestId = createWriteRequestId();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Could not create a secure write request ID.');
      return;
    }

    const previousPhase = client.AccountPhase;
    const previousSheetPhase = client.SheetAccountPhase;
    const previousMode = client.AccountPhase_Mode;
    const previousStage = project.SprintStage;
    const optimisticProjects = client.activeProjects.map((current) => (
      current.ProjectID === projectId ? { ...current, SprintStage: stage } : current
    ));
    const optimisticPhase = previousMode === 'manual'
      ? previousPhase
      : deriveAccountPhase(optimisticProjects, previousSheetPhase ?? previousPhase);
    updateClientRecord(client.ClientID, (current) => ({
      ...current,
      AccountPhase: optimisticPhase,
      activeProjects: current.activeProjects.map((currentProject) => (
        currentProject.ProjectID === projectId
          ? { ...currentProject, SprintStage: stage }
          : currentProject
      )),
    }));
    setWriteError(null);
    setWritePending(keys, true);
    try {
      const result = await writeMasterControl(accessToken, 'setSprintStage', {
        projectId,
        stage,
      }, requestId);
      const confirmedPhase = result.after.AccountPhase;
      const confirmedStage = result.after.SprintStage;
      if (result.after.projectId !== projectId
        || !isSprintStage(confirmedStage)
        || confirmedStage !== stage
        || !isAccountPhase(confirmedPhase)
        || result.after.AccountPhase_Mode !== (previousMode ?? 'auto')) {
        throw new Error('Master Control returned an unexpected sprint-stage read-back.');
      }
      updateClientRecord(client.ClientID, (current) => ({
        ...current,
        AccountPhase: confirmedPhase,
        SheetAccountPhase: confirmedPhase,
        AccountPhase_Mode: previousMode ?? 'auto',
        activeProjects: current.activeProjects.map((currentProject) => (
          currentProject.ProjectID === projectId
            ? { ...currentProject, SprintStage: confirmedStage }
            : currentProject
        )),
      }));
      clearConfirmedOverlayEntry('project', projectId);
    } catch (error) {
      updateClientRecord(client.ClientID, (current) => ({
        ...current,
        AccountPhase: previousPhase,
        SheetAccountPhase: previousSheetPhase,
        AccountPhase_Mode: previousMode,
        activeProjects: current.activeProjects.map((currentProject) => (
          currentProject.ProjectID === projectId
            ? { ...currentProject, SprintStage: previousStage }
            : currentProject
        )),
      }));
      setWriteError(error instanceof Error
        ? `Sprint stage was not saved: ${error.message}`
        : 'Sprint stage was not saved. Master Control returned an unknown error.');
    } finally {
      setWritePending(keys, false);
    }
  };

  const handleLoadProjectTasks = async (projectId: string) => {
    if (adapterStatus !== 'live') {
      setProjectTaskReadErrors((previous) => ({
        ...previous,
        [projectId]: 'Project task reads require live Master Control data.',
      }));
      return;
    }
    if (!accessToken) {
      setProjectTaskReadErrors((previous) => ({
        ...previous,
        [projectId]: 'Sign in to Master Control before loading project tasks.',
      }));
      return;
    }
    const project = clients.flatMap((client) => client.activeProjects)
      .find((candidate) => candidate.ProjectID === projectId);
    if (!project?.Google_Tasklist_ID) {
      setProjectTaskReadErrors((previous) => ({
        ...previous,
        [projectId]: 'This project has no Google Tasks list configured.',
      }));
      return;
    }
    if (pendingTaskReadsRef.current.has(projectId)) return;

    pendingTaskReadsRef.current = new Set(pendingTaskReadsRef.current).add(projectId);
    setPendingTaskReads(pendingTaskReadsRef.current);
    setProjectTaskReadErrors((previous) => {
      const next = { ...previous };
      delete next[projectId];
      return next;
    });
    try {
      const list = await fetchMasterControlProjectTasks(accessToken, projectId);
      setProjectTasks((previous) => ({ ...previous, [projectId]: list.tasks }));
    } catch (error) {
      setProjectTaskReadErrors((previous) => ({
        ...previous,
        [projectId]: error instanceof Error
          ? error.message
          : 'Master Control could not confirm the project task read.',
      }));
    } finally {
      const next = new Set(pendingTaskReadsRef.current);
      next.delete(projectId);
      pendingTaskReadsRef.current = next;
      setPendingTaskReads(next);
    }
  };

  const handleSetAlertStatus = async (alertId: string, status: 'Open' | 'Resolved') => {
    if (adapterStatus !== 'live') return;
    if (!accessToken) {
      setWriteError('Sign in to Master Control before changing a live alert.');
      return;
    }
    const alert = alerts.find((candidate) => candidate.id === alertId);
    const keys = [`alert:${alertId}`];
    if (!alert) {
      setWriteError(`Alert ${alertId} is no longer available in the HUD.`);
      return;
    }
    if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
    let requestId: string;
    try {
      requestId = createWriteRequestId();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Could not create a secure write request ID.');
      return;
    }

    const previousStatus = alert.actionStatus;
    const optimistic = { ...alert, actionStatus: status, dismissed: status === 'Resolved' };
    setAlerts((previous) => previous.map((current) => current.id === alertId ? optimistic : current));
    setWriteError(null);
    setWritePending(keys, true);
    try {
      const result = await writeMasterControl(accessToken, 'resolveAlert', { alertId, status }, requestId);
      if (result.after.alertId !== alertId
        || result.after.Action_Status !== status
        || result.after.Dismissed_Status !== (status === 'Resolved')) {
        throw new Error('Master Control returned an unexpected alert read-back.');
      }
      setAlerts((previous) => previous.map((current) => current.id === alertId
        ? { ...current, actionStatus: status, dismissed: status === 'Resolved' }
        : current));
    } catch (error) {
      setAlerts((previous) => previous.map((current) => current.id === alertId
        ? { ...current, actionStatus: previousStatus, dismissed: alert.dismissed }
        : current));
      setWriteError(error instanceof Error
        ? `Alert status was not saved: ${error.message}`
        : 'Alert status was not saved. Master Control returned an unknown error.');
    } finally {
      setWritePending(keys, false);
    }
  };

  /** Police R1 resolve (Plan v3.1 D2): "finances" restores the roll-up; "clients" changes money, so it needs the confirmation dialog. */
  const runResolveFinding = async (alertId: string, choice: 'finances' | 'clients') => {
    if (adapterStatus !== 'live' || !accessToken) {
      setWriteError('Sign in to Master Control before resolving a live finding.');
      return;
    }
    const keys = [`alert:${alertId}`];
    if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
    let requestId: string;
    try {
      requestId = createWriteRequestId();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Could not create a secure write request ID.');
      return;
    }
    setWriteError(null);
    setWritePending(keys, true);
    try {
      const result = await writeMasterControl(accessToken, 'resolveFinding', { alertId, choice }, requestId);
      if (result.after.alertId !== alertId || result.after.choice !== choice) {
        throw new Error('Master Control returned an unexpected finding read-back.');
      }
      setFindingConfirm(null);
      setFetchAttempt((attempt) => attempt + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Master Control returned an unknown error.';
      setFindingConfirmError(message);
      setWriteError(`Finding was not resolved: ${message}`);
    } finally {
      setWritePending(keys, false);
    }
  };

  /** Plan v3.1 E5: Daisy's preview, then (after the owner confirms in the Client Dossier) an audited post to the client space. */
  // State lives here (not in the bay) so a collapsing Dossier bay never loses a draft or an in-flight post.
  const patchClientSend = (projectId: string, next: (current: ClientSendState) => ClientSendState) => {
    setClientSends((all) => ({ ...all, [projectId]: next(all[projectId] ?? { step: 'idle' }) }));
  };
  const clientSendError = (error: unknown) => (error instanceof Error ? error.message : 'Master Control returned an unknown error.');
  const clientComms: ClientCommsHandlers | undefined = adapterStatus === 'live' && accessToken ? {
    states: clientSends,
    busy: Object.values(clientSends).some((state) => ['loading', 'preview', 'sending'].includes(state.step)),
    preview: (projectId) => {
      const current = clientSends[projectId];
      if (current && ['loading', 'preview', 'sending'].includes(current.step)) return;
      patchClientSend(projectId, (state) => ({ step: 'loading', lastSent: state.lastSent }));
      fetchClientMessagePreview(accessToken, projectId).then(
        (preview) => patchClientSend(projectId, (state) => ({
          step: 'preview', lastSent: state.lastSent, text: preview.text, warnings: preview.warnings,
          overdue: preview.overdue.length, spaceUrl: preview.spaceUrl,
          finalAllowed: preview.finalAllowed, finalReason: preview.finalReason, final: false,
        })),
        (error) => patchClientSend(projectId, (state) => ({ step: 'error', message: clientSendError(error), lastSent: state.lastSent })),
      );
    },
    edit: (projectId, text) => patchClientSend(projectId, (state) => (state.step === 'preview' ? { ...state, text, error: undefined } : state)),
    setFinal: (projectId, final) => patchClientSend(projectId, (state) => (state.step === 'preview' && state.finalAllowed ? { ...state, final, error: undefined } : state)),
    close: (projectId) => patchClientSend(projectId, (state) => (state.step === 'sending' ? state : { step: 'idle', lastSent: state.lastSent })),
    send: (projectId) => {
      const draft = clientSends[projectId];
      const keys = [`chat:${projectId}`];
      if (!draft || draft.step !== 'preview' || !draft.text.trim()) return;
      if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
      let requestId: string;
      try {
        requestId = createWriteRequestId();
      } catch (error) {
        patchClientSend(projectId, (state) => (state.step === 'preview' ? { ...state, error: clientSendError(error) } : state));
        return;
      }
      const { text, warnings, overdue, spaceUrl, finalAllowed, finalReason, final } = draft;
      const sendFinal = final && finalAllowed;
      patchClientSend(projectId, (state) => ({ step: 'sending', lastSent: state.lastSent, text, warnings, overdue, spaceUrl, finalAllowed, finalReason, final }));
      setWritePending(keys, true);
      writeMasterControl(accessToken, 'sendClientMessage', sendFinal ? { projectId, text, final: true } : { projectId, text }, requestId)
        .then((result) => {
          const messageName = typeof result.after.messageName === 'string' ? result.after.messageName : '';
          if (result.after.projectId !== projectId || !messageName) {
            throw new Error('Master Control returned an unexpected message read-back.');
          }
          patchClientSend(projectId, () => ({ step: 'sent', lastSent: { at: new Date().toISOString(), messageName, spaceUrl } }));
          handleLogTerminal(`Daisy posted to the ${projectId} client Chat Space (${messageName}).`, 'server');
          if (sendFinal) {
            if (result.after.archived === true) {
              handleLogTerminal(`Final message: the ${projectId} client folder moved to Sanctum Inactive. Undo: card menu > Restore client folder.`, 'server');
              pushToast('ok', `Final message sent; client folder archived to Sanctum Inactive.`);
            } else {
              pushToast('warn', `Final message sent, but the client folder was not archived: ${String(result.after.archiveError || 'move not confirmed')}`);
            }
          }
        })
        .catch((error) => {
          patchClientSend(projectId, (state) => ({ step: 'preview', lastSent: state.lastSent, text, warnings, overdue, spaceUrl, finalAllowed, finalReason, final, error: clientSendError(error) }));
        })
        .finally(() => setWritePending(keys, false));
    },
  } : undefined;

  // Save timing in the status terminal: total round trip and the server's own steps (lock wait, prepare, apply, Police).
  useEffect(() => {
    const onTiming = (event: Event) => {
      const { action, roundTripMs, server } = (event as CustomEvent<{ action: string; roundTripMs: number; server: Record<string, unknown> }>).detail;
      const seconds = (ms: unknown) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)} s` : '?');
      const total = typeof server.totalMs === 'number' ? server.totalMs : null;
      const steps = typeof server.lockMs === 'number' && total !== null
        ? ` (server ${seconds(total)}: lock wait ${seconds(server.lockMs)}, prepare ${seconds(Number(server.prepareMs) - Number(server.auditSetupMs))}, apply ${seconds(Number(server.applyMs) - Number(server.prepareMs))}, after ${seconds(total - Number(server.readBackMs))}; Google round trip ${seconds(roundTripMs - total)})`
        : '';
      handleLogTerminal(`Saved ${action} in ${seconds(roundTripMs)}${steps}.`, 'server');
      pushToast('ok', `Saved (${action}) in ${seconds(roundTripMs)}.`);
    };
    const onMenu = (event: Event) => {
      const { state, reason } = (event as CustomEvent<{ state: string; reason: string }>).detail;
      handleLogTerminal(`Client menu ${state} (${reason}).`, 'action');
    };
    window.addEventListener('hud-write-timing', onTiming);
    window.addEventListener('hud-client-menu', onMenu);
    return () => {
      window.removeEventListener('hud-write-timing', onTiming);
      window.removeEventListener('hud-client-menu', onMenu);
    };
    // handleLogTerminal only appends to the terminal; re-subscribing each render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (writeError) pushToast('error', writeError);
  }, [writeError, pushToast]);
  // Data-load failures (hidden before 2026-11-05) show as a toast, which clears itself once data loads.
  useEffect(() => {
    if (loadToastRef.current !== null) {
      const stale = loadToastRef.current;
      setToasts((current) => current.filter((item) => item.id !== stale));
      loadToastRef.current = null;
    }
    if (loadError) loadToastRef.current = pushToast('error', `Data did not load: ${loadError}`);
  }, [loadError, pushToast]);

  /** Plan v3.1 E6: task counts load on their own once live, so Galaxy and Universe cards show real numbers. */
  useEffect(() => {
    if (adapterStatus !== 'live' || !accessToken) return;
    clients.flatMap((client) => client.activeProjects)
      .filter((project) => project.Google_Tasklist_ID && !autoTaskReadsRef.current.has(project.ProjectID))
      .forEach((project) => {
        autoTaskReadsRef.current.add(project.ProjectID);
        void handleLoadProjectTasks(project.ProjectID);
      });
    // handleLoadProjectTasks is recreated each render; the ref keeps this to one automatic read per project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterStatus, accessToken, clients]);

  const taskWriteError = (error: unknown) => (error instanceof Error ? error.message : 'Master Control returned an unknown error.');
  const setTaskReadError = (projectId: string, message: string | null) => setProjectTaskReadErrors((previous) => {
    const next = { ...previous };
    if (message) next[projectId] = message; else delete next[projectId];
    return next;
  });
  const replaceProjectTasks = (projectId: string, update: (tasks: HudTask[]) => HudTask[]) => {
    setProjectTasks((previous) => {
      const tasks = update(previous[projectId] ?? []);
      return { ...previous, [projectId]: tasks };
    });
  };

  /** Plan v3.1 E6: create / complete / reopen through hud_write with read-back; the panel lives in the Client Dossier. */
  const taskHandlers: ProjectTaskHandlers | undefined = adapterStatus === 'live' && accessToken ? {
    tasks: projectTasks,
    loading: pendingTaskReads,
    errors: projectTaskReadErrors,
    pendingWriteKeys,
    openProjectId: taskPanelProjectId,
    open: (projectId) => {
      setTaskPanelProjectId(projectId);
      if (!projectTasks[projectId]) void handleLoadProjectTasks(projectId);
    },
    close: () => setTaskPanelProjectId(null),
    reload: (projectId) => { void handleLoadProjectTasks(projectId); },
    create: async (projectId: string, draft: TaskDraft) => {
      const keys = [`task:${projectId}/new`];
      if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return false;
      let requestId: string;
      try {
        requestId = createWriteRequestId();
      } catch (error) {
        setTaskReadError(projectId, taskWriteError(error));
        return false;
      }
      const title = draft.title.trim();
      setTaskReadError(projectId, null);
      setWritePending(keys, true);
      try {
        const result = await writeMasterControl(accessToken, 'createTask', {
          projectId, title, notes: draft.notes.trim(), due: draft.due, parentId: draft.parentId, clientFacing: draft.clientFacing,
        }, requestId);
        const after = result.after;
        if (after.projectId !== projectId || typeof after.taskId !== 'string' || !after.taskId || after.title !== title) {
          throw new Error('Master Control returned an unexpected task read-back.');
        }
        const created: HudTask = {
          id: after.taskId,
          title,
          status: 'needsAction',
          due: typeof after.due === 'string' ? after.due : '',
          parentId: typeof after.parentId === 'string' ? after.parentId : '',
          audience: after.audience === 'client' ? 'client' : 'internal',
          start: '',
          key: typeof after.key === 'string' ? after.key : '',
          milestone: false,
          notes: draft.notes.trim(),
        };
        replaceProjectTasks(projectId, (tasks) => [...tasks, created]);
        handleLogTerminal(`Task "${title}" created in ${projectId} (${created.audience}).`, 'server');
        return true;
      } catch (error) {
        setTaskReadError(projectId, `Task not created: ${taskWriteError(error)}`);
        return false;
      } finally {
        setWritePending(keys, false);
      }
    },
    setDone: (projectId, taskId, done) => {
      const keys = [`task:${projectId}/${taskId}`];
      if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
      let requestId: string;
      try {
        requestId = createWriteRequestId();
      } catch (error) {
        setTaskReadError(projectId, taskWriteError(error));
        return;
      }
      const status: HudTask['status'] = done ? 'completed' : 'needsAction';
      const previous = projectTasks[projectId]?.find((task) => task.id === taskId)?.status ?? (done ? 'needsAction' : 'completed');
      const setStatus = (next: HudTask['status']) => replaceProjectTasks(projectId, (tasks) => tasks.map((task) => (
        task.id === taskId ? { ...task, status: next } : task)));
      setTaskReadError(projectId, null);
      setStatus(status);
      setWritePending(keys, true);
      writeMasterControl(accessToken, 'setTaskStatus', { projectId, taskId, done }, requestId)
        .then((result) => {
          if (result.after.taskId !== taskId || result.after.status !== status) {
            throw new Error('Master Control returned an unexpected task read-back.');
          }
          handleLogTerminal(`Task ${taskId} in ${projectId} ${done ? 'completed' : 'reopened'}.`, 'server');
          // Phase F: completing a template milestone fires the existing milestone.done event (rules decide; none approved).
          const task = projectTasks[projectId]?.find((candidate) => candidate.id === taskId);
          const clientId = clients.find((client) => client.activeProjects.some((project) => project.ProjectID === projectId))?.ClientID;
          if (done && task?.milestone && clientId) {
            handlePublishHudEvent({
              id: `milestone:${projectId}:${taskId}:${requestId}`,
              type: 'milestone.done',
              source: 'user_write',
              sourceNodeId: 'node-dolores',
              clientId,
              projectId,
              payload: { taskId, title: task.title, key: task.key },
            });
            handleLogTerminal(`Milestone "${task.title}" done in ${projectId}; milestone.done published.`, 'action');
          }
        })
        .catch((error) => {
          setStatus(previous);
          setTaskReadError(projectId, `Task not ${done ? 'completed' : 'reopened'}: ${taskWriteError(error)}`);
        })
        .finally(() => setWritePending(keys, false));
    },
  } : undefined;

  const handleResolveFinding = (alertId: string, choice: 'finances' | 'clients') => {
    const clientId = alertId.replace(/^POL-R1-/, '');
    const client = clients.find((candidate) => candidate.ClientID === clientId);
    if (choice === 'clients') {
      setFindingConfirmError(null);
      setFindingConfirm({
        alertId,
        clientName: client?.Company_Name ?? clientId,
        financesValue: client?.ContractValue ?? 0,
        clientsValue: client?.SheetContractValue ?? 0,
      });
      return;
    }
    void runResolveFinding(alertId, 'finances');
  };

  const handleOpenGalaxy = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedProjectId(null);
    setDashboardLevel('galaxy');
  };

  const handleOpenSolar = (clientId: string, projectId: string) => {
    setSelectedClientId(clientId);
    setSelectedProjectId(projectId);
    setDashboardLevel('solar');
  };

  const handleOpenPlanet = (clientId: string, projectId: string) => {
    const route = { clientId, projectId };
    setSelectedClientId(clientId);
    setSelectedProjectId(projectId);
    setPlanet(route);
    try { window.history.pushState({ planet: route }, '', planetPath(route)); } catch { /* history is optional */ }
  };

  /** Back to Solar for the same client and project (Solar was never unmounted when opened from it). */
  const handleClosePlanet = (level: DashboardLevel = 'solar') => {
    if (planet) {
      setSelectedClientId(planet.clientId);
      setSelectedProjectId(level === 'universe' ? null : planet.projectId);
    }
    setPlanet(null);
    setDashboardLevel(level);
    try { if (parsePlanetPath(window.location.pathname)) window.history.pushState({}, '', '/'); } catch { /* optional */ }
  };
  planetCloseRef.current = () => handleClosePlanet();

  /** Plan v3.1 G3: invoice draft (after the Financial Mutation confirmation) through hud_write with read-back. */
  const handleDraftInvoice = async (invoiceId: string): Promise<{ url: string; name: string }> => {
    if (adapterStatus !== 'live' || !accessToken) throw new Error('Sign in to live Master Control to draft an invoice.');
    const keys = [`invoice:${invoiceId}`];
    if (keys.some((key) => pendingWriteKeysRef.current.has(key))) throw new Error('This invoice draft is already being created.');
    const requestId = createWriteRequestId();
    setWritePending(keys, true);
    try {
      const result = await writeMasterControl(accessToken, 'draftInvoice', { invoiceId }, requestId);
      const { url, name } = result.after;
      if (result.after.invoiceId !== invoiceId || typeof url !== 'string' || !url || typeof name !== 'string') {
        throw new Error('Master Control returned an unexpected invoice read-back.');
      }
      handleLogTerminal(`Invoice draft "${name}" created in the client folder.`, 'server');
      if (result.after.filled === false) {
        pushToast('warn', `Draft created, but the invoice template's {{…}} fields were not found, so it was not filled in. Check the template's placeholders.`);
      }
      return { url, name };
    } finally {
      setWritePending(keys, false);
    }
  };

  /**
   * Flag Blocker (owner 2026-11-06: several per client, each removable). Audited setBlocker write; throws so the
   * dialog shows the error. The HUD updates the alert list and roadblock summary at once, then re-reads.
   */
  const handleBlocker = async (clientId: string, op: BlockerOp) => {
    if (adapterStatus !== 'live' || !accessToken) throw new Error('Sign in to live Master Control to change blockers.');
    const payload = op.kind === 'add' ? { clientId, note: op.note, projectId: op.projectId ?? '' }
      : op.kind === 'remove' ? { clientId, alertId: op.alertId } : { clientId, note: '' };
    const result = await writeMasterControl(accessToken, 'setBlocker', payload, createWriteRequestId());
    const roadblock = String(result.after.ActiveRoadblock ?? '');
    const now = new Date().toISOString();
    setClients((previous) => previous.map((client) => client.ClientID === clientId ? { ...client, roadblock } : client));
    if (op.kind === 'add') {
      const alertId = String(result.after.alertId ?? '');
      const company = clients.find((client) => client.ClientID === clientId)?.Company_Name ?? clientId;
      if (alertId) {
        setAlerts((previous) => [...previous, {
          id: alertId, timestamp: now, severity: 'BLOCKER', subRoutine: 'Dolores', clientId, companyName: company,
          message: `Blocker: ${op.note}: Remove the blocker, then clear it in the HUD.`, dismissed: false, actionStatus: 'Open', blockerNote: op.note,
        }]);
      }
      handleLogTerminal(`Blocker flagged for ${clientId}: ${op.note}`, 'server');
    } else {
      const removed = op.kind === 'remove' ? [op.alertId] : null;
      setAlerts((previous) => previous.map((alert) => alert.clientId === clientId && alert.blockerNote !== undefined
        && (!removed || removed.includes(alert.id)) ? { ...alert, dismissed: true, actionStatus: 'Resolved' } : alert));
      handleLogTerminal(op.kind === 'remove' ? `Blocker removed for ${clientId}.` : `All blockers cleared for ${clientId} (${String(result.after.resolvedAlerts ?? 0)} resolved).`, 'server');
    }
    setFetchAttempt((attempt) => attempt + 1);
  };

  useEffect(() => {
    const open = (event: Event) => {
      const clientId = (event as CustomEvent<{ clientId?: string }>).detail?.clientId;
      if (clientId) setBlockerTarget({ clientId });
    };
    window.addEventListener('hud-manage-blockers', open);
    return () => window.removeEventListener('hud-manage-blockers', open);
  }, []);

  /** Undo of a final message: the audited restoreClientFolder write (Sanctum Inactive -> Active). */
  const handleRestoreFolder = async (clientId: string) => {
    if (adapterStatus !== 'live' || !accessToken) { setWriteError('Sign in to live Master Control to restore a client folder.'); return; }
    try {
      const result = await writeMasterControl(accessToken, 'restoreClientFolder', { clientId }, createWriteRequestId());
      if (result.after.restored !== true) throw new Error('Master Control did not confirm the folder move.');
      handleLogTerminal(`${clientId} client folder moved back to Sanctum Active.`, 'server');
    } catch (error) {
      setWriteError(`Folder not restored: ${error instanceof Error ? error.message : 'Master Control returned an unknown error.'}`);
    }
  };

  /** Plan v3.1 G3: OSINT sweep request = one Alfred_Alerts row (Oracle, Requested). It runs nothing. */
  const handleRequestOsint = async (clientId: string) => {
    if (adapterStatus !== 'live' || !accessToken) {
      setWriteError('Sign in to live Master Control to request an OSINT sweep.');
      return;
    }
    const keys = [`osint:${clientId}`];
    if (keys.some((key) => pendingWriteKeysRef.current.has(key))) return;
    let requestId: string;
    try {
      requestId = createWriteRequestId();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Could not create a secure write request ID.');
      return;
    }
    setWritePending(keys, true);
    try {
      const result = await writeMasterControl(accessToken, 'requestOsintSweep', { clientId }, requestId);
      if (result.after.clientId !== clientId || result.after.Department !== 'Oracle' || result.after.Action_Status !== 'Requested') {
        throw new Error('Master Control returned an unexpected alert read-back.');
      }
      handleLogTerminal(`OSINT sweep requested for ${clientId} (alert ${String(result.after.alertId)}).`, 'server');
      setFetchAttempt((attempt) => attempt + 1);
    } catch (error) {
      setWriteError(`OSINT sweep not requested: ${error instanceof Error ? error.message : 'Master Control returned an unknown error.'}`);
    } finally {
      setWritePending(keys, false);
    }
  };

  // Browser back/forward moves between Planet and the board; a deep link opens Planet on the dashboard.
  useEffect(() => {
    const onPop = () => setPlanet(parsePlanetPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!planet) return;
    setCurrentScreen('dashboard');
    setSelectedClientId(planet.clientId);
    setSelectedProjectId(planet.projectId);
  }, [planet]);

  const handleForceAdvance = (client: ClientRecord) => {
    if (!isDemoMode) {
      setLoadError('Force advance is available only in the demo fleet.');
      return;
    }
    const phases: ClientRecord['AccountPhase'][] = [
      '01: Intake',
      '02: Session Zero',
      '03: Active Sprints',
      '04: Liftoff',
      '05: Complete',
      '06: Archived/Sunset',
    ];
    const currentIndex = phases.indexOf(client.AccountPhase);
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      const updated = { ...client, AccountPhase: nextPhase };
      handleUpdateClient(updated);

      const alertMsg: AlfredAlert = {
        id: `ALERT-OVERRIDE-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'WARNING',
        subRoutine: 'Alfred',
        clientId: client.ClientID,
        companyName: client.Company_Name,
        message: `Admin force advance executed for ${client.Company_Name}. Stage gate bypassed.`,
        dismissed: false,
      };
      setAlerts((prev) => [alertMsg, ...prev]);

    }
  };

  const handleGoogleToken = (tokenResponse: TokenResponse) => {
    setOAuthError(null);
    setLoadError(null);
    setDataSourceReason(null);
    setIsDemoMode(false);
    setAdapterStatus('offline');
    setAccessToken(tokenResponse.access_token);
  };

  const handleSignOut = () => {
    setAccessToken(null);
    setIsDemoMode(false);
    setAdapterStatus(DATA_ADAPTER_MODE === 'mock' ? 'mock' : 'offline');
    setCurrentScreen('dashboard');
    setClients([]);
    setSelectedClientId(null);
    setWorkbenchClient(null);
    setAlerts([]);
    setTelemetry(null);
    setPendingProposals([]);
    setPendingAgentDispatch(null);
    setTerminalLogs([]);
    setContextMenu(null);
    setLoadError(null);
    setDataSourceReason(null);
    setWriteError(null);
    pendingWriteKeysRef.current = new Set();
    setPendingWriteKeys(pendingWriteKeysRef.current);
  };

  // Keyboard navigation & RTS control group handlers
  const handleSwitchDepartment = useCallback((view: string) => {
    if (view === 'pipeline' || view === 'dashboard') {
      setCurrentScreen('dashboard');
      setDashboardLevel('universe');
      return;
    }
    const validScreens: ScreenView[] = ['dashboard', 'pipeline', 'osint', 'symphony', 'treasure', 'archive', 'cockpit', 'clients', 'actions'];
    if (validScreens.includes(view as ScreenView)) {
      setCurrentScreen(view as ScreenView);
    }
  }, []);

  const handleRecallClientSlot = useCallback((slot: number) => {
    if (slot === 0) {
      setSelectedClientId(null);
      return;
    }
    // Check if slot was explicitly bound in controlGroups
    const boundIds = controlGroups[slot];
    if (boundIds && boundIds.length > 0) {
      const found = clients.find((c) => c.ClientID === boundIds[0]);
      if (found) {
        setSelectedClientId(found.ClientID);
        setSelectedProjectId(found.activeProjects[0]?.ProjectID ?? null);
        setWorkbenchClient(found);
        setDashboardLevel('solar');
        setCurrentScreen('dashboard');
        setActiveGroupNum(slot);
        return;
      }
    }
    // Fallback to array index if not bound
    const target = clients[slot - 1];
    if (target) {
      setSelectedClientId(target.ClientID);
      setSelectedProjectId(target.activeProjects[0]?.ProjectID ?? null);
      setWorkbenchClient(target);
      setDashboardLevel('solar');
      setCurrentScreen('dashboard');
      setActiveGroupNum(slot);
    }
  }, [clients, controlGroups]);

  useBridgeKeybindings({
    keymap,
    onSwitchDepartment: handleSwitchDepartment,
    onBindClientSlot: (slot) => {
      if (selectedClientId) {
        setControlGroups((prev) => ({ ...prev, [slot]: [selectedClientId] }));
        setActiveGroupNum(slot);
      }
    },
    onRecallClientSlot: handleRecallClientSlot,
    onTriggerMacro: (key) => setActiveModal(key as CommandKey),
    onToggleSettings: () => setIsKeymapModalOpen((prev) => !prev),
  });

  const hudStats = useMemo(() => computeHudStats(clients, alerts), [clients, alerts]);
  // Owner 2026-11-06: one Back control (and Backspace) that always goes up one level.
  const backTarget: { label: string; go: () => void } | null = currentScreen !== 'dashboard'
    ? { label: 'the board', go: () => setCurrentScreen('dashboard') }
    : planet ? { label: 'Solar', go: () => handleClosePlanet('solar') }
      : dashboardLevel === 'solar' ? { label: 'Galaxy', go: () => setDashboardLevel('galaxy') }
        : dashboardLevel === 'galaxy' ? { label: 'Universe', go: () => setDashboardLevel('universe') } : null;
  const backRef = useRef(backTarget);
  backRef.current = backTarget;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (event.key === 'Backspace' && !event.ctrlKey && !event.altKey && backRef.current) {
        event.preventDefault();
        backRef.current.go();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Calculate header telemetry
  const headerTelemetry: HudTelemetry = {
    pipelineMrr: clients.reduce((sum, c) => sum + (c.ContractValue || 0), 0),
    activeSprints: clients.filter((c) => c.AccountPhase === '03: Active Sprints').length,
    missingDeposits: clients.filter((c) => c.AccountPhase === '02: Session Zero' && !c.DepositPaid).length,
    activeAlertsCount: alerts.filter((a) => !a.dismissed).length,
    lastSynced: telemetry?.lastSynced || 'LIVE',
  };
  const openSchemaChanges = schemaChanges.filter((change) => change.Status === 'Noted' || change.Status === 'Requested');
  const schemaMismatches = findSchemaVersionMismatches(schemaRegistry);
  const departmentNotifications = summarizeDepartmentNotifications(
    alerts,
    pendingProposals,
    schemaMismatches.length + openSchemaChanges.length + (schemaDataStatus === 'unavailable' ? 1 : 0),
  );

  const handleOpenDepartment = (department: NotificationDepartment) => {
    setOpenNotificationDepartment(department);
    setActiveDepartment(department === 'Housekeeping' ? 'Alfred' : department);
    const nextClient = alerts.find((alert) =>
      !alert.dismissed
      && alert.clientId
      && (department === 'Housekeeping'
        ? ['Alfred', 'Police', 'Housekeeping'].includes(alert.subRoutine)
        : alert.subRoutine.toLowerCase() === department.toLowerCase()),
    )?.clientId;
    if (nextClient) setSelectedClientId(nextClient);
  };
  const handleOpenSolarFor = (client: ClientRecord) => {
    if (planet) handleClosePlanet('solar');
    setSelectedClientId(client.ClientID);
    setSelectedProjectId(client.activeProjects[0]?.ProjectID ?? null);
    setWorkbenchClient(client);
    setDashboardLevel('solar');
    setCurrentScreen('dashboard');
  };
  /** Top-bar levels. SOLAR opens the selected client (it used to fall back to Galaxy when no workbench was open). */
  const handleGoLevel = (level: DashboardLevel) => {
    if (level === 'solar' && activeClient && !workbenchClient) { handleOpenSolarFor(activeClient); return; }
    if (planet) handleClosePlanet(level);
    setCurrentScreen('dashboard');
    setDashboardLevel(level);
  };

  // Owner 2026-11-06: the cockpit shows live data. The main window builds the feed and broadcasts it to the side window.
  const cockpitFeed = useMemo(() => buildCockpitFeed({
    clients, alerts, departments: departmentNotifications, logs: terminalLogs,
    adapterStatus: isDemoMode ? 'mock' : adapterStatus, selectedClient: activeClient?.Company_Name ?? null,
  // departmentNotifications is rebuilt each render; its inputs are listed instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [clients, alerts, pendingProposals, schemaChanges, schemaRegistry, schemaDataStatus, terminalLogs, adapterStatus, isDemoMode, activeClient?.Company_Name]);
  const cockpitCommandRef = useRef<(command: CockpitCommand) => void>(() => {});
  const handleCockpitCommand = (command: CockpitCommand) => {
    if (command.type === 'refresh') setFetchAttempt((attempt) => attempt + 1);
    else if (command.type === 'department') { setCurrentScreen('dashboard'); handleOpenDepartment(command.department); }
    else if (command.type === 'level') handleGoLevel(command.level);
    else if (command.type === 'client') {
      const client = clients.find((candidate) => candidate.ClientID === command.clientId);
      if (client) handleOpenSolarFor(client);
    }
    handleLogTerminal(`Cockpit: ${command.type}${'level' in command ? ` ${command.level}` : 'department' in command ? ` ${command.department}` : 'clientId' in command ? ` ${command.clientId}` : ''}.`, 'action');
  };
  cockpitCommandRef.current = handleCockpitCommand;
  const cockpitChannelRef = useRef<BroadcastChannel | null>(null);
  const cockpitFeedRef = useRef(cockpitFeed);
  cockpitFeedRef.current = cockpitFeed;
  useEffect(() => {
    const channel = openCockpitChannel();
    cockpitChannelRef.current = channel;
    if (!channel) return undefined;
    channel.onmessage = (event: MessageEvent<CockpitMessage>) => {
      if (event.data?.kind === 'hello') channel.postMessage({ kind: 'feed', feed: cockpitFeedRef.current } satisfies CockpitMessage);
      if (event.data?.kind === 'command') cockpitCommandRef.current(event.data.command);
    };
    return () => { channel.close(); cockpitChannelRef.current = null; };
  }, []);
  useEffect(() => {
    cockpitChannelRef.current?.postMessage({ kind: 'feed', feed: cockpitFeed } satisfies CockpitMessage);
  }, [cockpitFeed]);

  if (!accessToken && !isDemoMode && !isLocalDataMode) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-[#020500] px-6 text-[#DDFBD0]">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#FE5F00] bg-[#5F0F40]/50 font-serif-display text-xl font-bold text-[#FE5F00] shadow-[0_0_24px_rgba(254,95,0,0.2)]">
          SZS
        </div>
        <div className="text-center">
          <h1 className="font-display text-xl font-bold tracking-wide">Session Zero Solutions</h1>
          <p className="mt-2 font-mono text-xs text-[#DDFBD0]/70">Sign in to securely connect to Master Control or explore the demo fleet.</p>
        </div>
        <GoogleSignIn
          scriptConfigured={Boolean(import.meta.env.VITE_APPS_SCRIPT_DEPLOYMENT_ID?.trim())}
          error={oauthError}
          onError={setOAuthError}
          onToken={handleGoogleToken}
          onExploreDemo={() => setIsDemoMode(true)}
        />
      </main>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#020500] text-[#DDFBD0] overflow-hidden relative select-none">
      {/* Reactive Airship Bridge Canvas Ambient Glow — fixed overlay, outside the grid */}
      <ReactiveBridgeCanvas activeDepartment={activeDepartment} alertsCount={headerTelemetry.activeAlertsCount} />

      {/* Existing Financial Mutation confirmation, reused unchanged for "Use Clients value" (Police R1). */}
      <DropConfirmDialog
        isOpen={Boolean(findingConfirm)}
        onCancel={() => { setFindingConfirm(null); setFindingConfirmError(null); }}
        onConfirm={() => findingConfirm ? runResolveFinding(findingConfirm.alertId, 'clients') : undefined}
        serviceName="Use Clients value (Police R1 contract total)"
        priceDelta={findingConfirm ? findingConfirm.clientsValue - findingConfirm.financesValue : 0}
        currentValue={findingConfirm?.financesValue ?? 0}
        targetClientName={findingConfirm?.clientName ?? ''}
        isSubmitting={findingConfirm ? pendingWriteKeys.has(`alert:${findingConfirm.alertId}`) : false}
        errorMessage={findingConfirmError}
      />

      {/* Root grid: 52px permanent rail | main workspace */}
      <div className="relative z-10 w-full h-full grid grid-cols-[52px_1fr]">

      {/* Permanent 52px Left Rail + Floating 320px Auto-Closing Drawer */}
      <MultiAgentDispatch
        openDepartment={openNotificationDepartment}
        alerts={alerts}
        onSetAlertStatus={adapterStatus === 'live' && accessToken ? handleSetAlertStatus : undefined}
        onResolveFinding={adapterStatus === 'live' && accessToken ? handleResolveFinding : undefined}
        pendingWriteKeys={pendingWriteKeys}
        seenNotificationIds={seenNotificationIds}
        notificationStateError={notificationStateError}
        onAcknowledgeNotification={handleAcknowledgeNotification}
        schemaMismatches={schemaMismatches}
        expectedSchemaVersion={EXPECTED_SCHEMA_VERSION}
        schemaChanges={schemaChanges}
        schemaDataStatus={schemaDataStatus}
        schemaDataError={schemaDataError}
        wirePanel={wirePanel}
        onCreateWire={handleCreateWire}
        onSelectWire={handleSelectWire}
        onUpdateWire={handleUpdateWire}
        onReverseWire={handleReverseWire}
        onRemoveWire={handleRemoveWire}
        onPublishEvent={handlePublishHudEvent}
        onSimulateEvent={handleSimulateHudEvent}
        onSimulateUnblockEvent={handleSimulateUnblockHudEvent}
        activeDepartment={activeDepartment}
        onSelectDepartment={(dept) => {
          // Owner 2026-11-05: a department button filters the drawer's feed to that department (Alfred = everything
          // routed to Housekeeping/Police). It no longer jumps the main view to the prototype screens (top-centre icons).
          setActiveDepartment(dept);
          setOpenNotificationDepartment(dept === 'Alfred' ? null : dept as NotificationDepartment);
        }}
        proposals={pendingProposals}
        onDismissProposal={handleDismissProposal}
        onReviewMoneyProposal={adapterStatus === 'live' && accessToken ? (proposal) => setInvoiceDraft({
          clientId: proposal.clientId,
          reason: `Proposal: ${proposal.title}. ${proposal.detail}`,
        }) : undefined}
        clients={clients}
        selectedClient={activeClient}
        onSelectClient={(id) => {
          setSelectedClientId(id);
          const found = clients.find((c) => c.ClientID === id);
          if (found) setWorkbenchClient(found);
        }}
        onTriggerWorkbench={(client) => {
          setSelectedClientId(client.ClientID);
          setWorkbenchClient(client);
          setCurrentScreen('dashboard');
        }}
        onCommandSubmit={(cmd) => {
          const newAlert: AlfredAlert = {
            id: `CMD-${Date.now()}`,
            timestamp: new Date().toISOString(),
            severity: 'INFO',
            subRoutine: 'Alfred',
            clientId: activeClient?.ClientID || '',
            companyName: activeClient?.Company_Name || 'Bridge Command',
            message: `Command executed: "${cmd}"`,
            dismissed: false,
          };
          setAlerts((prev) => [newAlert, ...prev]);
        }}
      />

      {/* Main Horizon Workspace */}
      <main className="h-full flex flex-col relative overflow-hidden z-[115]">
        {/* Top SkyHeader (Single 48px Row) */}
        <HudErrorBoundary fallbackTitle="SKY HEADER FAULT">
          <SkyHeader
            currentScreen={currentScreen}
            dashboardLevel={dashboardLevel}
            onDashboardLevelChange={handleGoLevel}
            onBack={backTarget?.go}
            backLabel={backTarget?.label}
            selectedClientName={activeClient?.Company_Name}
            selectedProjectName={activeClient?.activeProjects.find((project) => project.ProjectID === selectedProjectId)?.Title}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            stats={hudStats}
            onSelectScreen={setCurrentScreen}
            onSignOut={handleSignOut}
            onOpenKeybindings={() => setIsKeymapModalOpen(true)}
            currentSkin={currentSkin}
            onToggleSkin={handleToggleSkin}
            onOpenCockpitWindow={() => { window.open('/cockpit', 'SZS_AvionicsCockpit', 'popup=yes,width=762,height=1366,left=1680,top=0,resizable=yes'); }}
            clients={clients}
            activeClientId={selectedClientId}
            onSelectClient={handleOpenSolarFor}
            notifications={departmentNotifications}
            onSelectNotificationDepartment={handleOpenDepartment}
          />
        </HudErrorBoundary>

        {/* Viewport 1: Tactical Horizon (Dashboard) */}
        {currentScreen === 'dashboard' && (
          // isolate: canvas layers (z-40 pills) stay under the top bar's dropdowns (owner 2026-11-06).
          <div className="relative isolate flex-1 w-full overflow-hidden">
            {dashboardLevel === 'solar' && workbenchClient ? (
              <HudErrorBoundary fallbackTitle="SOLAR CANVAS FAULT">
                <TacticalCanvas
                  selectedProjectId={selectedProjectId}
                  onUpdateClient={handleUpdateClient}
                  onToggleNonStructural={() => setShowNonStructural((visible) => !visible)}
                  scale={canvasZoom}
                  setScale={setCanvasZoom}
                  workbenchClient={workbenchClient}
                  canvasControls={(
                    <CanvasControls
                      interactionMode={interactionMode}
                      onSetInteractionMode={setInteractionMode}
                      showNonStructural={showNonStructural}
                      onToggleNonStructural={() => setShowNonStructural((visible) => !visible)}
                      canvasZoom={canvasZoom}
                      onSetCanvasZoom={setCanvasZoom}
                      onResetCanvas={() => { setCanvasZoom(1); setCanvasResetRequest((current) => current + 1); }}
                    />
                  )}
                  onWorkbenchChange={(client) => {
                    setWorkbenchClient(client);
                    if (!client) setDashboardLevel('galaxy');
                  }}
                  resetRequest={canvasResetRequest}
                  accessToken={accessToken}
                  interactionMode={interactionMode}
                  showNonStructural={showNonStructural}
                  activeWireIds={activeWireIds}
                  doneNodeIds={completedNodeIdsByClient[workbenchClient.ClientID] || []}
                  onWirePanelChange={handleWirePanelChange}
                  onWirePanelActionsChange={handleWirePanelActionsChange}
                  onDispatchAgent={handleDispatchAgent}
                  onOpenPlanet={(projectId) => handleOpenPlanet(workbenchClient.ClientID, projectId)}
                  onOpenContextMenu={(x, y, item) => {
                    if ('AccountPhase' in item) setContextMenu({ x, y, client: item });
                  }}
                />
              </HudErrorBoundary>
            ) : (
              <UniverseGalaxyView
                level={dashboardLevel === 'solar' ? 'galaxy' : dashboardLevel}
                clients={clients}
                alerts={alerts}
                selectedClientId={selectedClientId}
                galaxyZoom={galaxyZoom}
                setGalaxyZoom={setGalaxyZoom}
                resetRequest={canvasResetRequest}
                manuallySetClientIds={new Set(adapterStatus === 'snapshot' ? Object.keys(snapshotOverlay.clients) : [])}
                moveMode={adapterStatus === 'snapshot'
                  ? 'snapshot'
                  : adapterStatus === 'live' && accessToken ? 'live' : 'readonly'}
                canMove={adapterStatus === 'snapshot' || (adapterStatus === 'live' && Boolean(accessToken))}
                pendingWriteKeys={pendingWriteKeys}
                projectTaskSummaries={projectTaskSummaries}
                pendingTaskReads={pendingTaskReads}
                projectTaskReadErrors={projectTaskReadErrors}
                onSelectClient={(clientId) => setSelectedClientId(clientId || null)}
                onOpenGalaxy={handleOpenGalaxy}
                onOpenSolar={handleOpenSolar}
                onSetAccountPhase={handleSetAccountPhase}
                onResetAccountPhase={handleResetAccountPhase}
                onSetSprintStage={handleSetSprintStage}
                onLoadProjectTasks={handleLoadProjectTasks}
                onOpenClientMenu={(x, y, clientId, projectId) => {
                  const client = clients.find((candidate) => candidate.ClientID === clientId);
                  handleLogTerminal(client ? `Client menu requested for ${projectId || clientId}.` : `Client menu: ${clientId} is not in the loaded data.`, 'action');
                  if (client) setContextMenu({ x, y, client, projectId });
                }}
              />
            )}
            {planet && (
              <Suspense fallback={<div className="absolute inset-0 z-40 flex items-center justify-center bg-[#020500] text-xs text-[#DDFBD0]/60">Opening Planet…</div>}>
                <PlanetView
                  projectId={planet.projectId}
                  client={clients.find((client) => client.ClientID === planet.clientId) ?? null}
                  project={clients.find((client) => client.ClientID === planet.clientId)?.activeProjects
                    .find((project) => project.ProjectID === planet.projectId) ?? null}
                  tasks={taskHandlers}
                  onClose={() => handleClosePlanet('solar')}
                  onOpenGalaxy={() => handleClosePlanet('galaxy')}
                  onOpenUniverse={() => handleClosePlanet('universe')}
                />
              </Suspense>
            )}
          </div>
        )}

        {/* Owner 2026-11-06: screens other than the board end above the bottom dock and its crystal. */}
        {currentScreen !== 'dashboard' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[var(--dock-clearance)]" data-testid="screen-area">
        {/* Viewport 2: Oracle OSINT War Room */}
        {currentScreen === 'osint' && (
          <OsintWarRoomView
            units={clientUnits}
            activeUnit={activeClientUnit}
            onSelectUnit={(id) => setSelectedClientId(id)}
            onNavigateToDashboard={() => setCurrentScreen('dashboard')}
            onLogTerminal={handleLogTerminal}
          />
        )}

        {/* Viewport 3: Dolores Symphony Matrix */}
        {currentScreen === 'symphony' && (
          <SymphonyMatrixView
            units={clientUnits}
            activeUnit={activeClientUnit}
            onSelectUnit={(id) => setSelectedClientId(id)}
            onNavigateToDashboard={() => setCurrentScreen('dashboard')}
            onLogTerminal={handleLogTerminal}
          />
        )}

        {/* Viewport 4: Vala Treasure Ledger */}
        {currentScreen === 'treasure' && (
          <TreasureLedgerView
            units={clients}
            activeUnit={activeClient}
            onSelectUnit={(id) => setSelectedClientId(id)}
            onNavigateToDashboard={() => setCurrentScreen('dashboard')}
            onLogTerminal={handleLogTerminal}
          />
        )}

        {/* Viewport 5: Full-Screen Mail Command Center (MCC) */}
        {currentScreen === 'archive' && (
          <MailCommandCenter />
        )}

        {/* Display 2: Avionics Cockpit View (762×1366 Portrait) */}
        {currentScreen === 'cockpit' && (
          <div className="flex-1 flex items-center justify-center p-4 bg-[#020500] overflow-y-auto">
            <AvionicsCockpitView feed={cockpitFeed} onCommand={handleCockpitCommand} onClose={() => setCurrentScreen('dashboard')} />
          </div>
        )}

        {/* Secondary Screens */}
        {currentScreen === 'clients' && (
          <ClientDirectoryView
            units={clientUnits}
            onSelectUnit={(id) => setSelectedClientId(id)}
            onUpdateUnit={() => {}}
            onNavigateToDashboard={() => setCurrentScreen('dashboard')}
            onOpenIntake={() => setActiveModal('A')}
            onLogTerminal={handleLogTerminal}
          />
        )}

        {currentScreen === 'actions' && (
          <MacroMatrixView
            onTriggerCommand={(key) => setActiveModal(key)}
            onNavigateToDashboard={() => setCurrentScreen('dashboard')}
          />
        )}
        </div>
        )}

        {/* Settings › Bottom console scale (restored 2026-11-06). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[60] origin-bottom" style={{ transform: 'scale(var(--dock-scale, 1))' }}>
          <HudErrorBoundary fallbackTitle="CHASSIS TELEMETRY FAULT">
            <BottomConsoleChassis
              selectedClient={activeClient}
              staffMeetingInput={staffMeetingInput}
              onUpdateClient={handleUpdateClient}
              onTriggerCommand={(key) => setActiveModal(key)}
              onLogTerminal={handleLogTerminal}
              onProposal={handleAddProposal}
              pendingAgentDispatch={pendingAgentDispatch}
              onAgentDispatchHandled={handleAgentDispatchHandled}
              clientComms={clientComms}
              projectTasks={taskHandlers}
              controlGroups={controlGroups}
              activeGroupNum={activeGroupNum}
              onRecallControlGroup={(grp) => handleRecallClientSlot(grp)}
              context={workbenchClient ? 'CLIENT_WORKBENCH' : 'GLOBAL'}
              calendar={{
                accessToken: adapterStatus === 'live' ? accessToken : null,
                clients,
                onOpenClient: (clientId) => { const client = clients.find((c) => c.ClientID === clientId); if (client) handleOpenSolarFor(client); },
              }}
            />
          </HudErrorBoundary>
        </div>

        <WriteToasts items={toasts} onDismiss={dismissToast} />

        {/* Persistent 24px Bottom Status Strip */}
        <BottomStatusStrip
          telemetry={headerTelemetry}
          isBackendConnected={Boolean(accessToken) || isDemoMode}
          latestLog={terminalLogs[terminalLogs.length - 1] || null}
          adapterStatus={isDemoMode ? 'mock' : adapterStatus}
          rejectedRows={rejectedRows}
          localDraftCount={countSnapshotOverlayChanges(snapshotOverlay)}
          localStateError={snapshotOverlayError}
          dataSourceReason={dataSourceReason}
          writeError={writeError}
          onRefresh={DATA_ADAPTER_MODE === 'live' ? () => setFetchAttempt((attempt) => attempt + 1) : undefined}
          refreshing={isLoading}
          policeOpen={hudStats.policeOpen}
          activeClients={hudStats.activeClients}
        />
      </main>

      {/* Settings Modal */}
      <KeybindingSettingsModal
        isOpen={isKeymapModalOpen}
        onClose={() => setIsKeymapModalOpen(false)}
        currentKeymap={keymap}
        onUpdateKeymap={setKeymap}
      />

      {/* Context Menu with [ Sprint Stage View ] and [ Admin: Force Advance ] */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          client={contextMenu.client}
          onClose={() => setContextMenu(null)}
          onAdvanceStage={() => handleForceAdvance(contextMenu.client)}
          onDraftInvoice={(client) => setInvoiceDraft({ clientId: client.ClientID })}
          onFlagBlocker={(client) => setBlockerTarget({ clientId: client.ClientID, projectId: contextMenu.projectId })}
          onSunsetClient={(client) => {
            setContextMenu(null);
            // Owner 2026-11-05: re-requesting Sunset on a sunset client did nothing visible. Say so instead.
            if (client.AccountPhase === '06: Archived/Sunset') {
              handleLogTerminal(`${client.ClientID} is already at 06: Archived/Sunset. Its "Sunset requested" alert is in Daisy's feed (gold D button, left bar). Use Reset to auto on the Universe card to undo.`, 'alert');
              setWriteError(`${client.Company_Name || client.ClientID} is already at 06: Archived/Sunset; nothing was changed.`);
              return;
            }
            // Daisy's Sunset request: the audited AccountPhase write also adds the "Sunset requested" alert.
            handleLogTerminal(`Requesting Sunset for ${client.ClientID}…`, 'action');
            void handleSetAccountPhase(client.ClientID, '06: Archived/Sunset');
          }}
          onRestoreFolder={(client) => { void handleRestoreFolder(client.ClientID); }}
          onStatusSummary={(client) => setStatusSummaryClientId(client.ClientID)}
          onRequestOsint={(client) => { void handleRequestOsint(client.ClientID); }}
          canWrite={adapterStatus === 'live' && Boolean(accessToken)}
          canMove={adapterStatus === 'snapshot' || (adapterStatus === 'live' && Boolean(accessToken))}
          canAdvance={isDemoMode}
          onSetPhase={(client, phase) => { handleLogTerminal(`Moving ${client.ClientID} to ${phase}…`, 'action'); void handleSetAccountPhase(client.ClientID, phase); }}
          onResetPhase={(client) => { handleLogTerminal(`Resetting ${client.ClientID} to automatic phase…`, 'action'); void handleResetAccountPhase(client.ClientID); }}
          projectId={contextMenu.projectId}
          onSetStage={(projectId, stage) => { handleLogTerminal(`Moving ${projectId} to ${stage}…`, 'action'); void handleSetSprintStage(projectId, stage); }}
        />
      )}

      {statusSummaryClientId && clients.some((client) => client.ClientID === statusSummaryClientId) && (
        <StatusSummaryModal
          client={clients.find((client) => client.ClientID === statusSummaryClientId)!}
          alerts={alerts}
          taskSummaries={projectTaskSummaries}
          onClose={() => setStatusSummaryClientId(null)}
        />
      )}
      {invoiceDraft && clients.some((client) => client.ClientID === invoiceDraft.clientId) && (
        <InvoiceDraftModal
          client={clients.find((client) => client.ClientID === invoiceDraft.clientId)!}
          reason={invoiceDraft.reason}
          onDraft={handleDraftInvoice}
          onClose={() => setInvoiceDraft(null)}
        />
      )}

      {blockerTarget && clients.some((client) => client.ClientID === blockerTarget.clientId) && (
        <FlagBlockerModal
          client={clients.find((client) => client.ClientID === blockerTarget.clientId)!}
          projectId={blockerTarget.projectId}
          blockers={alerts.filter((alert) => alert.clientId === blockerTarget.clientId && !alert.dismissed && alert.blockerNote !== undefined)
            .map((alert) => ({ id: alert.id, note: alert.blockerNote ?? '' }))}
          onChange={(op) => handleBlocker(blockerTarget.clientId, op)}
          onClose={() => setBlockerTarget(null)}
        />
      )}

      {/* Command Modals for Actions Q..C */}
      <CommandModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        activeUnit={activeClientUnit}
        units={clientUnits}
        onAddUnit={() => {}}
      />
      </div>{/* end grid wrapper */}
    </div>
  );
}
