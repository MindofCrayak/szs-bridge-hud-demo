> **Superseded by Master Plan v3.1** ([`docs/archive/SZS_HUD_MASTER_PLAN_v3.1.md`](./SZS_HUD_MASTER_PLAN_v3.1.md), itself completed 2026-11-05).

# SZS Command HUD: Phase 2 Implementation Plan (for Antigravity)

Supersedes `ANTIGRAVITY_PHASE2_PROMPT.md`. Repo: `MindofCrayak/szs-bridge-HUD`, app at `apps/command-hud/` (React + TypeScript + Vite + Tailwind, dev origin `http://127.0.0.1:3002`).

**Status:** closing; the Phase 2 service-attachment acceptance passed, but the wider Phase 2 audit has remaining partial and blocked items. **Last verified:** 2026-11-02. **Audit counts:** 16 done, 31 partial, 0 missing, 1 superseded, and 2 blocked-external (50 audit rows).
**Current handoff:** The latest HUD/engine checks and unresolved live-write status are recorded in [`PROGRESS.md`](./PROGRESS.md). The Working Copy schema is owner-confirmed as already matching the canonical schema; do not change Master Control schema for this work. The AccountPhase live write was rejected despite the canonical dropdown, read-back confirmed no mutation, and the cause remains unresolved. Subsequent validation-source alignment is local only and was not deployed. Keep Phase 2 `closing`; do not treat historical test counts below as current.
**Service-attachment acceptance:** after the v25 attachment, a fresh authenticated HUD load read C-107 from Master Control with `ContractValue` of `$3,200` and `comp_mcc_engine` in `ActiveComponents` (1 active module). The owner-confirmed test-only Google Tasks list showed each expected task exactly once: “Calibrate transactional Google Group inbox aliases,” “Deploy 10-stage milestone status templates,” and “Wire webhook listeners for Google Tasks triggers.” No production spreadsheet or Tasks list was targeted. This acceptance does not close the rest of Phase 2.
**Historical progress log:** The following entries are snapshots from earlier checkpoints, not current status. Use the latest update and Block 0 audit below for the current disposition.
**Earlier verification snapshot (pre-v25):** browser checks covered the bottom chassis, shared service catalog, demo drop, default Sun wire, Alfred proxy error/Stop behavior, menus, selection operations, wire editing/export/import, and event-loop/proposal behavior. At that checkpoint, HUD tests passed 8 tests and Master Control tests passed 25 tests; those counts are superseded by the latest validation below. A prior live Alfred smoke request returned sanitized HTTP 400; no key or response body was printed.
**Earlier attachment snapshot (pre-v25):** the first authorized attachment attempt failed on missing headers; a later attempt failed the Google Tasks preflight without writes. The spreadsheet target, schema, Tasks service, and OAuth scope were subsequently corrected and the authorized test was completed as recorded above.
**Earlier B4 check:** a development-only dependency preview was checked with an enabled Pamela-to-Vala wire; the preview did not change persisted link state. Production rules remain suggested.
**Owner decisions (2026-10-31):** the owner approved the disposable-copy service attachment, Google Tasks service access and OAuth scope, re-consent, and the final acceptance retry. The owner later explicitly authorized live Gemini checks for the Alfred task; native browser download capture remains owner-deferred. These decisions supersede the earlier pre-v25 checkpoint actions.

**Latest update:** the owner-approved disposable-copy attachment is verified as described above. Phase 2 is **closing, not complete**: the broader acceptance audit found unverified interactions and a money-proposal route that is not connected to the existing Financial Mutation confirmation. For the Alfred task, the repo-root env file was detected, but live `ping` and synthetic demo-client requests both returned Google HTTP 400 (invalid API key); a successful provider answer is not verified. Missing-key, error mapping, and Stop paths were checked locally. Native browser download capture remains owner-deferred. At the original Block 0 audit checkpoint on 2026-10-31, HUD tests passed 9/9 and Master Control tests passed 26/26, with `npm run lint` and `npm run build` also passing. The current HUD suite later passed 42/42; the build retains the existing >500 KB chunk warning.
**Status clarification (2026-10-31):** the Block 0 audit below was posted before independent Phase 3 implementation proceeded. Its statement that Phase 3 Block 1 had not started is historical, not current; see the Phase 3 plan and current handoff. The Phase 2 disposition remains `closing`.

Code blocks below are **reference logic**, not drop-in files. Search the repo, quote the real code, and adapt names, imports, and the camera math to what exists. Do not guess file names or line numbers.

---

## 0. Global rules

1. Edit source files only. No runtime DOM injection.
2. Search first, quote real code, report findings **before** editing.
3. One part per commit, small commits. Run type-check, lint, and build after each (`npm run lint`, `npm run build` from repo root).
4. Do not modify `Master_Control_Bridge.gs`, finance ledger logic, or the Financial Mutation confirmation flow. The owner explicitly authorized a surgical `attachClientServiceNode` handler/schema fix in `engines/master-control/` for Phase 2; no unrelated engine changes are authorized.
5. Do not touch `quarantine/oracle-mmd/`. Oracle internals never enter HUD code, Alfred context, or exported JSON; only a short findings summary may.
6. No layout or link data goes to Sheets or the backend. Zustand store + localStorage only.
7. Never log, print, or commit an API key.
8. Do not claim anything is verified unless you ran it. State how.
9. After each part, post: files changed, what you ran, what you could not verify, open questions.

### 0.1 UI containment rules (from the owner, non-negotiable)

- **Extend, don't replace.** Existing right-click menu items (Lock/Unlock, Alt+Right-Click freeze) stay exactly as they are. Existing filter/view options stay. New items are *added*.
- **Everything nests, collapses, hides when unused.**
  - No menu has more than ~8 top-level items. Everything else lives in submenus (`Edit ▸`, `Arrange ▸`, `Connect ▸`, `View ▸`).
  - Wire filters, legend, and layer toggles live in **one collapsed "Wires ▸" group** inside the *existing* filter/view control.
  - Wire labels, handles, and animations show only on hover or selection (and animations only while an event flows).
  - No new always-visible toolbar, panel, or button.
- **No new UI surface without approval.** For every new UI element, name the existing surface it attaches to in your report. If a new standalone surface seems necessary, stop and ask.

### 0.2 Order of work (one session per block)

| # | Block | Commits |
|---|-------|---------|
| 1 | **Part 0** bottom HUD controls in Galaxy and Solar | 1 |
| 2 | **Part 1** merge new ESC catalogue into Multi-Agent Dispatch and ECS Node tabs | 2 |
| 3 | **Part A** Alfred and Gemini | 2 to 3 |
| 4 | **Part C-core** reusable `ContextMenu`, node menu, Sun menu, canvas menu, shortcuts | 3 to 4 |
| 5 | **Part B1-B3** link model, theme, creation, rendering, default wires | 4 to 5 |
| 6 | **Part B4-B5** events, proposals, persistence, export | 2 to 3 |
| 7 | **Part C-wire** link menu, multi-select menu | 2 |
| 8 | **Verify and report** | 1 |

Wires exist **only in Solar view** for now. Galaxy cards are phase-transition carriers; do not draw wires there.

---

## Part 0: Bottom HUD controls missing in Galaxy and Solar

**Symptom:** the bottom bays (Calendar, Alfred Core, Dossier, Macro Pad) do not appear in Galaxy or Solar views.

**Known context (from `STATUS.md` / progress summary):** the footer is a transparent `pointer-events-none` overlay holding four floating bays that re-enable pointer events; the boot sequence was forced to Stage 4 to bypass an `opacity: 0` hang.

### Investigation (report before editing)

1. Grep for where the bays mount: `Calendar`, `AlfredCore`, `Dossier`, `MacroPad`, `Chassis`, `Bay`, and the boot stage state (`stage`, `bootStage`). Quote the mount point.
2. Determine whether the bays are (a) conditionally rendered by `view`, (b) rendered inside a view-specific parent that unmounts, (c) hidden by z-index or stacking context under the full-bleed canvas, (d) hidden by an `opacity`/stage condition, or (e) positioned off-screen at 762x1366 / 1680x1050.
3. Check whether the bays render in the view that works (Universe or whichever shows them) and diff the condition.

### Fix

Mount the bay chassis **once, at the app shell level, outside any view component**, so view switches never unmount it. Keep `pointer-events-none` on the overlay and `pointer-events-auto` on each bay.

```tsx
// App shell (illustrative)
<div className="fixed inset-0">
  <ViewHost view={view} />            {/* Galaxy / Solar / etc. */}
  <BottomChassis className="pointer-events-none fixed inset-x-0 bottom-0 z-[60]" />
</div>
```

### Acceptance

- Bays visible and clickable in Galaxy, Solar, and the other views.
- Bay state (e.g. Alfred input text) survives switching views.
- Canvas pan, zoom, and drag unchanged.

---

## Part 1: Merge the new ESC catalogue into the original surfaces

**Owner's requirement:** do not keep a second catalogue. Apply the new behavior to the **original Multi-Agent Dispatch drawer** and the **ECS Node tabs**. The new catalogue's good behavior is: nodes spawn **already connected to the project (Sun)**.

### Steps

1. Find and quote: the original Multi-Agent Dispatch drawer (`MultiAgentDispatch.tsx`), the ECS Node tabs, and the new ESC catalogue. List what each does that the others don't.
2. Create **one catalog config** `src/ecs/catalog.ts` consumed by all three entry points (drawer, tabs, canvas "Add node" menu later):

```ts
export type CatalogEntry = {
  serviceId: string;
  label: string;
  nodeType: 'component' | 'agent';
  department?: Department;      // for wire color
  price?: number;               // passes through existing Module C flow only
  tasksToInject?: string[];     // existing field in the drag payload
  defaultLinkTo?: 'sun';        // spawn pre-connected
};
export const CATALOG: CatalogEntry[] = [ /* migrate existing entries, do not invent new ones */ ];
```

3. Make the **original drawer and tabs** read from `CATALOG`, and make spawning (drag-drop *and* any click-to-add) create the node **and** its default link to the Sun via the same `addNodeWithDefaultLink()` helper:

```ts
function addNodeWithDefaultLink(entry: CatalogEntry, pos: Vec2, clientId: string) {
  const node = store.addNode({ ...fromCatalog(entry), position: pos, clientId });
  if (entry.defaultLinkTo === 'sun') {
    store.addLink(makeDefaultLink({ clientId, from: 'sun', to: node.id, kind: 'context', origin: 'default' }));
  }
  return node;
}
```

   The existing drop path (orbit snap, duplicate guard, optimistic vitals, `syncServiceToMasterControl` behind `ENABLE_COMPONENT_PERSISTENCE` and the financial confirmation) must be called **unchanged**. Only add the link creation.

4. **Commit 1:** old surfaces now behave like the new catalogue. **Commit 2:** remove the new catalogue and its dead imports, only after confirming parity. Report anything the old surface could do that was lost.

### Acceptance

- One catalogue file. Dragging from the original drawer spawns a node already wired to the Sun.
- The financial confirmation and duplicate guard behave exactly as before.
- New catalogue component and its menu entry are gone; nothing else regressed.

---

## Part A: Alfred talks to Gemini

### A1. Find existing code (quote it)

Grep `VITE_`, `GoogleGenAI`, `generativelanguage`, `gemini`, `process.env`, and the Alfred Core bay ("Command Alfred..." input).

### A2. Environment and server-side proxy

The current implementation is a Vite server middleware at `/api/alfred`, defined in
`apps/command-hud/vite.config.ts` and handled by `apps/command-hud/server/alfredProxy.ts`.
Vite loads environment values from the repository root with
`loadEnv(mode, repoRoot, '')`, so the Node-side proxy can read unprefixed variables.

Put `GEMINI_API_KEY=...` in the repository-root `.env.local`; never use a `VITE_`
prefix for this secret. Optionally set `GEMINI_MODEL=...`; the default is
`gemini-3.5-flash-lite`. Restart the dev server after changing either value.

The proxy never logs or returns the key. Its startup line reports only whether a
key was found, the selected model, and the root env file path. The Alfred panel
displays the missing variable/file and restart instructions. Provider errors are
shown in plain English with the HTTP status; Stop aborts the in-flight request.

### A3. Gemini SDK

The server-side proxy uses `@google/genai` through `GoogleGenAI`. Keep SDK calls
in `apps/command-hud/server/alfredProxy.ts`; do not move the key or SDK request
into browser code. The request builder always appends Alfred's latest user turn
after the conversation history.

Streaming (`generateContentStream`) is optional; add only if it is a small change. If the installed SDK version differs on `abortSignal` or `.text`, check its types and adapt.

### A4. Alfred panel behavior

- No key: show `No Gemini key found. Add GEMINI_API_KEY to the repo-root .env.local file, then restart the dev server`.
- Keep the last N turns (N = 8) in panel state. Loading state while awaiting. **Stop** button wires to an `AbortController`.
- Errors render `AlfredError.message` with the HTTP status. Never render the key.

### A5. System prompt and context anchoring

```ts
export const ALFRED_SYSTEM = `
You are Alfred, the Command HUD's client-audit assistant.
You answer questions about the selected client, milestones, roadblocks, and gate status, using only the context provided.
You may PROPOSE actions (create task, draft invoice, send email) as structured suggestions.
You never perform actions. Every proposal goes to the human approval flow.
You cannot change contract values and must not say you can.
If the context does not contain the answer, say so.
When proposing, append a fenced block:
\`\`\`proposal
{"type":"create_task"|"draft_invoice"|"send_email","title":"...","detail":"..."}
\`\`\`
`;
```

Context builder: include only name, ID, phase, step, roadblock, deposit status, installed components. For a selected node, add that node and its linked neighbors (via the links slice) with the same field whitelist. Exclude Drive links, emails, and anything not needed. Hard cap (e.g. 4,000 characters), dropping neighbor detail first.

```ts
const ALLOWED = ['name','id','phase','step','roadblock','depositStatus','installedComponents'] as const;
export function buildContext(client, node?, neighbors: Node[] = []) {
  const pick = (o: any) => Object.fromEntries(ALLOWED.filter(k => o?.[k] != null).map(k => [k, o[k]]));
  let ctx = JSON.stringify({ client: pick(client), node: node && pick(node), linked: neighbors.map(pick) });
  return ctx.length > 4000 ? ctx.slice(0, 4000) : ctx;
}
```

**Proposal parsing:** parse ```proposal blocks, validate `type` against an allowlist, and push into the existing pending-changes tray / approval list. Nothing executes. Anything money-related uses the existing Financial Mutation confirmation unchanged.

### A6. Acceptance

- Valid key + restarted server: answer about the selected client.
- No key: the missing-key message.
- Bad key / bad model / quota / offline: readable message with status, never the key.
- Stop button cancels a pending request.

---

## Part B: ECS wires and cross-node functionality

### B1. Data model and config

```ts
// src/ecs/linkKinds.ts
export type Department = 'pamela' | 'oracle' | 'dolores' | 'vala' | 'daisy' | 'core';
export type LinkKind = 'context' | 'dependency' | 'trigger';
export type FlowMode = 'push' | 'pull' | 'sync';
export type Pin = 'top' | 'bottom' | 'left' | 'right';

export type Link = {
  id: string;
  clientId: string;
  fromNodeId: string; fromPin: Pin;
  toNodeId: string;   toPin: Pin;
  kind: LinkKind;
  mode: FlowMode;                 // push | pull | sync
  label?: string;
  enabled: boolean;
  origin: 'default' | 'user';
  defaultKey?: string;            // set for seeded links
  createdAt: number;
};

// Which kinds each node-type pair allows. Ask before adding kinds.
export const ALLOWED_KINDS: Record<string, LinkKind[]> = {
  'agent>agent':      ['context', 'dependency', 'trigger'],
  'agent>core':       ['context', 'trigger'],
  'core>agent':       ['context', 'trigger'],
  'component>agent':  ['context', 'trigger'],
  'component>core':   ['context'],
  'agent>component':  ['context'],
};
export const allowedKinds = (a: string, b: string) => ALLOWED_KINDS[`${a}>${b}`] ?? [];
```

Store slice (Zustand or whatever the store uses; mirror to localStorage under a versioned key, e.g. `szs.links.v1:{clientId}`):

```ts
links: Record<string /*clientId*/, Link[]>;
suppressedDefaults: Record<string /*clientId*/, string[]>; // defaultKeys the user deleted
addLink, removeLink, updateLink, reverseLink, setLinks
```

Selectors (memoized): `linksFor(clientId)`, `neighborsOf(nodeId)`, `isBlocked(link)`.

### B1.1 Wire theme (one file)

Hue = **where it comes from** (source department). Line style and glyph = **what it does**. Red = error only. Gold stays for the Sun and unassigned (matches existing Imperial Gold tracers).

```ts
// src/ecs/wireTheme.ts
export const DEPT_COLOR: Record<Department, string> = {
  pamela:  '#8B5CF6', // violet
  oracle:  '#22D3EE', // cyan
  dolores: '#F59E0B', // amber
  vala:    '#22C55E', // green
  daisy:   '#EC4899', // pink
  core:    '#E0CA3C', // gold (Sun / unassigned)
};
export const KIND_STYLE: Record<LinkKind, { width: number; dash?: string; glyph: 'dot' | 'lock' | 'diamond' }> = {
  context:    { width: 1.5, glyph: 'dot' },
  dependency: { width: 3,   glyph: 'lock' },
  trigger:    { width: 2,   dash: '6 5', glyph: 'diamond' },
};
export const ERROR_COLOR = '#EF4444';
export const MONEY_GLYPH = 'coin'; // shown when the wire can end in a ledger/invoice proposal
export const MAX_ANIMATED = 20;
```

Direction rule: **arrowhead = where data goes**. Chevrons always point toward the receiver.

| mode | Meaning | Look |
|------|---------|------|
| `push` | Source sends | solid chevrons `>>>` toward target |
| `pull` | Receiver requests | hollow chevrons toward the receiver |
| `sync` | Both ways | chevrons both directions `>><<`, arrowheads both ends |

"Reverse direction" in the menu swaps `from`/`to` (and pins). It does not add a mode.

### B1.2 Pre-established department wires (default seeding)

Departments start already wired, as before. Seed per client when the Solar view loads. Defaults are deletable and **never re-created** after deletion (tracked in `suppressedDefaults`).

```ts
// src/ecs/defaultLinks.ts  (all editable; flagged as a draft)
export const DEFAULT_LINKS = [
  { key: 'pamela-sun',  from: 'pamela',  to: 'sun', kind: 'context', mode: 'push', label: 'Legal and vault status' },
  { key: 'oracle-sun',  from: 'oracle',  to: 'sun', kind: 'context', mode: 'push', label: 'Intel summary' },
  { key: 'dolores-sun', from: 'dolores', to: 'sun', kind: 'context', mode: 'sync', label: 'Tasks and Gantt' },
  { key: 'vala-sun',    from: 'vala',    to: 'sun', kind: 'context', mode: 'sync', label: 'Ledger' },
  { key: 'sun-daisy',   from: 'sun',     to: 'daisy', kind: 'context', mode: 'push', label: 'Broadcast feed' },
] as const;

export function seedDefaultLinks(clientId: string, nodeIdByDept: Record<string, string | undefined>) {
  const s = store.getState();
  const existing = new Set((s.links[clientId] ?? []).map(l => l.defaultKey).filter(Boolean));
  const suppressed = new Set(s.suppressedDefaults[clientId] ?? []);
  for (const d of DEFAULT_LINKS) {
    const a = nodeIdByDept[d.from], b = nodeIdByDept[d.to];
    if (!a || !b || existing.has(d.key) || suppressed.has(d.key)) continue;
    s.addLink({ ...newLink(clientId, a, b, d.kind, d.mode), origin: 'default', defaultKey: d.key, label: d.label });
  }
}
```

On delete of a link with `origin === 'default'`, push its `defaultKey` into `suppressedDefaults`. Undo removes it from `suppressedDefaults` again.

### B2. Creating and editing wires

Interaction (all coordinates via the **store camera** and its existing `screenToWorld`; never read positions from the DOM):

```ts
function pinWorldPos(node: Node, pin: Pin): Vec2 {           // from store position + size
  const { x, y, w, h } = node.rect;
  return { top: {x: x+w/2, y}, bottom: {x: x+w/2, y: y+h}, left: {x, y: y+h/2}, right: {x: x+w, y: y+h/2} }[pin];
}

// zoom-compensated hit radius: constant ~14 screen px
const HIT_PX = 14;
function pickPin(worldPt: Vec2, zoom: number, nodes: Node[]) {
  const r = HIT_PX / zoom;
  for (const n of nodes) for (const pin of PINS)
    if (dist(worldPt, pinWorldPos(n, pin)) <= r) return { node: n, pin };
  return null;
}

// dropped on node body: snap to nearest free pin (not already used by a link on this node)
function nearestFreePin(node: Node, worldPt: Vec2, usedPins: Set<Pin>): Pin | null { /* min distance among PINS not in usedPins */ }
```

Validation, returning a reason shown on the red target highlight:

```ts
type Check = { ok: true; kinds: LinkKind[] } | { ok: false; reason: 'self-link' | 'duplicate' | 'incompatible kinds' };
function validateLink(a: Node, b: Node, existing: Link[]): Check {
  if (a.id === b.id) return { ok: false, reason: 'self-link' };
  if (existing.some(l => l.fromNodeId === a.id && l.toNodeId === b.id)) return { ok: false, reason: 'duplicate' };
  const kinds = allowedKinds(a.type, b.type);
  return kinds.length ? { ok: true, kinds } : { ok: false, reason: 'incompatible kinds' };
}
```

Drag flow:
1. `pointerdown` on a pin starts `dragLink = { fromNodeId, fromPin, cursorWorld }` (transient UI state, not persisted).
2. `pointermove` updates `cursorWorld`; render a live cubic Bezier from the pin to the cursor. Valid targets highlight, invalid show red with the reason.
3. `pointerup` on a valid pin or node body: if `kinds.length > 1`, show a small kind picker (anchored to the drop point); otherwise use the single kind. Default `mode` = `push`. Create through the command system.
4. `pointerup` on empty canvas: open the **existing canvas menu** with "Add node here and connect" (nested submenu from `CATALOG`).
5. `Esc` cancels the drag. Clicking a wire selects it; `Delete` removes it.

Each wire renders a second, wide, transparent hit path (`stroke="transparent" stroke-width="16" pointer-events="stroke"`) so thin lines are easy to click.

**Commands and undo.** First check whether a command/undo system exists (`STATUS.md` lists "ECS store and command system" as queued, so it may not). If none, add a minimal one that Milestone 2 can later absorb:

```ts
type Command = { label: string; do(): void; undo(): void };
const past: Command[] = [], future: Command[] = [];
export const run = (c: Command) => { c.do(); past.push(c); future.length = 0; };
export const undo = () => { const c = past.pop(); if (c) { c.undo(); future.push(c); } };
export const redo = () => { const c = future.pop(); if (c) { c.do(); past.push(c); } };
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;
```

Covered by commands: link create / delete / kind change / reverse / label / enable, node delete (with its links and `suppressedDefaults` changes), node duplicate. Deleting a node deletes its links in the **same** command so one undo restores both.

### B3. Rendering

```ts
// Cubic Bezier between pins; control handles extend along each pin's outward normal
const NORMAL: Record<Pin, Vec2> = { top:{x:0,y:-1}, bottom:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
function linkPath(a: Vec2, pa: Pin, b: Vec2, pb: Pin) {
  const d = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
  const c1 = { x: a.x + NORMAL[pa].x * d, y: a.y + NORMAL[pa].y * d };
  const c2 = { x: b.x + NORMAL[pb].x * d, y: b.y + NORMAL[pb].y * d };
  return `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
}
```

- Links render in a layer **below nodes, above the grid**, reading positions from the store (including the Sun) so they follow drags.
- Memoize each path by `(fromRect, toRect, pins)`. Cull links whose bounding box does not intersect the viewport (world-space rect from the camera).
- **States:** idle (static), active (animated chevrons while an event flows), blocked (dependency whose source is not done: muted plus lock glyph), error (red).
- Color from `DEPT_COLOR[sourceDepartment]`; style from `KIND_STYLE[kind]`; midpoint glyph from kind, plus the coin glyph when the wire can end in a ledger/invoice proposal (derived from the rules table, `moneyGate: true`).
- Arrowhead at the target via SVG `<marker>` (a second at the source for `sync`).
- Chevron animation, cheap and with no per-frame JS:

```tsx
<g className="flow" aria-hidden>
  {[0, 0.66, 1.33].map(delay => (
    <g key={delay}>
      <path d="M-4,-4 L2,0 L-4,4" fill={mode==='pull' ? 'none' : color} stroke={color} />
      <animateMotion dur="2s" begin={`${delay}s`} repeatCount="indefinite" rotate="auto">
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </g>
  ))}
</g>
```

  For `sync`, add a second set with `keyPoints="1;0" keyTimes="0;1" calcMode="linear"`. Only mount `.flow` when the link is `active` (an event is flowing) or selected. Cap concurrent animations at `MAX_ANIMATED`; beyond that, animate only the selected node's wires. Honor `prefers-reduced-motion` (static glyph instead).
- **Level of detail:** zoomed out, thin color lines only; zoomed in, glyphs and labels on hover.
- **Selection:** selecting a node highlights its linked neighbors and dims the rest (lines **and** animations). Clear on background click.
- **Filter/legend:** one collapsed "Wires ▸" group inside the existing filter/view control with department and kind toggles and a small legend. Collapsed by default.

### B4. Cross-node events (proposals only)

```ts
// src/ecs/events.ts
export type HudEvent = {
  type: 'msa.signed' | 'sweep.complete' | 'component.installed' | 'milestone.done' | 'invoice.paid' | 'task.overdue';
  sourceNodeId: string; clientId: string; payload?: Record<string, unknown>;
};

const MAX_DEPTH = 3;
let firedThisTick = new Set<string>();           // `${linkId}:${eventType}`
const resetTick = () => queueMicrotask(() => { firedThisTick = new Set(); });

export function publish(ev: HudEvent, depth = 0) {
  if (depth > MAX_DEPTH) return console.warn('[events] max depth reached', ev.type);
  resetTick();
  for (const link of linksFrom(ev.sourceNodeId)) {
    if (!link.enabled) continue;
    const key = `${link.id}:${ev.type}`;
    if (firedThisTick.has(key)) continue;        // no re-fire on same link in one tick
    firedThisTick.add(key);
    for (const rule of RULES.filter(r => r.status === 'approved' && matches(r, ev, link))) {
      logEvent({ source: ev.sourceNodeId, target: link.toNodeId, kind: link.kind, type: ev.type, t: Date.now() });
      markLinkActive(link.id);                    // drives chevron animation, auto-clears after ~2s
      rule.handle({ ev, link, propose, unblock });
    }
  }
}
```

**Rules table, editable config. Everything starts as `suggested`; only `approved` rules fire. Confirm with the owner before flipping any to `approved`.**

```ts
// src/ecs/rules.ts
export const RULES: Rule[] = [
  { id: 'pamela-msa-unblocks-vala',  status: 'suggested', on: 'msa.signed',          from: 'pamela',  kind: 'dependency', to: 'vala',    effect: 'unblock', note: 'Unblocks invoice drafting' },
  { id: 'pamela-msa-kickoff',        status: 'suggested', on: 'msa.signed',          from: 'pamela',  kind: 'trigger',    to: 'dolores', effect: 'propose', proposal: 'create_tasks' },
  { id: 'component-installed',       status: 'suggested', on: 'component.installed', from: 'component', kind: 'trigger',  to: 'dolores', effect: 'propose', proposal: 'create_tasks' },
  { id: 'component-ledger',          status: 'suggested', on: 'component.installed', from: 'component', kind: 'trigger',  to: 'vala',    effect: 'propose', proposal: 'ledger_increment', moneyGate: true },
  { id: 'oracle-sweep-context',      status: 'suggested', on: 'sweep.complete',      from: 'oracle',  kind: 'context',    to: '*',       effect: 'context', note: 'Summary only, never Oracle internals' },
  { id: 'milestone-invoice',         status: 'suggested', on: 'milestone.done',      from: 'dolores', kind: 'trigger',    to: 'vala',    effect: 'propose', proposal: 'draft_invoice', moneyGate: true },
  { id: 'milestone-nurture',         status: 'suggested', on: 'milestone.done',      from: 'dolores', kind: 'trigger',    to: 'daisy',   effect: 'propose', proposal: 'nurture_step' },
  { id: 'paid-thankyou',             status: 'suggested', on: 'invoice.paid',        from: 'vala',    kind: 'trigger',    to: 'daisy',   effect: 'propose', proposal: 'send_email' },
  { id: 'paid-next-phase',           status: 'suggested', on: 'invoice.paid',        from: 'vala',    kind: 'trigger',    to: 'dolores', effect: 'propose', proposal: 'unlock_next_phase' },
  { id: 'overdue-roadblock',         status: 'suggested', on: 'task.overdue',        from: 'dolores', kind: 'trigger',    to: 'daisy',   effect: 'propose', proposal: 'client_checkin' },
];
```

Handler contract (**hard rules**):
- `propose()` only creates a **pending proposal** in the existing pending-changes tray / Alfred approval list. It never sends, creates tasks, drafts or sends invoices, or writes the ledger.
- Any proposal with `moneyGate: true` is routed through the existing Financial Mutation confirmation **unchanged**; the handler must not call ledger code directly.
- `unblock` only flips a derived UI flag (`isBlocked`); it does not write anywhere.
- Each event is logged (source, target, kind, type, time) to the console or a collapsed dev log (no new always-visible panel).
- Planet View (later) will publish the same events from the same store; keep `publish` UI-agnostic.

**Dependency state:** `isBlocked(link) = link.kind === 'dependency' && !doneFlags[link.fromNodeId]`, derived, not stored.

### B5. Persistence and export

- Persist per client to localStorage (`szs.links.v1:{clientId}`) with a `version` field; load on client switch; survive reload.
- Export/Import JSON from an existing menu (put it under `Advanced ▸`, not a new button). Shape:

```json
{ "version": 1, "clientId": "...", "exportedAt": 0, "links": [ /* Link[] */ ], "suppressedDefaults": [] }
```

  Validate on import (reject unknown kinds, unknown node IDs, duplicates); never import event logs or Oracle content.

### B6. Acceptance

- Departments appear pre-wired with department colors and push/pull/sync chevrons.
- Wire Pamela to Vala and Dolores to Daisy by dragging pins; wires follow node and Sun drags.
- `Delete` or right-click removes a wire; undo restores it; reload keeps wires.
- A `milestone.done` test event (from a dev-only trigger) produces proposals in the pending tray with **no** send, task, invoice, or ledger write.
- Event loops are blocked (max depth, one fire per link per tick).

---

## Part C: Context menus (extend, never replace)

### C0. Reusable component

One `ContextMenu` rendered via portal to `document.body`.

```ts
export type MenuItem = {
  id: string; label: string; icon?: ReactNode; shortcut?: string;
  disabled?: boolean; disabledReason?: string;   // shown as tooltip
  danger?: boolean; separator?: boolean;
  submenu?: MenuItem[];
  onSelect?: () => void;
};
```

Behavior:
- Opens at the cursor, flips to stay in the viewport:

```ts
function placeMenu(x: number, y: number, w: number, h: number) {
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8;
  return { left: Math.max(pad, Math.min(x, vw - w - pad)), top: Math.max(pad, Math.min(y, vh - h - pad)) };
}
```

  Submenus flip to the left side when there is no room on the right.
- Closes on outside click, `Esc`, scroll, window blur.
- `role="menu"` / `role="menuitem"`; arrow-key navigation; Right Arrow opens a submenu, Left Arrow closes it; hover opens submenus; disabled items skip focus-activation but show `disabledReason`.
- Maximum ~8 top-level items per menu; everything else is nested.

**Builders extend, not replace:** keep the existing Lock/Unlock builder output as the first item(s) and append new items after it.

```ts
export function buildNodeMenu(ctx): MenuItem[] {
  return [
    ...existingLockItems(ctx),                                   // unchanged
    { id: 'edit', label: 'Edit', submenu: [
        { id: 'rename', label: 'Rename label' },
        { id: 'dup', label: 'Duplicate', shortcut: 'Ctrl+D' },
        { id: 'copyId', label: 'Copy node ID' } ] },
    { id: 'arrange', label: 'Arrange', submenu: [
        { id: 'front', label: 'Bring to front' }, { id: 'back', label: 'Send to back' },
        { id: 'rsize', label: 'Reset size' },      { id: 'rpos', label: 'Reset position' } ] },
    { id: 'focus', label: 'Focus on this node', shortcut: 'F' },
    { id: 'connect', label: 'Connect to…', submenu: validTargets(ctx).map(toConnectItem) },
    { id: 'disconnect', label: 'Disconnect', submenu: [...wiresOf(ctx).map(toDisconnectItem), { id: 'all', label: 'Disconnect all', danger: true }] },
    { id: 'dispatch', label: 'Dispatch agent…', submenu: ['Alfred','Oracle','Pamela','Dolores','Vala','Daisy'].map(toDispatch) },
    ...(hasLinks(ctx) ? [{ id: 'open', label: 'Open links', submenu: openLinkItems(ctx) }] : []),
    { id: 'sep', label: '', separator: true },
    { id: 'delete', label: 'Delete', shortcut: 'Del', danger: true },
  ];
}
```

### C1. Node menu rules

- **Delete** is undoable and removes the node's links in the same command.
- For a service-component node that earlier changed Contract Value or created Google Tasks, Delete **only removes it from the canvas**. Show toast: `Removed from canvas. Ledger and Google Tasks were not changed.` Do not touch the ledger or backend. **Do not build an "uninstall" flow**; ask the owner first (it would need the Financial Mutation confirmation).
- "Dispatch agent…" passes the node as context to that agent.

### C2. Sun menu

Keep: Lock/Unlock. Add: Recenter, Focus, Connect to…, Dispatch agent…, `Open client links ▸`, Copy client ID. **Delete shown disabled** with `disabledReason: 'The core deliverable cannot be deleted.'`

### C3. Link menu (built in the wire block)

Delete wire, `Edit ▸` (Edit label, Change kind ▸, Change mode ▸), Reverse direction, Enable/Disable.

### C4. Canvas menu

Top level (≤8): `Add node ▸` (from `CATALOG`, placed at the cursor in world coordinates via `screenToWorld`), Paste (if copied), Select all, `View ▸` (Fit all, Recenter `Home`, Toggle grid, Toggle snap-to-orbit, Toggle satellites), `Arrange ▸` (Auto-arrange satellites around the Sun, Lock all, Unlock all), Undo, Redo (disabled with reason when empty). Add the new view toggles to the **existing** view/filter options rather than a second control.

### C5. Multi-selection menu

Marquee or `Shift+click`. Menu: `Align ▸` (left, right, top, bottom, center), `Distribute ▸`, Lock/Unlock selection, Duplicate, Delete selected (one confirm if more than one node). Group move must keep working.

### C6. Keyboard shortcuts

`Delete`/`Backspace` delete selection, `Ctrl+D` duplicate, `Ctrl+A` select all, `L` toggle lock, `F` focus, `Esc` clear selection or close menu, `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo. These must not break the existing RTS hotkeys (`Ctrl+[1-9]`, `Alt+[1-9]`).

```ts
function shouldIgnoreShortcut(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.closest('[data-alfred-input]'));
}
```

Add `data-alfred-input` to the Alfred field so the exception is explicit.

### Acceptance

- Right-click on a node, the Sun, a wire, empty canvas, and a multi-selection each show the right menu.
- Existing Lock/Unlock and Alt+Right-Click still work exactly as before.
- Sun Delete is disabled with its reason.
- Deleting a node and its wires is undoable.
- Menus stay inside the viewport at 762x1366 and 1680x1050.
- Lock, drag, zoom, and pan behave as before.

---

## Verify and report

Use Playwright if available; otherwise write a manual script. Report **pass/fail with evidence** (command output, screenshot, or console excerpt) for each:

| Area | Checks |
|------|--------|
| Part 0 | Bays visible in Galaxy and Solar; state survives view switch |
| Part 1 | One catalogue; drawer spawn is pre-wired; financial confirmation unchanged |
| Alfred | With key, without key, bad key, bad model, offline, Stop button |
| Wires | Default seeding; create; drag-follow (including Sun); delete; undo; reload-persist; suppressed default not re-created; export/import |
| Events | Test event produces a proposal in the tray with no side effects; loop guard; money proposals hit the existing confirmation |
| Menus | Every menu type; viewport clamp at both resolutions; keyboard navigation; disabled-reason tooltip |
| Shortcuts | All shortcuts, including the input/Alfred focus exception, and RTS hotkeys unaffected |
| Regression | Lock, drag, resize, zoom, pan, orbit snap, duplicate-module guard |

## Owner decisions (resolved; do not reopen without new information)

| Question | Decision |
|----------|----------|
| Should any `suggested` rules become `approved`? | No; all remain suggestions. |
| Should component uninstall reverse ledger changes? | No, not until there is a demonstrated need. Do not change the Financial Mutation flow. |
| Pull chevrons: hollow or reversed? | Hollow; direction still points toward the receiver. |
| Which existing surface hosts wire controls? | Multi-Agent Dispatch Wires tab; AlfredDock remains dormant. |
| Is a minimal link undo model acceptable until the command system exists? | Yes. |

These decisions are recorded in `docs/active/OWNER_TODO_CHECKLIST.md` (D1-D5). D6-D19 in that checklist are separate Phase 3 decisions.

## Final report template (per part)

```
Part:
Files changed:
What I ran (commands + results):
What I could not verify:
New UI surfaces attached to (existing surface names):
Open questions:
```

## Block 0 Closeout Audit (2026-10-31)

**Disposition:** Phase 2 remains in `docs/active/` with status `closing`. The service-attachment acceptance is complete, but the wider Phase 2 acceptance is not. No Phase 3 Block 1 work has started.

| Item | Status | Evidence (command, file, test, screenshot) | What remains |
|---|---|---|---|
| Part 0 — bottom HUD controls | partial | Local browser checks saw the chassis in Galaxy and Solar at 762x1366; Alfred draft text survived a view switch. | Verify visibility/clickability in other screens and the complete pan/zoom/drag regression. |
| Part 0 acceptance — bays visible/clickable in Galaxy, Solar, and other views | partial | Galaxy and Solar visibility checked in the local browser. | Other views and clickability were not fully evidenced. |
| Part 0 acceptance — bay state survives view switches | done | Alfred input text remained after switching away and back in the local browser. | None for the tested view switch. |
| Part 0 acceptance — canvas pan, zoom, and drag unchanged | partial | Canvas interactions were exercised during local checks. | No complete before/after regression record for all three behaviors. |
| Part 1 — shared service catalog | partial | `src/ecs/catalog.ts` is the shared source; browser checks covered the service catalog, demo drop, and default Sun wire. | Verify every legacy entry point and parity behavior. |
| Part 1 acceptance — original drawer spawn is pre-wired | done | Browser drop produced a node with its default Sun connection; `ProjectWorkbenchView.tsx` uses `addNodeWithDefaultLink`. | None for the tested service. |
| Part 1 acceptance — financial confirmation and duplicate guard unchanged | partial | The authorized C-107 attachment completed through the confirmation path and was read back from the disposable copy. | Duplicate-guard behavior was not independently re-tested in this audit. |
| Part 1 acceptance — new catalog UI removed and no regressions | done | Shared catalog is used by the drawer and workbench; browser checks covered the catalog and drop. | None identified in the checked paths. |
| Part A — browser-key implementation design | superseded | The server-side Alfred proxy replaces the browser-exposed `VITE_GEMINI_API_KEY` design; proxy coverage is in `server/alfredProxy.test.ts`. | Do not reintroduce a browser-bundled key. |
| Part A acceptance — valid provider key returns an answer | blocked-external | The repo-root key was detected, but live `ping` and synthetic demo-client requests returned Google HTTP 400 (invalid API key); no provider answer was returned. | Owner must verify or replace the key in repo-root `.env.local`, restart Vite, and retry. Never share the key. |
| Part A acceptance — missing key is reported safely | done | Proxy tests cover missing configuration; a local HUD check confirmed the `.env.local`/`GEMINI_API_KEY`/restart guidance. | None for the tested paths. |
| Part A acceptance — bad key/model, quota, and offline errors | partial | Proxy tests cover 400/403/404/429/network mapping and redaction. A disposable invalid key returned the expected HTTP 400. A `GEMINI_MODEL=nonexistent` server was started, but the invalid key caused HTTP 400 before the provider could validate the model. | Retry the model check after a valid key is available. |
| Part A acceptance — Stop cancels a pending request | done | Stop aborted a delayed local request and displayed `Stopped.` | None for the tested local path. |
| Part B1 — link data model and selectors | done | `src/ecs/links.ts`, `src/ecs/links.test.ts`; current HUD test suite passed 42/42 on 2026-10-31. | None identified in the audited requirements. |
| Part B1.1 — wire theme and visual encoding | done | Local browser checks exercised department/kind/legend filters and wire rendering. | None identified in the audited requirements. |
| Part B1.2 — default wires and suppressed defaults | done | Default wires checked in the local browser; unit test confirms deleted defaults remain suppressed. | None identified in the audited requirements. |
| Part B2 — wire creation, validation, editing, and undo | done | Browser checks exercised pin drag, kind picker, edits, and Undo. | None identified in the audited interactions. |
| Part B3 — rendering, motion, and selection | partial | Browser checks covered paths following nodes and the Sun, reduced-motion behavior, selection dimming, and responsive rendering. | Active event-flow fidelity and viewport culling are not fully evidenced. |
| Part B4 — event engine and proposal-only handlers | partial | `src/ecs/events.test.ts` verifies depth blocking, tick deduplication, suggested-rule inertness, and money-gate flags; the development preview created a proposal without API requests. | Actual domain-event integration is not fully verified; production rules remain suggested. |
| Part B4 — money proposals routed through the existing Financial Mutation confirmation | blocked-external | The pending tray marks money proposals as gated, but has no approval action or route to the existing confirmation. No finance behavior was changed. | Needs an approved integration path or an owner decision to defer this acceptance. |
| Part B5 — per-client persistence and export/import | done | `src/ecs/links.test.ts` covers persistence/suppression and import validation; the local browser round-tripped exported links. | Native browser download capture was explicitly deferred by the owner. |
| Part B6 — wire acceptance | partial | Local browser and unit checks covered defaults, wire interaction, persistence, proposals, and loop guards. | Specific named handoff edges and delete/right-click/undo acceptance are not all independently evidenced. |
| Part B6 acceptance — departments pre-wired with color and flow modes | partial | Default wires and department/kind rendering were checked locally. | The complete color and push/pull/sync presentation was not captured for every department. |
| Part B6 acceptance — Pamela/Vala and Dolores/Daisy pin drags; wires follow moves | partial | Pin drag and path-following for node/Sun movement were checked. | The two specifically named endpoint pairs were not both recorded. |
| Part B6 acceptance — delete/right-click, undo, and reload persistence | partial | Wire editing/Undo and reload persistence were exercised. | The complete delete-by-context-menu and undo-restoration sequence was not independently recorded. |
| Part B6 acceptance — milestone preview creates proposals without side effects | done | Development-only preview produced a pending draft-invoice proposal; no `/api/` requests occurred. | No real business event or financial write was exercised. |
| Part B6 acceptance — event loops blocked | done | `src/ecs/events.test.ts` verifies maximum depth and same-tick deduplication/reset. | None for the tested event engine. |
| Part C-core — reusable menus and shortcuts | partial | Local browser checks covered menu types, keyboard navigation, disabled Sun Delete, and viewport bounds. | Several specified menu actions, shortcuts, and focus exceptions remain unverified. |
| Part C0 — reusable portal menu behavior | done | Menu keyboard navigation and bounds were exercised at 762x1366 and 1680x1050. | None for the tested behaviors. |
| Part C1 — node menu deletion and dispatch behavior | partial | Node menus and selection/duplicate Undo were exercised. | Undoing node-plus-link deletion and the service-removal notice were not verified. |
| Part C2 — Sun menu | partial | Sun menu was checked; Delete was disabled with the correct reason. | Recenter, connect, dispatch, open-links, and copy-ID actions were not all verified. |
| Part C3 — wire menu | partial | Wire context menu was checked locally. | The full edit/reverse/enable menu set was not verified. |
| Part C4 — canvas menu | partial | Canvas menu bounds and keyboard navigation were checked. | All view/arrange submenus and actions were not individually verified. |
| Part C5 — multi-selection menu | partial | Shift-click, Ctrl+A, grouped movement/Undo, duplicate/Undo, align, and lock/unlock were checked. | Delete-selected confirmation and all distribution options were not verified. |
| Part C6 — shortcuts and focus exceptions | partial | Alfred-input Ctrl+A, Ctrl+1/2, and Alt+1/2 were checked. | Every listed shortcut and all input-focus exceptions were not verified. |
| Part C-wire — wire and multi-selection menus | partial | Wire and multi-selection menus and several selection operations were checked. | Full menu actions and destructive-operation Undo paths remain unverified. |
| Part C acceptance — correct menu on node, Sun, wire, canvas, and multi-selection | done | Each of the five context-menu types was opened in the local browser. | None for menu presence. |
| Part C acceptance — Lock/Unlock and Alt+Right-Click preserved | partial | Lock/Unlock behavior was exercised. | Alt+Right-Click preservation was not explicitly re-tested. |
| Part C acceptance — Sun Delete disabled with reason | done | Local browser confirmed disabled Delete and its reason. | None. |
| Part C acceptance — node and links delete as one undoable command | partial | Duplicate and grouped-move Undo were exercised. | Node-plus-links deletion/Undo was not verified. |
| Part C acceptance — menu viewport bounds at both target resolutions | done | Local browser checks at 762x1366 and 1680x1050. | None for the tested dimensions. |
| Part C acceptance — Lock, drag, zoom, and pan unchanged | partial | Lock and canvas interactions were exercised. | The full regression set was not independently evidenced. |
| Verify/report — Part 0 | partial | Local chassis visibility and state-retention checks. | Remaining Part 0 evidence listed above. |
| Verify/report — Part 1 | partial | Shared catalog/drop and attachment confirmation path checked. | Duplicate guard and full entry-point parity remain. |
| Verify/report — Alfred | partial | Proxy mocks, missing-key guidance, 400/404/network panel messages, and Stop behavior checked. Live provider requests returned HTTP 400 because the key was rejected. | Successful Gemini response remains unverified until the owner updates the key. |
| Verify/report — wires | partial | Default seeding, create/edit, movement, Undo, persistence, and import/export exercised. | Full deletion, named endpoint pairs, culling, and active event animation remain. |
| Verify/report — events | partial | Proposal preview and loop guards checked; no API requests from the preview. | Existing Financial Mutation confirmation route remains blocked. |
| Verify/report — menus | partial | Menu types, viewport bounds, keyboard navigation, and disabled reason checked. | Some actions and destructive Undo paths remain. |
| Verify/report — shortcuts | partial | Selected shortcuts and focus exception checked. | Not every shortcut/focus case was tested. |
| Verify/report — regression | partial | Several canvas and module interactions were checked. | Full lock/drag/resize/zoom/pan/orbit-snap/duplicate-guard matrix remains incomplete. |

### Block 0 evidence and remaining work

- **Validation run 2026-10-31:** `npm run lint` passed; `npm test` passed 9/9; `npm run build` passed with the existing >500 KB chunk warning; `node --test engines/master-control/test/pipeline-phase-gate.test.mjs engines/master-control/test/master-control-router.test.mjs` passed 26/26. The Master Control tests emitted existing mock `insertSheet` warnings.
- **Unavailable Phase 3 input:** `docs/PARKING_LOT.md` is absent. The private template link registry exists under `docs/private/`, is ignored and untracked, and was not opened, quoted, or printed.
- **Needs owner:** decide whether to defer the money-proposal confirmation acceptance or provide an already-approved route into the existing Financial Mutation confirmation. No change to finance behavior is authorized by this audit.
- **Alfred:** live Gemini requests were owner-authorized, but both requests returned HTTP 400 because Google rejected the configured key; successful provider behavior remains blocked until the owner verifies/replaces the key. Native browser download capture was explicitly deferred by the owner.
- **Archive:** not archived; partial and blocked items remain. Keep this plan in `docs/active/` with status `closing`.
