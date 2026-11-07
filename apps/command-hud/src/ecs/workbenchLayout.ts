import type { NodeGeometry } from '../components/canvas/workbench/ResizableNodeContainer';

/**
 * Owner 2026-11-05: Solar node arrangements reset every time Solar reopened (only wires and the Sun position were
 * saved). The layout (position, size, lock, attached project) is now kept per client in this browser.
 */
export const LAYOUT_PREFIX = 'szs_workbench_layout_';

type SavedNode = Pick<NodeGeometry, 'id' | 'x' | 'y' | 'width' | 'height' | 'isLocked'> & Partial<Pick<NodeGeometry, 'title' | 'serviceId' | 'kind' | 'projectId'>>;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseLayout(raw: string | null): Record<string, SavedNode> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return {};
    const out: Record<string, SavedNode> = {};
    value.forEach((item) => {
      const node = item as SavedNode;
      if (node && typeof node.id === 'string' && isFiniteNumber(node.x) && isFiniteNumber(node.y)
        && isFiniteNumber(node.width) && isFiniteNumber(node.height)) {
        out[node.id] = { ...node, isLocked: node.isLocked === true };
      }
    });
    return out;
  } catch {
    return {};
  }
}

export function serializeLayout(nodes: readonly NodeGeometry[]): string {
  return JSON.stringify(nodes.map(({ id, x, y, width, height, isLocked, title, serviceId, kind, projectId }) => ({
    id, x, y, width, height, isLocked, title, serviceId, kind, projectId,
  })));
}

/**
 * Pure: the initial nodes with saved geometry applied by id, plus saved Duplicate copies (which exist only in the
 * layout). Saved components or suns that are no longer installed/open are not brought back.
 */
export function mergeLayout(initial: readonly NodeGeometry[], saved: Record<string, SavedNode>): NodeGeometry[] {
  const merged = initial.map((node) => {
    const stored = saved[node.id];
    if (!stored) return node;
    return { ...node, x: stored.x, y: stored.y, width: stored.width, height: stored.height, isLocked: stored.isLocked, projectId: stored.projectId ?? node.projectId };
  });
  const ids = new Set(merged.map((node) => node.id));
  const copies = Object.values(saved)
    .filter((node) => node.id.includes('-copy-') && !ids.has(node.id))
    .map((node) => ({ ...node, isLocked: node.isLocked === true }) as NodeGeometry);
  return [...merged, ...copies];
}

export function loadLayout(clientId: string): Record<string, SavedNode> {
  try { return parseLayout(localStorage.getItem(`${LAYOUT_PREFIX}${clientId}`)); } catch { return {}; }
}

/** Saves the layout; saved sun positions not on the canvas right now (sun added later, or gone out) are kept. */
export function saveLayout(clientId: string, nodes: readonly NodeGeometry[]): void {
  try {
    const previous = loadLayout(clientId);
    const ids = new Set(nodes.map((node) => node.id));
    const keptSuns = Object.values(previous).filter((node) => node.id.startsWith('sun-') && !ids.has(node.id)) as NodeGeometry[];
    localStorage.setItem(`${LAYOUT_PREFIX}${clientId}`, serializeLayout([...nodes, ...keptSuns]));
  } catch { /* storage optional */ }
}
