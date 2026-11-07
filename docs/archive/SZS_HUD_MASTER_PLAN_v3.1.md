# SZS HUD Master Plan v3.1

**Status:** completed 2026-11-05 and archived (Phases A–G done; Phase H done except H1/H2, deferred by the owner to Phase Q). Log: `docs/archive/PROGRESS_v3.1.md`. Reports: `CATALOG_CHECK_E7.md`, `LIFECYCLE_TEST_REPORT.md`, `MULTI_SUN_SOLAR_DESIGN.md` (built) in this folder.
**This is the only plan to read.** It replaces: the Phase 2 Implementation Plan, the Phase 3 Implementation Plan, the HUD Live Data Master Plan, and the Owner To-Do Checklist. `PROGRESS.md` stays as the running log (append to it). The Charter, Schema Control Spec, Alfred Core Directive, and v7 documents stay as reference.

**For:** the coder bot. **Owner:** Drake, single user, local machine, beginner coder. Every instruction you give him must be exact and copy-paste: real file names, real paths, real button names. Never write "change the folder" without saying to what.

Work is organized in **Phases A to H** (no dates). Do them in order. Do not stop between phases unless you need the owner.

---

## 1. Standing rules (merged; where an old rule conflicts, this section wins)

**Autonomy**
1. You have full autonomy: edit HUD code, edit `engines/master-control/`, run `clasp` against the Working Copy, run tests, run the dev server, and make **local git commits**. Do as much as you can yourself. Stop only for things only the owner can do (browser logins, permission clicks, decisions).
2. **Never `git push`.** Phase A makes this physical (see A1). Local commits after every step.
3. Security, secrets, ID redaction, and credential scans are **suspended by the owner** until the final security pass. Do not add warnings, redaction, or scrubbing. Do not redact this file.

**Safety that stays**
4. Work only against the **Working Copy** (section 2). Never touch the Original.
5. Money changes (Contract Value, deposits, invoices) keep the existing **Financial Mutation confirmation dialog**. Do not change the dialog itself.
6. Every write goes through the audited writer (`hud_write`, section 6 Phase B), is read back, and shows confirmed or failed in the HUD.
7. Agents and event handlers **only create proposals** (proposal-only cap). Event rules stay `suggested`; only `approved` rules fire, and none are approved.
8. Do not touch `quarantine/oracle-mmd/`. Oracle internals never enter HUD code, Alfred context, or exports.
9. Layout, wire, and event data stay in the store and `localStorage`. Business records (clients, projects, finances, alerts, tasks) are written to Master Control through `hud_write` only.

**UI containment (owner, non-negotiable)**
10. **Extend, don't replace.** Existing menu items (Lock/Unlock, Alt+Right-Click freeze) stay exactly as they are. New items are added.
11. Everything nests, collapses, and hides when unused: no menu with more than about 8 top-level items; wire controls live in the Multi-Agent Dispatch **Wires** tab (AlfredDock stays dormant); wire labels, handles, and animations show only on hover or selection.
12. No new always-visible toolbar, panel, or button. For every new UI element, name the existing surface it attaches to in your report. If a new standalone surface seems necessary, stop and ask.
13. Wires exist only in Solar. Galaxy and Universe cards are phase/stage carriers; draw no wires there. Nothing floats over the canvas except nodes and wires.

**Method**
14. Edit source files only. No runtime DOM injection.
15. Search first, quote real code, report findings before editing. Do not guess file names or line numbers. Do not ask the owner anything you can find in the repo or by running a command.
16. After each step: `npm run lint`, `npm run build`, `npm test`, plus Master Control tests; commit locally; append to `docs/active/PROGRESS.md` (phase, step, what changed, what you ran, results, Needs owner).
17. Do not claim anything works unless you ran it. Say what you ran. Mark an item `done` only with evidence.
18. Test writes only on seeded test data or a fake `ZZZ` client you create and delete.
19. Out-of-scope findings go in `docs/PARKING_LOT.md`.

---

## 2. Targets and environment

- **Repo root (quote it; it contains a space):** `C:\Users\craya\GitHub\szs-bridge HUD`
- **Working Copy (TARGET):** spreadsheet `1KlP547wMInbfabpbAYI-sx8oirIQ8A19wlUquUdx3Rs`; Apps Script project `1H02jmtB9AuYant9x5paAZceoaPSaRv-5SepRBRvmkJ-kawWpx_q9_sif`. Chat, Admin, Sheets, Slides, Docs, Gmail, and Tasks APIs are enabled on it.
- **Original (DO NOT TOUCH):** spreadsheet `1VLvipkP8LUOX2_F4RdIFHrq7e346XRSk1nYSClTVDy0`; script `12l72F8nuKnaz-CqfPDccExeCPE41oQzGqzVhLKDRPGn21ZoI5lQZUs2L`.
- `engines/master-control/.clasp.json` currently points at the **Original**. Never use it as-is. Re-create the isolated Working Copy staging config used earlier (it was not retained) and use only that.
- **HUD origin:** `http://127.0.0.1:3002` (OAuth is pinned to it; Vite uses `strictPort`). Port 3000 is an unrelated PM2 process; leave it.
- **Transport:** Apps Script API `scripts.run` with the API Executable deployment ID in `VITE_APPS_SCRIPT_DEPLOYMENT_ID` (set locally by the owner). Master Control checks `AUTHORIZED_USER_EMAILS`.
- **Data modes:** `VITE_DATA_MODE=live|snapshot|mock`. Live is working; snapshot (CSV) and mock are fallbacks.

---

## 3. Data standards (settled by the owner)

**Stage lists**
- AccountPhase (`Clients` column H): `01: Intake`, `02: Session Zero`, `03: Active Sprints`, `04: Liftoff`, `05: Complete`, `06: Archived/Sunset`.
- SprintStage (`Projects` column D): `00: Discovery`, `01: Vibecheck`, `02: Contract & Inception`, `03: Deep Intelligence`, `04: Session Zero Kickoff`, `05: Architecture & Builds`, `06: Mid-Flight Review`, `07: Final Staging & QA`, `08: Liftoff & Handover`, `09: Sunset / Retainer`.
- AccountPhase is derived from a client's projects (any project 05 to 07 gives `03`; else any 02 to 04 gives `02`; else any 00 to 01 gives `01`; all projects at 08 gives `04`; 09 gives `06`; `05: Complete` is set by hand) with a manual override (`AccountPhase_Mode` = `auto` or `manual`) that always wins.

**IDs and names**
| Thing | Standard | Example |
|---|---|---|
| ClientID | 3-letter abbreviation of the company; on collision append a digit, no hyphen | `PAC`, `PAC2` |
| ProjectID | `<ClientID>-NN` | `PAC-01` |
| InvoiceID / number | `INV-<ClientID>-<YY>-<NNN>`; YY = year issued; NNN = that client's invoice count for that year (can pass 003) | `INV-PAC-26-001` |
| Google Group | one per client, `client-<clientid lowercase>@sessionzero.solutions` | `client-pac@...` |
| Drive folders and docs | `<ClientID> - <Project Name> - <template or document name>` | `PAC - Initial Project Build - SOW` |
| Google Tasks list title | the ProjectID | `PAC-01` |
| Client Command Deck (task dashboard) | `<ClientID> - <Project Name> - Command Deck` | Copy of `MASTER - SZS - Client_Command_Deck Template`, owner decision 2026-11-05. |

The earlier year-suffixed **client** IDs (`PAC-26`) are **dropped**. Revert the HUD and Master Control generators and validators to this standard. Legacy shapes stay readable only until the wipe in Phase C removes them. Update the Schema Control Spec patterns (ClientID `^[A-Z]{3}\d{0,2}$`, ProjectID `^[A-Z]{3}\d{0,2}-\d{2,3}$`, InvoiceID `^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$`) and unit-test them.

**Finance model: Finances is the master; values cascade down**
- Each project has **one contract row** in `Finances` (`MilestoneStage = Contract`) where `TotalContractValue` (TCV) is typed **once**.
- Invoices: three per project by default. Deposit = one third at inception (stage 02). Second = one third at **stage 06** (Mid-Flight Review). Final = the remainder at **stage 08** (Liftoff & Handover), so rounding never breaks the total. A negotiated split is recorded on the contract row (additive schedule columns), never by editing invoices by hand. Extra invoices (addendum or new contract) continue the per-client-per-year sequence.
- Add a computed column `TotalContractDue` (never typed): the sum of the scheduled invoice amounts. It must equal TCV.
- `InvoiceAmount` is computed from TCV and the schedule. `Remaining_Balance` = TCV minus paid invoices. The sum of issued invoices must never exceed TCV and must equal TCV once the final invoice is issued.
- `Clients.ContractValue` becomes a formula: the sum of that client's project TCVs. The HUD shows contract values from the Finances roll-up.
- Changing TCV after the first invoice has been issued raises a BLOCK finding unless `AddendumRef` is filled in on the contract row.
- Vala's existing invoice automation writes `Finances` rows. **Read it first** and patch minimally. The owner authorizes ledger-shape changes needed for this model; the Financial Mutation dialog stays.

**Police reconciliation rules** (run in the 15-minute Police audit and on edit; each finding is one deduplicated `Alfred_Alerts` row naming both cells and both values, severity, and prescribed action)
| # | Rule | Severity |
|---|---|---|
| R1 | `Clients.ContractValue` differs from the sum of its project TCVs | BLOCK |
| R2 | `Finances` row with no ClientID, or a ProjectID not in `Projects` | BLOCK |
| R3 | `TotalContractDue` differs from TCV | BLOCK |
| R4 | Issued invoices exceed TCV | BLOCK |
| R5 | `DepositPaid` flag disagrees with the deposit invoice status | WARN |
| R6 | AccountPhase in sheet differs from the derived phase (auto mode) | INFO |
| R7 | Project at stage 04+ without `DepositPaid`, `MSA_DocID`, `SOW_DocID` | BLOCK |
| R8 | Malformed or duplicate ClientID / ProjectID / InvoiceID | WARN / BLOCK |
| R9 | Project past stage 03 missing expected assets (Brief, Outline, both Chat Spaces, task list, dashboard) | WARN |
| R10 | TCV changed after first invoice without `AddendumRef` | BLOCK |

Early-stage completeness matters most to the owner: Police must catch missing information early, not at stage 07.

**Edit_Log:** a new tab fed by an installable on-edit trigger (user, timestamp, tab, cell, old value, new value) for money, phase, stage, and ID fields, with a loop guard. `Schema_Change_Log` stays for structure changes only. `HUD_Audit_Log` records HUD writes.

**Tasks conventions**
- Tasks lists are **personal** to the owner's Google account. The Tasks API cannot create tasks assigned from Docs or Chat Spaces, and a Docs checklist can only be assigned to people in the owner's domain. So the sync to clients is built here (Phase E), not by Google.
- Each task's notes begin with `Audience: client` or `Audience: internal`, optionally `Start: YYYY-MM-DD`, and `Key: <template row key>` (for idempotency).
- Delete lists with `Tasks.Tasklists.remove` (not `delete`).

---

## 4. Current state (from `PROGRESS.md`; do not redo done items)

| Area | State |
|---|---|
| Live reads (Working Copy via `scripts.run`) | **Done.** Owner verified count, contract value, and stage. |
| Universe (AccountPhase) and Galaxy (SprintStage) views, breadcrumb, canvas controls dropdown, camera memory, local overlay | **Done.** Owner verified drag-and-refresh. Department badges removed from the top bar (they remain in the left rail and Dispatch drawer). |
| Wires, default wires, undo, persistence, import/export, event engine (proposal-only), relay wires, multi-project model, schema awareness, personas/Staff Meeting (mock) | **Done** in code and tests; many acceptance items only **partially evidenced** (see Phase G). |
| Audited write path (`hud_write`) | **Deployed to the Working Copy (version 8). The AccountPhase write is rejected** with "Please select an option from the approved list." Cause unknown. Stage-04 gate working as designed. |
| Contract-value display | Solar shows `Clients.ContractValue`; owner edited `Finances` F29; nothing reads that field. Finance model not yet implemented. |
| Data | All current rows are test data, many incomplete. 27 Finance rows lack a ClientID; 79 invalid `Schema_Registry` rows (grew from 69). |
| Task lists | All six projects have a blank `Google_Tasklist_ID`. Task reads work (temporary test succeeded and was cleaned up). |
| Planet view, Reports, task writes, client dashboard, Chat push | **Not built.** |
| Git | **No commit exists** for any of this work (branch `live-data`). |
| Alfred / Gemini | **Parked.** Google rejects the key (HTTP 400). Server-side proxy exists. When resumed, use model `gemini-3.5-flash-lite` (2.5 is retired) via env override. Not in this plan. |

---

## 5. Owner to-do list (exact steps)

**A. Now (about 3 minutes)**
1. Save this file into the repo (PowerShell):
```
Move-Item "$env:USERPROFILE\Downloads\SZS_HUD_MASTER_PLAN_v3.1.md" "C:\Users\craya\GitHub\szs-bridge HUD\docs\active\" -Force
```
2. In each PowerShell window running `npm run dev`, press `Ctrl+C`, then close the window. The bot restarts the server itself.
3. Tell the bot: **"Read docs/active/SZS_HUD_MASTER_PLAN_v3.1.md and execute it from Phase A. You have full autonomy inside it."**
4. You do **not** need to export any CSVs. The data wipe in Phase C makes the old exports and the ID migration baseline obsolete.

**B. Only when the bot asks (it must give exact steps each time)**
- **Permissions:** when the bot adds new permissions it will tell you to run `authorizeHudScopes` once: open the Working Copy script editor, pick `authorizeHudScopes` in the function dropdown at the top, click **Run**, then **Review permissions**, choose your account, **Advanced**, **Go to (project name) (unsafe)**, **Allow**.
- **`clasp login`:** run it once if clasp says you are logged out (a browser window opens; pick your Google account).
- **Phase E test:** have one external **Workspace** account (a test client account, any address) ready, plus its membership in a test Google Group, to test the dashboard and the Chat space.
- **Phase H:** when the bot says the system is ready, drop your test leads through the forms.

---

## 6. Phases

### Phase A: Checkpoint, housekeeping, target safety
1. **Local checkpoint.** On branch `live-data`, commit all current work (`checkpoint: before master plan v3.1`). Confirm raw exports are untracked and ignored (`local_data/`, `apps/command-hud/local-data/*.csv`, `docs/active/*.csv`). **Disable pushing physically**: `git remote set-url --push origin DISABLED` (or the equivalent for each remote). Verify `git push` fails.
2. **Archive old plans.** Move `ANTIGRAVITY_PHASE2_IMPLEMENTATION_PLAN`, `ANTIGRAVITY_PHASE3_IMPLEMENTATION_PLAN`, `HUD_LIVE_DATA_MASTER_PLAN`, and `OWNER_TODO_CHECKLIST` into `docs/archive/`, each with a one-line header "Superseded by Master Plan v3.1". Update `docs/README.md`. Cut `HUD_HANDOFF_SUMMARY.md` down to a short status page that points here and to `PROGRESS.md` (remove duplicated detail).
3. **Fix reference docs.** In the Alfred Core Directive replace the stage names with the lists in section 3 and add the Daisy single-outbound-voice note; update the Schema Control Spec ID patterns and invoice pattern; keep the v7 supersession notes as they are.
4. **Clasp and deployments.** Re-create the isolated Working Copy staging config. Verify it targets the Working Copy only (print the script ID, compare with section 2). List the Working Copy's deployments, describe each, keep the single API Executable deployment the HUD uses, and delete the unused ones (Working Copy only). Record the result in `PROGRESS.md`.
5. **Dev server.** Start the HUD once at `http://127.0.0.1:3002` and confirm `DATA LIVE`.

**Done when:** `git log` shows the checkpoint commit, `git push` is blocked, the old plans are archived, and the HUD shows `DATA LIVE`.

### Phase B: Fix the write path and the registry
1. **Find the rejection.** Search the local `engines/` and a fresh `clasp pull` of the Working Copy for the exact text `Please select an option from the approved list`. Also inspect the live data validation rule on `Clients!H:H` (every range, including the row for the failing client) and the `Allowed_Values` for AccountPhase in `Schema_Registry`. The owner confirmed the visible dropdown is canonical, so check for a second list (deployed guardrails code, registry rows, or a per-row rule) still holding legacy labels such as `02: Inception`. Report the exact source before changing anything.
2. **Fix and redeploy** (Working Copy only), then retest both manual and auto AccountPhase writes, a SprintStage write, and an alert resolve on a fake `ZZZ` client you create and delete. Confirm each `HUD_Audit_Log` row and each read-back.
3. **Registry rows.** Find why `Schema_Registry` invalid rows grew from 69 to 79 (something appends rows each run). Fix the cause so it is idempotent, complete the invalid rows (`Data_Type`, `Data_Class`, `Owner_Persona`, `Allowed_Values`), and report the before/after count. Register the new tabs and columns this plan adds.

**Done when:** a live AccountPhase drag persists in the sheet, `HUD_Audit_Log` shows the row, and the invalid-registry-row count stops growing.

### Phase C: Wipe and reseed with complete test data
1. **Backup** current tabs to a dated folder under `docs/private/backups/` (CSV exports through Apps Script or the HUD snapshot).
2. **Manifest.** Before deleting anything, write `docs/private/backups/wipe-manifest-<date>.json` listing every external asset tied to the current rows: Drive folders (`DriveFolderUrl`, `MeetingNotes_DriveFolderID`), Chat Spaces (both URL columns), Google Groups (`GoogleGroupEmail`), Tasks lists (`Google_Tasklist_ID`), MCC subscriber rows, Oracle baseline rows. Delete only assets on this list.
3. **Clear data, keep structure.** Clear only the input cells in `Clients`, `Projects`, `Finances`, `Alfred_Alerts` (and linked MCC/Oracle rows). **Keep** headers, formulas (the tabs have about 999 formula-filled rows), validation, and protections. Also trash the manifest's Drive folders; delete the listed Chat Spaces and Groups through the Chat and Admin APIs (the owner confirmed all of this is test data). If an API call is not permitted, list the leftovers in `PROGRESS.md` with exact manual steps.
4. **Seed with an Apps Script function** (`seedTestData`, idempotent, refuses to run on non-empty data tabs) that produces complete rows using the section 3 standards:
   - 6 clients covering all six AccountPhase values (with Google Group emails).
   - 8 projects across stages 00 to 09, including one client with two projects (exercises the multi-project model).
   - Contract rows and invoices in the new finance model, in several statuses.
   - Alerts at INFO, WARN, and BLOCK.
   - Real Drive folders for about 3 clients through the existing provisioning.
   - Every row marked as test data in a visible way, and a `purgeTestData()` helper that removes exactly the seeded rows and their assets using a manifest.
   - **One deliberate contract-value mismatch and one malformed row**, so the new checks have something real to catch.
   - Projects at stage 04+ must satisfy the stage gate (deposit, MSA, SOW).
5. Report the seeded counts and verify the HUD shows them live. Update the HUD ID generators to the new standard.

**Done when:** the HUD reads the seeded data live, Universe and Galaxy are populated, and `purgeTestData()` has been dry-run successfully.

### Phase D: Finance cascade and Police reconciliation
1. **Read Vala's invoice automation first**, then implement the finance model in section 3 (contract rows, computed `InvoiceAmount`, `TotalContractDue`, `Remaining_Balance`, roll-up `Clients.ContractValue`, the stage 06 and 08 invoice triggers, per-client-per-year invoice numbering). Add additive columns only; log each in `Schema_Change_Log` and `Schema_Registry`.
2. **Police rules R1 to R10** with deduplicated alert rows, HUD badges, and **resolve actions** ("Use Finances value", "Use Clients value") through the audited writer.
3. **Edit_Log** with the installable on-edit trigger.
4. Make the HUD show contract values from the Finances roll-up everywhere (Solar, Universe, Vitals) and map the remaining fields the HUD does not yet show: client `GoogleGroupEmail`, `Tech_Stack`, `MCC_Subscriber_ID`, `Oracle_Baseline_ID`; project `Google_Tasklist_ID`, hours, document and chat links, parent/addendum; finance `ProjectID`, balance, tax, margin.
5. **Test:** change a contract value by hand in the sheet and show the mismatch alert appears with both cells and values, the HUD badge lights, and "Use Finances value" resolves it. Show the deliberate seed mismatch and malformed row were caught.

**Done when:** editing one contract number in the sheet is caught, logged, and resolvable from the HUD.

### Phase E: Task lists, client dashboard, Chat push
1. **Inventory.** Read the Apps Script source and report which of these automations already exist: Chat Space creation (internal and client), Google Group creation and membership, Tasks list creation, Drive tree, invoices, SOW and MSA. Build the missing ones that this phase needs (Chat and Admin APIs are enabled). Ask the owner only if the account running the script is not a Workspace super admin.
2. **Template repository.** Add columns `Offset_Days`, `Duration_Days`, `Audience`, and `Is_Milestone` to the Task List Template Repository. Fill them for the existing template rows with sensible defaults and list them for owner review.
3. **Automatic list creation per project**, once all project information is present: Brief doc, Outline doc, both Chat Spaces, rate tier, and active components. Never earlier than stage 03. If still incomplete at stage 04, raise an alert (R9). It builds the list from the template plus service-component tasks plus Vitals/Project Overview data, names it with the ProjectID, writes `Google_Tasklist_ID` (column J), and records a new additive `Dashboard_Sheet_ID` column on `Projects`. It is idempotent: a filled column J means skip; a "sync missing tasks" action adds only tasks whose `Key` is absent.
4. **Client dashboard sheet** per project, created in the project's Drive folder with the standard name, showing only `Audience: client` tasks with Title, Due, Notes, and a Done checkbox.
   - Share it with the client's Google Group; protect every range except the Done column.
   - Sheet to Tasks: an installable on-edit trigger completes or reopens the task in the list.
   - Tasks to Sheet: a time-driven trigger every 5 minutes updates the Done box. Add a loop guard.
   - **Test with the owner's external Workspace account** that a group member can tick a box and the task completes. If group sharing is blocked, report the exact admin setting or fall back to sharing with member emails.
5. **"Send to client" action.** A preview, written in Daisy's voice, then owner confirmation, then a post to the **client-facing** Chat Space (`ChatSpace_URL`, never the internal one) with the dashboard link, optionally a digest of overdue client tasks. Logged in `HUD_Audit_Log`. If posting as the user is not permitted, report the exact limit.
6. **HUD task writes:** create task (title, notes, due, parent, client-facing checkbox that writes the `Audience:` line), complete, reopen, each through `hud_write` with read-back. Task counts replace the "unavailable" placeholder in Galaxy and Universe cards.
7. **Catalog check** (the old Block 8): now that `Services_Rates` and the template repository are available, compare services and task sets and report differences. Change nothing without the owner.

**Done when:** a seeded project gets its `PAC-01` list and dashboard automatically, a tick in the dashboard completes the task, and the Chat message is posted after confirmation.

### Phase F: Planet view
1. Route `/client/:clientId/project/:projectId`, a real DOM page, lazy-loaded. Reached by double-clicking a project or service node in Solar; `Esc` or the breadcrumb returns to Solar with its camera restored.
2. **Layout (owner decision): Gantt in the center, project details on the side (right), task list below the Gantt.**
   - Details: name, SprintStage and AccountPhase, rate tier, estimated and actual hours, document links built from the `*_DocID` columns, `COMS_Sheet_URL`, meeting notes folder, both Chat Spaces, Google Group, the client summary, and the project's invoices by `ProjectID`.
   - Gantt: 45-day cadence axis from kickoff, SprintStage markers, task bars from the `Start:` note line to the due date (a marker when there is no start), grouped under parent tasks, with distinct colors for completed, upcoming, and overdue. No drag-to-reschedule yet.
   - Task list: title, due, status, notes, subtask indentation, virtualized beyond about 100 rows, create/complete/reopen from Phase E.
3. Completing a task marked `Is_Milestone` fires the existing `milestone.done` event and creates its proposals (no side effects).

**Done when:** Planet shows the seeded project's real Gantt, details, and tasks, and completing a task there completes it in Google Tasks.

### Phase G: Remaining HUD writes, reports, and acceptance gaps
1. **Live write acceptance:** re-verify Universe drag (AccountPhase) and Galaxy drag (SprintStage) against seeded data, "Reset to auto", alert Resolve/Reopen, and the Daisy Sunset request (writes the phase and a "Sunset requested" alert; the HUD does not move Drive folders). Inspect `HUD_Audit_Log` rows by hand and report.
2. **Money proposals:** route approved money proposals into the existing Financial Mutation confirmation (owner decision: money keeps the dialog). Do not alter the dialog.
3. **Reports** (in the existing Dispatch drawer or a client context menu; no new always-visible surface):
   - Status summary: read-only modal.
   - Invoice draft: copy the invoice template into the client's Drive folder, named `<ClientID> - <Project Name> - Invoice <InvoiceID>`, through the confirmation dialog; log in `HUD_Audit_Log`.
   - OSINT sweep: only adds an `Alfred_Alerts` row (`Department: Oracle`, `Action_Status: Requested`). It runs nothing.
4. **Close the unverified Phase 2 items.** Run and record evidence for each: bottom bays visible and clickable in every view and the full lock/drag/resize/zoom/pan/orbit-snap/duplicate-guard regression; Alt+Right-Click preserved; every node, Sun, wire, canvas, and multi-selection menu action; node-plus-links delete and Undo; the full shortcut list with input-focus exceptions; the named wire pairs (Pamela to Vala, Dolores to Daisy) following moves; wire delete by context menu, Undo, and reload; active event-flow animation and viewport culling. Automate with browser tests where possible, otherwise record a manual script and results.
5. Mark each item `done` only with evidence, and list anything left in `PROGRESS.md`.

**Done when:** every item above is `done` or explicitly marked "deferred by owner".

### Phase H: Lifecycle test and wrap-up
1. When Phase G is done, tell the owner (with exact steps) that the system is ready for **test lead drops through the forms**.
2. For each lead the owner drops, record what appeared where (sheet rows, Drive folders, Chat Spaces, Group, task list, dashboard, HUD cards, alerts), what Police flagged, and what was missing.
3. Walk at least one test client through the full lifecycle to **Sunset** (Daisy's flow), including the HUD drag to `06: Archived/Sunset`, the "Sunset requested" alert, and the Drive archival result.
4. Write a **Lifecycle Test Report** in `docs/active/` (what worked, what broke, what is still manual) and propose a fix list.
5. Move completed plan documents to `docs/archive/` and update `docs/README.md`.

---

## 7. Parked (do not do now)

Alfred / Gemini (key rejected; resume later); the security overhaul and key rotation (owner's final pass); promoting the Working Copy changes to the Original or production Master Control (cutover); client-ID migration of live records (obsolete after the wipe); hosting or moving off Apps Script; `BroadcastChannel` cross-window sync; pointer-event drag-and-drop; the binary/trinary visual overhaul; a component uninstall flow that reverses the ledger; Google Sites portal changes; approving any `suggested` event rule.

---

## 8. Decisions record (owner; do not reopen without new information)

| Topic | Decision |
|---|---|
| Suggested event rules | None approved. |
| Uninstall reversing the ledger | Not built. |
| Pull chevrons | Hollow. |
| Wire controls home | Multi-Agent Dispatch Wires tab; AlfredDock dormant. |
| Undo | Minimal rollback model accepted. |
| Views | Universe = one card per project, grouped by phase (owner 2026-11-05; was AccountPhase per client), Galaxy = SprintStage, Solar = both, Planet = project page. No four-lane macro layout anywhere. Collapsed columns keep a visible arrow tab with a count. |
| Planet layout | Gantt center, details side, task list below. |
| Transport | Apps Script API `scripts.run` (API Executable). |
| IDs and naming | Section 3. |
| Finance authority | Finances is the master; values cascade down; invoices default to three (deposit, stage 06, stage 08), equal thirds with the remainder on the final; schedule overrides per project. |
| Tasks | Personal Google Tasks list per project, titled with the ProjectID; client dashboard sheet shared to the client's Google Group; Chat push is a message through Daisy with confirmation. |
| Data | All current data is test data; wipe and reseed; then test leads through the forms. |
| Alerts | Newer columns (`Client_ID`, `Severity`) canonical; legacy columns fallback; invalid client references stay rejected, not silently shown. |
| Sunset | Writes the phase and a Daisy "Sunset requested" alert; the HUD does not move Drive folders. |
| Git | Local commits yes, push never. |

---

## 9. Questions for the owner (put in your first report; proceed on the defaults, change course if he answers differently)

1. Is the Google account that runs the Working Copy script a **Workspace super admin**? (Needed to create and delete Groups through the Admin API. Default: assume yes and report the error if not.)
2. For the Phase E dashboard test, which external Workspace account and test Group should you use? (Default: the owner supplies them when asked.)
3. Anything in the repo or sheets that contradicts this plan: quote it and propose the fix instead of silently changing course.

---

## 10. Report format (every step)

```
Phase / step:
Needs owner (exact copy-paste commands or exact clicks, or "none"):
What changed (files):
What I ran and the results:
Row counts / values compared:
What I could not verify:
Defaults I used:
Next step:
```
