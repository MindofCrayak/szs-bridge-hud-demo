import React, { useState, useEffect, useRef } from 'react';
import { ClientRecord, SprintStage } from '../../types';
import { CATALOG, CatalogEntry, Department } from '../../ecs/catalog';
import {
  allowedKinds,
  createUserLink,
  exportLinkState,
  Link,
  LinkKind,
  LinkState,
  loadLinkState,
  parseLinkExport,
  saveLinkState,
  WireCreateInput,
  WirePanelActions,
  WirePanelSnapshot,
  WireEditableFields,
} from '../../ecs/links';
import { DEPT_COLOR, KIND_STYLE, MAX_ANIMATED, MONEY_GLYPH } from '../../ecs/wireTheme';
import type { AgentCallsign, AlfredNodeContext } from '../../ecs/agentDispatch';
import { ResizableNodeContainer, NodeGeometry } from './workbench/ResizableNodeContainer';
import { ConnectionPort } from './workbench/ConnectionPort';
import type { ConnectionTargetPreview } from './workbench/ConnectionPort';
import { ContextMenu, MenuItem } from './workbench/ContextMenu';
import { syncServiceToMasterControl } from '../../data/api';
import { SUN_HEIGHT, SUN_WIDTH, isSunNodeId, nearestSun, planSuns, sunLayout, sunNodeId, withSunDefaults } from '../../ecs/suns';
import { loadLayout, mergeLayout, saveLayout } from '../../ecs/workbenchLayout';
import { DropConfirmDialog } from './workbench/DropConfirmDialog';
import { ServiceRemovalDialog } from './workbench/ServiceRemovalDialog';

interface ProjectWorkbenchViewProps {
  client: ClientRecord;
  selectedProjectId?: string | null;
  onExit: () => void;
  /** Canvas controls rendered inside the top ribbon (owner 2026-11-06). */
  toolbar?: React.ReactNode;
  onUpdateClient?: (updated: ClientRecord) => void;
  onTriggerAction?: (actionKey: string, payload?: any) => void;
  onDispatchAgent?: (agent: AgentCallsign, nodeContext: AlfredNodeContext) => void;
  cameraZoom?: number;
  cameraPan?: { x: number; y: number };
  accessToken?: string | null;
  interactionMode?: 'drag' | 'lock' | 'edit';
  showNonStructural?: boolean;
  activeWireIds?: string[];
  doneNodeIds?: string[];
  onWirePanelChange?: (snapshot: WirePanelSnapshot | null) => void;
  onWirePanelActionsChange?: (actions: WirePanelActions | null) => void;
  /** Phase F: open the Planet page for a project (double-click the Sun or a service node). */
  onOpenPlanet?: (projectId: string) => void;
}

const SPRINT_STAGES_LIST: SprintStage[] = [
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

const isFinancialRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const PIN_NORMALS: Record<Link['fromPin'], { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const WIRE_DEPARTMENTS: Department[] = ['pamela', 'oracle', 'dolores', 'vala', 'daisy', 'core'];
const WIRE_KINDS: LinkKind[] = ['context', 'dependency', 'trigger'];

interface PendingDropState {
  serviceId: string;
  name: string;
  price: number;
  tasksToInject: string[];
  targetClientId: string;
  snapX: number;
  snapY: number;
  /** Multi-sun: the project (and its sun node) the service attaches to. */
  projectId?: string;
  sunId?: string;
  connectFrom?: { nodeId: string; pin: Link['fromPin'] };
  connectAt?: { x: number; y: number };
}

interface WorkbenchSnapshot {
  nodes: NodeGeometry[];
  links: LinkState | null;
}

interface PortDragState {
  fromNodeId: string;
  fromPin: Link['fromPin'];
  cursorWorld: { x: number; y: number };
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

interface WireKindPickerState {
  x: number;
  y: number;
  input: WireCreateInput;
  kinds: LinkKind[];
}

function getInitialWorkbenchNodes(client: ClientRecord): NodeGeometry[] {
  const nodes: NodeGeometry[] = [
    { id: 'node-pamela', title: 'PAMELA // LEGAL', x: -300, y: -200, width: 220, height: 130, isLocked: false },
    { id: 'node-oracle', title: 'ORACLE // INTEL', x: 120, y: -200, width: 220, height: 130, isLocked: false },
    { id: 'node-dolores', title: 'DOLORES // GANTT', x: -300, y: 100, width: 220, height: 130, isLocked: false },
    { id: 'node-vala', title: 'VALA // FISCAL', x: 120, y: 100, width: 220, height: 130, isLocked: false },
    { id: 'node-daisy', title: 'DAISY // MCC', x: -100, y: -280, width: 220, height: 120, isLocked: false },
  ];
  (client.activeComponents || []).forEach((serviceId, index) => {
    const entry = CATALOG.find((candidate) => candidate.serviceId === serviceId);
    if (!entry) return;
    const angle = (index / Math.max(client.activeComponents?.length || 1, 1)) * Math.PI * 2;
    nodes.push({
      id: `node-${entry.serviceId}`,
      serviceId,
      title: entry.label,
      x: Math.round(Math.cos(angle) * 500),
      y: Math.round(Math.sin(angle) * 400),
      width: 200,
      height: 100,
      isLocked: false,
    });
  });
  return nodes;
}

function getWireNodeType(id: string, node?: NodeGeometry): WirePanelSnapshot['nodes'][number]['type'] {
  if (id === 'core-node' || isSunNodeId(id)) return 'core';
  return node?.serviceId ? 'component' : 'agent';
}

export const ProjectWorkbenchView: React.FC<ProjectWorkbenchViewProps> = ({
  client,
  selectedProjectId = null,
  onExit,
  toolbar,
  onUpdateClient,
  onTriggerAction,
  onDispatchAgent,
  cameraZoom = 1.0,
  cameraPan = { x: 0, y: 0 },
  accessToken = null,
  interactionMode = 'drag',
  showNonStructural = true,
  activeWireIds = [],
  doneNodeIds = [],
  onWirePanelChange,
  onWirePanelActionsChange,
  onOpenPlanet,
}) => {
  const [notice, setNotice] = useState<string | null>(null);
  const [isServiceSubmitting, setIsServiceSubmitting] = useState(false);
  const [serviceSyncError, setServiceSyncError] = useState<string | null>(null);
  const serviceSubmitInFlightRef = useRef(false);
  const [nodes, setNodes] = useState<NodeGeometry[]>(() => mergeLayout(getInitialWorkbenchNodes(client), loadLayout(client.ClientID)));
  const nodesRef = useRef(nodes);
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const linkStateRef = useRef<LinkState | null>(null);
  const historyRef = useRef<{ past: WorkbenchSnapshot[]; future: WorkbenchSnapshot[] }>({ past: [], future: [] });
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [visibleWireDepartments, setVisibleWireDepartments] = useState<Record<Department, boolean>>({
    pamela: true,
    oracle: true,
    dolores: true,
    vala: true,
    daisy: true,
    core: true,
  });
  const [visibleWireKinds, setVisibleWireKinds] = useState<Record<LinkKind, boolean>>({
    context: true,
    dependency: true,
    trigger: true,
  });
  const groupDragSnapshotRef = useRef<NodeGeometry[] | null>(null);
  const [selectedPort, setSelectedPort] = useState<{ nodeId: string; pin: Link['fromPin'] } | null>(null);
  const [portDrag, setPortDrag] = useState<PortDragState | null>(null);
  const portDragRef = useRef<PortDragState | null>(null);
  const portDragCleanupRef = useRef<(() => void) | null>(null);
  const suppressPortClickRef = useRef(false);
  const [wireKindPicker, setWireKindPicker] = useState<WireKindPickerState | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [wireMenu, setWireMenu] = useState<{ x: number; y: number; linkId: string } | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{
    x: number;
    y: number;
    connectFrom?: { nodeId: string; pin: Link['fromPin'] };
  } | null>(null);
  const [sunMenu, setSunMenu] = useState<{ x: number; y: number } | null>(null);
  const [sunLocked, setSunLocked] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const wireActionsRef = useRef<WirePanelActions | null>(null);
  // Multi-sun Solar: the primary sun (`core-node`) is the client's first open project (stable, so wires on it never
  // move to another project); every other open project gets its own sun node. A project at 09 goes out.
  // Selecting a project (Galaxy/Universe/Planet) focuses the camera on its sun instead.
  const sunPlan = planSuns(client.activeProjects ?? [], null);
  const activeProject = sunPlan.primary;
  const secondaryKey = sunPlan.secondary.map((project) => `${project.ProjectID}@${project.SprintStage}`).join('|');
  const currentStage = activeProject?.SprintStage || '00: Discovery';
  const stageIndex = SPRINT_STAGES_LIST.indexOf(currentStage);

  useEffect(() => () => portDragCleanupRef.current?.(), []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(preference.matches);
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    preference.addEventListener('change', handleChange);
    return () => preference.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    try {
      const loaded = loadLinkState(client.ClientID);
      linkStateRef.current = loaded;
      historyRef.current = { past: [], future: [] };
      setLinkState(loaded);
    } catch (error) {
      linkStateRef.current = null;
      setLinkState(null);
      setNotice(error instanceof Error ? error.message : 'Unable to load saved wire data.');
    }
  }, [client.ClientID]);

  useEffect(() => {
    if (!linkState || linkState.clientId !== client.ClientID) return;
    try {
      saveLinkState(linkState);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save wire data.');
    }
  }, [client.ClientID, linkState]);

  // Owner 2026-11-05: arrangements persist per client (they reset on every reopen before).
  const layoutClientRef = useRef<string | null>(null);
  useEffect(() => {
    const initialNodes = mergeLayout(getInitialWorkbenchNodes(client), loadLayout(client.ClientID));
    layoutClientRef.current = client.ClientID;
    nodesRef.current = initialNodes;
    setNodes(initialNodes);
  }, [client.ClientID]);
  useEffect(() => {
    if (layoutClientRef.current === client.ClientID && nodes.length) saveLayout(client.ClientID, nodes);
    // Only node changes are saved; the client switch is handled by the load effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Focus the camera on the selected project's sun when it is a secondary sun.
  useEffect(() => {
    if (!selectedProjectId || selectedProjectId === activeProject?.ProjectID) return;
    const sun = nodesRef.current.find((node) => node.id === sunNodeId(selectedProjectId));
    if (sun) onTriggerAction?.('FOCUS_NODE', { x: sun.x + sun.width / 2, y: sun.y + sun.height / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, secondaryKey]);

  // Keep one sun node per secondary open project (added/removed as projects open or go to Sunset), plus their
  // default department wires. Not an undoable edit: suns follow the project data.
  useEffect(() => {
    const wanted = sunPlan.secondary;
    const wantedIds = new Set(wanted.map((project) => sunNodeId(project.ProjectID)));
    const current = nodesRef.current;
    const kept = current.filter((node) => node.kind !== 'sun' || wantedIds.has(node.id));
    const have = new Set(kept.filter((node) => node.kind === 'sun').map((node) => node.id));
    const savedLayout = loadLayout(client.ClientID);
    const added: NodeGeometry[] = wanted
      .map((project, index) => ({ project, index }))
      .filter(({ project }) => !have.has(sunNodeId(project.ProjectID)))
      .map(({ project, index }) => {
        const saved = savedLayout[sunNodeId(project.ProjectID)];
        return {
          id: sunNodeId(project.ProjectID),
          kind: 'sun' as const,
          projectId: project.ProjectID,
          title: project.Title || project.ProjectID,
          ...(saved ? { x: saved.x, y: saved.y } : sunLayout(index)),
          width: saved?.width ?? SUN_WIDTH,
          height: saved?.height ?? SUN_HEIGHT,
          isLocked: saved?.isLocked ?? false,
        };
      });
    const titled = kept.map((node) => {
      if (node.kind !== 'sun') return node;
      const project = wanted.find((item) => sunNodeId(item.ProjectID) === node.id);
      return project && node.title !== (project.Title || project.ProjectID) ? { ...node, title: project.Title || project.ProjectID } : node;
    });
    if (added.length || titled.length !== current.length || titled.some((node, i) => node !== current[i])) {
      updateNodes(() => [...titled, ...added]);
    }
    const links = linkStateRef.current;
    if (links && links.clientId === client.ClientID) {
      const next = withSunDefaults(links, wanted.map((project) => project.ProjectID));
      if (next !== links) {
        linkStateRef.current = next;
        setLinkState(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.ClientID, secondaryKey, linkState?.clientId]);

  const updateNodes = (update: (current: NodeGeometry[]) => NodeGeometry[]) => {
    const next = update(nodesRef.current);
    nodesRef.current = next;
    setNodes(next);
  };

  const commitWorkbenchState = (nextNodes: NodeGeometry[], nextLinks: LinkState | null) => {
    const history = historyRef.current;
    history.past.push({ nodes: nodesRef.current, links: linkStateRef.current });
    if (history.past.length > 50) history.past.shift();
    history.future = [];
    nodesRef.current = nextNodes;
    linkStateRef.current = nextLinks;
    setNodes(nextNodes);
    setLinkState(nextLinks);
  };

  const commitLinkState = (next: LinkState) => {
    const previous = linkStateRef.current;
    if (!previous || previous.clientId !== client.ClientID) return;
    commitWorkbenchState(nodesRef.current, next);
  };

  const updateLinkState = (update: (current: LinkState) => LinkState) => {
    const current = linkStateRef.current;
    if (!current || current.clientId !== client.ClientID) {
      setNotice('Wire data is unavailable; reload the Solar Workbench before changing wires.');
      return;
    }
    const next = update(current);
    if (next !== current) commitLinkState(next);
  };

  const undoWorkbenchChange = () => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push({ nodes: nodesRef.current, links: linkStateRef.current });
    const validNodeIds = new Set(previous.nodes.map((node) => node.id));
    nodesRef.current = previous.nodes;
    linkStateRef.current = previous.links;
    setNodes(previous.nodes);
    setLinkState(previous.links);
    setSelectedNodeIds((current) => current.filter((id) => validNodeIds.has(id)));
    setSelectedNodeId((current) => current === 'core-node' || (current !== null && validNodeIds.has(current)) ? current : null);
  };

  const redoWorkbenchChange = () => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push({ nodes: nodesRef.current, links: linkStateRef.current });
    const validNodeIds = new Set(next.nodes.map((node) => node.id));
    nodesRef.current = next.nodes;
    linkStateRef.current = next.links;
    setNodes(next.nodes);
    setLinkState(next.links);
    setSelectedNodeIds((current) => current.filter((id) => validNodeIds.has(id)));
    setSelectedNodeId((current) => current === 'core-node' || (current !== null && validNodeIds.has(current)) ? current : null);
  };

  const duplicateNode = (node: NodeGeometry) => {
    if (node.kind === 'sun') {
      setNotice('Project suns cannot be duplicated; each project has exactly one sun.');
      return;
    }
    if (node.serviceId) {
      setNotice('Installed service components cannot be duplicated.');
      return;
    }
    const duplicate: NodeGeometry = {
      ...node,
      id: `${node.id}-copy-${Date.now()}`,
      title: `${node.title || node.id} COPY`,
      x: node.x + 32,
      y: node.y + 32,
      isLocked: false,
    };
    commitWorkbenchState([...nodesRef.current, duplicate], linkStateRef.current);
    setSelectedNodeId(duplicate.id);
    setSelectedNodeIds([duplicate.id]);
    setSelectedWireId(null);
  };

  const duplicateSelectedNodes = () => {
    const selected = nodesRef.current.filter((node) => selectedNodeIds.includes(node.id) && !node.serviceId);
    if (selected.length === 0) {
      setNotice('Only built-in department nodes are selected; they cannot be duplicated.');
      return;
    }
    const suffix = Date.now();
    const duplicates = selected.map((node, index) => ({
      ...node,
      id: `${node.id}-copy-${suffix}-${index}`,
      title: `${node.title || node.id} COPY`,
      x: node.x + 32,
      y: node.y + 32,
      isLocked: false,
    }));
    commitWorkbenchState([...nodesRef.current, ...duplicates], linkStateRef.current);
    setSelectedNodeIds(duplicates.map((node) => node.id));
    setSelectedNodeId(duplicates[duplicates.length - 1].id);
    setSelectedWireId(null);
  };

  const arrangeSelection = (align: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y' | 'distribute-x' | 'distribute-y') => {
    const selected = nodesRef.current.filter((node) => selectedNodeIds.includes(node.id));
    if (selected.length < 2) return;
    const left = Math.min(...selected.map((node) => node.x));
    const right = Math.max(...selected.map((node) => node.x + node.width));
    const top = Math.min(...selected.map((node) => node.y));
    const bottom = Math.max(...selected.map((node) => node.y + node.height));
    const sorted = [...selected].sort((a, b) =>
      align === 'distribute-y' ? a.y - b.y : a.x - b.x);
    const updates = new Map<string, Partial<NodeGeometry>>();
    if (align === 'distribute-x' || align === 'distribute-y') {
      const horizontal = align === 'distribute-x';
      const start = horizontal ? left : top;
      const end = horizontal ? right : bottom;
      const occupied = sorted.reduce((total, node) => total + (horizontal ? node.width : node.height), 0);
      const gap = (end - start - occupied) / (sorted.length - 1);
      let cursor = start;
      sorted.forEach((node) => {
        updates.set(node.id, horizontal ? { x: Math.round(cursor) } : { y: Math.round(cursor) });
        cursor += (horizontal ? node.width : node.height) + gap;
      });
    } else {
      selected.forEach((node) => {
        const position = align === 'left' ? { x: left }
          : align === 'right' ? { x: right - node.width }
            : align === 'top' ? { y: top }
              : align === 'bottom' ? { y: bottom - node.height }
                : align === 'center-x' ? { x: (left + right - node.width) / 2 }
                  : { y: (top + bottom - node.height) / 2 };
        updates.set(node.id, {
          ...(position.x === undefined ? {} : { x: Math.round(position.x) }),
          ...(position.y === undefined ? {} : { y: Math.round(position.y) }),
        });
      });
    }
    commitWorkbenchState(nodesRef.current.map((node) =>
      updates.has(node.id) ? { ...node, ...updates.get(node.id) } : node), linkStateRef.current);
  };

  const beginGroupDrag = (nodeId: string) => {
    if (selectedNodeIds.length < 2 || !selectedNodeIds.includes(nodeId)) return false;
    groupDragSnapshotRef.current = nodesRef.current;
    return true;
  };

  const moveSelectedNodes = (_nodeId: string, dx: number, dy: number) => {
    const snapshot = groupDragSnapshotRef.current;
    if (!snapshot) return;
    const selectedIds = new Set(selectedNodeIds);
    const next = snapshot.map((node) => selectedIds.has(node.id)
      && !node.isLocked
      ? { ...node, x: Math.round(node.x + dx), y: Math.round(node.y + dy) }
      : node);
    nodesRef.current = next;
    setNodes(next);
  };

  const endGroupDrag = () => {
    const snapshot = groupDragSnapshotRef.current;
    if (!snapshot) return;
    groupDragSnapshotRef.current = null;
    const history = historyRef.current;
    history.past.push({ nodes: snapshot, links: linkStateRef.current });
    if (history.past.length > 50) history.past.shift();
    history.future = [];
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied to clipboard.');
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      setNotice('Unable to copy to clipboard. Check browser clipboard permissions.');
    }
  };

  const nodeContext = (node: NodeGeometry): AlfredNodeContext => ({
    id: node.id,
    label: node.title || node.id,
    type: getWireNodeType(node.id, node),
    department: getNodeDepartment(node.id),
    status: node.serviceId ? 'installed' : node.isLocked ? 'locked' : 'unlocked',
    connectedWireIds: activeLinks
      .filter((link) => link.fromNodeId === node.id || link.toNodeId === node.id)
      .map((link) => link.id),
  });

  const dispatchItems = (node: NodeGeometry): MenuItem[] => {
    const agents: AgentCallsign[] = ['Alfred', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy'];
    return [{
      id: 'dispatch',
      label: 'Dispatch agent…',
      submenu: agents.map((agent) => ({
        id: `dispatch-${agent.toLowerCase()}`,
        label: agent,
        onSelect: () => onDispatchAgent?.(agent, nodeContext(node)),
      })),
    }];
  };

  const nodeMenuItems = (node: NodeGeometry): MenuItem[] => {
    const targets = allRenderNodes.filter((target) =>
      target.id !== node.id
      && allowedKinds(getWireNodeType(node.id, node), getWireNodeType(target.id, target)).length > 0);
    const connectedLinks = activeLinks.filter((link) =>
      link.fromNodeId === node.id || link.toNodeId === node.id);
    const selection = nodesRef.current.filter((item) => selectedNodeIds.includes(item.id));
    const selectionHasComponents = selection.some((item) => isRemovableNode(item));
    const kindsForTarget = (target: NodeGeometry) =>
      allowedKinds(getWireNodeType(node.id, node), getWireNodeType(target.id, target));

    return [
      ...(node.kind === 'sun' && node.projectId && onOpenPlanet
        ? [{ id: 'sun-planet', label: `Open ${node.projectId} (Planet)`, onSelect: () => onOpenPlanet(node.projectId!) }]
        : []),
      {
        id: 'edit',
        label: 'Edit',
        submenu: [
          {
            id: 'duplicate',
            label: 'Duplicate',
            shortcut: 'Ctrl+D',
            disabled: Boolean(node.serviceId),
            disabledReason: 'Installed service components cannot be duplicated.',
            onSelect: () => duplicateNode(node),
          },
          { id: 'copy-id', label: 'Copy node ID', onSelect: () => { void copyText(node.id); } },
          ...(selectedNodeIds.length > 1 ? [{
            id: 'selection',
            label: `Selection (${selectedNodeIds.length})`,
            submenu: [
              {
                id: 'align',
                label: 'Align',
                submenu: [
                  { id: 'align-left', label: 'Left', onSelect: () => arrangeSelection('left') },
                  { id: 'align-right', label: 'Right', onSelect: () => arrangeSelection('right') },
                  { id: 'align-top', label: 'Top', onSelect: () => arrangeSelection('top') },
                  { id: 'align-bottom', label: 'Bottom', onSelect: () => arrangeSelection('bottom') },
                  { id: 'align-center-x', label: 'Center horizontally', onSelect: () => arrangeSelection('center-x') },
                  { id: 'align-center-y', label: 'Center vertically', onSelect: () => arrangeSelection('center-y') },
                ],
              },
              {
                id: 'distribute',
                label: 'Distribute',
                submenu: [
                  { id: 'distribute-x', label: 'Horizontally', onSelect: () => arrangeSelection('distribute-x') },
                  { id: 'distribute-y', label: 'Vertically', onSelect: () => arrangeSelection('distribute-y') },
                ],
              },
              {
                id: 'lock-selection',
                label: 'Lock selection',
                onSelect: () => commitWorkbenchState(
                  nodesRef.current.map((item) => selectedNodeIds.includes(item.id) ? { ...item, isLocked: true } : item),
                  linkStateRef.current,
                ),
              },
              {
                id: 'unlock-selection',
                label: 'Unlock selection',
                onSelect: () => commitWorkbenchState(
                  nodesRef.current.map((item) => selectedNodeIds.includes(item.id) ? { ...item, isLocked: false } : item),
                  linkStateRef.current,
                ),
              },
              {
                id: 'duplicate-selection',
                label: 'Duplicate selection',
                disabled: selectionHasComponents,
                disabledReason: 'Installed service components cannot be duplicated.',
                onSelect: duplicateSelectedNodes,
              },
              {
                id: 'delete-selection',
                label: 'Delete selected components',
                danger: true,
                disabled: !selectionHasComponents,
                disabledReason: 'Built-in department nodes cannot be deleted.',
                onSelect: deleteSelectedNodes,
              },
            ],
          }] : []),
        ],
      },
      {
        id: 'arrange',
        label: 'Arrange',
        submenu: [
          {
            id: 'front',
            label: 'Bring to front',
            onSelect: () => commitWorkbenchState(
              [...nodesRef.current.filter((item) => item.id !== node.id), node],
              linkStateRef.current,
            ),
          },
          {
            id: 'back',
            label: 'Send to back',
            onSelect: () => commitWorkbenchState(
              [node, ...nodesRef.current.filter((item) => item.id !== node.id)],
              linkStateRef.current,
            ),
          },
          {
            id: 'reset-size',
            label: 'Reset size',
            onSelect: () => handleUpdateNode(node.id, {
              width: node.serviceId ? 200 : 220,
              height: node.serviceId ? 100 : node.id === 'node-daisy' ? 120 : 130,
            }),
          },
        ],
      },
      {
        id: 'focus',
        label: 'Focus on this node',
        shortcut: 'F',
        onSelect: () => {
          setSelectedNodeId(node.id);
          onTriggerAction?.('FOCUS_NODE', { x: node.x + node.width / 2, y: node.y + node.height / 2 });
        },
      },
      {
        id: 'connect',
        label: 'Connect to…',
        submenu: targets.map((target) => ({
          id: `connect-${target.id}`,
          label: target.title || target.id,
          submenu: kindsForTarget(target).map((kind) => ({
            id: `connect-${target.id}-${kind}`,
            label: kind,
            onSelect: () => connectPorts(
              { nodeId: node.id, pin: 'right' },
              { nodeId: target.id, pin: 'left' },
              undefined,
              kind,
            ),
          })),
        })),
      },
      {
        id: 'disconnect',
        label: 'Disconnect',
        disabled: connectedLinks.length === 0,
        disabledReason: 'This node has no connected wires.',
        submenu: connectedLinks.map((link) => ({
          id: `disconnect-${link.id}`,
          label: link.label || `${link.fromNodeId} → ${link.toNodeId}`,
          danger: true,
          onSelect: () => removeWire(link.id),
        })),
      },
      ...dispatchItems(node),
      // Owner 2026-11-05: with several nodes selected, delete them from the top level (departments are skipped).
      ...(selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id) ? (() => {
        const removable = nodesRef.current.filter((item) => selectedNodeIds.includes(item.id) && isRemovableNode(item));
        return [{
          id: 'delete-selected-top',
          label: `Delete ${removable.length} selected (departments kept)`,
          danger: true,
          disabled: removable.length === 0,
          disabledReason: 'The selection has only built-in department nodes, which cannot be deleted.',
          onSelect: deleteSelectedNodes,
        }];
      })() : []),
      ...(!node.serviceId && node.id.includes('-copy-')
        ? [{ id: 'delete', label: 'Delete copy', danger: true, onSelect: () => removeNodesFromCanvas([node.id]) }]
        : !node.serviceId
          ? [{
              id: 'delete',
              label: 'Delete',
              danger: true,
              disabled: true,
              disabledReason: node.kind === 'sun'
                ? 'A project sun follows its project; Sunset the project to put its sun out.'
                : 'Built-in department nodes cannot be deleted.',
            }]
          : []),
    ];
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || target.closest('[data-alfred-input]')
        || target.closest('[role="menu"]')
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoWorkbenchChange();
        else undoWorkbenchChange();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoWorkbenchChange();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const ids = nodesRef.current.map((node) => node.id);
        setSelectedNodeIds(ids);
        setSelectedNodeId(ids[ids.length - 1] || null);
        setSelectedWireId(null);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeIds.length > 0) {
        event.preventDefault();
        deleteSelectedNodes();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedWireId) {
        event.preventDefault();
        removeWire(selectedWireId);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedNodeIds.length > 1) {
        event.preventDefault();
        duplicateSelectedNodes();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedNodeId) {
        event.preventDefault();
        const node = nodesRef.current.find((item) => item.id === selectedNodeId);
        if (node) duplicateNode(node);
      } else if (event.key.toLowerCase() === 'f') {
        const node = allRenderNodes.find((item) => item.id === selectedNodeId);
        if (node) {
          event.preventDefault();
          onTriggerAction?.('FOCUS_NODE', { x: node.x + node.width / 2, y: node.y + node.height / 2 });
        }
      } else if (event.key.toLowerCase() === 'l') {
        const node = nodesRef.current.find((item) => item.id === selectedNodeId);
        if (node) {
          event.preventDefault();
          handleUpdateNode(node.id, { isLocked: !node.isLocked });
        } else if (selectedNodeId === 'core-node') {
          event.preventDefault();
          setSunLocked((locked) => !locked);
        }
      } else if (event.key === 'Escape') {
        portDragCleanupRef.current?.();
        portDragRef.current = null;
        setPortDrag(null);
        setWireKindPicker(null);
        setSelectedPort(null);
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
        setSelectedWireId(null);
        setWireMenu(null);
        setCanvasMenu(null);
        setSunMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // ── STEP 2: Sun Position State (per ClientID) ───────────────────
  const [sunPos, setSunPos] = useState<{ x: number; y: number }>(() => {
    try {
      const stored = localStorage.getItem(`szs_sun_pos_${client.ClientID}`);
      return stored ? JSON.parse(stored) : { x: 0, y: 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  });

  // Persist Sun position locally per client
  useEffect(() => {
    try {
      localStorage.setItem(`szs_sun_pos_${client.ClientID}`, JSON.stringify(sunPos));
    } catch {}
  }, [sunPos, client.ClientID]);

  const [isDropActive, setIsDropActive] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<PendingDropState | null>(null);
  /** Owner 2026-11-06: removing a service is a real, audited Master Control change (not just the canvas). */
  const [pendingRemoval, setPendingRemoval] = useState<{ serviceId: string; projectId: string } | null>(null);

  // Dynamic Core node geometry reading live sunPos
  const coreNodeGeometry: NodeGeometry = {
    id: 'core-node',
    title: 'CORE DELIVERABLE',
    x: sunPos.x - 210,
    y: sunPos.y - 140,
    width: 420,
    height: 280,
    isLocked: interactionMode === 'lock' || sunLocked,
  };

  const handleUpdateNode = (id: string, updates: Partial<NodeGeometry>) => {
    updateNodes((current) => current.map((node) => (node.id === id ? { ...node, ...updates } : node)));
  };

  // ── SUN DRAG HANDLER (Reuses satellite drag pattern with zoom compensation) ──
  const handleSunPointerDown = (e: React.PointerEvent) => {
    if (interactionMode === 'lock' || sunLocked || e.button !== 0) return;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = sunPos.x;
    const initY = sunPos.y;

    const onPointerMove = (ev: PointerEvent) => {
      const zoom = cameraZoom > 0 ? cameraZoom : 1.0;
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      setSunPos({
        x: Math.round(initX + dx),
        y: Math.round(initY + dy),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Phase F (plan v3.1): double-clicking the project Sun opens its Planet page. "Recenter Sun" stays in the Sun menu.
  const handleSunDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeProject && onOpenPlanet) {
      onOpenPlanet(activeProject.ProjectID);
      return;
    }
    if (sunLocked) return;
    setSunPos({ x: 0, y: 0 });
  };

  /**
   * MODULE 2: WORKBENCH ORBIT SNAP & DROP TARGET ENGINE
   * Snaps relative to the live Sun position
   */
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropActive(false);

    let raw = e.dataTransfer.getData('application/json');
    let serviceId = e.dataTransfer.getData('serviceId');
    let name = e.dataTransfer.getData('serviceName');
    let price = 0;
    let tasksToInject: string[] = [];
    let targetClientId = client.ClientID;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        serviceId = parsed.serviceId || serviceId;
        name = parsed.name || name;
        price = parsed.price || 0;
        tasksToInject = parsed.tasksToInject || [];
        targetClientId = parsed.targetClientId || targetClientId;
      } catch (err) {
        console.warn('Failed to parse drag payload JSON', err);
      }
    }

    if (!serviceId) return;

    const registryService = CATALOG.find((s) => s.serviceId === serviceId);
    if (registryService) {
      name = name || registryService.name;
      price = price || registryService.price;
      tasksToInject = tasksToInject.length > 0 ? tasksToInject : registryService.tasksToInject;
    }

    if (client.activeComponents?.includes(serviceId)) {
      console.warn(`Module ${serviceId} is already mounted to ${targetClientId}`);
      return;
    }

    // Calculate radial placement relative to central Sun's live position
    const rect = e.currentTarget.getBoundingClientRect();
    const zoom = cameraZoom > 0 ? cameraZoom : 1.0;
    const canvasCenterX = rect.width / 2 + cameraPan.x;
    const canvasCenterY = rect.height / 2 + cameraPan.y;

    // Multi-sun: the service orbits (and attaches to the project of) the sun nearest to the drop point.
    // Screen -> canvas coordinates measured against the core sun's real on-screen box, so it is exact at any
    // zoom/pan (the old centre/zoom estimate drifted when zoomed out and picked the wrong sun; owner 2026-11-05).
    const coreElement = workbenchRef.current?.querySelector<HTMLElement>('[data-node-id="core-node"]');
    const coreRect = coreElement?.getBoundingClientRect();
    const scale = coreRect && coreRect.width > 0 ? coreRect.width / coreNodeGeometry.width : zoom;
    const world = coreRect
      ? { x: coreNodeGeometry.x + (e.clientX - coreRect.left) / scale, y: coreNodeGeometry.y + (e.clientY - coreRect.top) / scale }
      : { x: (e.clientX - canvasCenterX) / zoom, y: (e.clientY - canvasCenterY) / zoom };
    const suns = [
      { id: 'core-node', projectId: activeProject?.ProjectID, cx: sunPos.x, cy: sunPos.y },
      ...nodesRef.current.filter((node) => node.kind === 'sun')
        .map((node) => ({ id: node.id, projectId: node.projectId, cx: node.x + node.width / 2, cy: node.y + node.height / 2 })),
    ];
    const target = nearestSun(world, suns) ?? suns[0];
    const screenX = world.x - target.cx;
    const screenY = world.y - target.cy;
    const angle = Math.atan2(screenY, screenX);
    const distance = Math.max(220, Math.min(480, Math.sqrt(screenX * screenX + screenY * screenY)));

    const snapX = Math.round(target.cx + Math.cos(angle) * distance - 100);
    const snapY = Math.round(target.cy + Math.sin(angle) * distance - 50);

    setPendingDrop({
      serviceId,
      name: name || serviceId,
      price,
      tasksToInject,
      targetClientId,
      snapX,
      snapY,
      projectId: target.projectId,
      sunId: target.id,
    });
  };

  const addNodeWithDefaultLink = (entry: CatalogEntry, position: { x: number; y: number }, sunId = 'core-node', projectId?: string) => {
    const nodeId = `node-${entry.serviceId}`;
    const node: NodeGeometry = {
      id: nodeId,
      serviceId: entry.serviceId,
      projectId,
      title: entry.label,
      x: position.x,
      y: position.y,
      width: 200,
      height: 100,
      isLocked: false,
    };
    const currentLinks = linkStateRef.current;
    let nextLinks = currentLinks;
    if (entry.defaultLinkTo === 'sun' && currentLinks) {
      const defaultKey = `component-${entry.serviceId}`;
      if (!currentLinks.links.some((link) => link.defaultKey === defaultKey)) {
        const link = createUserLink({
          clientId: client.ClientID,
          fromNodeId: sunId,
          fromPin: 'right',
          toNodeId: nodeId,
          toPin: 'left',
          kind: 'context',
          mode: 'push',
          label: `${entry.label} connection`,
          enabled: true,
        });
        nextLinks = {
          ...currentLinks,
          links: [...currentLinks.links, { ...link, origin: 'default', defaultKey }],
          suppressedDefaults: currentLinks.suppressedDefaults.filter((key) => key !== defaultKey),
        };
      }
    } else if (entry.defaultLinkTo === 'sun') {
      setNotice('The component was added, but its wire could not be created because saved wire data is unavailable.');
    }
    commitWorkbenchState([...nodesRef.current, node], nextLinks);
    return nodeId;
  };

  const removeWire = (linkId: string) => {
    updateLinkState((current) => {
      const link = current.links.find((candidate) => candidate.id === linkId);
      if (!link) return current;
      return {
        ...current,
        links: current.links.filter((candidate) => candidate.id !== linkId),
        suppressedDefaults: link.defaultKey && !current.suppressedDefaults.includes(link.defaultKey)
          ? [...current.suppressedDefaults, link.defaultKey]
          : current.suppressedDefaults,
      };
    });
    setSelectedWireId(null);
    setWireMenu(null);
  };

  const reverseWire = (linkId: string) => {
    updateLinkState((current) => {
      const link = current.links.find((candidate) => candidate.id === linkId);
      if (!link) return current;
      const fromNode = nodesRef.current.find((node) => node.id === link.toNodeId);
      const toNode = nodesRef.current.find((node) => node.id === link.fromNodeId);
      const kinds = allowedKinds(
        getWireNodeType(link.toNodeId, fromNode),
        getWireNodeType(link.fromNodeId, toNode),
      );
      if (!kinds.includes(link.kind)) {
        setNotice('This wire cannot be reversed with its current kind.');
        return current;
      }
      if (current.links.some((candidate) =>
        candidate.id !== linkId
        && candidate.fromNodeId === link.toNodeId
        && candidate.toNodeId === link.fromNodeId
      )) {
        setNotice('A wire already connects these nodes in that direction.');
        return current;
      }
      return {
        ...current,
        links: current.links.map((candidate) => candidate.id === linkId
          ? { ...candidate, fromNodeId: candidate.toNodeId, fromPin: candidate.toPin, toNodeId: candidate.fromNodeId, toPin: candidate.fromPin }
          : candidate),
      };
    });
    setWireMenu(null);
  };

  const updateWire = (linkId: string, updates: Partial<WireEditableFields>) => {
    updateLinkState((current) => {
      const link = current.links.find((candidate) => candidate.id === linkId);
      if (!link) return current;
      if (updates.kind) {
        const fromNode = nodesRef.current.find((node) => node.id === link.fromNodeId);
        const toNode = nodesRef.current.find((node) => node.id === link.toNodeId);
        const kinds = allowedKinds(
          getWireNodeType(link.fromNodeId, fromNode),
          getWireNodeType(link.toNodeId, toNode),
        );
        if (!kinds.includes(updates.kind)) {
          setNotice('That wire kind is not allowed for these node types.');
          return current;
        }
      }
      return {
        ...current,
        links: current.links.map((candidate) => candidate.id === linkId ? { ...candidate, ...updates } : candidate),
      };
    });
    setWireMenu(null);
  };

  const createWireFromPanel = (input: WireCreateInput): boolean => {
    const current = linkStateRef.current;
    if (!current || current.clientId !== client.ClientID) {
      setNotice('Wire data is unavailable; reload the Solar Workbench before changing wires.');
      return false;
    }
    if (input.fromNodeId === input.toNodeId) {
      setNotice('A wire cannot connect a node to itself.');
      return false;
    }
    if (current.links.some((link) =>
      link.fromNodeId === input.fromNodeId
      && link.toNodeId === input.toNodeId
      && link.kind === input.kind)) {
      setNotice('A wire already connects these nodes in that direction.');
      return false;
    }
    const fromNode = nodesRef.current.find((node) => node.id === input.fromNodeId);
    const toNode = nodesRef.current.find((node) => node.id === input.toNodeId);
    const kinds = allowedKinds(
      getWireNodeType(input.fromNodeId, fromNode),
      getWireNodeType(input.toNodeId, toNode),
    );
    if (!kinds.includes(input.kind)) {
      setNotice('That wire kind is not allowed for these node types.');
      return false;
    }

    const link = createUserLink({
      clientId: client.ClientID,
      ...input,
      label: input.label.trim() || undefined,
      enabled: true,
    });
    commitLinkState({ ...current, links: [...current.links, link] });
    setSelectedWireId(link.id);
    setWireMenu(null);
    setWireKindPicker(null);
    setNotice('Wire created.');
    return true;
  };

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = workbenchRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const zoom = cameraZoom > 0 ? cameraZoom : 1;
    return {
      x: (clientX - rect.left - cameraPan.x) / zoom - rect.width / 2,
      y: (clientY - rect.top - cameraPan.y) / zoom - rect.height / 2,
    };
  };

  const nodePinPoint = (node: NodeGeometry, pin: Link['fromPin']) => {
    switch (pin) {
      case 'top': return { x: node.x + node.width / 2, y: node.y };
      case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
      case 'left': return { x: node.x, y: node.y + node.height / 2 };
      case 'right': return { x: node.x + node.width, y: node.y + node.height / 2 };
    }
  };

  const findWireDropTarget = (world: { x: number; y: number }) => {
    const renderNodes = [coreNodeGeometry, ...nodesRef.current];
    const pins: Link['fromPin'][] = ['top', 'right', 'bottom', 'left'];
    const zoom = cameraZoom > 0 ? cameraZoom : 1;
    let nearestPort: { node: NodeGeometry; pin: Link['fromPin']; distance: number } | null = null;

    for (const node of renderNodes) {
      for (const pin of pins) {
        const point = nodePinPoint(node, pin);
        const distance = Math.hypot(world.x - point.x, world.y - point.y);
        if (!nearestPort || distance < nearestPort.distance) nearestPort = { node, pin, distance };
      }
    }
    if (nearestPort && nearestPort.distance <= 14 / zoom) {
      return { node: nearestPort.node, pin: nearestPort.pin };
    }

    const targetNode = renderNodes.find((node) =>
      world.x >= node.x
      && world.x <= node.x + node.width
      && world.y >= node.y
      && world.y <= node.y + node.height);
    if (!targetNode) return null;

    const usedPins = new Set<Link['fromPin']>();
    for (const link of linkStateRef.current?.links || []) {
      if (link.fromNodeId === targetNode.id) usedPins.add(link.fromPin);
      if (link.toNodeId === targetNode.id) usedPins.add(link.toPin);
    }
    const freePins = pins.filter((pin) => !usedPins.has(pin));
    if (freePins.length === 0) return null;
    const pin = freePins.reduce((nearest, candidate) =>
      Math.hypot(world.x - nodePinPoint(targetNode, candidate).x, world.y - nodePinPoint(targetNode, candidate).y)
      < Math.hypot(world.x - nodePinPoint(targetNode, nearest).x, world.y - nodePinPoint(targetNode, nearest).y)
        ? candidate
        : nearest);
    return { node: targetNode, pin };
  };

  const connectPorts = (
    from: { nodeId: string; pin: Link['fromPin'] },
    to: { nodeId: string; pin: Link['fromPin'] },
    pickerPosition?: { x: number; y: number },
    preferredKind?: LinkKind,
  ) => {
    if (from.nodeId === to.nodeId) {
      setNotice('A wire cannot connect a node to itself.');
      return;
    }
    const current = linkStateRef.current;
    if (!current || current.clientId !== client.ClientID) {
      setNotice('Wire data is unavailable; reload the Solar Workbench before changing wires.');
      return;
    }
    const renderNodes = [coreNodeGeometry, ...nodesRef.current];
    const fromNode = renderNodes.find((node) => node.id === from.nodeId);
    const toNode = renderNodes.find((node) => node.id === to.nodeId);
    const kinds = allowedKinds(
      getWireNodeType(from.nodeId, fromNode),
      getWireNodeType(to.nodeId, toNode),
    );
    if (kinds.length === 0) {
      setNotice('These node types cannot be connected.');
      return;
    }

    const input: WireCreateInput = {
      fromNodeId: from.nodeId,
      fromPin: from.pin,
      toNodeId: to.nodeId,
      toPin: to.pin,
      kind: preferredKind ?? (kinds.includes('context') ? 'context' : kinds[0]),
      mode: 'push',
      label: '',
    };
    if (pickerPosition && kinds.length > 1) {
      setWireKindPicker({ ...pickerPosition, input, kinds });
      setNotice('Choose a wire kind to finish connecting these nodes.');
      return;
    }
    createWireFromPanel(input);
  };

  const handlePortPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    nodeId: string,
    pin: Link['fromPin'],
  ) => {
    if (event.button !== 0 || portDragRef.current) return;
    const startWorld = screenToWorld(event.clientX, event.clientY);
    if (!startWorld) return;
    event.preventDefault();
    setSelectedPort(null);
    setWireKindPicker(null);
    setWireMenu(null);
    setCanvasMenu(null);
    const initial: PortDragState = {
      fromNodeId: nodeId,
      fromPin: pin,
      cursorWorld: startWorld,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };
    portDragRef.current = initial;
    setPortDrag(initial);

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (portDragCleanupRef.current === cleanup) portDragCleanupRef.current = null;
    };
    const onPointerMove = (pointerEvent: PointerEvent) => {
      const current = portDragRef.current;
      const cursorWorld = screenToWorld(pointerEvent.clientX, pointerEvent.clientY);
      if (!current || !cursorWorld) return;
      const moved = current.moved
        || Math.hypot(pointerEvent.clientX - current.startClientX, pointerEvent.clientY - current.startClientY) >= 4;
      const next = { ...current, cursorWorld, moved };
      portDragRef.current = next;
      setPortDrag(next);
    };
    const onPointerUp = (pointerEvent: PointerEvent) => {
      const current = portDragRef.current;
      const world = screenToWorld(pointerEvent.clientX, pointerEvent.clientY);
      cleanup();
      portDragRef.current = null;
      setPortDrag(null);
      if (!current?.moved) return;

      suppressPortClickRef.current = true;
      window.setTimeout(() => { suppressPortClickRef.current = false; }, 0);
      if (!world) {
        setNotice('Wire creation was cancelled because the canvas position is unavailable.');
        return;
      }
      const target = findWireDropTarget(world);
      if (!target) {
        const isOverNode = [coreNodeGeometry, ...nodesRef.current].some((node) =>
          world.x >= node.x
          && world.x <= node.x + node.width
          && world.y >= node.y
          && world.y <= node.y + node.height);
        if (!isOverNode) {
          setCanvasMenu({
            x: pointerEvent.clientX,
            y: pointerEvent.clientY,
            connectFrom: { nodeId: current.fromNodeId, pin: current.fromPin },
          });
          return;
        }
        setNotice('Drop the wire on a connection port or node.');
        return;
      }
      connectPorts(
        { nodeId: current.fromNodeId, pin: current.fromPin },
        { nodeId: target.node.id, pin: target.pin },
        { x: pointerEvent.clientX, y: pointerEvent.clientY },
      );
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    portDragCleanupRef.current = cleanup;
  };

  const handlePortClick = (nodeId: string, pin: Link['fromPin']) => {
    if (suppressPortClickRef.current) return;
    if (!selectedPort) {
      setSelectedPort({ nodeId, pin });
      setNotice('Select a target connection port to complete the wire.');
      return;
    }
    const from = selectedPort;
    setSelectedPort(null);
    if (from.nodeId === nodeId) {
      setNotice('A wire cannot connect a node to itself.');
      return;
    }
    connectPorts(from, { nodeId, pin });
  };

  const handleConfirmDrop = async () => {
    if (!pendingDrop || serviceSubmitInFlightRef.current) return;
    const { serviceId, price, tasksToInject, targetClientId, snapX, snapY } = pendingDrop;
    const entry = CATALOG.find((candidate) => candidate.serviceId === serviceId);
    if (!entry) {
      setNotice('That service is no longer available in the catalog.');
      setPendingDrop(null);
      return;
    }

    serviceSubmitInFlightRef.current = true;
    setIsServiceSubmitting(true);
    setServiceSyncError(null);
    try {
      const result = await syncServiceToMasterControl(
        targetClientId,
        serviceId,
        price,
        tasksToInject,
        accessToken,
        pendingDrop.projectId || activeProject?.ProjectID,
      );
      const updatedComponents = result.status === 'persisted'
        ? result.activeComponents
        : [...(client.activeComponents || []), serviceId];
      const updatedContractValue = result.status === 'persisted'
        ? result.updatedValue
        : Number(client.ContractValue || 0) + Number(price);

      onUpdateClient?.({
        ...client,
        activeComponents: updatedComponents,
        ContractValue: updatedContractValue,
      });

      addNodeWithDefaultLink(entry, { x: snapX, y: snapY }, pendingDrop.sunId || 'core-node', pendingDrop.projectId || activeProject?.ProjectID);
      if (pendingDrop.connectFrom) {
        const target = findWireDropTarget({ x: snapX + 100, y: snapY + 50 });
        if (target) {
          connectPorts(
            pendingDrop.connectFrom,
            { nodeId: target.node.id, pin: target.pin },
            pendingDrop.connectAt,
          );
        } else {
          setNotice('The node was added, but no free connection port was available.');
        }
      }

      setPendingDrop(null);
      if (result.status === 'offline') {
        setNotice('Demo only: this service was added locally and was not saved to Master Control.');
      } else if (result.alreadyAttached) {
        setNotice('This service was already saved in Master Control; no duplicate charge or tasks were added.');
      } else if (result.tasksFailed > 0) {
        setNotice(`Service saved, but ${result.tasksFailed} Google Task(s) were not created. Check the test Tasks list.`);
      } else {
        setNotice(`Service saved to Master Control; ${result.tasksCreated} Google Task(s) created.`);
      }
    } catch (syncError) {
      setServiceSyncError(
        syncError instanceof Error
          ? syncError.message
          : 'Master Control did not confirm the service attachment.',
      );
    } finally {
      serviceSubmitInFlightRef.current = false;
      setIsServiceSubmitting(false);
    }
  };

  /** Removable: installed components and copies made with Duplicate (G4: copies could not be deleted before). */
  const isRemovableNode = (node: NodeGeometry) => node.kind !== 'sun' && (Boolean(node.serviceId) || node.id.includes('-copy-'));

  const removeComponentsFromCanvas = (componentIds: string[]) => {
    const componentIdSet = new Set(componentIds);
    removeNodesFromCanvas(nodesRef.current.filter((node) => node.serviceId && componentIdSet.has(node.serviceId)).map((node) => node.id));
  };

  /** Removes nodes and every wire attached to them, as one undoable change. */
  const removeNodesFromCanvas = (nodeIds: string[]) => {
    const idSet = new Set(nodeIds);
    const removedNodes = nodesRef.current.filter((node) => idSet.has(node.id) && isRemovableNode(node));
    if (removedNodes.length === 0) return;
    const removedNodeIds = new Set(removedNodes.map((node) => node.id));
    const nextNodes = nodesRef.current.filter((node) => !removedNodeIds.has(node.id));
    const currentLinks = linkStateRef.current;
    setSelectedNodeIds((current) => current.filter((id) => !removedNodeIds.has(id)));
    setSelectedNodeId((current) => current && removedNodeIds.has(current) ? null : current);
    if (!currentLinks) {
      commitWorkbenchState(nextNodes, null);
      setNotice('Removed from canvas. Saved wire data could not be updated; reload the Solar Workbench before changing wires.');
      return;
    }
    const removedLinks = currentLinks.links.filter((link) =>
      removedNodeIds.has(link.fromNodeId) || removedNodeIds.has(link.toNodeId));
    const removedDefaults = removedLinks
      .map((link) => link.defaultKey)
      .filter((key): key is string => Boolean(key));
    const nextLinks: LinkState = {
      ...currentLinks,
      links: currentLinks.links.filter((link) => !removedLinks.includes(link)),
      suppressedDefaults: [...new Set([...currentLinks.suppressedDefaults, ...removedDefaults])],
    };
    commitWorkbenchState(nextNodes, nextLinks);
    setNotice('Removed from canvas. Ledger and Google Tasks were not changed.');
  };

  const handleRemoveComponentFromCanvas = (componentId: string) => {
    const node = nodesRef.current.find((item) => item.serviceId === componentId);
    // Owner 2026-11-06: the canvas shows every project's services; remove from the project that actually has it
    // (PAC's Apps Script build is on PAC-02, not the primary PAC-01).
    const owners = client.activeProjects.filter((project) => project.ActiveComponents?.includes(componentId)).map((project) => project.ProjectID);
    const projectId = (node?.projectId && owners.includes(node.projectId) ? node.projectId : owners[0])
      || node?.projectId || activeProject?.ProjectID;
    if (accessToken && projectId && client.activeComponents?.includes(componentId)) {
      setPendingRemoval({ serviceId: componentId, projectId });
      return;
    }
    removeComponentsFromCanvas([componentId]);
  };

  const deleteSelectedNodes = () => {
    const selected = nodesRef.current.filter((node) => selectedNodeIds.includes(node.id));
    const removable = selected.filter(isRemovableNode);
    if (removable.length === 0) {
      setNotice('Built-in department nodes cannot be deleted.');
      return;
    }
    if (removable.length > 1 && !window.confirm(`Remove ${removable.length} nodes from this canvas? Ledger and Google Tasks will not be changed.`)) {
      return;
    }
    removeNodesFromCanvas(removable.map((node) => node.id));
  };

  const allRenderNodes = [coreNodeGeometry, ...nodes];
  const activeLinks = linkState?.clientId === client.ClientID ? linkState.links : [];

  const getNodeDepartment = (nodeId: string): Department => {
    if (nodeId === 'core-node') return 'core';
    const node = allRenderNodes.find((candidate) => candidate.id === nodeId);
    if (node?.serviceId) return CATALOG.find((entry) => entry.serviceId === node.serviceId)?.department || 'core';
    const fixedDepartments: Record<string, Department> = {
      'node-pamela': 'pamela',
      'node-oracle': 'oracle',
      'node-dolores': 'dolores',
      'node-vala': 'vala',
      'node-daisy': 'daisy',
    };
    return fixedDepartments[nodeId] || 'core';
  };
  const visibleLinks = activeLinks.filter((link) =>
    visibleWireDepartments[getNodeDepartment(link.fromNodeId)] && visibleWireKinds[link.kind]);
  const selectedNodeSet = new Set([
    ...selectedNodeIds,
    ...(selectedNodeId ? [selectedNodeId] : []),
  ]);
  const hasSelectedNodes = selectedNodeSet.size > 0;

  const pinPoint = nodePinPoint;
  const draggedFromNode = portDrag
    ? allRenderNodes.find((node) => node.id === portDrag.fromNodeId)
    : undefined;
  const dragPreviewPath = portDrag?.moved && draggedFromNode
    ? (() => {
      const start = pinPoint(draggedFromNode, portDrag.fromPin);
      const end = portDrag.cursorWorld;
      const x1 = 2000 + start.x;
      const y1 = 2000 + start.y;
      const x2 = 2000 + end.x;
      const y2 = 2000 + end.y;
      const bend = Math.max(50, Math.abs(x2 - x1) * 0.5);
      return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    })()
    : null;
  const portTargetPreview: ConnectionTargetPreview | null = (() => {
    if (!portDrag?.moved) return null;
    const target = findWireDropTarget(portDrag.cursorWorld);
    if (!target) return null;
    if (target.node.id === portDrag.fromNodeId) {
      return { nodeId: target.node.id, pin: target.pin, valid: false, reason: 'A wire cannot connect a node to itself.' };
    }
    if (activeLinks.some((link) =>
      link.fromNodeId === portDrag.fromNodeId && link.toNodeId === target.node.id)) {
      return {
        nodeId: target.node.id,
        pin: target.pin,
        valid: false,
        reason: 'A wire already connects these nodes in that direction.',
      };
    }
    const sourceNode = allRenderNodes.find((node) => node.id === portDrag.fromNodeId);
    if (!allowedKinds(
      getWireNodeType(portDrag.fromNodeId, sourceNode),
      getWireNodeType(target.node.id, target.node),
    ).length) {
      return { nodeId: target.node.id, pin: target.pin, valid: false, reason: 'These node types cannot be connected.' };
    }
    return { nodeId: target.node.id, pin: target.pin, valid: true };
  })();
  const animatedWireIds = new Set(activeWireIds.slice(0, MAX_ANIMATED));

  const handleCanvasContextMenu = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('[data-node-id], [data-wire-id], button, input')) return;
    event.preventDefault();
    setWireMenu(null);
    setWireKindPicker(null);
    setCanvasMenu({ x: event.clientX, y: event.clientY });
  };

  const downloadWireExport = () => {
    const current = linkStateRef.current;
    if (!current) {
      setNotice('Wire data is unavailable for export.');
      return;
    }
    const blob = new Blob([JSON.stringify(exportLinkState(current), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `szs-wires-${client.ClientID}.json`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCanvasMenu(null);
  };

  const handleWireImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const current = linkStateRef.current;
      if (!current) throw new Error('Wire data is unavailable for import.');
      const validNodeIds = new Set(allRenderNodes.map((node) => node.id));
      const imported = parseLinkExport(await file.text(), client.ClientID, validNodeIds);
      commitLinkState(imported);
      setCanvasMenu(null);
      setNotice('Wire data imported.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to import wire data.');
    }
  };

  const requestCatalogAdd = (
    entry: CatalogEntry,
    connectFrom?: { nodeId: string; pin: Link['fromPin'] },
  ) => {
    if (client.activeComponents?.includes(entry.serviceId) || nodes.some((node) => node.serviceId === entry.serviceId)) {
      setNotice(`${entry.label} is already installed on this canvas.`);
      return;
    }
    const rect = workbenchRef.current?.getBoundingClientRect();
    if (!rect) {
      setNotice('Unable to place the catalog node because the workbench is not available.');
      return;
    }
    const screenX = canvasMenu?.x ?? rect.left + rect.width / 2;
    const screenY = canvasMenu?.y ?? rect.top + rect.height / 2;
    const world = screenToWorld(screenX, screenY);
    if (!world) {
      setNotice('Unable to place the catalog node because the canvas position is unavailable.');
      return;
    }
    setPendingDrop({
      serviceId: entry.serviceId,
      name: entry.label,
      price: Number(entry.price || 0),
      tasksToInject: entry.tasksToInject || [],
      targetClientId: client.ClientID,
      snapX: Math.round(world.x - 100),
      snapY: Math.round(world.y - 50),
      connectFrom,
      connectAt: connectFrom ? { x: screenX, y: screenY } : undefined,
    });
    setCanvasMenu(null);
  };

  const wireMenuItems = (linkId: string): MenuItem[] => {
    const link = activeLinks.find((candidate) => candidate.id === linkId);
    if (!link) return [];
    const fromNode = nodesRef.current.find((node) => node.id === link.fromNodeId);
    const toNode = nodesRef.current.find((node) => node.id === link.toNodeId);
    const kinds = allowedKinds(
      getWireNodeType(link.fromNodeId, fromNode),
      getWireNodeType(link.toNodeId, toNode),
    );
    return [
      { id: 'delete', label: 'Delete wire', danger: true, shortcut: 'Del', onSelect: () => removeWire(linkId) },
      {
        id: 'edit',
        label: 'Edit',
        submenu: [
          {
            id: 'label',
            label: 'Edit label',
            onSelect: () => {
              const label = window.prompt('Wire label', link.label || '');
              if (label !== null) updateWire(linkId, { label });
            },
          },
          {
            id: 'kind',
            label: 'Change kind',
            submenu: kinds.map((kind) => ({
              id: `kind-${kind}`,
              label: kind,
              onSelect: () => updateWire(linkId, { kind }),
            })),
          },
          {
            id: 'mode',
            label: 'Change flow',
            submenu: (['push', 'pull', 'sync'] as const).map((mode) => ({
              id: `mode-${mode}`,
              label: mode,
              onSelect: () => updateWire(linkId, { mode }),
            })),
          },
        ],
      },
      { id: 'reverse', label: 'Reverse direction', onSelect: () => reverseWire(linkId) },
      { id: 'toggle', label: link.enabled ? 'Disable wire' : 'Enable wire', onSelect: () => updateWire(linkId, { enabled: !link.enabled }) },
    ];
  };

  const connectFrom = canvasMenu?.connectFrom;
  const connectFromNode = connectFrom
    ? allRenderNodes.find((node) => node.id === connectFrom.nodeId)
    : undefined;
  const connectableCatalog = connectFrom
    ? CATALOG.filter((entry) =>
      allowedKinds(getWireNodeType(connectFrom.nodeId, connectFromNode), entry.nodeType).length > 0)
    : [];
  const canvasMenuItems: MenuItem[] = [
    ...(connectFrom ? [{
      id: 'add-node-connect',
      label: 'Add node here and connect',
      submenu: connectableCatalog.map((entry) => ({
        id: `add-connect-${entry.serviceId}`,
        label: entry.label,
        disabled: client.activeComponents?.includes(entry.serviceId) || nodes.some((node) => node.serviceId === entry.serviceId),
        disabledReason: 'This component is already installed on the canvas.',
        onSelect: () => requestCatalogAdd(entry, connectFrom),
      })),
    }] : []),
    {
      id: 'add-node',
      label: 'Add node',
      submenu: CATALOG.map((entry) => ({
        id: `add-${entry.serviceId}`,
        label: entry.label,
        disabled: client.activeComponents?.includes(entry.serviceId) || nodes.some((node) => node.serviceId === entry.serviceId),
        disabledReason: 'This component is already installed on the canvas.',
        onSelect: () => requestCatalogAdd(entry),
      })),
    },
    ...(!connectFrom ? [{
      id: 'select-all',
      label: 'Select all satellites',
      shortcut: 'Ctrl+A',
      disabled: nodes.length === 0,
      disabledReason: 'There are no satellites to select.',
      onSelect: () => {
        const ids = nodesRef.current.map((node) => node.id);
        setSelectedNodeIds(ids);
        setSelectedNodeId(ids[ids.length - 1] || null);
        setSelectedWireId(null);
      },
    }] : []),
    {
      id: 'wires',
      label: 'Wires',
      submenu: [
        { id: 'export', label: 'Export wires', onSelect: downloadWireExport },
        { id: 'import', label: 'Import wires', onSelect: () => importInputRef.current?.click() },
      ],
    },
    {
      id: 'arrange',
      label: 'Arrange',
      submenu: [
        {
          id: 'auto-arrange',
          label: 'Arrange satellites around Sun',
          onSelect: () => commitWorkbenchState(nodesRef.current.map((node, index) => {
            const angle = (index / Math.max(nodesRef.current.length, 1)) * Math.PI * 2;
            return {
              ...node,
              x: Math.round(sunPos.x + Math.cos(angle) * 460 - node.width / 2),
              y: Math.round(sunPos.y + Math.sin(angle) * 360 - node.height / 2),
            };
          }), linkStateRef.current),
        },
        {
          id: 'lock-all',
          label: 'Lock all satellites',
          onSelect: () => commitWorkbenchState(
            nodesRef.current.map((node) => ({ ...node, isLocked: true })),
            linkStateRef.current,
          ),
        },
        {
          id: 'unlock-all',
          label: 'Unlock all satellites',
          onSelect: () => commitWorkbenchState(
            nodesRef.current.map((node) => ({ ...node, isLocked: false })),
            linkStateRef.current,
          ),
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      submenu: [
        { id: 'focus-sun', label: 'Focus Sun', onSelect: () => onTriggerAction?.('FOCUS_NODE', { x: sunPos.x, y: sunPos.y }) },
        {
          id: 'focus-selected',
          label: 'Focus selected node',
          disabled: !selectedNodeId,
          disabledReason: 'Select a node before focusing it.',
          onSelect: () => {
            const node = allRenderNodes.find((item) => item.id === selectedNodeId);
            if (node) onTriggerAction?.('FOCUS_NODE', { x: node.x + node.width / 2, y: node.y + node.height / 2 });
          },
        },
        { id: 'toggle-satellites', label: 'Toggle satellites', onSelect: () => onTriggerAction?.('TOGGLE_SATELLITES') },
        {
          id: 'wire-filters',
          label: 'Wires',
          submenu: [
            {
              id: 'wire-departments',
              label: 'Departments',
              submenu: WIRE_DEPARTMENTS.map((department) => ({
                id: `wire-department-${department}`,
                label: `${visibleWireDepartments[department] ? 'Hide' : 'Show'} ${department === 'core' ? 'Sun / core' : department}`,
                icon: <span aria-hidden="true" style={{ color: DEPT_COLOR[department] }}>●</span>,
                onSelect: () => setVisibleWireDepartments((current) => ({
                  ...current,
                  [department]: !current[department],
                })),
              })),
            },
            {
              id: 'wire-kinds',
              label: 'Kinds',
              submenu: WIRE_KINDS.map((kind) => ({
                id: `wire-kind-${kind}`,
                label: `${visibleWireKinds[kind] ? 'Hide' : 'Show'} ${kind}`,
                icon: <span aria-hidden="true">{KIND_STYLE[kind].glyph === 'lock' ? '▣' : KIND_STYLE[kind].glyph === 'diamond' ? '◆' : '•'}</span>,
                onSelect: () => setVisibleWireKinds((current) => ({
                  ...current,
                  [kind]: !current[kind],
                })),
              })),
            },
            {
              id: 'wire-legend',
              label: 'Legend',
              submenu: [
                ...WIRE_DEPARTMENTS.map((department) => ({
                  id: `legend-department-${department}`,
                  label: department === 'core' ? 'Sun / core source' : `${department} source`,
                  icon: <span aria-hidden="true" style={{ color: DEPT_COLOR[department] }}>●</span>,
                  disabled: true,
                  disabledReason: 'Wire color represents the source department.',
                })),
                ...WIRE_KINDS.map((kind) => ({
                  id: `legend-kind-${kind}`,
                  label: `${kind} · ${KIND_STYLE[kind].glyph}`,
                  disabled: true,
                  disabledReason: 'Wire line style and glyph represent its kind.',
                })),
                {
                  id: 'legend-error',
                  label: 'Red · error state',
                  disabled: true,
                  disabledReason: 'Red is reserved for wire errors.',
                },
              ],
            },
          ],
        },
        {
          id: 'fit-all',
          label: 'Fit all nodes',
          onSelect: () => {
            const bounds = allRenderNodes.reduce((result, node) => ({
              left: Math.min(result.left, node.x),
              top: Math.min(result.top, node.y),
              right: Math.max(result.right, node.x + node.width),
              bottom: Math.max(result.bottom, node.y + node.height),
            }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
            onTriggerAction?.('FIT_WORKBENCH', bounds);
          },
        },
      ],
    },
    {
      id: 'recenter',
      label: 'Recenter Sun',
      onSelect: () => {
        setSunPos({ x: 0, y: 0 });
        onTriggerAction?.('FOCUS_NODE', { x: 0, y: 0 });
      },
    },
    {
      id: 'undo',
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      disabled: historyRef.current.past.length === 0,
      disabledReason: 'There is no workbench change to undo.',
      onSelect: undoWorkbenchChange,
    },
    {
      id: 'redo',
      label: 'Redo',
      shortcut: 'Ctrl+Shift+Z',
      disabled: historyRef.current.future.length === 0,
      disabledReason: 'There is no workbench change to redo.',
      onSelect: redoWorkbenchChange,
    },
  ];

  const sunMenuItems: MenuItem[] = [
    {
      id: 'lock',
      label: sunLocked ? 'Unlock Sun' : 'Lock Sun',
      onSelect: () => setSunLocked((locked) => !locked),
    },
    { id: 'recenter', label: 'Recenter Sun', onSelect: () => setSunPos({ x: 0, y: 0 }) },
    ...(activeProject && onOpenPlanet ? [{ id: 'planet', label: `Open ${activeProject.ProjectID} (Planet)`, onSelect: () => onOpenPlanet(activeProject.ProjectID) }] : []),
    // Owner feedback 2026-11-05: the client actions menu (status, invoice, OSINT, Sunset) is reachable from Solar too.
    { id: 'client-actions', label: 'Client actions (status, invoice, Sunset)…', onSelect: () => onTriggerAction?.('OPEN_TASKS', { client }) },
    {
      id: 'connect',
      label: 'Connect to…',
      onSelect: () => {
        setSelectedPort({ nodeId: 'core-node', pin: 'right' });
        setNotice('Select a target connection port to complete the wire.');
      },
    },
    { id: 'focus', label: 'Focus Sun', shortcut: 'F', onSelect: () => onTriggerAction?.('FOCUS_NODE', { x: sunPos.x, y: sunPos.y }) },
    {
      id: 'dispatch',
      label: 'Dispatch agent…',
      submenu: (['Alfred', 'Pamela', 'Oracle', 'Dolores', 'Vala', 'Daisy'] as const).map((agent) => ({
        id: `sun-dispatch-${agent.toLowerCase()}`,
        label: agent,
        onSelect: () => onDispatchAgent?.(agent, nodeContext(coreNodeGeometry)),
      })),
    },
    {
      id: 'open-links',
      label: 'Open client links',
      submenu: [
        { id: 'drive', label: 'Drive folder', disabled: !client.DriveFolderUrl, disabledReason: 'No Drive folder link is available.', onSelect: () => { if (client.DriveFolderUrl) window.open(client.DriveFolderUrl, '_blank', 'noopener,noreferrer'); } },
        { id: 'notes', label: 'Notes document', disabled: !client.NotesDocUrl, disabledReason: 'No notes document link is available.', onSelect: () => { if (client.NotesDocUrl) window.open(client.NotesDocUrl, '_blank', 'noopener,noreferrer'); } },
        { id: 'chat', label: 'Chat space', disabled: !client.ChatSpaceUrl, disabledReason: 'No chat space link is available.', onSelect: () => { if (client.ChatSpaceUrl) window.open(client.ChatSpaceUrl, '_blank', 'noopener,noreferrer'); } },
      ],
    },
    { id: 'copy-client-id', label: 'Copy client ID', onSelect: () => { void copyText(client.ClientID); } },
    {
      id: 'delete',
      label: 'Delete',
      disabled: true,
      disabledReason: 'The core deliverable cannot be deleted.',
    },
  ];

  useEffect(() => {
    wireActionsRef.current = {
      create: createWireFromPanel,
      select: (linkId) => {
        setSelectedWireId(linkId);
        setWireMenu(null);
      },
      update: updateWire,
      reverse: reverseWire,
      remove: removeWire,
    };
  });

  useEffect(() => {
    if (!linkState || linkState.clientId !== client.ClientID) {
      onWirePanelChange?.(null);
      return;
    }

    onWirePanelChange?.({
      clientId: client.ClientID,
      clientName: client.Company_Name,
      nodes: [
        { id: 'core-node', label: 'SUN // CORE', type: 'core' },
        ...nodes.map((node) => ({
          id: node.id,
          label: node.title || node.id,
          type: getWireNodeType(node.id, node),
        })),
      ],
      links: linkState.links,
      selectedWireId,
      contextMenuOpen: Boolean(wireMenu),
    });
  }, [
    client.ClientID,
    client.Company_Name,
    linkState,
    nodes,
    selectedWireId,
    wireMenu,
    onWirePanelChange,
  ]);

  useEffect(() => {
    onWirePanelActionsChange?.({
      create: (input) => wireActionsRef.current?.create(input) ?? false,
      select: (linkId) => wireActionsRef.current?.select(linkId),
      update: (linkId, updates) => wireActionsRef.current?.update(linkId, updates),
      reverse: (linkId) => wireActionsRef.current?.reverse(linkId),
      remove: (linkId) => wireActionsRef.current?.remove(linkId),
    });
    return () => onWirePanelActionsChange?.(null);
  }, [onWirePanelActionsChange]);

  useEffect(() => () => onWirePanelChange?.(null), [onWirePanelChange]);

  return (
    <div
      ref={workbenchRef}
      data-canvas-bg="true"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[data-node-id], [data-wire-id], button, input')) return;
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
        setSelectedWireId(null);
        setSelectedPort(null);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDropActive) setIsDropActive(true);
      }}
      onDragLeave={() => setIsDropActive(false)}
      onDrop={handleCanvasDrop}
      onContextMenu={handleCanvasContextMenu}
      className={`pointer-events-auto relative w-full h-full bg-[#020500] text-[#DDFBD0] overflow-hidden select-none flex flex-col font-mono transition-colors duration-200 ${
        isDropActive ? 'bg-[#04100c]' : ''
      }`}
    >
      {/* Background Starfield & Tactical Radar Grid */}
      <div className="crm-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#086375]/15 via-transparent to-transparent" />

      {/* Drop Zone Ambient Glow Indicator */}
      {isDropActive && (
        <div className="pointer-events-none absolute inset-0 border-4 border-dashed border-[#E0CA3C] z-30 animate-pulse bg-[#E0CA3C]/5 flex items-center justify-center">
          <div className="bg-[#020500]/90 border border-[#E0CA3C] px-6 py-3 rounded-xl shadow-2xl text-[#E0CA3C] font-bold text-sm tracking-wider">
            ✦ RELEASE TO SNAP SERVICE COMPONENT TO ORBIT ✦
          </div>
        </div>
      )}

      {/* Top Breadcrumb Overlay (Fixed top-left) */}
      <div className="pointer-events-auto absolute top-4 left-6 z-40 flex items-center gap-3 bg-[#020500]/95 border border-[#E0CA3C] rounded-xl px-4 py-2 shadow-[0_0_24px_rgba(224,202,60,0.3)]">
        <button
          type="button"
          onClick={onExit}
          className="text-[#DDFBD0]/70 hover:text-[#E0CA3C] flex items-center gap-1.5 font-bold transition-colors cursor-pointer text-xs"
        >
          <i className="fa-solid fa-arrow-left text-[#E0CA3C]" />
          <span>[ GALAXY VIEW ]</span>
        </button>
        <span className="text-[#086375] font-bold">/</span>
        <div className="flex items-center gap-2">
          <span className="text-[#E0CA3C] font-display font-bold text-sm tracking-wide">
            ✦ {client.Company_Name}
          </span>
          <span className="text-hud-3 px-2 py-0.5 rounded bg-[#5F0F40] border border-[#E0CA3C]/40 text-[#E0CA3C] font-bold">
            SOLAR WORKBENCH
          </span>
        </div>
        {toolbar && (
          <>
            <span aria-hidden="true" className="text-[#086375] font-bold">|</span>
            {toolbar}
          </>
        )}
        <button
          type="button"
          onClick={onExit}
          className="ml-3 text-xs text-[#FE5F00] hover:text-white px-2 py-0.5 rounded border border-[#FE5F00]/50 hover:bg-[#FE5F00] hover:text-black transition-colors cursor-pointer"
          title="Press Esc or click to return to Galaxy View"
        >
          ESC ✕
        </button>
      </div>

      {/* Top Right Mode Switcher */}
      <div className="pointer-events-auto absolute top-28 right-6 z-40 flex gap-2">
        <button
          type="button"
          disabled={historyRef.current.past.length === 0}
          onClick={undoWorkbenchChange}
          className="px-2 py-1.5 rounded-lg border border-[#086375] bg-[#020500]/90 text-[#DDFBD0] disabled:opacity-40 text-hud-3 font-bold"
        >
          UNDO
        </button>
        <button
          type="button"
          disabled={historyRef.current.future.length === 0}
          onClick={redoWorkbenchChange}
          className="px-2 py-1.5 rounded-lg border border-[#086375] bg-[#020500]/90 text-[#DDFBD0] disabled:opacity-40 text-hud-3 font-bold"
        >
          REDO
        </button>
        <button
          type="button"
          title="Workbench view and wire controls"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setCanvasMenu((current) => current ? null : { x: rect.left, y: rect.bottom + 4 });
          }}
          className="px-3 py-1.5 rounded-lg border border-[#E0CA3C] bg-[#E0CA3C]/20 text-[#E0CA3C] font-bold text-xs"
        >
          <i className="fa-solid fa-satellite mr-1.5 text-xs" />
          SATELLITES ({nodes.length}) ▾
        </button>
      </div>

      {/* ── STEP 1: TRANSFORMED WORLD CONTAINER (RECEIVES CAMERA PAN & ZOOM) ── */}
      <div
        style={{
          transform: `translate3d(${cameraPan.x}px, ${cameraPan.y}px, 0) scale(${cameraZoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transition: 'transform 75ms ease-out',
        }}
        className="pointer-events-none"
      >
        {/* World Origin Anchor at Center of Screen (50vw, 50vh) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0 overflow-visible pointer-events-none">
          {/* Orbital Concentric Guide Rings centered around Sun's live coordinates */}
          <svg
            style={{
              position: 'absolute',
              left: `${sunPos.x - 600}px`,
              top: `${sunPos.y - 600}px`,
              width: '1200px',
              height: '1200px',
            }}
            className="pointer-events-none overflow-visible z-0"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="600" cy="600" r="220" fill="none" stroke="#086375" strokeWidth="1" strokeDasharray="4 6" opacity="0.35" />
            <circle cx="600" cy="600" r="340" fill="none" stroke="#086375" strokeWidth="1" strokeDasharray="3 8" opacity="0.25" />
            <circle cx="600" cy="600" r="460" fill="none" stroke="#086375" strokeWidth="1" strokeDasharray="2 10" opacity="0.15" />
          </svg>

          {/* Dynamic SVG Tracer Link Layer between Sun and Satellites */}
          <svg
            style={{ position: 'absolute', left: '-2000px', top: '-2000px', width: '4000px', height: '4000px' }}
            className="pointer-events-none overflow-visible z-10"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {visibleLinks.map((link, index) => {
                const color = DEPT_COLOR[getNodeDepartment(link.fromNodeId)];
                return (
                  <marker
                    key={link.id}
                    id={`wire-arrow-${index}`}
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path
                      d="M 0 0 L 8 4 L 0 8"
                      fill={link.mode === 'pull' ? 'none' : color}
                      stroke={color}
                      strokeWidth="1.25"
                    />
                  </marker>
                );
              })}
            </defs>
            {visibleLinks.map((link, index) => {
              const src = allRenderNodes.find((node) => node.id === link.fromNodeId);
              const dst = allRenderNodes.find((node) => node.id === link.toNodeId);
              if (!src || !dst) return null;
              const start = pinPoint(src, link.fromPin);
              const end = pinPoint(dst, link.toPin);
              const x1 = 2000 + start.x;
              const y1 = 2000 + start.y;
              const x2 = 2000 + end.x;
              const y2 = 2000 + end.y;
              const distance = Math.max(40, Math.hypot(x2 - x1, y2 - y1) * 0.4);
              const fromNormal = PIN_NORMALS[link.fromPin];
              const toNormal = PIN_NORMALS[link.toPin];
              const path = `M ${x1} ${y1} C ${x1 + fromNormal.x * distance} ${y1 + fromNormal.y * distance}, ${x2 + toNormal.x * distance} ${y2 + toNormal.y * distance}, ${x2} ${y2}`;
              const color = DEPT_COLOR[getNodeDepartment(link.fromNodeId)];
              const style = KIND_STYLE[link.kind];
              const isSelected = selectedWireId === link.id;
              const isActive = activeWireIds.includes(link.id);
              const isBlocked = link.kind === 'dependency' && !doneNodeIds.includes(link.fromNodeId);
              const hasMoneyProposal = link.kind === 'trigger' && getNodeDepartment(link.toNodeId) === 'vala';
              const isConnectedToSelectedNode = !hasSelectedNodes
                || selectedNodeSet.has(link.fromNodeId)
                || selectedNodeSet.has(link.toNodeId);
              const opacity = (link.enabled ? 0.9 : 0.3)
                * (isBlocked ? 0.55 : 1)
                * (hasSelectedNodes && !isConnectedToSelectedNode ? 0.12 : 1);
              const glyph = style.glyph === 'lock' ? '▣' : style.glyph === 'diamond' ? '◆' : '•';
              const pathId = `wire-path-${index}`;
              const isHovered = hoveredWireId === link.id;

              return (
                <g
                  key={link.id}
                  data-wire-id={link.id}
                  data-wire-from={link.fromNodeId}
                  data-wire-to={link.toNodeId}
                  aria-label={`${link.kind} wire${isBlocked ? ', blocked' : ''}`}
                  onMouseEnter={() => setHoveredWireId(link.id)}
                  onMouseLeave={() => setHoveredWireId((current) => current === link.id ? null : current)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedWireId(link.id);
                    setCanvasMenu(null);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedWireId(link.id);
                    setWireMenu({ x: event.clientX, y: event.clientY, linkId: link.id });
                  }}
                >
                  <path
                    id={pathId}
                    d={path}
                    stroke={color}
                    strokeWidth={isSelected ? style.width + 1 : style.width}
                    strokeDasharray={isBlocked ? '2 5' : style.dash || (link.enabled ? undefined : '3 5')}
                    fill="none"
                    opacity={opacity}
                    markerEnd={`url(#wire-arrow-${index})`}
                    markerStart={link.mode === 'sync' ? `url(#wire-arrow-${index})` : undefined}
                    pointerEvents="none"
                  />
                  <path
                    d={path}
                    stroke="transparent"
                    strokeWidth="16"
                    fill="none"
                    pointerEvents="stroke"
                    className="cursor-pointer"
                  />
                  {!prefersReducedMotion && animatedWireIds.has(link.id) && (
                    <g aria-hidden="true" pointerEvents="none">
                      {[0, 0.66, 1.33].map((delay) => (
                        <g key={delay}>
                          <path
                            d="M-4,-4 L2,0 L-4,4"
                            fill={link.mode === 'pull' ? 'none' : color}
                            stroke={color}
                          />
                          <animateMotion
                            dur="2s"
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                            rotate="auto"
                          >
                            <mpath href={`#${pathId}`} />
                          </animateMotion>
                        </g>
                      ))}
                      {link.mode === 'sync' && [0, 0.66, 1.33].map((delay) => (
                        <g key={`reverse-${delay}`}>
                          <path
                            d="M-4,-4 L2,0 L-4,4"
                            fill={link.mode === 'pull' ? 'none' : color}
                            stroke={color}
                          />
                          <animateMotion
                            dur="2s"
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                            rotate="auto"
                            keyPoints="1;0"
                            keyTimes="0;1"
                            calcMode="linear"
                          >
                            <mpath href={`#${pathId}`} />
                          </animateMotion>
                        </g>
                      ))}
                    </g>
                  )}
                  {(isSelected || isHovered || (prefersReducedMotion && isActive)) && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      textAnchor="middle"
                      fill={color}
                      fontSize="16"
                      pointerEvents="none"
                    >
                      {glyph}
                      {(isSelected || isHovered) && hasMoneyProposal ? ` ${MONEY_GLYPH}` : ''}
                      {(isSelected || isHovered) && isBlocked ? ' BLOCKED' : ''}
                      {(isSelected || isHovered) && link.label ? ` ${link.label}` : ''}
                    </text>
                  )}
                </g>
              );
            })}
            {dragPreviewPath && draggedFromNode && (
              <path
                d={dragPreviewPath}
                stroke={DEPT_COLOR[getNodeDepartment(draggedFromNode.id)]}
                strokeWidth="2"
                strokeDasharray="6 6"
                fill="none"
                opacity="0.9"
              />
            )}
          </svg>

          {/* ── STEP 2: CENTRAL SUN CORE NODE (DRAGGABLE, LOCKABLE, STABLE KEY) ── */}
          <div
            data-node-id="core-node"
            key={`sun-${client.ClientID}`}
            onPointerDown={handleSunPointerDown}
            onDoubleClick={handleSunDoubleClick}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSunMenu({ x: event.clientX, y: event.clientY });
            }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button, [data-port-id]')) return;
              setSelectedNodeId('core-node');
              setSelectedNodeIds([]);
              setSelectedWireId(null);
              setCanvasMenu(null);
            }}
            style={{
              position: 'absolute',
              top: `${coreNodeGeometry.y}px`,
              left: `${coreNodeGeometry.x}px`,
              width: `${coreNodeGeometry.width}px`,
              height: `${coreNodeGeometry.height}px`,
              // Owner design: a completed project's sun dims and goes out (shown only when no project is open).
              opacity: sunPlan.primaryOut ? 0.35 : 1,
              filter: sunPlan.primaryOut ? 'grayscale(0.8)' : undefined,
            }}
            data-sun-project={activeProject?.ProjectID}
            className={`z-20 pointer-events-auto rounded-2xl border-2 border-[#E0CA3C] bg-gradient-to-br from-[#0d1f18] via-[#05130e] to-[#020500] p-5 shadow-[0_0_50px_rgba(224,202,60,0.35)] flex flex-col select-none transition-shadow ${
              interactionMode === 'lock' || sunLocked ? 'cursor-default' : 'cursor-move hover:shadow-[0_0_60px_rgba(224,202,60,0.5)]'
            }`}
            title={sunPlan.primaryOut
              ? `${activeProject?.ProjectID} is in Sunset; its sun is going out. Double-click to open its Planet page.`
              : `Sun for ${activeProject?.ProjectID ?? 'this client'}: drag to move, double-click to open its Planet page`}
          >
            <ConnectionPort
              id="core-node-top"
              nodeId="core-node"
              position="top"
              targetPreview={portTargetPreview}
              onPortClick={() => handlePortClick('core-node', 'top')}
              onPortPointerDown={(event) => handlePortPointerDown(event, 'core-node', 'top')}
            />
            <ConnectionPort
              id="core-node-bottom"
              nodeId="core-node"
              position="bottom"
              targetPreview={portTargetPreview}
              onPortClick={() => handlePortClick('core-node', 'bottom')}
              onPortPointerDown={(event) => handlePortPointerDown(event, 'core-node', 'bottom')}
            />
            <ConnectionPort
              id="core-node-left"
              nodeId="core-node"
              position="left"
              targetPreview={portTargetPreview}
              onPortClick={() => handlePortClick('core-node', 'left')}
              onPortPointerDown={(event) => handlePortPointerDown(event, 'core-node', 'left')}
            />
            <ConnectionPort
              id="core-node-right"
              nodeId="core-node"
              position="right"
              targetPreview={portTargetPreview}
              onPortClick={() => handlePortClick('core-node', 'right')}
              onPortPointerDown={(event) => handlePortPointerDown(event, 'core-node', 'right')}
            />
            {/* Core Header */}
            <div className="flex items-center justify-between border-b border-[#086375]/60 pb-3 mb-3">
              <div>
                <span className="text-hud-3 text-[#086375] font-bold uppercase tracking-wider block">
                  CORE DELIVERABLE NODE // {client.ClientID}
                </span>
                <h2 className="font-display font-extrabold text-lg text-white tracking-wide">
                  {client.Company_Name}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-hud-2 text-[#DDFBD0]/60 block uppercase">Contract Value</span>
                <span className="font-bold text-sm text-[#E0CA3C]">
                  ${(client.ContractValue || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* 10-Step SprintStage Progress Track */}
            <div className="mb-4">
              <div className="flex justify-between items-center text-hud-3 mb-1.5">
                <span className="font-bold text-[#E0CA3C]">10-STEP SPRINT STAGE PROGRESS</span>
                <span className="text-[#DDFBD0]/70">Step {stageIndex + 1} of 10</span>
              </div>
              <div className="flex gap-1 h-2 mb-1">
                {SPRINT_STAGES_LIST.map((stage, idx) => {
                  const isPassed = idx <= stageIndex;
                  const isCurrent = idx === stageIndex;
                  return (
                    <div
                      key={stage}
                      title={stage}
                      className={`flex-1 rounded-xs transition-all ${
                        isCurrent
                          ? 'bg-[#E0CA3C] shadow-[0_0_8px_#E0CA3C] animate-pulse'
                          : isPassed
                          ? 'bg-[#086375]'
                          : 'bg-[#086375]/20'
                      }`}
                    />
                  );
                })}
              </div>
              <div className="text-hud-3 text-[#E0CA3C] font-bold truncate">
                {currentStage}
              </div>
            </div>

            {/* Roadblock and Vitals */}
            <div className="grid grid-cols-2 gap-2 text-hud-3 bg-[#020500]/70 border border-[#086375]/40 rounded-xl p-2.5 mb-3">
              <div>
                <span className="text-[#DDFBD0]/50 block text-hud-2 uppercase">Iron Gate Deposit</span>
                <span className={`font-bold ${client.DepositPaid ? 'text-[#E0CA3C]' : 'text-[#FE5F00]'}`}>
                  {client.DepositPaid ? '1/3 CLEARED 🔓' : 'UNPAID / LOCKED 🔒'}
                </span>
              </div>
              <div>
                <span className="text-[#DDFBD0]/50 block text-hud-2 uppercase">Active Roadblock</span>
                <span className="text-[#FE5F00] font-bold truncate block">
                  {client.roadblock || client.activePebble || 'None Reported'}
                </span>
              </div>
            </div>

            {/* Active ECS Components Count */}
            <div className="flex items-center justify-between text-hud-3 text-[#DDFBD0]/70 border-t border-[#086375]/40 pt-2">
              <span>Installed ECS Components:</span>
              <span className="font-bold text-[#E0CA3C]">
                {client.activeComponents?.length || 0} Modules Active
              </span>
            </div>
          </div>

          {/* ── SATELLITE NODES ── */}
          {(
            <>
              {/* Project suns are structural: they stay visible when satellites are hidden. */}
              {nodes.filter((node) => showNonStructural || node.kind === 'sun').map((node) => (
                <ResizableNodeContainer
                  key={node.id}
                  node={{
                    ...node,
                    isLocked: node.isLocked || interactionMode === 'lock',
                  }}
                  cameraZoom={cameraZoom}
                  onUpdate={handleUpdateNode}
                  onPortClick={handlePortClick}
                  onPortPointerDown={handlePortPointerDown}
                  targetPreview={portTargetPreview}
                  onSelect={(nodeId, additive = false) => {
                    const nextSelection = additive
                      ? selectedNodeIds.includes(nodeId)
                        ? selectedNodeIds.filter((id) => id !== nodeId)
                        : [...selectedNodeIds, nodeId]
                      : [nodeId];
                    setSelectedNodeIds(nextSelection);
                    setSelectedNodeId(nextSelection.includes(nodeId)
                      ? nodeId
                      : nextSelection[nextSelection.length - 1] || null);
                    setSelectedWireId(null);
                    setCanvasMenu(null);
                  }}
                  isSelected={selectedNodeIds.includes(node.id)}
                  onGroupDragStart={beginGroupDrag}
                  onGroupDragMove={moveSelectedNodes}
                  onGroupDragEnd={endGroupDrag}
                  additionalMenuItems={nodeMenuItems(node)}
                  onOpen={node.kind === 'sun' && node.projectId && onOpenPlanet
                    ? () => onOpenPlanet(node.projectId!)
                    : node.serviceId && onOpenPlanet && (node.projectId || activeProject)
                      ? () => onOpenPlanet(node.projectId || activeProject!.ProjectID)
                      : undefined}
                  onDelete={(target) => {
                    if (target.serviceId) handleRemoveComponentFromCanvas(target.serviceId);
                    else if (isRemovableNode(target)) removeNodesFromCanvas([target.id]);
                  }}
                >
                  {/* Node Specific Contents */}
                  {node.kind === 'sun' && (() => {
                    const project = client.activeProjects.find((item) => item.ProjectID === node.projectId);
                    const index = project ? SPRINT_STAGES_LIST.indexOf(project.SprintStage) : -1;
                    return (
                      <div className="flex h-full flex-col gap-1.5 text-hud-2 text-[#DDFBD0]/85" data-sun-project={node.projectId}>
                        <div className="flex items-center justify-between text-hud-2">
                          <span className="font-bold tracking-wider text-[#E0CA3C]">SUN // {node.projectId}</span>
                          <span className="text-[#DDFBD0]/60">Step {index + 1} of 10</span>
                        </div>
                        <div className="truncate font-display text-sm font-bold text-[#DDFBD0]">{project?.Title || node.projectId}</div>
                        <div className="flex gap-0.5" aria-label={`Stage progress ${index + 1} of 10`}>
                          {SPRINT_STAGES_LIST.map((stage, idx) => (
                            <span key={stage} className={`h-1.5 flex-1 rounded-sm ${idx < index ? 'bg-[#086375]' : idx === index ? 'bg-[#E0CA3C]' : 'bg-[#DDFBD0]/10'}`} />
                          ))}
                        </div>
                        <div className="text-[#E0CA3C]">{project?.SprintStage}</div>
                        <div className="flex gap-3 text-[#DDFBD0]/60">
                          <span>Est {project?.Est_Hours ?? '—'}h</span><span>Actual {project?.Actual_Hours ?? '—'}h</span>
                        </div>
                        {onOpenPlanet && node.projectId && (
                          <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPlanet(node.projectId!); }}
                            className="mt-auto self-start rounded border border-[#E0CA3C]/60 px-2 py-0.5 text-hud-2 font-bold text-[#E0CA3C] hover:bg-[#E0CA3C]/10">
                            Open Planet ↗
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  {node.id === 'node-pamela' && (
                    <div className="space-y-1 text-hud-2 text-[#DDFBD0]/80">
                      <div className="flex items-center gap-1.5 mb-1 text-[#086375] font-bold text-hud-3">
                        <i className="fa-solid fa-flask text-emerald-400" />
                        <span>LEGAL & DRIVE VAULT</span>
                      </div>
                      <a
                        href={client.DriveFolderUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-1 rounded bg-[#086375]/15 hover:bg-[#086375]/30 cursor-pointer text-[#DDFBD0]"
                      >
                        <span>Google Drive Vault</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-hud-1 text-[#E0CA3C]" />
                      </a>
                      <div className="flex items-center justify-between p-1 rounded bg-[#086375]/15">
                        <span>MSA: {client.MSA_DocID ? 'Signed 🔓' : 'Missing 🔒'}</span>
                      </div>
                    </div>
                  )}

                  {node.id === 'node-oracle' && (
                    <div className="space-y-1 text-hud-2 text-[#DDFBD0]/80">
                      <div className="flex items-center gap-1.5 mb-1 text-[#E0CA3C] font-bold text-hud-3">
                        <i className="fa-solid fa-eye text-[#E0CA3C]" />
                        <span>INTELLIGENCE & OSINT</span>
                      </div>
                      <div className="p-1 rounded bg-[#086375]/15 flex justify-between">
                        <span>case_file.json</span>
                        <span className="text-[#E0CA3C]">{client.caseFileJsonUrl ? 'Compiled' : 'Pending'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTriggerAction?.('ORACLE_SWEEP', { client })}
                        className="w-full mt-1 py-0.5 rounded border border-[#E0CA3C]/50 bg-[#E0CA3C]/10 text-[#E0CA3C] text-hud-1 font-bold hover:bg-[#E0CA3C] hover:text-black cursor-pointer"
                      >
                        RUN OSINT SWEEP
                      </button>
                    </div>
                  )}

                  {node.id === 'node-dolores' && (
                    <div className="space-y-1 text-hud-2 text-[#DDFBD0]/80">
                      <div className="flex items-center gap-1.5 mb-1 text-[#3C91E6] font-bold text-hud-3">
                        <i className="fa-solid fa-wave-square text-[#3C91E6]" />
                        <span>TASKS & 45-DAY GANTT</span>
                      </div>
                      <div className="p-1 rounded bg-[#086375]/15 flex justify-between">
                        <span>Milestones Done</span>
                        <span className="text-[#E0CA3C]">
                          {activeProject?.MilestonesDone ?? 1}/{activeProject?.MilestonesTotal ?? 4}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTriggerAction?.('OPEN_TASKS', { client })}
                        className="w-full mt-1 py-0.5 rounded border border-[#3C91E6]/50 bg-[#3C91E6]/10 text-[#3C91E6] text-hud-1 font-bold hover:bg-[#3C91E6] hover:text-white cursor-pointer"
                      >
                        OPEN GOOGLE TASKS
                      </button>
                    </div>
                  )}

                  {node.id === 'node-vala' && (
                    <div className="space-y-1 text-hud-2 text-[#DDFBD0]/80">
                      <div className="flex items-center gap-1.5 mb-1 text-[#E0CA3C] font-bold text-hud-3">
                        <i className="fa-solid fa-coins text-[#E0CA3C]" />
                        <span>COMMERCE & FISCAL</span>
                      </div>
                      <div className="p-1 rounded bg-[#086375]/15 flex justify-between">
                        <span>Next 1/3rd Invoice</span>
                        <span className="text-white font-bold">
                          ${Math.round((client.ContractValue || 0) / 3).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTriggerAction?.('DRAFT_INVOICE', { client })}
                        className="w-full mt-1 py-0.5 rounded border border-[#E0CA3C]/50 bg-[#E0CA3C]/10 text-[#E0CA3C] text-hud-1 font-bold hover:bg-[#E0CA3C] hover:text-black cursor-pointer"
                      >
                        DRAFT INVOICE
                      </button>
                    </div>
                  )}

                  {node.id === 'node-daisy' && (
                    <div className="space-y-1 text-hud-2 text-[#DDFBD0]/80">
                      <div className="flex items-center gap-1.5 mb-1 text-[#FE5F00] font-bold text-hud-3">
                        <i className="fa-solid fa-envelope-open-text text-[#FE5F00]" />
                        <span>MCC & BROADCASTS</span>
                      </div>
                      <div className="p-1 rounded bg-[#086375]/15 flex justify-between">
                        <span>Nurture Step</span>
                        <span className="text-[#FE5F00]">#{stageIndex + 1} Triggered</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTriggerAction?.('OPEN_MCC', { client })}
                        className="w-full mt-1 py-0.5 rounded border border-[#FE5F00]/50 bg-[#FE5F00]/10 text-[#FE5F00] text-hud-1 font-bold hover:bg-[#FE5F00] hover:text-black cursor-pointer"
                      >
                        DISPATCH MCC
                      </button>
                    </div>
                  )}

                  {/* Dynamically Dropped Service Node Content */}
                  {node.serviceId && (
                    <div className="space-y-1 text-hud-2 text-[#DDFBD0]/80">
                      <div className="flex items-center justify-between text-[#E0CA3C] font-bold text-hud-3">
                        <span className="truncate">{node.title}</span>
                        <i className="fa-solid fa-puzzle-piece text-xs text-[#E0CA3C]" />
                      </div>
                      <p className="text-hud-1 text-[#DDFBD0]/60 line-clamp-2">
                        {CATALOG.find((s) => s.serviceId === node.serviceId)?.description || 'Active modular component attached.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveComponentFromCanvas(node.serviceId!)}
                        className="w-full py-0.5 rounded border border-[#FE5F00]/60 bg-[#FE5F00]/10 text-[#FE5F00] text-hud-1 font-bold hover:bg-[#FE5F00] hover:text-black cursor-pointer"
                      >
                        {accessToken ? 'REMOVE SERVICE…' : 'REMOVE FROM CANVAS'}
                      </button>
                    </div>
                  )}
                </ResizableNodeContainer>
              ))}
            </>
          )}
        </div>
      </div>

      {notice && (
        <div role="status" className="pointer-events-auto absolute bottom-4 right-6 z-40 rounded border border-[#086375] bg-[#020500]/95 px-3 py-2 text-xs text-[#DDFBD0] shadow-lg">
          {notice}
        </div>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleWireImport}
      />

      {wireMenu && (
        <ContextMenu
          x={wireMenu.x}
          y={wireMenu.y}
          items={wireMenuItems(wireMenu.linkId)}
          onClose={() => setWireMenu(null)}
        />
      )}

      {wireKindPicker && (
        <ContextMenu
          x={wireKindPicker.x}
          y={wireKindPicker.y}
          items={wireKindPicker.kinds.map((kind) => ({
            id: `wire-kind-${kind}`,
            label: `${KIND_STYLE[kind].glyph === 'lock' ? '▣' : KIND_STYLE[kind].glyph === 'diamond' ? '◆' : '•'} ${kind.toUpperCase()}`,
            onSelect: () => createWireFromPanel({ ...wireKindPicker.input, kind }),
          }))}
          onClose={() => setWireKindPicker(null)}
        />
      )}

      {canvasMenu && (
        <ContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          items={canvasMenuItems}
          onClose={() => setCanvasMenu(null)}
        />
      )}

      {sunMenu && (
        <ContextMenu
          x={sunMenu.x}
          y={sunMenu.y}
          items={sunMenuItems}
          onClose={() => setSunMenu(null)}
        />
      )}

      {/* Financial Mutation Confirmation Modal */}
      <DropConfirmDialog
        isOpen={Boolean(pendingDrop)}
        onCancel={() => {
          setPendingDrop(null);
          setServiceSyncError(null);
        }}
        onConfirm={handleConfirmDrop}
        serviceName={pendingDrop?.name || ''}
        priceDelta={pendingDrop?.price || 0}
        currentValue={client.ContractValue || 0}
        targetClientName={client.Company_Name}
        isSubmitting={isServiceSubmitting}
        errorMessage={serviceSyncError}
      />
      {pendingRemoval && accessToken && (() => {
        const entry = CATALOG.find((candidate) => candidate.serviceId === pendingRemoval.serviceId);
        return (
          <ServiceRemovalDialog
            accessToken={accessToken}
            clientName={client.Company_Name}
            projectId={pendingRemoval.projectId}
            serviceId={pendingRemoval.serviceId}
            serviceName={entry?.name ?? pendingRemoval.serviceId}
            price={entry?.price ?? 0}
            onCancel={() => setPendingRemoval(null)}
            onRemoved={(result) => {
              const remaining = Array.isArray(result.after.activeComponents)
                ? result.after.activeComponents.filter((id): id is string => typeof id === 'string')
                : (client.activeComponents || []).filter((id) => id !== pendingRemoval.serviceId);
              const tcvAfter = typeof result.after.TotalContractValue === 'number' ? result.after.TotalContractValue : null;
              const tcvBefore = isFinancialRecord(result.before.finance) ? Number(result.before.finance.TotalContractValue || 0) : null;
              onUpdateClient?.({
                ...client,
                activeComponents: remaining,
                ...(tcvAfter !== null && tcvBefore !== null ? { ContractValue: Number(client.ContractValue || 0) - (tcvBefore - tcvAfter) } : {}),
              });
              removeComponentsFromCanvas([pendingRemoval.serviceId]);
              const errors = typeof result.after.taskErrors === 'string' && result.after.taskErrors ? ` Some tasks were not deleted: ${result.after.taskErrors}` : '';
              setNotice(`${entry?.name ?? pendingRemoval.serviceId} removed from ${pendingRemoval.projectId}`
                + (tcvAfter !== null ? `; final invoice reduced by $${(entry?.price ?? 0).toLocaleString()}` : '')
                + `; ${String(result.after.tasksDeleted ?? 0)} open task(s) deleted.${errors}`);
              setPendingRemoval(null);
            }}
          />
        );
      })()}
    </div>
  );
};
