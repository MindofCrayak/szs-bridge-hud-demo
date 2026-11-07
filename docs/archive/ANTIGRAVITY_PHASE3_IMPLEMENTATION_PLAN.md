> **Superseded by Master Plan v3.1** ([`docs/archive/SZS_HUD_MASTER_PLAN_v3.1.md`](./SZS_HUD_MASTER_PLAN_v3.1.md), itself completed 2026-11-05).

# SZS Command HUD: Phase 3 Implementation Plan (for Antigravity)

**Status:** in progress; Blocks 1–7 and 9 have implementation closeouts, but Phase 3 is not complete. Block 8 needs sanitized owner inputs; Block 10 still has unverified regressions and live-mode checks. Phase 2 remains `closing`. **Last verified:** 2026-11-02. **Place at:** `docs/active/ANTIGRAVITY_PHASE3_IMPLEMENTATION_PLAN.md`
**Current handoff:** The current live-read, schema, data-standardization, and local validation status is in [`PROGRESS.md`](./PROGRESS.md). The Working Copy already matches the canonical schema; no Master Control schema edit/deployment is needed. The latest local validation-source and year-suffixed client-ID work is not deployed and no live IDs/records were changed. The AccountPhase write remains blocked pending diagnosis of the approved-list rejection. Use current status in `PROGRESS.md` over older dated snapshots in this plan.
**Phase 2 dependency:** `ANTIGRAVITY_PHASE2_IMPLEMENTATION_PLAN.md` remains active and `closing`, not superseded or archived. Block 0's audit report was posted before independent Phase 3 work proceeded; remaining Phase 2 acceptance is tracked in that plan.
Repo: `MindofCrayak/szs-bridge-HUD`, app at `apps/command-hud/` (React + TypeScript + Vite + Tailwind, dev origin `http://127.0.0.1:3002`).

Code blocks are **reference logic**, not drop-in files. Search the repo, quote real code, and adapt names and imports to what exists. Do not guess file names or line numbers.

---

## 0. Read first, in this order

| # | File | Where it should be | Role |
|---|---|---|---|
| 1 | `HUD_HANDOFF_SUMMARY.md` | `docs/` | Project context, constraints, owner decisions |
| 2 | `ANTIGRAVITY_PHASE2_IMPLEMENTATION_PLAN.md` | `docs/active/` | The plan Block 0 audits and closes |
| 3 | `SZS_DB_LOGIC_AND_PERSONA_CHARTER.md` | `docs/` | **New source.** Why and how of the databases, personas, events, Police, relay |
| 4 | `SZS_SCHEMA_CONTROL_SPEC.md` | `docs/` | **New source.** Schema registry, change log, alert shape, ID patterns |
| 5 | `OWNER_TODO_CHECKLIST.md` | `docs/active/` | Owner decisions (Part B) and what the owner is doing in Apps Script and sheets |
| 6 | `alfred-grounding-document-v7.md`, `copilot-instructions-v7.md` | `docs/` | Persona and architecture grounding. **Where they conflict with the Charter (Daisy's role, the "90/10" rule), the Charter wins.** |
| 7 | `szs-master-template-link-registry.md` | `docs/private/` (**gitignored**) | **Reference only. Never commit, quote, or print its contents.** |

If a file is missing, say so in your first report and continue with what exists.

---

## 1. Global rules

All Phase 2 global rules (0 and 0.1) still apply. Restated and extended:

1. Edit source files only. No runtime DOM injection.
2. Search first, quote real code, report findings **before** editing.
3. One part per commit, small commits. Run `npm run lint` and `npm run build` after each. Run tests if a test runner exists.
4. **Do not modify** `Master_Control_Bridge.gs`, `engines/master-control/`, finance ledger logic, or the Financial Mutation confirmation flow. **Apps Script changes are the owner's job** (see `OWNER_TODO_CHECKLIST.md`). If HUD work seems to need an engine change, write a proposal in `docs/proposed/` and stop on that item.
5. Do not touch `quarantine/oracle-mmd/`. Oracle internals never enter HUD code, Alfred context, or exports. Only a short findings summary may.
6. No layout, link, or event data goes to Sheets or the backend. Store plus localStorage only.
7. **Secrets and identifiers.** Never log, print, commit, or put in a report: API keys, bearer tokens, Apps Script IDs, deployment IDs or URLs, spreadsheet, document, or folder IDs. Before your first commit, run a scan for these (token-like strings, `AKfycb`, 44-character IDs, `VITE_API_SECRET_KEY`) over tracked files and report **counts only**. If the link registry is in a tracked path, **stop, move it to `docs/private/`, add it to `.gitignore`, and tell the owner.**
8. **Do not copy** the COMS or Personality Controls sheet exports, or any client or contact data, into the repo. Use obviously fake fixtures (for example `Example Co`, `ZZZ`).
9. **Proposal-only.** Every agent and event handler only creates proposals. Effective autonomy in the HUD is the lower of the persona sheet's tier and the HUD cap (proposal-only). Crisis overrides are staged states, never automatic.
10. **Undecided owner questions:** use the default stated in `OWNER_TODO_CHECKLIST.md` Part B, and list every default you used in your report.
11. Do not claim anything is verified unless you ran it. State what you ran.
12. **UI containment (Phase 2 section 0.1) holds.** Extend, do not replace. Everything nests and collapses. The notification ribbon (Block 5) is the only new always-visible element and only if owner decision D6 is approved. Name the existing surface it attaches to.
13. Work only on the current block. Out-of-scope findings go in `docs/PARKING_LOT.md`.

---

## 2. Order of work

| Block | Work | Commits |
|---|---|---|
| **0** | Phase 2 audit, completion, and archive | as needed, then 1 |
| **1** | Docs intake and housekeeping | 1 |
| **2** | Data contract and adapter layer | 2 to 3 |
| **3** | Event engine and proposals | 2 to 3 |
| **4** | Persona config and Staff Meeting | 2 to 3 |
| **5** | Notification ribbon and department menus | 2 to 3 |
| **6** | Relay wires (two layers) | 1 to 2 |
| **7** | Multi-project model and addendum proposal (model only) | 1 to 2 |
| **8** | Catalog validation | 1 |
| **9** | Schema awareness in the HUD | 1 to 2 |
| **10** | Verify and report | 1 |

Stop and post a report after Block 0, and after every block. **Do not start Block 1 until Block 0's closeout report is posted.**

---

## Block 0: Phase 2 audit, completion, archive

**Goal:** make sure everything in Phase 2 is addressed; finish what is not; archive Phase 2; only then execute Phase 3.

### Steps

1. Read the **entire** Phase 2 plan, including every part and the open questions. Also read `STATUS.md`, `HUD_HANDOFF_SUMMARY.md` section 5, and `docs/PARKING_LOT.md`.
2. Build an **audit table**, one row per Phase 2 item (Part 0, Part 1, Part A, Part C-core, Part B1 to B6, Part C-wire, Verify and report, and each acceptance bullet):

   | Item | Status (`done` / `partial` / `missing` / `superseded` / `blocked-external`) | Evidence (command, file, test, screenshot) | What remains |
   |---|---|---|---|

   Mark `done` **only with evidence you ran this session.** Treat the previous agent's self-report as unverified.
3. Specifically re-check the known issues: bottom bays missing in Galaxy and Solar; duplicate catalogue; default department wires; layout overflow (fix by removing fixed minimums and fitting the camera, **no CSS scale**); Alfred key and proxy paths; undo system (check whether one exists before building a minimal one); wire persistence, undo, export and import; context menus and shortcuts; Playwright or manual verification.
4. **Part A is superseded in design.** The server-side proxy reading `GEMINI_API_KEY` (no `VITE_` prefix) replaces the browser-side `VITE_GEMINI_API_KEY` approach, which would expose a secret in the browser. Do not reintroduce a `VITE_` key. Verify with-key, bad-key, bad-model, offline, and Stop paths against the proxy build. Mark Part A `superseded` with that note, and `done` only for the paths you tested.
5. **Complete every `partial` and `missing` item** following Phase 2's own instructions and order (its section 0.2), one part per commit, lint and build after each.
6. Items needing an owner answer (Phase 2 open questions 1 to 5): use the defaults in `OWNER_TODO_CHECKLIST.md` Part B and record them. Items that truly cannot proceed because only the owner can act: mark `blocked-external`, list under **Needs owner**, and continue.
7. **Closeout.** Add a status header to the Phase 2 doc (`Status`, `Last verified`, items done / partial / missing / superseded), a **Closeout** section with the audit table and evidence, and move it to `docs/archive/`. Update `STATUS.md`. Archive only when every item is `done`, `superseded`, or marked `deferred by owner`. If something is `blocked-external`, leave Phase 2 in `docs/active/` with status `closing`, post the report, and continue with blocks that do not depend on it. Archive the moment the last item clears.
8. Post the **Phase 2 Closeout Report** (template in section 4).

### Acceptance

- Audit table complete with evidence; every item has a status.
- `npm run lint` and `npm run build` pass.
- Phase 2 doc archived (or `closing` with a clear Needs owner list).

---

## Block 1: Docs intake and housekeeping

1. Confirm the files in section 0 are in the listed locations. Add `docs/private/` and any inputs folder to `.gitignore`; confirm with `git check-ignore -v` and report the command output.
2. Create or update a `docs/README.md` index linking the Charter, Schema Spec, and this plan, each with a status header (`Status`, `Last verified`).
3. If the v7 docs are tracked in the repo, prepend a short **"Superseded sections"** note pointing to Charter sections 7.4 and 7.5. Do not rewrite their bodies (the owner updates them).
4. Run the secrets scan from global rule 7. Report counts only.

**Acceptance:** index exists; `.gitignore` verified; scan report shows zero tracked secrets or IDs (or you stopped and told the owner).

---

## Block 2: Data contract and adapter layer

**Why:** the HUD must work on mock data now and live data later, and must reject malformed rows instead of crashing. Source: Charter sections 1, 2, 3; Schema Spec sections 4, 5.

1. Check `package.json` for `zod`. If absent, add it (owner decision D13, default yes). Check for a test runner (Vitest); if absent, ask before adding.
2. Create `src/data/contracts.ts` with schemas for: `Client`, `Project` (including `SprintStage` 00 to 09), `FinanceRow` (read model only; no ledger logic), `Alert` (common shape, Schema Spec section 4), `SchemaRegistryRow`, `SchemaChange`.
3. Create **typed ID validators per column** (patterns in Schema Spec section 5). Support current year-suffixed IDs and legacy read compatibility; never infer a legacy ID's type from its shape because `ICA-02` is valid as both a ClientID and a ProjectID.
4. Define a `DataAdapter` interface:

```ts
interface DataAdapter {
  getSnapshot(clientId?: string): Promise<Snapshot>;   // Clients, Projects, FinanceRows
  getAlerts(): Promise<Alert[]>;
  getSchemaRegistry(): Promise<SchemaRegistryRow[]>;
  getSchemaChangeLog(): Promise<SchemaChange[]>;
  status(): 'live' | 'stale' | 'mock' | 'offline';
}
```

5. Implement `MockAdapter` with **fake fixtures** covering: one client in each AccountPhase, one project in each SprintStage, a client with two projects, alerts at each severity for each department, a schema registry with one version mismatch. Implement `LiveAdapter` as a stub that returns a clear "not configured" error unless OAuth is verified live. Select by an env flag.
6. Show adapter status (`live` / `stale` / `mock` / `offline`) on an **existing** status area. Name it in your report; if none exists, stop and ask.
7. Boundary rule: every row from an adapter passes through the schemas; bad rows are rejected with a readable error and surfaced on the Housekeeping badge, never silently dropped.

**Tests (must exist and pass):** ID validators accept and reject the current and legacy examples in Schema Spec section 5; typed validation covers the legacy `ICA-02` ambiguity; schema rejects a row with a missing required field; mock fixtures satisfy their own schemas.

**Block 2 closeout (2026-10-31):** Added Zod contracts and typed ID validators, mock fixtures, a live adapter that explicitly reports the unavailable full API contract, and adapter status on the existing bottom status strip. OAuth is confirmed, but the live snapshot/Finance/schema endpoints and authoritative deployment are not. At this checkpoint, mock was the default; the later local snapshot follow-up below changes the local default when the CSV directory exists. Verified at the time with root `npm run lint`, root `npm run build`, `npm run test --workspace @szs/command-hud` (13/13), and `git diff --check`. The build retains its existing 500 kB chunk-size warning.

### Local CSV snapshot follow-up (2026-10-31; separate read-only task)

- Added `SnapshotAdapter` alongside `MockAdapter` and the unconfigured `LiveAdapter`. `VITE_DATA_MODE=snapshot|mock` selects the local source; snapshot is the default when `apps/command-hud/local-data/` exists.
- Added local CSV normalization and Zod validation for `clients.csv`, `projects.csv`, `finances.csv`, `alerts.csv`, and `services_rates.csv`. Header matching tolerates casing/separators and known naming aliases. Bad rows are skipped with readable reasons; empty/header-only files do not crash.
- Snapshot mode is local/read-only: no sign-in, Google data request, or persistence. Mode and rejected-row details appear in the existing bottom status strip.
- Added tests for header normalization, invalid-row reporting, empty files, realistic IDs, and alert mapping. Current HUD test suite passed 42/42; `npm run lint` and `npm run build` passed on 2026-10-31. The build retains its existing >500 KB chunk warning.
- **Persistent data limitation:** the five CSVs in `apps/command-hud/local-data/` contain headers only (0 loaded / 0 rejected rows per file). This is an empty local snapshot, not evidence that real sheet data is loaded. Populate the five named files from approved exports before comparing HUD values with Master Control.
- **Unreviewed local exports:** untracked CSV exports are present in the repository-root `local_data/` directory. Their contents were not inspected or copied. Do not stage or commit these raw exports; provide only the sanitized catalog inputs in the Phase 3 Block 8 location if they are needed.

---

## Block 3: Event engine and proposals

Source: Charter sections 4, 5, 6, 8.

1. Implement `diffSnapshots(prev, next): HudEvent[]` producing events for: `stage.changed` (SprintStage), `phase.changed` (AccountPhase), `invoice.paid`, `task.overdue`, `component.installed`, `addendum.signed` (stub; source column not yet defined, see Schema Spec seed SCH-0007).
2. Event shape per Charter section 5. **`id` = stable hash of entity + field + version**, so re-diffing the same data never duplicates an event.
3. Add `source` to every event: `user_write`, `police_correction`, `external`, `system`.
4. Add event types `police.corrected` and `police.schema`. **These never trigger wire rules and never animate wires.** They create alerts and badge counts only.
5. After an approved write, wait for a confirming snapshot. If the next snapshot contradicts it, show "Reverted by Police: [reason]" on the node.
6. Rules registry: keep all draft rules `suggested`. Rewrite the draft rules table to match Charter section 8 (relay graph). In particular, Daisy acts on completion and as the router for client-facing sends, not at `milestone.done` or `invoice.paid` by default. Only `approved` rules fire. Loop guard unchanged (depth 3, one fire per link per tick).
7. Proposal shape: `{ id, proposer, eventId, type, surface, effect, requiresMoneyGate, clientFacing, status }`. Proposals with `clientFacing: true` are tagged **"via Daisy"**. Money proposals use the existing Financial Mutation confirmation unchanged.
8. Keep the dev-only event trigger; add triggers for `police.corrected` and `police.schema`.

**Tests:** re-diffing identical snapshots yields zero new events; a Police-sourced diff fires no rule; loop guard blocks depth greater than 3; a `clientFacing` proposal carries the Daisy tag; money proposals set `requiresMoneyGate`.

**Block 3 closeout (2026-10-31):** Implemented deterministic snapshot diffs for account phase, project stage, milestone progress, installed components, and invoice-paid transitions. Every event has an explicit source; Police events create deduplicated Housekeeping alerts without traces or wire activation, and Police-sourced diffs are suppressed from rules. Rewrote the suggested relay registry to match Charter section 8, including Daisy completion/client-facing routing without default milestone or invoice-paid Daisy rules. Client-facing proposals carry the exact `via Daisy` label and proposal-only effect; money proposals retain the Financial Mutation gate. Added developer-only Police correction/schema triggers. `task.overdue` and `addendum.signed` remain event types only: neither source exists in the current typed snapshot, so no transition is inferred. Verified with root `npm run lint`, HUD tests (18/18), root `npm run build`, and `git diff --check`. The build retains its >500 kB chunk-size warning; no live writes were performed.

---

## Block 4: Persona config and Staff Meeting

Source: Charter sections 7 and 9. Do **not** copy the Personality Controls sheet; build config from Charter section 7.3 and the dial values the owner supplies.

1. Create `src/agents/personas.config.ts`, typed with the five layers (Voice, Behavior, Authority, Routing, Grounding). **No document IDs, no links.** Authority includes `sheetTier` and a derived `effectiveAutonomy = min(sheetTier, HUD_CAP)` where `HUD_CAP` is proposal-only.
2. Each persona gets a deterministic `report(snapshot, alerts, proposals)` returning `{ status, bottlenecks, risks, asks }`. No language model in the report. Oracle's report uses summary data only.
3. Alfred Core: add the `Staff Meeting` and `Staff Meeting: [topic]` commands in the existing input (it already carries `data-alfred-input`). The server-side proxy builds the system prompt from the Charter persona text, applies the persona's Wit dial to wording only, calls the reports in v7 order, and Alfred closes with the top 1 to 3 pending proposals as decision gates.
4. **Remove "90/10" from any prompt text.** Replace with the Charter 7.5 wording.
5. Context rules: whitelist and roughly 4,000-character cap unchanged. The prompt receives briefs, never raw rows. No emails, phones, document IDs, or Drive links. Where the schema registry marks a column `pii` or `secret`, exclude it.
6. Crisis overrides: model as **staged states** that appear as proposals awaiting sign-off. Nothing enters one automatically. A Police `BLOCK` alert may propose one.
7. Missing key shows the existing setup message. Never log the key.

**Tests:** prompt payload contains no email pattern, no 44-character ID, no `pii` column; Oracle brief contains no `case_file` fields beyond the summary; `effectiveAutonomy` is `proposal-only` for every persona; Staff Meeting with mock data returns six briefs in order plus 1 to 3 gates; no-key path shows the setup message.

**Block 4 closeout (2026-10-31):** Added typed five-layer persona profiles and Charter dials, deterministic reports in Alfred/Pamela/Oracle/Dolores/Vala/Daisy order, and a server-proxy Staff Meeting path that sends only the six briefs plus up to three pending-proposal gates to the model. The context allowlist excludes schema-classified `pii` and `secret` fields; mock registry fixtures include PII classifications, while the live registry remains unavailable through the current API. The prompt applies Wit to wording only and excludes email, URL, 44-character ID, and raw Oracle case-file data. Police BLOCK events can create an explicit staged crisis proposal requiring sign-off; no crisis state is activated automatically. Verified with root `npm run lint`, HUD tests (24/24), root `npm run build`, and `git diff --check`. No Gemini/provider request or live write was made. The build retains its >500 kB chunk-size warning.

---

## Block 5: Notification ribbon and department menus

Source: Charter section 10. **Requires owner decision D6 (new always-visible surface).** Default host: the existing top bar. If D6 is not approved, build the data layer only and skip the visual.

1. Attach to the existing top bar. One symbol per department (Alfred/Police as **Housekeeping**, Pamela, Oracle, Dolores, Vala, Daisy), each with an open-item count. Color by highest open severity: teal `INFO`, gold `WARN`, Plasma Orange `BLOCK`. **Red is reserved for system errors.**
2. Counts derive from `getAlerts()`, schema findings, and pending proposals, grouped by `Department`. Daisy's badge also counts the client-comms queue.
3. Click opens that department's **existing right-side menu** with its log and proposed ways of dealing with each item (proposals only, same tray). If no such menu exists, stop and ask.
4. Items link to their entity (select the client or node). "Acknowledge" is a local seen-state only; resolving an alert is a proposal.
5. Accessibility and layout: `aria-label` includes department, count, and top severity; keyboard reachable; `prefers-reduced-motion` respected; must fit **762x1366 and 1680x1050** without overflow; collapses to icons when narrow.
6. Cap concurrent animations (about 20) as with wires.

**Tests:** mock alerts at each severity produce the right count and color per department; a `police.schema` event raises Housekeeping only; clicking a badge opens the correct department list; no layout overflow at both resolutions (screenshot evidence).

---

## Block 6: Relay wires (two layers)

Source: Charter section 8. **Solar view only.** Extend the existing wire system; do not replace it.

1. Keep Sun-spoke wires (department to Sun, kind `context`, status).
2. Add handoff wires (kind `trigger`): Pamela to Oracle and Alfred, Oracle to Alfred, Dolores to Vala, Vala to Daisy. Add a path for any persona's client-facing proposal to Daisy.
3. Visual language unchanged: hue = source department, line style = kind, arrowhead at the receiver, chevrons animate only while an event flows. Defaults are editable, deletable, and never re-seeded after deletion.
4. Oracle wires carry **summary** only.

**Tests:** defaults seed once and stay deleted; handoff wires follow node drags; no animation without an event; no wires in Galaxy.

---

## Block 7: Multi-project model and addendum proposal (model only)

Source: Charter section 12. **Scope is the data model and logic, not a visual overhaul.**

1. Types: `SunNode` per ProjectID, `Connector { kind: 'expands' | 'spawns' | 'depends_on' | 'shares' }`, barycenter at (0,0), per-Sun orbit origin helper (unit-test the snap math `atan2` and `clamp(220, 480)` per origin).
2. `addendum.signed` generates one proposal that **always offers both outcomes** (expand vs spawn) for the human to choose.
3. Connectors are **local-only** (store plus localStorage, key `szs.links.v1:{clientId}` extended with a version bump and migration). Do not assume `ParentProjectID` exists.
4. A dev fixture (client with two projects) may render a second Sun behind a dev flag.

**Tests:** snap math per origin; connector persistence round-trip; the addendum proposal offers both options.

---

## Block 8: Catalog validation

Source: Charter section 2, Phase 2 Part 1. Prices belong to `Services_Rates` (Vala); `tasksToInject` belong to the task repositories (Dolores).

1. If the owner supplied sanitized inputs in `docs/private/inputs/` (a `Services_Rates` CSV and a list of task repository names), add `npm run catalog:check` that compares `CATALOG` to them and prints mismatches (missing IDs, price drift, task-set drift). Offline, no network.
2. If inputs are missing, skip and list under **Needs owner**.
3. Do not change prices or tasks automatically. Report only.

---

## Block 9: Schema awareness in the HUD

Source: Schema Spec section 6.

1. Read the registry and change log through the adapter. If the registry version differs from the version the HUD expects, show a Housekeeping item.
2. Make the HUD context whitelist **schema-driven**: exclude columns whose `Data_Class` is `pii` or `secret`.
3. In the Housekeeping department menu, add **"Draft schema change request"**, producing a copyable block whose fields match `Schema_Change_Log` columns exactly. It **writes nothing.** Dolores or the owner logs it.
4. Show `police.schema` and `Noted` / `Requested` items there with their Change_IDs.

**Tests:** whitelist excludes a mock `pii` column; version mismatch shows a badge; the drafted request's field names equal the log's column names.

### Blocks 5–9 closeout (2026-10-31)

- **Block 5:** Added six department badges to the existing `SkyHeader` top bar; the existing Multi-Agent Dispatch drawer opens to the chosen department. Open alerts, pending proposals, schema findings, and client-comms proposals are grouped by department and highest severity. Local Acknowledge persists only seen-state and never resolves or hides an item. The Housekeeping feed shows schema status. Verified badge click-through and no horizontal overflow at 1680x1050 and 762x1366 in the local browser; unit coverage includes severity/count grouping and local seen-state.
- **Block 6:** Added editable/deletable trigger handoff defaults alongside context status spokes in Solar. Default deletions remain suppressed across load and version migration; same endpoint pairs may carry distinct wire kinds. Oracle's default label remains summary-only. Wires remain local to Solar.
- **Block 7:** Added project-keyed `SunNode`, origin-relative `atan2` orbit snapping clamped to 220–480, and local project connectors in the version-2 wire state with version-1 migration. A signed addendum creates one review-only proposal offering both expand and spawn. No project records are changed.
- **Block 8:** Skipped catalog comparison: the required sanitized `Services_Rates` CSV and task repository list were not available in `docs/private/inputs/`. The separate untracked root `local_data/` exports have not been inspected or used. No rates or task sets were inferred or changed. **Needs owner:** provide sanitized catalog inputs in the designated location.
- **Block 9:** The mock adapter supplies registry and change-log rows. A registry version mismatch and `Noted`/`Requested` entries appear in Housekeeping; `police.schema` remains an alert-only path. Draft schema requests use the exact `Schema_Change_Log` field names, are validated, and are copyable without any write. Live schema endpoints were unavailable at this checkpoint; the later live-data follow-up is recorded below.
- **Validation:** Root `npm run lint`, root `npm run build`, HUD tests (34/34), and `git diff --check` passed. The build retains the >500 kB chunk warning. No Master Control, provider, or schema writes were performed.

### Historical live-data follow-up — 2026-10-31 (superseded by current status above)

At this checkpoint the live-data implementation had not yet been pushed.
Subsequent entries in the live-data plan and `PROGRESS.md` record the Working
Copy deployment and successful live reads. The current price-test read-back
and data-standardization status is recorded in `PROGRESS.md`.

---

## Block 10: Verify and report

Use Playwright if available; otherwise write a manual script. **Pass or fail with evidence** for each:

| Area | Checks |
|---|---|
| Block 0 | Audit table complete; Phase 2 archived or `closing` with Needs owner |
| Secrets | Scan counts zero; registry not tracked |
| Data layer | Validators, schemas, and mock fixtures pass tests; bad row surfaces on Housekeeping |
| Events | Idempotent; Police events fire no rules; loop guard; money gate; Daisy tag |
| Personas | `effectiveAutonomy` proposal-only; Staff Meeting works on mock; whitelist test; no 90/10 |
| Ribbon | Counts, colors, click-through, both resolutions |
| Wires | Relay defaults; Solar only; summary-only Oracle |
| Multi-project | Snap math per origin; both-options addendum proposal |
| Catalog | `catalog:check` result or Needs owner |
| Schema | Version badge; pii exclusion; draft matches log columns |
| Regression | Lock, drag, resize, zoom, pan, orbit snap, duplicate-module guard, RTS hotkeys, existing menus and shortcuts |

Live-mode checks (only when the owner confirms OAuth is live): read a snapshot and compare three values with the sheet; confirm `police.corrected` appears after a deliberate correction on the owner's **copy**.

### Historical Block 10 verification record (2026-10-31; later live-read updates are recorded in `PROGRESS.md`)

| Area | Result | Evidence / limitation |
|---|---|---|
| Block 0 / Phase 2 | **Closing** | Phase 2 remains active with owner/deferred acceptance items; its audit and remaining work stay in the active Phase 2 plan. |
| Secrets | **Review needed; no commit made** | Count-only tracked-file scan: token-like matches 6; `AKfycb` matches 1; 44-character ID matches 4; `VITE_API_SECRET_KEY` references 4. Private link registry tracked: 0. No matched values were printed or copied. |
| Data layer | **Pass, mock scope** | Validators, bad-row rejection, mock fixture coverage, and unavailable-live adapter behavior pass in the HUD tests. |
| Events | **Pass** | Event tests cover idempotent diffs, Police suppression, loop guard, gated money proposals, Daisy labels, and addendum proposals. |
| Personas | **Pass, mock scope** | Persona tests cover proposal-only autonomy, Staff Meeting order, PII/secret exclusion, and staged crisis proposals. No provider request was made. |
| Ribbon | **Pass, browser checked** | Department grouping, severity, Housekeeping click-through, and generated schema draft checked in the local browser at 1680x1050 and 762x1366; both document widths matched their viewports. Screenshots captured during this session. |
| Wires | **Pass, model/tests** | Default handoff links, kind-specific duplicate behavior, delete suppression/migration, and local-only persistence are tested. Full drag/animation/Galaxy regressions remain part of the Phase 2 closeout. |
| Multi-project | **Pass, model/tests** | Orbit angle/clamp per origin, version migration, connector persistence, and one two-outcome addendum proposal pass. |
| Catalog | **Needs owner** | No sanitized `docs/private/inputs/` files were supplied; comparison was intentionally skipped. |
| Schema | **Pass, mock scope** | Version mismatch and change-log rows surfaced in Housekeeping; request fields match the typed schema and no write occurs. `authorizeHudScopes()` and the read-only `hud_getSnapshot()` succeeded in the editor. The owner confirms the Original and Working Copy share a Cloud project with the OAuth client and sign-in succeeds; the Working Copy currently has only a Web App. The HUD used the project Script ID where `scripts.run` requires the API Executable deployment ID. Code is corrected, but an API Executable deployment and live read remain unverified. |
| Regression / live mode | **Not verified** | This run did not re-test all Phase 2 lock/drag/resize/zoom/pan/hotkey paths. The Working Copy deployment was pulled back and matched staging 10/10; live API execution and provider behavior remain unverified. Deploy the Working Copy as an API Executable before retrying the live read. |

Final validation recorded for the Phase 3 blocks: root `npm run lint` and
`npm run build` passed with the existing >500 kB chunk warning; the latest HUD
suite passed 55/55. The current Master Control suite passes 25/25, all nine
deployable Apps Script sources parse, and `git diff --check` passes (line-ending
notices only). No Git commit was created. Browser regressions and live checks
listed as unverified above remain open; passing these automated checks does
not complete Phase 3.

---

## 3. Parking lot (do not do in Phase 3)

Universe view and Planet view; migrating off Apps Script (Postgres, Supabase, Firestore); server-side ledger idempotency and audit log (design the proposal shape to allow it); pointer-event drag-and-drop; `BroadcastChannel` cross-window sync; a visual overhaul of binary and trinary systems; building an uninstall flow.

---

## 4. Report templates

### Per block

```
Block:
Files changed:
What I ran (commands + results):
What I could not verify:
Defaults I used for undecided owner questions:
New UI surfaces attached to (existing surface names):
Needs owner:
Open questions:
```

### Phase 2 Closeout Report (Block 0)

```
Phase 2 audit table (all items, status, evidence, remaining):
Items completed this session (commit refs):
Items superseded (and why):
Items blocked-external / Needs owner:
Archive status: archived | closing
Lint / build / test results:
```
