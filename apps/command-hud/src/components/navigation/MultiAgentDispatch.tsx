import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Terminal, AlertTriangle, Package, GripVertical, Link2 } from 'lucide-react';
import { AlfredAlert, ClientRecord } from '../../types';
import { CATALOG, CatalogEntry } from '../../ecs/catalog';
import type { HudEvent } from '../../ecs/events';
import type { PendingProposal } from '../../ecs/proposals';
import { CLIENT_FACING_ROUTE_LABEL } from '../../ecs/proposals';
import type { SchemaChange } from '../../data/contracts';
import { createSchemaChangeRequest, serializeSchemaChangeRequest } from '../../data/schemaChangeRequest';
import {
  allowedKinds,
  FlowMode,
  LinkKind,
  Pin,
  WireCreateInput,
  WireEditableFields,
  WirePanelSnapshot,
} from '../../ecs/links';
import { ERROR_COLOR } from '../../ecs/wireTheme';

interface MultiAgentDispatchProps {
  activeDepartment?: string;
  onSelectDepartment?: (agent: string) => void;
  alerts?: AlfredAlert[];
  onSetAlertStatus?: (alertId: string, status: 'Open' | 'Resolved') => void | Promise<void>;
  /** Police R1 (contract-value mismatch) resolve choices; shown instead of the plain Resolve button. */
  onResolveFinding?: (alertId: string, choice: 'finances' | 'clients') => void | Promise<void>;
  pendingWriteKeys?: ReadonlySet<string>;
  proposals?: PendingProposal[];
  onDismissProposal?: (proposalId: string) => void;
  /** Plan v3.1 G2: money proposals open the existing Financial Mutation confirmation (via the invoice draft). */
  onReviewMoneyProposal?: (proposal: PendingProposal) => void;
  seenNotificationIds?: string[];
  notificationStateError?: string | null;
  onAcknowledgeNotification?: (notificationId: string) => void;
  schemaMismatches?: { Registry_ID: string; Tab: string; Column_Name: string; Schema_Version: string }[];
  expectedSchemaVersion?: string;
  schemaChanges?: SchemaChange[];
  schemaDataStatus?: 'loading' | 'available' | 'unavailable';
  schemaDataError?: string | null;
  clients?: ClientRecord[];
  onCommandSubmit?: (cmd: string) => void;
  selectedClient?: ClientRecord | null;
  onSelectClient?: (clientId: string) => void;
  onTriggerWorkbench?: (client: ClientRecord) => void;
  wirePanel?: WirePanelSnapshot | null;
  onCreateWire?: (input: WireCreateInput) => boolean;
  onSelectWire?: (linkId: string | null) => void;
  onUpdateWire?: (linkId: string, updates: Partial<WireEditableFields>) => void;
  onReverseWire?: (linkId: string) => void;
  onRemoveWire?: (linkId: string) => void;
  onPublishEvent?: (event: HudEvent) => void;
  onSimulateEvent?: (event: HudEvent) => void;
  onSimulateUnblockEvent?: (event: HudEvent) => void;
  openDepartment?: string | null;
}

/** Maps each ECS service to its owning AI Sub-Routine department */
const SERVICE_DEPARTMENT_MAP: Record<string, { department: string; label: string; icon: string; color: string }> = {
  comp_oracle_deepscan: { department: 'Oracle', label: 'Intelligence', icon: '🔮', color: '#3C91E6' },
  comp_iron_gate_legal: { department: 'Pamela', label: 'Legal / Admin', icon: '⚖️', color: '#FE5F00' },
  comp_mcc_engine:      { department: 'Daisy', label: 'Audience Growth', icon: '📡', color: '#E0CA3C' },
  comp_dns_shield:      { department: 'Daisy', label: 'Infrastructure', icon: '🛡️', color: '#E0CA3C' },
  comp_gantt_symphony:  { department: 'Dolores', label: 'Delivery', icon: '🎼', color: '#5F0F40' },
};

/** Group services by department for the accordion */
interface DepartmentSection {
  department: string;
  label: string;
  icon: string;
  color: string;
  services: CatalogEntry[];
}

function buildDepartmentSections(): DepartmentSection[] {
  const map = new Map<string, DepartmentSection>();

  for (const service of CATALOG) {
    const meta = SERVICE_DEPARTMENT_MAP[service.id] || {
      department: 'Alfred',
      label: 'General',
      icon: '🤖',
      color: '#086375',
    };

    if (!map.has(meta.department)) {
      map.set(meta.department, {
        department: meta.department,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        services: [],
      });
    }
    map.get(meta.department)!.services.push(service);
  }

  return Array.from(map.values());
}

const DEPARTMENT_SECTIONS = buildDepartmentSections();

export const MultiAgentDispatch: React.FC<MultiAgentDispatchProps> = ({
  activeDepartment = 'Alfred',
  onSelectDepartment,
  alerts = [],
  onSetAlertStatus,
  onResolveFinding,
  pendingWriteKeys = new Set(),
  proposals = [],
  onDismissProposal,
  onReviewMoneyProposal,
  seenNotificationIds = [],
  notificationStateError = null,
  onAcknowledgeNotification,
  schemaMismatches = [],
  expectedSchemaVersion = '1.0',
  schemaChanges = [],
  schemaDataStatus = 'loading',
  schemaDataError = null,
  clients = [],
  onCommandSubmit,
  selectedClient = null,
  onSelectClient,
  onTriggerWorkbench,
  wirePanel = null,
  onCreateWire,
  onSelectWire,
  onUpdateWire,
  onReverseWire,
  onRemoveWire,
  onPublishEvent,
  onSimulateEvent,
  onSimulateUnblockEvent,
  openDepartment,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Oracle']));
  const [drawerTab, setDrawerTab] = useState<'feed' | 'services' | 'wires'>('feed');
  const [wireDraft, setWireDraft] = useState<{
    fromNodeId: string;
    fromPin: Pin;
    toNodeId: string;
    toPin: Pin;
    kind: LinkKind;
    mode: FlowMode;
    label: string;
  }>({
    fromNodeId: '',
    fromPin: 'right',
    toNodeId: '',
    toPin: 'left',
    kind: 'context',
    mode: 'push',
    label: '',
  });
  const [wireLabelDraft, setWireLabelDraft] = useState('');
  const [schemaDraftFields, setSchemaDraftFields] = useState({
    Target_Tab: '',
    Target_Column: '',
    Change_Type: 'Other' as SchemaChange['Change_Type'],
    Reason: '',
    Impact: '',
    Severity: 'WARN' as SchemaChange['Severity'],
  });
  const [schemaDraftOutput, setSchemaDraftOutput] = useState('');
  const [schemaDraftError, setSchemaDraftError] = useState<string | null>(null);

  const wireNodes = wirePanel?.nodes || [];
  const fromNode = wireNodes.find((node) => node.id === wireDraft.fromNodeId) || wireNodes[0];
  const toNode = wireNodes.find((node) =>
    node.id === wireDraft.toNodeId && node.id !== fromNode?.id
  ) || wireNodes.find((node) => node.id !== fromNode?.id);
  const createKinds = fromNode && toNode ? allowedKinds(fromNode.type, toNode.type) : [];
  const selectedCreateKind = createKinds.includes(wireDraft.kind) ? wireDraft.kind : createKinds[0];
  const duplicateWire = Boolean(wirePanel?.links.some((link) =>
    link.fromNodeId === fromNode?.id
    && link.toNodeId === toNode?.id
    && link.kind === selectedCreateKind
  ));
  const selectedWireId = wirePanel?.selectedWireId;
  const selectedWire = wirePanel?.links.find((link) => link.id === selectedWireId) || null;
  const selectedWireFrom = wirePanel?.nodes.find((node) => node.id === selectedWire?.fromNodeId);
  const selectedWireTo = wirePanel?.nodes.find((node) => node.id === selectedWire?.toNodeId);
  const developerPoliceSource = wirePanel?.nodes.find((node) => node.id === 'core-node');
  const selectedWireKinds = selectedWire && selectedWireFrom && selectedWireTo
    ? allowedKinds(selectedWireFrom.type, selectedWireTo.type)
    : [];
  const developerEventSource = wirePanel?.nodes.find((node) => node.id === 'node-dolores');
  const developerDependencySource = wirePanel?.nodes.find((node) => node.id === 'node-pamela');
  const canPreviewDependencyUnblock = Boolean(
    developerDependencySource
    && wirePanel?.links.some((link) =>
      link.fromNodeId === developerDependencySource.id
      && link.toNodeId === 'node-vala'
      && link.kind === 'dependency'
      && link.enabled),
  );

  useEffect(() => {
    if (!openDepartment) return;
    setIsCollapsed(false);
    setDrawerTab('feed');
  }, [openDepartment]);

  useEffect(() => {
    if (wirePanel?.selectedWireId && !wirePanel.contextMenuOpen) {
      setIsCollapsed(false);
      setDrawerTab('wires');
    }
  }, [wirePanel?.clientId, wirePanel?.selectedWireId, wirePanel?.contextMenuOpen]);

  useEffect(() => {
    setWireLabelDraft(selectedWire?.label || '');
  }, [wirePanel?.clientId, wirePanel?.selectedWireId, selectedWire?.label]);

  const agents = ['Alfred', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy'];
  const selectedProposals = selectedClient
    ? proposals.filter((proposal) => proposal.clientId === selectedClient.ClientID)
    : [];
  const departmentAlerts = openDepartment
    ? alerts.filter((alert) => openDepartment === 'Housekeeping'
      ? ['Alfred', 'Police', 'Housekeeping'].includes(alert.subRoutine)
      : alert.subRoutine.toLowerCase() === openDepartment.toLowerCase())
    : alerts;
  const openDepartmentAlerts = departmentAlerts.filter((alert) => !alert.dismissed);
  const resolvedDepartmentAlerts = departmentAlerts.filter(
    (alert) => alert.actionStatus?.toLowerCase() === 'resolved',
  );
  const openSchemaChanges = schemaChanges.filter((change) => change.Status === 'Noted' || change.Status === 'Requested');

  const createSchemaDraft = async () => {
    try {
      const request = createSchemaChangeRequest({
        Requested_By: 'HUD draft',
        Target_Database: 'Master Control',
        ...schemaDraftFields,
      });
      const output = serializeSchemaChangeRequest(request);
      setSchemaDraftOutput(output);
      setSchemaDraftError(null);
      try {
        await navigator.clipboard.writeText(output);
      } catch {
        setSchemaDraftError('Clipboard access is unavailable. Select the generated block below and copy it manually.');
      }
    } catch (error) {
      setSchemaDraftError(error instanceof Error ? error.message : 'Unable to generate a schema request draft.');
    }
  };

  const toggleSection = useCallback((dept: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  }, []);

  /**
   * MODULE 1: AUTO-SWITCH VIEW TO CLIENT SOLAR WORKBENCH ON DRAG INITIATION
   */
  const handleServiceDragStart = (e: React.DragEvent, service: CatalogEntry) => {
    const target = selectedClient || clients[0];
    if (!target) {
      console.warn('⚠️ HUD ALERT: Select an active client before deploying modular service components.');
      return;
    }

    // Pack ECS metadata into the drag stream
    const payload = {
      serviceId: service.id,
      name: service.name,
      price: service.price,
      tasksToInject: service.tasksToInject || [],
      targetClientId: target.ClientID,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.setData('serviceId', service.id);
    e.dataTransfer.setData('serviceName', service.name);
    e.dataTransfer.effectAllowed = 'copyMove';

    // Create a lightweight drag image
    const ghost = document.createElement('div');
    ghost.textContent = `✦ ${service.name} (+$${service.price})`;
    ghost.style.cssText =
      'position:absolute;top:-9999px;left:-9999px;padding:6px 12px;border-radius:8px;background:#020500;border:1px solid #E0CA3C;color:#E0CA3C;font-size:11px;font-family:monospace;white-space:nowrap;box-shadow:0 0 12px rgba(224,202,60,0.4);';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));

    // Instantly transition view to the selected client's solar system workbench
    if (onTriggerWorkbench) {
      onTriggerWorkbench(target);
    }
  };

  return (
    <>
      {/* 52px Permanent Left Rail — overflow-visible so drawer can escape the grid column */}
      <aside className="w-[52px] h-full border-r border-[#086375] bg-[#020500] z-[100] flex flex-col items-center py-3 select-none shrink-0 justify-between overflow-visible min-w-[52px]">
        <div className="flex flex-col items-center space-y-3 w-full">
          {/* Header Toggle Icon */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded border border-[#086375]/70 flex items-center justify-center text-[#DDFBD0] hover:border-[#E0CA3C] hover:text-[#E0CA3C] transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Dispatch Drawer (Ctrl+B)' : 'Collapse Rail (Ctrl+B)'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Subroutine Buttons [A] [P] [O] [D] [V] [D] - Distinct icons and styles for Dolores vs Daisy */}
          {agents.map((agent) => {
            const isDolores = agent === 'Dolores';
            const isDaisy = agent === 'Daisy';
            const isActive = activeDepartment === agent;

            // Visual distinction: Dolores is Delivery/Gantt (magenta/plum), Daisy is MCC/Audience (gold/amber)
            const badgeColor = isDolores
              ? 'text-[#f472b6] border-[#ec4899]/60 hover:border-[#f472b6]'
              : isDaisy
              ? 'text-[#E0CA3C] border-[#E0CA3C]/60 hover:border-[#E0CA3C]'
              : 'text-[#DDFBD0]/70 border-[#086375] hover:border-[#E0CA3C] hover:text-[#E0CA3C]';

            return (
              <button
                key={agent}
                type="button"
                onClick={() => {
                  onSelectDepartment?.(agent);
                  setIsCollapsed(false); // Open drawer on agent click
                }}
                className={`w-8 h-8 rounded border flex flex-col items-center justify-center font-mono font-bold transition-all cursor-pointer relative group ${
                  isActive
                    ? 'border-[#FE5F00] text-[#FE5F00] bg-[#5F0F40]/40 shadow-[0_0_10px_rgba(254,95,0,0.4)]'
                    : badgeColor
                }`}
                title={`${agent} // ${isDolores ? 'Gantt & Delivery Matrix' : isDaisy ? 'MCC & Audience Broadcasts' : 'AI Sub-Routine'}`}
              >
                <span className="text-xs">{agent[0]}</span>
                {isDaisy && <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#E0CA3C]" />}
                {isDolores && <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#ec4899]" />}
              </button>
            );
          })}
        </div>

        {/* Bottom Intercom Shortcut Icon */}
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="text-[#FE5F00] hover:text-[#E0CA3C] p-2 cursor-pointer transition-colors"
          title="Open Universal Intercom Drawer"
        >
          <Terminal size={18} />
        </button>
      </aside>

      {/* Floating 320px Auto-Closing Drawer Overlay */}
      {!isCollapsed && (
        <>
          {/* Outside Backdrop Click Dismiss: pointer-events-auto for dismissal, but pointer-events-none during drag */}
          <div
            onClick={() => setIsCollapsed(true)}
            className="fixed inset-0 top-0 bg-black/60 backdrop-blur-[2px] z-[110] transition-opacity pointer-events-none"
            aria-hidden="true"
          />

          <div
            className="fixed top-[56px] bottom-0 left-[52px] w-[320px] bg-[#020500]/95 border-r border-[#086375] backdrop-blur-md shadow-[12px_0_36px_rgba(0,0,0,0.9)] z-[120] flex flex-col p-4 animate-in fade-in slide-in-from-left-2 duration-150"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#086375]/60 pb-2 mb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-[#FE5F00] font-bold">
                Multi-Agent Dispatch
              </span>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="text-xs text-[#DDFBD0]/60 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Active Client Target Banner */}
            {selectedClient && (
              <div className="mb-2 p-1.5 rounded bg-[#086375]/20 border border-[#086375] flex items-center justify-between font-mono text-hud-3">
                <span className="text-[#086375] uppercase">Target Client:</span>
                <span className="text-[#E0CA3C] font-bold truncate max-w-[150px]">
                  {selectedClient.Company_Name}
                </span>
              </div>
            )}

            {/* ── Tab Switcher: Feed, nodes, and wires ─────────────── */}
            <div className="grid grid-cols-3 gap-1 mb-3 border-b border-[#086375]/30 pb-2">
              <button
                type="button"
                onClick={() => setDrawerTab('feed')}
                aria-pressed={drawerTab === 'feed'}
                className={`flex items-center justify-center gap-1 px-1 py-1 rounded-t text-hud-3 font-mono font-bold transition-colors cursor-pointer ${
                  drawerTab === 'feed'
                    ? 'bg-[#086375]/30 text-[#DDFBD0] border-b-2 border-[#FE5F00]'
                    : 'text-[#DDFBD0]/50 hover:text-[#DDFBD0]'
                }`}
              >
                <AlertTriangle size={11} />
                FEED
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('services')}
                aria-pressed={drawerTab === 'services'}
                className={`flex items-center justify-center gap-1 px-1 py-1 rounded-t text-hud-3 font-mono font-bold transition-colors cursor-pointer ${
                  drawerTab === 'services'
                    ? 'bg-[#086375]/30 text-[#DDFBD0] border-b-2 border-[#E0CA3C]'
                    : 'text-[#DDFBD0]/50 hover:text-[#DDFBD0]'
                }`}
              >
                <Package size={11} />
                ECS NODES
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('wires')}
                aria-pressed={drawerTab === 'wires'}
                className={`flex items-center justify-center gap-1 px-1 py-1 rounded-t text-hud-3 font-mono font-bold transition-colors cursor-pointer ${
                  drawerTab === 'wires'
                    ? 'bg-[#086375]/30 text-[#DDFBD0] border-b-2 border-[#22D3EE]'
                    : 'text-[#DDFBD0]/50 hover:text-[#DDFBD0]'
                }`}
              >
                <Link2 size={11} />
                WIRES
              </button>
            </div>

            {/* ── TAB BODY ─────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-3 font-mono text-xs text-[#DDFBD0] custom-scrollbar">

              {/* ════════════════════ FEED TAB ════════════════════ */}
              {drawerTab === 'feed' && (
                <div className="space-y-3.5">
                  {/* Client Jumper */}
                  <div>
                    <label className="text-hud-3 uppercase tracking-wider text-[#086375] block mb-1">
                      Client Jumper
                    </label>
                    <input
                      type="text"
                      placeholder="Find client ID or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full box-border bg-[#020500] border border-[#086375] rounded px-2.5 py-1 text-xs text-[#DDFBD0] placeholder-[#DDFBD0]/30 focus:outline-none focus:border-[#FE5F00]"
                    />
                    {searchQuery.trim() && (
                      <div className="mt-1 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {clients
                          .filter((c) =>
                            c.Company_Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.ClientID.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((c) => (
                            <button
                              key={c.ClientID}
                              type="button"
                              onClick={() => {
                                onSelectClient?.(c.ClientID);
                                onTriggerWorkbench?.(c);
                                setSearchQuery('');
                              }}
                              className="w-full text-left p-1.5 rounded bg-[#086375]/20 hover:bg-[#086375]/50 flex justify-between text-hud-4 cursor-pointer"
                            >
                              <span className="truncate">{c.Company_Name}</span>
                              <span className="text-[#E0CA3C] text-hud-2">{c.AccountPhase}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Priority Alerts Stream */}
                  {/* Owner 2026-11-05: collapsed in the all-alerts view (13 alerts buried Pending Proposals); open when a department button is chosen. */}
                  {/* Department filter inside the drawer (the left-bar buttons are hidden while the drawer is open). */}
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Filter alerts by department">
                    {[['Alfred', 'All'], ['Pamela', 'Pamela'], ['Oracle', 'Oracle'], ['Dolores', 'Dolores'], ['Vala', 'Vala'], ['Daisy', 'Daisy']].map(([dept, label]) => {
                      const active = (dept === 'Alfred' ? (!openDepartment || openDepartment === 'Housekeeping') : openDepartment === dept);
                      const count = alerts.filter((alert) => !alert.dismissed && (dept === 'Alfred' || alert.subRoutine.toLowerCase() === dept.toLowerCase())).length;
                      return (
                        <button key={dept} type="button" aria-pressed={active} onClick={() => onSelectDepartment?.(dept)}
                          className={`rounded border px-2 py-0.5 text-hud-2 font-bold ${active ? 'border-[#FE5F00] bg-[#FE5F00]/15 text-[#FE5F00]' : 'border-[#086375]/60 text-[#DDFBD0]/70 hover:border-[#E0CA3C]'}`}>
                          {label} {count}
                        </button>
                      );
                    })}
                  </div>
                  <details
                    key={`feed-${openDepartment || 'Alfred'}`}
                    open={Boolean(openDepartment && openDepartment !== 'Housekeeping' && openDepartment !== 'Alfred')}
                    className="rounded-lg border border-[#086375]/40 bg-[#086375]/5 p-2.5"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between border-b border-[#086375]/30 pb-1.5">
                      <span className="text-hud-3 uppercase text-[#086375] font-bold">
                        ▸ {!openDepartment || openDepartment === 'Housekeeping' ? 'All departments' : openDepartment} · Priority Feed ({openDepartmentAlerts.length} open)
                      </span>
                      <AlertTriangle size={12} className="text-[#FE5F00]" />
                    </summary>
                    <div className="divide-y divide-[#086375]/25">
                      {openDepartmentAlerts.length === 0 ? (
                        <div className="py-3 text-center text-hud-3 text-[#DDFBD0]/40">
                          The House is in order. Zero priority alerts.
                        </div>
                      ) : (
                        openDepartmentAlerts.map((alert, i) => {
                          const id = alert.id || `${alert.timestamp}:${i}`;
                          const seen = seenNotificationIds.includes(id);
                          return (
                            <article key={id} className="flex items-start gap-2 py-2 text-hud-4 first:pt-2">
                              <button
                                type="button"
                                onClick={() => alert.clientId && onSelectClient?.(alert.clientId)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="font-bold text-[#FE5F00]">{alert.companyName || 'System Alert'}</div>
                                <div className="mt-0.5 text-hud-3 text-[#DDFBD0]/70">{alert.message}</div>
                              </button>
                              <button
                                type="button"
                                disabled={seen || !onAcknowledgeNotification}
                                onClick={() => onAcknowledgeNotification?.(id)}
                                className="shrink-0 rounded border border-[#086375]/50 px-1.5 py-0.5 text-hud-2 text-[#22D3EE] disabled:cursor-default disabled:text-[#DDFBD0]/40"
                              >
                                {seen ? 'Seen' : 'Acknowledge'}
                              </button>
                              {onResolveFinding
                                && alert.id.startsWith('POL-R1-')
                                && ['open', 'active', 'pending', 'requested'].includes(alert.actionStatus?.toLowerCase() ?? '')
                                && (
                                  <span className="flex shrink-0 flex-col gap-1">
                                    {(['finances', 'clients'] as const).map((choice) => (
                                      <button
                                        key={choice}
                                        type="button"
                                        disabled={pendingWriteKeys.has(`alert:${alert.id}`)}
                                        onClick={() => onResolveFinding(alert.id, choice)}
                                        className="rounded border border-[#086375]/50 px-1.5 py-0.5 text-hud-2 text-[#DDFBD0]/70 hover:border-[#E0CA3C] disabled:cursor-wait disabled:opacity-40"
                                      >
                                        {pendingWriteKeys.has(`alert:${alert.id}`)
                                          ? 'Saving…'
                                          : choice === 'finances' ? 'Use Finances value' : 'Use Clients value'}
                                      </button>
                                    ))}
                                  </span>
                                )}
                              {onSetAlertStatus
                                && !(onResolveFinding && alert.id.startsWith('POL-R1-'))
                                && ['open', 'active', 'pending', 'requested'].includes(alert.actionStatus?.toLowerCase() ?? '')
                                && (
                                  <button
                                    type="button"
                                    disabled={pendingWriteKeys.has(`alert:${alert.id}`)}
                                    onClick={() => onSetAlertStatus(alert.id, 'Resolved')}
                                    className="shrink-0 rounded border border-[#086375]/50 px-1.5 py-0.5 text-hud-2 text-[#DDFBD0]/70 hover:border-[#E0CA3C] disabled:cursor-wait disabled:opacity-40"
                                  >
                                    {pendingWriteKeys.has(`alert:${alert.id}`) ? 'Saving…' : 'Resolve'}
                                  </button>
                                )}
                            </article>
                          );
                        })
                      )}
                    </div>
                    {onSetAlertStatus && resolvedDepartmentAlerts.length > 0 && (
                      <div className="mt-2 border-t border-[#086375]/30 pt-2">
                        <div className="mb-1 text-hud-2 font-bold uppercase text-[#DDFBD0]/50">Resolved</div>
                        <div className="space-y-1">
                          {resolvedDepartmentAlerts.map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between gap-2 text-hud-3">
                              <span className="min-w-0 truncate text-[#DDFBD0]/60" title={alert.message}>
                                {alert.companyName}: {alert.message}
                              </span>
                              <button
                                type="button"
                                disabled={pendingWriteKeys.has(`alert:${alert.id}`)}
                                onClick={() => onSetAlertStatus(alert.id, 'Open')}
                                className="shrink-0 rounded border border-[#086375]/50 px-1.5 py-0.5 text-hud-2 text-[#DDFBD0]/70 hover:border-[#E0CA3C] disabled:cursor-wait disabled:opacity-40"
                              >
                                {pendingWriteKeys.has(`alert:${alert.id}`) ? 'Saving…' : 'Reopen'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </details>

                  {openDepartment === 'Housekeeping' && (
                    <section className="space-y-2 rounded-lg border border-[#086375]/40 bg-[#086375]/5 p-2.5">
                      <h3 className="text-hud-3 uppercase text-[#086375] font-bold">Schema awareness · expected {expectedSchemaVersion}</h3>
                      {schemaDataStatus === 'loading' ? (
                        <p className="text-hud-3 text-[#DDFBD0]/50">Loading schema registry and change log…</p>
                      ) : schemaDataStatus === 'unavailable' ? (
                        <p role="status" className="text-hud-3 text-[#E0CA3C]">
                          {schemaDataError || 'Schema data is unavailable; no live schema claim can be made.'}
                        </p>
                      ) : schemaMismatches.length === 0 && openSchemaChanges.length === 0 ? (
                      <p className="text-hud-3 text-[#DDFBD0]/50">No schema findings or open change-log items.</p>
                      ) : (
                      <ul className="space-y-1 text-hud-3">
                        {schemaMismatches.map((row) => (
                          <li key={row.Registry_ID} className="text-[#E0CA3C]">
                            Version mismatch · {row.Tab}.{row.Column_Name} is {row.Schema_Version}
                          </li>
                        ))}
                        {openSchemaChanges.map((change) => (
                          <li key={change.Change_ID} className="text-[#DDFBD0]/75">
                            {change.Status} · {change.Change_ID} · {change.Target_Tab}.{change.Target_Column}
                          </li>
                        ))}
                      </ul>
                      )}
                      <details>
                      <summary className="cursor-pointer text-hud-3 font-bold text-[#22D3EE]">
                        Draft schema change request
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        <label className="block text-hud-2 text-[#DDFBD0]/60">
                          Target tab
                          <input
                            value={schemaDraftFields.Target_Tab}
                            onChange={(event) => setSchemaDraftFields((current) => ({ ...current, Target_Tab: event.target.value }))}
                            className="mt-0.5 w-full rounded border border-[#086375] bg-[#020500] px-2 py-1 text-hud-3 text-[#DDFBD0]"
                          />
                        </label>
                        <label className="block text-hud-2 text-[#DDFBD0]/60">
                          Target column
                          <input
                            value={schemaDraftFields.Target_Column}
                            onChange={(event) => setSchemaDraftFields((current) => ({ ...current, Target_Column: event.target.value }))}
                            className="mt-0.5 w-full rounded border border-[#086375] bg-[#020500] px-2 py-1 text-hud-3 text-[#DDFBD0]"
                          />
                        </label>
                        <label className="block text-hud-2 text-[#DDFBD0]/60">
                          Reason
                          <textarea
                            value={schemaDraftFields.Reason}
                            onChange={(event) => setSchemaDraftFields((current) => ({ ...current, Reason: event.target.value }))}
                            className="mt-0.5 min-h-12 w-full rounded border border-[#086375] bg-[#020500] px-2 py-1 text-hud-3 text-[#DDFBD0]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void createSchemaDraft()}
                          className="rounded border border-[#086375] px-2 py-1 text-hud-2 font-bold text-[#DDFBD0] hover:border-[#E0CA3C]"
                        >
                          Generate and copy draft
                        </button>
                        {schemaDraftError && <p role="status" className="text-hud-2 text-[#E0CA3C]">{schemaDraftError}</p>}
                        {schemaDraftOutput && (
                          <textarea
                            aria-label="Copyable schema change request JSON"
                            readOnly
                            value={schemaDraftOutput}
                            onFocus={(event) => event.currentTarget.select()}
                            className="min-h-36 w-full rounded border border-[#086375] bg-[#020500] p-2 font-mono text-hud-2 text-[#DDFBD0]"
                          />
                        )}
                        <p className="text-hud-2 text-[#DDFBD0]/50">Draft only. No sheet or server write occurs; the owner or Dolores logs it.</p>
                      </div>
                      </details>
                    </section>
                  )}

                  {notificationStateError && (
                    <p role="status" className="rounded border border-[#E0CA3C]/40 p-2 text-hud-3 text-[#E0CA3C]">
                      {notificationStateError}
                    </p>
                  )}

                  <details open={selectedProposals.length > 0} className="rounded-lg border border-[#E0CA3C]/50 bg-[#086375]/5 p-2.5">
                    <summary className="cursor-pointer list-none text-hud-3 uppercase text-[#E0CA3C] font-bold">
                      ▸ Pending Proposals ({selectedProposals.length})
                    </summary>
                    <p className="mt-2 text-hud-3 text-[#DDFBD0]/50">
                      Review only; nothing is sent, created, or written here. Money proposals open the Financial Mutation confirmation, and only a confirmed draft is written.
                    </p>
                    {selectedProposals.length === 0 ? (
                      <p className="py-3 text-center text-hud-3 text-[#DDFBD0]/40">
                        No proposals are waiting for this client.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#086375]/25">
                        {selectedProposals.map((proposal) => (
                          <article key={proposal.id} className="py-2 text-hud-4 first:pt-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-[#E0CA3C]">{proposal.title}</div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  disabled={seenNotificationIds.includes(proposal.id)}
                                  onClick={() => onAcknowledgeNotification?.(proposal.id)}
                                  className="text-hud-2 text-[#22D3EE] hover:text-[#DDFBD0] disabled:text-[#DDFBD0]/40"
                                >
                                  {seenNotificationIds.includes(proposal.id) ? 'Seen' : 'Acknowledge'}
                                </button>
                                {onDismissProposal && (
                                <button
                                  type="button"
                                  onClick={() => onDismissProposal(proposal.id)}
                                  className="shrink-0 text-hud-2 text-[#DDFBD0]/50 hover:text-[#FE5F00]"
                                  aria-label={`Dismiss local proposal: ${proposal.title}`}
                                >
                                  Dismiss
                                </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-0.5 text-hud-2 uppercase tracking-wide text-[#DDFBD0]/50">
                              {proposal.type.replaceAll('_', ' ')} · pending human review
                            </div>
                            <p className="mt-1 text-hud-3 text-[#DDFBD0]/75">{proposal.detail}</p>
                            {(proposal.requiresMoneyGate || proposal.clientFacing || proposal.stagedState) && (
                              <div className="mt-1 flex flex-wrap gap-1 text-hud-2">
                                {proposal.requiresMoneyGate && (
                                  <span className="rounded border border-[#FE5F00]/40 px-1 text-[#FE5F00]">
                                    Financial Mutation gate required
                                  </span>
                                )}
                                {proposal.requiresMoneyGate && proposal.type === 'draft_invoice' && onReviewMoneyProposal && (
                                  <button
                                    type="button"
                                    onClick={() => onReviewMoneyProposal(proposal)}
                                    className="rounded border border-[#FE5F00] px-1 font-bold text-[#FE5F00] hover:bg-[#FE5F00]/10"
                                  >
                                    Review in Financial Mutation gate…
                                  </button>
                                )}
                                {proposal.clientFacing && (
                                  <span className="rounded border border-[#086375]/50 px-1 text-[#22D3EE]">
                                    {CLIENT_FACING_ROUTE_LABEL}
                                  </span>
                                )}
                                {proposal.stagedState && (
                                  <span className="rounded border border-[#FE5F00]/40 px-1 text-[#FE5F00]">
                                    Crisis state staged — sign-off required
                                  </span>
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </details>
                </div>
              )}

              {/* ════════════════════ ECS SERVICES TAB ════════════════════ */}
              {drawerTab === 'services' && (
                <div className="space-y-2">
                  {/* Registry Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-hud-3 uppercase tracking-wider text-[#E0CA3C] font-bold">
                        Service Node Registry
                      </span>
                    </div>
                    <span className="text-hud-1 px-1.5 py-0.5 rounded bg-[#086375]/30 text-[#DDFBD0]/60">
                      DRAG → WORKBENCH
                    </span>
                  </div>

                  {/* ── Department Accordion ──────────────────────── */}
                  {DEPARTMENT_SECTIONS.map((section) => {
                    const isExpanded = expandedSections.has(section.department);
                    return (
                      <div
                        key={section.department}
                        className="rounded-lg border border-[#086375]/40 overflow-hidden"
                      >
                        {/* Accordion Header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(section.department)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer hover:bg-[#086375]/10"
                          style={{ borderLeft: `3px solid ${section.color}` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{section.icon}</span>
                            <div>
                              <span className="font-bold text-hud-4 text-white block">
                                {section.department}
                              </span>
                              <span className="text-hud-1 text-[#DDFBD0]/50">
                                {section.label} · {section.services.length} node{section.services.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            size={13}
                            className={`text-[#DDFBD0]/40 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        {/* Accordion Body: Draggable Service Nodes */}
                        {isExpanded && (
                          <div className="px-2 pb-2 space-y-1.5 border-t border-[#086375]/20 pt-1.5">
                            {section.services.map((service) => (
                              <div
                                key={service.id}
                                draggable="true"
                                onDragStart={(e) => handleServiceDragStart(e, service)}
                                className="group flex items-center gap-2 p-2 rounded-lg border border-[#086375]/50 bg-[#0d1513]/70 cursor-grab hover:ring-2 hover:ring-[#E0CA3C] hover:border-[#E0CA3C]/60 hover:bg-[#E0CA3C]/5 transition-all active:cursor-grabbing active:ring-[#FE5F00] active:scale-[0.97] w-full box-border"
                                style={{ userSelect: 'auto' }}
                                title={`Drag "${service.name}" onto the Solar Workbench to snap it to orbit`}
                              >
                                {/* Grip Handle */}
                                <GripVertical
                                  size={14}
                                  className="text-[#086375] group-hover:text-[#E0CA3C] shrink-0 transition-colors"
                                />

                                {/* Service Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-hud-3 text-white truncate">
                                      {service.name}
                                    </span>
                                    <span
                                      className="text-hud-2 font-bold shrink-0"
                                      style={{ color: section.color }}
                                    >
                                      {service.price > 0 ? `+$${service.price.toLocaleString()}` : 'unpriced'}
                                    </span>
                                  </div>
                                  <p className="text-hud-1 text-[#DDFBD0]/50 truncate mt-0.5">
                                    {service.description}
                                  </p>
                                </div>

                                {/* Category Badge */}
                                <span
                                  className="text-hud-1 font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `${section.color}20`,
                                    color: section.color,
                                    border: `1px solid ${section.color}40`,
                                  }}
                                >
                                  {service.category}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Drop Zone Hint */}
                  <div className="mt-3 p-2.5 border border-dashed border-[#E0CA3C]/30 rounded-lg text-center">
                    <p className="text-hud-2 text-[#E0CA3C]/60">
                      Drag a Service Node from above and drop it onto a client's
                      <span className="text-[#E0CA3C] font-bold"> Solar System Workbench </span>
                      to attach the ECS component.
                    </p>
                  </div>
                </div>
              )}

              {drawerTab === 'wires' && (
                <div className="space-y-3">
                  {!wirePanel ? (
                    <div className="rounded border border-dashed border-[#086375]/50 p-3 text-center">
                      <p className="font-bold text-hud-3 text-[#22D3EE]">WIRE CONTROL OFFLINE</p>
                      <p className="mt-1 text-hud-2 text-[#DDFBD0]/50">
                        Open a client Solar Workbench to configure its nodes and wires.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded border border-[#086375]/50 bg-[#086375]/10 px-2.5 py-2">
                        <div className="text-hud-2 uppercase tracking-wider text-[#22D3EE]">Solar Workbench</div>
                        <div className="mt-0.5 truncate text-hud-4 font-bold text-white">{wirePanel.clientName}</div>
                      </div>

                      <section className="rounded border border-[#086375]/50 p-2.5">
                        <h3 className="mb-2 text-hud-3 font-bold uppercase tracking-wider text-[#E0CA3C]">
                          New Wire Configuration
                        </h3>
                        <label className="mb-1 block text-hud-1 uppercase text-[#086375]">Source node</label>
                        <div className="mb-2 grid grid-cols-[1fr_auto] gap-1">
                          <select
                            aria-label="Wire source node"
                            value={fromNode?.id || ''}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setWireDraft((draft) => ({ ...draft, fromNodeId: value }));
                            }}
                            className="min-w-0 rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 text-[#DDFBD0]"
                          >
                            {wireNodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                          </select>
                          <select
                            aria-label="Wire source port"
                            value={wireDraft.fromPin}
                            onChange={(event) => {
                              const value = event.currentTarget.value as Pin;
                              setWireDraft((draft) => ({ ...draft, fromPin: value }));
                            }}
                            className="rounded border border-[#086375] bg-[#020500] px-1 py-1 text-hud-2 text-[#DDFBD0]"
                          >
                            {['top', 'right', 'bottom', 'left'].map((pin) => <option key={pin} value={pin}>{pin}</option>)}
                          </select>
                        </div>

                        <label className="mb-1 block text-hud-1 uppercase text-[#086375]">Target node</label>
                        <div className="mb-2 grid grid-cols-[1fr_auto] gap-1">
                          <select
                            aria-label="Wire target node"
                            value={toNode?.id || ''}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setWireDraft((draft) => ({ ...draft, toNodeId: value }));
                            }}
                            className="min-w-0 rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 text-[#DDFBD0]"
                          >
                            {wireNodes.filter((node) => node.id !== fromNode?.id).map((node) => (
                              <option key={node.id} value={node.id}>{node.label}</option>
                            ))}
                          </select>
                          <select
                            aria-label="Wire target port"
                            value={wireDraft.toPin}
                            onChange={(event) => {
                              const value = event.currentTarget.value as Pin;
                              setWireDraft((draft) => ({ ...draft, toPin: value }));
                            }}
                            className="rounded border border-[#086375] bg-[#020500] px-1 py-1 text-hud-2 text-[#DDFBD0]"
                          >
                            {['top', 'right', 'bottom', 'left'].map((pin) => <option key={pin} value={pin}>{pin}</option>)}
                          </select>
                        </div>

                        <div className="mb-2 grid grid-cols-2 gap-2">
                          <label className="text-hud-1 uppercase text-[#086375]">
                            Kind
                            <select
                              aria-label="New wire kind"
                              value={selectedCreateKind || ''}
                              onChange={(event) => {
                                const value = event.currentTarget.value as LinkKind;
                                setWireDraft((draft) => ({ ...draft, kind: value }));
                              }}
                              disabled={!createKinds.length}
                              className="mt-1 block w-full rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 normal-case text-[#DDFBD0] disabled:opacity-40"
                            >
                              {createKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                            </select>
                          </label>
                          <label className="text-hud-1 uppercase text-[#086375]">
                            Flow
                            <select
                              aria-label="New wire flow"
                              value={wireDraft.mode}
                              onChange={(event) => {
                                const value = event.currentTarget.value as FlowMode;
                                setWireDraft((draft) => ({ ...draft, mode: value }));
                              }}
                              className="mt-1 block w-full rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 normal-case text-[#DDFBD0]"
                            >
                              {(['push', 'pull', 'sync'] as FlowMode[]).map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                            </select>
                          </label>
                        </div>

                        <label className="mb-2 block text-hud-1 uppercase text-[#086375]">
                          Label
                          <input
                            type="text"
                            value={wireDraft.label}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setWireDraft((draft) => ({ ...draft, label: value }));
                            }}
                            maxLength={80}
                            placeholder="Optional wire label"
                            className="mt-1 block w-full box-border rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 normal-case text-[#DDFBD0] placeholder:text-[#DDFBD0]/30"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={!fromNode || !toNode || !selectedCreateKind || duplicateWire}
                          onClick={() => {
                            if (!fromNode || !toNode || !selectedCreateKind) return;
                            onCreateWire?.({
                              fromNodeId: fromNode.id,
                              fromPin: wireDraft.fromPin,
                              toNodeId: toNode.id,
                              toPin: wireDraft.toPin,
                              kind: selectedCreateKind,
                              mode: wireDraft.mode,
                              label: wireDraft.label,
                            });
                          }}
                          className="w-full rounded border border-[#22D3EE]/60 bg-[#22D3EE]/10 px-2 py-1.5 text-hud-2 font-bold uppercase text-[#22D3EE] hover:bg-[#22D3EE]/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Create Wire
                        </button>
                        {duplicateWire && (
                          <p role="status" className="mt-1 text-hud-1 text-[#FE5F00]">
                            A wire already connects these nodes in this direction.
                          </p>
                        )}
                      </section>

                      <section className="rounded border border-[#086375]/50 p-2.5">
                        <h3 className="mb-2 flex items-center justify-between text-hud-3 font-bold uppercase tracking-wider text-[#22D3EE]">
                          <span>GateVitals</span>
                          <span className="text-hud-1 font-normal text-[#DDFBD0]/50">
                            {wirePanel.links.length} wire{wirePanel.links.length === 1 ? '' : 's'}
                          </span>
                        </h3>
                        {wirePanel.links.length ? (
                          <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
                            {wirePanel.links.map((link) => {
                              const source = wirePanel.nodes.find((node) => node.id === link.fromNodeId);
                              const target = wirePanel.nodes.find((node) => node.id === link.toNodeId);
                              const hasMissingEndpoint = !source || !target;
                              const isSelected = link.id === wirePanel.selectedWireId;
                              return (
                                <button
                                  key={link.id}
                                  type="button"
                                  aria-pressed={isSelected}
                                  aria-label={`${source?.label || link.fromNodeId} to ${target?.label || link.toNodeId}, ${link.kind}${hasMissingEndpoint ? ', error: endpoint unavailable' : ''}`}
                                  onClick={() => onSelectWire?.(link.id)}
                                  style={hasMissingEndpoint ? { borderColor: ERROR_COLOR, color: ERROR_COLOR } : undefined}
                                  className={`w-full rounded border px-2 py-1.5 text-left text-hud-1 ${
                                    isSelected
                                      ? 'border-[#22D3EE] bg-[#22D3EE]/10 text-[#DDFBD0]'
                                      : hasMissingEndpoint
                                        ? 'bg-red-950/20'
                                        : 'border-[#086375]/40 text-[#DDFBD0]/65 hover:border-[#086375]'
                                  }`}
                                >
                                  <span className="block truncate">{source?.label || link.fromNodeId} → {target?.label || link.toNodeId}</span>
                                  <span className={`text-hud-1 uppercase ${hasMissingEndpoint ? '' : 'text-[#086375]'}`}>
                                    {link.kind} · {link.mode} · {link.enabled ? 'enabled' : 'disabled'}
                                    {hasMissingEndpoint ? ' · endpoint error' : ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mb-2 text-hud-1 text-[#DDFBD0]/50">No wires are configured for this workbench.</p>
                        )}

                        {selectedWire ? (
                          <div className="space-y-2 border-t border-[#086375]/40 pt-2">
                            {(!selectedWireFrom || !selectedWireTo) && (
                              <p role="alert" style={{ color: ERROR_COLOR }} className="text-hud-1">
                                Wire endpoint unavailable. This wire is not rendered on the canvas; delete it or import a valid wire export.
                              </p>
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 text-hud-2 text-white">
                                <span className="block truncate">{selectedWireFrom?.label || selectedWire.fromNodeId}</span>
                                <span className="text-[#22D3EE]">↓</span>
                                <span className="block truncate">{selectedWireTo?.label || selectedWire.toNodeId}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onSelectWire?.(null)}
                                className="shrink-0 text-hud-1 uppercase text-[#DDFBD0]/45 hover:text-white"
                              >
                                Clear
                              </button>
                            </div>

                            <label className="block text-hud-1 uppercase text-[#086375]">
                              Wire kind
                              <select
                                aria-label="Selected wire kind"
                                value={selectedWire.kind}
                                onChange={(event) => onUpdateWire?.(selectedWire.id, { kind: event.currentTarget.value as LinkKind })}
                                className="mt-1 block w-full rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 normal-case text-[#DDFBD0]"
                              >
                                {selectedWireKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                              </select>
                            </label>

                            <label className="block text-hud-1 uppercase text-[#086375]">
                              Flow mode
                              <select
                                aria-label="Selected wire flow mode"
                                value={selectedWire.mode}
                                onChange={(event) => onUpdateWire?.(selectedWire.id, { mode: event.currentTarget.value as FlowMode })}
                                className="mt-1 block w-full rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 normal-case text-[#DDFBD0]"
                              >
                                {(['push', 'pull', 'sync'] as FlowMode[]).map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                              </select>
                            </label>

                            <label className="block text-hud-1 uppercase text-[#086375]">
                              Label
                              <input
                                type="text"
                                value={wireLabelDraft}
                                onChange={(event) => setWireLabelDraft(event.currentTarget.value)}
                                maxLength={80}
                                className="mt-1 block w-full box-border rounded border border-[#086375] bg-[#020500] px-1.5 py-1 text-hud-2 normal-case text-[#DDFBD0]"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={wireLabelDraft === (selectedWire.label || '')}
                              onClick={() => onUpdateWire?.(selectedWire.id, { label: wireLabelDraft.trim() })}
                              className="w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Save Label
                            </button>

                            <button
                              type="button"
                              aria-pressed={selectedWire.enabled}
                              onClick={() => onUpdateWire?.(selectedWire.id, { enabled: !selectedWire.enabled })}
                              className="w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE]"
                            >
                              {selectedWire.enabled ? 'Disable Wire' : 'Enable Wire'}
                            </button>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => onReverseWire?.(selectedWire.id)}
                                className="rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#E0CA3C]"
                              >
                                Reverse
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveWire?.(selectedWire.id)}
                                className="rounded border border-[#FE5F00]/50 px-2 py-1 text-hud-1 uppercase text-[#FE5F00] hover:bg-[#FE5F00]/10"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="border-t border-[#086375]/40 pt-2 text-hud-1 text-[#DDFBD0]/45">
                            Select a wire to view and edit its GateVitals.
                          </p>
                        )}
                      </section>

                      {import.meta.env.DEV && (
                        <details className="rounded border border-[#086375]/40 p-2.5">
                          <summary className="cursor-pointer text-hud-2 font-bold uppercase text-[#DDFBD0]/60">
                            Developer event trigger
                          </summary>
                          <p className="mt-2 text-hud-1 text-[#DDFBD0]/45">
                            Production rules remain suggested and inert. The proposal preview uses an isolated development fixture and performs no sends or writes.
                          </p>
                          <button
                            type="button"
                            disabled={!developerEventSource}
                            onClick={() => {
                              if (!developerEventSource) return;
                              onPublishEvent?.({
                                id: `dev:milestone:${wirePanel.clientId}`,
                                type: 'milestone.done',
                                source: 'system',
                                sourceNodeId: developerEventSource.id,
                                clientId: wirePanel.clientId,
                              });
                            }}
                            className="mt-2 w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Publish with production rules
                          </button>
                          <button
                            type="button"
                            disabled={!developerEventSource}
                            onClick={() => {
                              if (!developerEventSource) return;
                              onSimulateEvent?.({
                                id: `dev:milestone-preview:${wirePanel.clientId}`,
                                type: 'milestone.done',
                                source: 'system',
                                sourceNodeId: developerEventSource.id,
                                clientId: wirePanel.clientId,
                              });
                            }}
                            className="mt-1 w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Preview proposal fixture
                          </button>
                          <button
                            type="button"
                            disabled={!developerDependencySource || !canPreviewDependencyUnblock}
                            onClick={() => {
                              if (!developerDependencySource) return;
                              onSimulateUnblockEvent?.({
                                id: `dev:msa-preview:${wirePanel.clientId}`,
                                type: 'msa.signed',
                                source: 'system',
                                sourceNodeId: developerDependencySource.id,
                                clientId: wirePanel.clientId,
                              });
                            }}
                            className="mt-1 w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Preview dependency unblock
                          </button>
                          {!canPreviewDependencyUnblock && (
                            <p className="mt-1 text-hud-1 text-[#DDFBD0]/45">
                              Add an enabled Pamela to Vala dependency wire to preview its derived unblock state.
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={!developerPoliceSource}
                            onClick={() => {
                              if (!developerPoliceSource) return;
                              onPublishEvent?.({
                                id: `dev:police-corrected:${wirePanel.clientId}`,
                                type: 'police.corrected',
                                source: 'police_correction',
                                sourceNodeId: developerPoliceSource.id,
                                clientId: wirePanel.clientId,
                                payload: { message: 'Development-only Police correction alert.' },
                              });
                            }}
                            className="mt-1 w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Preview Police correction alert
                          </button>
                          <button
                            type="button"
                            disabled={!developerPoliceSource}
                            onClick={() => {
                              if (!developerPoliceSource) return;
                              onPublishEvent?.({
                                id: `dev:police-schema:${wirePanel.clientId}`,
                                type: 'police.schema',
                                source: 'police_correction',
                                sourceNodeId: developerPoliceSource.id,
                                clientId: wirePanel.clientId,
                                payload: { message: 'Development-only schema alert.' },
                              });
                            }}
                            className="mt-1 w-full rounded border border-[#086375] px-2 py-1 text-hud-1 uppercase text-[#DDFBD0] hover:border-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Preview Police schema alert
                          </button>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Universal Intercom (Pinned Bottom Prompt) */}
            <div className="pt-2 border-t border-[#086375] bg-[#020500] shrink-0 mt-2">
              <label className="text-hud-2 font-mono uppercase text-[#086375] block mb-1">
                Universal Intercom
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!commandInput.trim()) return;
                  onCommandSubmit?.(commandInput);
                  setCommandInput('');
                }}
                className="flex gap-1"
              >
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="> @agent command..."
                  className="flex-1 bg-[#020500] border border-[#086375] rounded px-2 py-1 text-xs text-[#DDFBD0] font-mono focus:outline-none focus:border-[#E0CA3C]"
                />
                <button
                  type="submit"
                  className="px-2.5 bg-[#086375] text-[#DDFBD0] rounded hover:bg-[#FE5F00] transition-colors text-xs font-mono font-bold cursor-pointer"
                >
                  ↵
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
};
