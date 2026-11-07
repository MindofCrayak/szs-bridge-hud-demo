> **Superseded by Master Plan v3.1** ([`docs/archive/SZS_HUD_MASTER_PLAN_v3.1.md`](./SZS_HUD_MASTER_PLAN_v3.1.md), itself completed 2026-11-05).

# HUD Live Data and Navigation: Master Plan

## Current status and handoff — 2026-11-02

This status supersedes conflicting older checkpoints and instructions below.
The Working Copy schema is already aligned with the canonical schema; do not
edit or deploy Master Control schema changes as part of this data-standardization
work. The owner confirmed the `Clients` AccountPhase dropdown in column H
contains the canonical `01`–`06` options.

- HUD live reads previously succeeded against the Working Copy. The latest
  recorded read reported 79 invalid optional `Schema_Registry` rows as a
  warning while core data continued loading. The attempted live read after
  the owner's price test could not be completed: the shared Sheets page was
  on `Finances`, but its accessible snapshot did not expose cell values.
- Solar displays `Clients.ContractValue`; `Finances.TotalContractValue` is a
  separate field. The user's changed cell and its before/after values have
  not been identified, so the reason Solar did not reflect the test remains
  unverified.
- The live AccountPhase write was rejected with “Please select an option from
  the approved list.” Read-back confirmed no mutation. The cause remains
  unresolved. Later local validation-source changes were not deployed; do not
  retry a live write until the active writer/validation path is diagnosed.
- The temporary, owner-approved `SE-01` Tasks fixture was removed. Its task
  list field was cleared and read back blank; the exact temporary list and
  task were deleted. No client/project data standardization or lasting
  Workspace asset creation has occurred.
- The agreed migration IDs use the onboarding year: `PAC-26` (Prime Auto
  Collision), `SE-26` (SolarPulse Energy), and `ZES-26` (Zenith EdTech
  Solutions); collisions add a counter (for example `PAC-26-02`), and project
  IDs append to the complete client ID (for example `PAC-26-01`). This
  convention is implemented and tested locally, but no live IDs were changed.
- Validation after the latest local ID/schema work: root tests 62/62, lint
  passed, build passed with the existing large-chunk warning, Master Control
  router tests 34/34, and `git diff --check` passed. Those local changes were
  not deployed. No Git commit or push was made.
- The Nov 2 Clients CSV is in `docs/active/`; the available Projects,
  Finances, and Alerts exports are older and must not be used as the current
  migration baseline. Before proposing row changes, obtain fresh exports of
  `Clients`, `Projects`, `Finances`, `Alfred_Alerts`, and `Services_Rates`
  in `C:\Users\craya\GitHub\szs-bridge HUD\docs\active\`, using filenames
  `Working Copy of SZS Master Control - <TabName>.csv`. Keep them untracked
  and do not commit them. Then produce a before/after mapping for owner review.

**For:** the coder bot. **Owner:** Drake (single user, local machine, beginner coder: every instruction to him must be exact, copy-paste, with real names and paths).
**Place at:** `docs/active/HUD_LIVE_DATA_MASTER_PLAN.md`. This file replaces the older plan files as the thing to follow. Keep the older docs for reference but do not re-run their blocks.

**Repository copy note:** Identifier-like IDs from the downloaded source were
redacted in this tracked copy. The unmodified source remains in Downloads for
local reference. Use the existing ignored local clasp configuration only after
verifying its target; never copy IDs into tracked files or output.

## 0. Autonomy and ground rules

1. **You have full autonomy** inside this plan: edit HUD code, edit `engines/master-control/`, run `clasp`, run tests, run the dev server, and commit locally. Do as much as you can yourself. Only stop for things only the owner can do (browser logins, permission clicks, decisions). When you need him, write **exact** copy-paste commands or exact click paths with real button and tab names. Never write "update the folder" without saying which folder and with what.
2. **Security and secrets are out of scope for now.** Do not add warnings, redaction, scans, or scrubbing. The HUD should read and show everything. The owner will do a security pass at the very end. Do not push to any remote: **`git push` is forbidden**. Local commits are required.
3. **Safety that does stay:** (a) work only against the **working copy** Master Control (section 1), never the original; (b) money changes (Contract Value, deposits, invoices) still go through the existing Financial Mutation confirmation dialog; (c) every write is read back and shown as confirmed or failed; (d) test writes only on a fake client (`ZZZ`, project `ZZZ-01`) that you create and delete.
4. **Out of scope:** Alfred/Gemini (parked), `quarantine/oracle-mmd/` (do not touch), the Original spreadsheet and script (do not touch), Universe cross-account features beyond section 6.
5. Search the repo and quote real code before editing. Do not guess file names. Do not ask the owner anything you can find in the repo or by running a command.
6. After every step: run `npm run lint`, `npm run build`, and the tests; commit locally with a clear message; append to `docs/active/PROGRESS.md` (step, what changed, what you ran, results, Needs owner).
7. Do not claim anything works unless you ran it. Say what you ran.

## 1. Facts (verified from the owner's machine and sheets)

**Repo root (note the space in the folder name; quote it in PowerShell):** `C:\Users\craya\GitHub\szs-bridge HUD`

**Working copy (TARGET):**
- Spreadsheet ID: `[REDACTED_ID]`
- Apps Script project (Script ID): `[REDACTED_ID]`
- It has `Schema_Registry` and `Schema_Change_Log`. Both Web App and API Executable deployments exist on it.

**Original (DO NOT TOUCH):** spreadsheet `[REDACTED_ID]`, script `[REDACTED_ID]`.

The owner does not know which copy the repo's code last targeted. Step 0 resolves that.

**Data already exported** to `C:\Users\craya\GitHub\szs-bridge HUD\local_data\` (Google's default names):
- `Working Copy of SZS Master Control - Alfred_Alerts.csv` (1,168 bytes)
- `Working Copy of SZS Master Control - Clients.csv` (30,141 bytes)
- `Working Copy of SZS Master Control - Finances.csv` (26,726 bytes)
- `Working Copy of SZS Master Control - Projects.csv` (1,040 bytes; suspiciously small next to Clients, report the row counts)
- `Working Copy of SZS Master Control - Services_Rates.csv` is now present and
  has 3 data rows.

**The app reads** `apps\command-hud\local-data\`. The five exports have been
imported there with `npm run data:import`; latest validated counts are Clients
12, Projects 6, Finances 4, Alerts 4, and Services_Rates 3. See
`docs/active/PROGRESS.md` for rejected and ignored row counts.

**Real headers (the app's mapping must handle these):**
- Clients: `ClientID, First_Name, Last_Name, Company_Name, ContactEmail, GoogleGroupEmail, Archetype, AccountPhase, ActiveRoadblock, ContractValue, DepositPaid, CurrentMilestone, CompletedMilestones, TotalMilestones, DriveFolderUrl, ChatSpaceUrl, NotesDocUrl, MSA_DocID, Tech_Stack, MCC_Subscriber_ID, Oracle_Baseline_ID` (AccountPhase is column H)
- Projects: `ProjectID, ClientID, ProjectName, SprintStage, AssignedRateTier, SOW_DocID, Project_Brief_DocID, Project_Outline_DocID, COMS_Sheet_URL, Google_Tasklist_ID, MeetingNotes_DriveFolderID, ChatSpaceURL, ChatSpace_Internal_URL, Est_Hours, Actual_Hours, ParentProjectID, AddendumRef, ActiveComponents` (SprintStage is column D, `Google_Tasklist_ID` is column J). `ParentProjectID` and `AddendumRef` already exist.
- Finances: `InvoiceID, ClientID, ProjectID, InvoiceNumber, MilestoneStage, TotalContractValue, DepositAmount, InvoiceAmount, DepositPaid, Remaining_Balance, InvoiceStatus, PaymentDate, Est_Hours_Allocation, Actual_Hours_Worked, EffectiveHourlyRate, EstimatedQuarterlyTax, OverheadCosts, NetMargin`. `ProjectID` already exists.
- Alfred_Alerts: `Alert_ID, Timestamp, ClientID, Priority, Category, Message, Action_URL, Dismissed_Status, Created_At, Source_Module, Department, Client_ID, Project_ID, Entity_Reference, Severity, Trigger_Condition, Prescribed_Action, Due_SLA, Assigned_Lead, Action_Status, Resolved_At`. It carries legacy columns (`ClientID`, `Priority`, `Category`) beside the newer shape (`Client_ID`, `Severity`, ...). Treat the newer ones as canonical and the legacy ones as fallbacks.

**Stage lists (canonical, from the v7 docs and what the HUD already shows):**
- AccountPhase (Clients): `01: Intake`, `02: Session Zero`, `03: Active Sprints`, `04: Liftoff`, `05: Complete`, `06: Archived/Sunset`.
- SprintStage (Projects): `00: Discovery`, `01: Vibecheck`, `02: Contract & Inception`, `03: Deep Intelligence`, `04: Session Zero Kickoff`, `05: Architecture & Builds`, `06: Mid-Flight Review`, `07: Final Staging & QA`, `08: Liftoff & Handover`, `09: Sunset / Retainer`.
- These are the canonical persisted labels; HUD enums, controls, and current
  directives must use them. Legacy stored values may be normalized for reads,
  but must not be used as current dropdown options.

**Owner decisions (settled):**
- Views change what is shown. **Universe** = clients grouped by `AccountPhase`. **Galaxy** = projects grouped by `SprintStage`. **Solar** = one client's workbench showing **both**. **Planet** = per-project execution page. The old four macro lanes (Intake / Session Zero / Active Sprints / Liftoff as the only columns) must not appear anywhere again.
- Kanban-style columns are fine. A phase or stage column can be collapsed, but it must still be visible as a slim tab with an arrow and a count that pulls it back out. `05: Complete` and `06: Archived/Sunset` are collapsed by default.
- A client's AccountPhase is **derived** from its projects with a **manual override that always wins**. Rule: any project at 05–07 gives `03: Active Sprints`; else any at 02–04 gives `02: Session Zero`; else any at 00–01 gives `01: Intake`; all projects at 08 gives `04: Liftoff`; 09 gives `06: Archived/Sunset`; `05: Complete` is set by hand only.
- Tasks live on the project's own Google Tasks list, whose ID is in `Projects.Google_Tasklist_ID`. Completing a task means completing it on that list.
- Writes the owner wants: create/complete tasks, run reports, change phase/stage by dragging, resolve alerts. Money changes keep the confirmation dialog.
- Planet layout: **Gantt in the center, project details on the side, task list below the Gantt.**
- Reports v1: status summary (read-only), invoice draft (through the confirmation dialog), OSINT sweep (only logs a "requested" item for Oracle; it does not run anything).
- Everything reads from the **Master Control tabs** only for now. Lead, COMS, and MCC data come later through Master Control.
- Local git commits are allowed after every step. Never push.

## 2. Owner to-do list (exact steps)

**A. Do now (about 5 minutes)**
1. Save this file into the repo. In PowerShell:
```
Move-Item "$env:USERPROFILE\Downloads\HUD_LIVE_DATA_MASTER_PLAN.md" "C:\Users\craya\GitHub\szs-bridge HUD\docs\active\" -Force
```
2. Stop every old dev server: in each PowerShell window running `npm run dev`, press `Ctrl+C`. Close every browser tab on `127.0.0.1` or `localhost`.
3. Export `Services_Rates` from the working copy:
   - Open https://docs.google.com/spreadsheets/d/[REDACTED_ID]/edit
   - Click the **Services_Rates** tab at the bottom, then **File → Download → Comma Separated Values (.csv)**.
   - Optional but helpful: repeat for the **Schema_Registry** and **Schema_Change_Log** tabs.
   - Then move the downloads into the data folder:
```
Move-Item "$env:USERPROFILE\Downloads\Working Copy of SZS Master Control - *.csv" "C:\Users\craya\GitHub\szs-bridge HUD\local_data\" -Force
```
4. Tell the bot: **"Read docs/active/HUD_LIVE_DATA_MASTER_PLAN.md and execute it from Step 0. You have full autonomy inside it."**

**B. Only when the bot asks (it must give you exact steps each time)**
- Run `clasp login` once if clasp says you are not logged in (a browser window opens; pick your Google account).
- Run the function `authorizeHudScopes` once in the working-copy script editor to grant new permissions: open https://script.google.com/home/projects/[REDACTED_ID]/edit, pick `authorizeHudScopes` in the function dropdown at the top, click **Run**, then **Review permissions**, choose your account, **Advanced**, **Go to (project name) (unsafe)**, **Allow**.
- Compare row counts when the bot reports them (see Step 1 test).
- Answer the questions in section 9.
- Final click-through: section 8.

## 3. Step 0: Setup and safety net (no feature work yet)

1. From the repo root run `git status`. Create a branch `live-data`. Commit **all** current uncommitted work as `checkpoint: before live-data plan`. The old secrets-scan rule that blocked commits is waived by the owner for this plan.
2. Add these lines to `.gitignore` (so raw exports never get committed by accident): `local_data/` and `apps/command-hud/local-data/*.csv`.
3. **Dev server:** inspect ports 3000–3010 (`Get-NetTCPConnection`) and stop only confirmed stray repository processes. Bind Vite to `127.0.0.1:3002` with `strictPort = true`; never auto-select another port because Google OAuth is registered only for this exact origin. Start once and report the URL.
4. **Clasp target:** find `.clasp.json` and report its script ID. Compare it with the working-copy Script ID in section 1.
   - Run `clasp pull` into a temporary folder (not into `engines/master-control/`), diff it against `engines/master-control/`, and report the file differences.
   - The repo must end up as a **superset**: never lose a function that exists only in the working copy (for example `Schema_Control.gs` or the Police hook). Merge, then point `.clasp.json` at the working-copy Script ID.
   - Before the first `clasp push`, save a backup of the remote files to `docs/private/backups/working-copy-<date>/`.
   - Never run `clasp push` while `.clasp.json` points at the original script.
5. Create `docs/active/PROGRESS.md`.

## 4. Step 1: Real data in (snapshot mode, no sign-in)

1. Add `npm run data:import` at the repo root. It finds files in `local_data\` named `* - <Tab>.csv` and copies them to `apps\command-hud\local-data\` with these names:

| Tab | Destination file |
|---|---|
| Clients | `clients.csv` |
| Projects | `projects.csv` |
| Finances | `finances.csv` |
| Alfred_Alerts | `alerts.csv` |
| Services_Rates | `services_rates.csv` |
| Schema_Registry | `schema_registry.csv` (optional) |
| Schema_Change_Log | `schema_change_log.csv` (optional) |

   It prints the **data row count** of each file and warns about any missing file. The owner re-runs it after any new export.
2. Run it. Fix the snapshot adapter's header mapping against the real headers in section 1 (including the duplicate `ClientID` / `Client_ID` in alerts). Handle multi-line cells and quoted commas. Use the stage lists in section 1 for the Zod enums.
3. Bad rows must be skipped with a plain-English reason, listed from the existing status strip, never a crash.
4. Report per file: rows loaded, rows rejected with reasons, and 3 sample values from Clients and Projects. Investigate why `Projects.csv` is so small.

**Owner test:** compare the importer’s loaded counts with the number of keyed
records in the **Clients** and **Projects** tabs. Do not compare against the
physical last row: formula-filled rows make that row number larger than the
number of actual records.

## 5. Step 2: Layout cleanup, navigation shell, Universe and Galaxy

**5.1 Stop the shrinking.** Find and remove every auto-scaling behavior: anything that re-fits the camera on resize or view change, CSS `scale`, `--ui-scale`, fixed minimum sizes that force overflow, and responsive collapses that shrink panels. Layout must be fluid. The camera changes only when the user zooms/pans, presses Recenter/Fit, or on the first open of a view. **Remember per-view camera and the selected view** (store plus `localStorage`) so switching views or reloading does not reset them.

**5.2 Remove the department badges from the top-right of the top bar.** They duplicate the A/P/O/D/V/D rail on the left and the dispatch drawer. Keep the alert dots/counts on the left rail buttons and the drawer's own lists. Nothing else replaces them.

**5.3 Move the floating canvas toolbar into the top bar.** The overlay (`absolute top-3 left-4 z-40`, containing DRAG / LOCK / EDIT, SATELLITES, zoom −/%/+, RECENTER) must go. Replace it with one small **▾ button inside the existing top bar next to the SOLAR MAP selector**, closed by default, containing the same controls. Keep the hotkeys `Alt+0` / `Home` for recenter. A read-only zoom % may sit in the bottom status strip. Nothing may float over the canvas except nodes and wires.

**5.4 Breadcrumb navigation** in the top bar: `Universe › Galaxy › <Client> › <Project>`, each crumb clickable. `Esc` goes up one level. Collapse to `… › <Client>` on narrow windows. Keep the existing `Ctrl+[1-9]` / `Alt+[1-9]` jump to Solar. Default drill rules: double-click a client card in Universe opens Galaxy filtered to that client; double-click a project card in Galaxy opens Solar for that client with that project selected; double-click a project/service node in Solar opens Planet (Step 5).

**5.5 Universe view** (new default view): Kanban of **client cards** across six columns by `AccountPhase`. `05` and `06` are collapsed by default into slim edge tabs with an arrow and a count; clicking expands them in place. Card: company, contract value, deposit status, the client's most advanced SprintStage, open alert count. Top strip: client count per phase, pipeline total. Dragging a card to another column sets AccountPhase to **manual** (Step 4 writes it; until then see 5.7).

**5.6 Galaxy view:** replaces the old four-lane `TacticalCanvas` columns. Ten columns by `SprintStage` (`00`..`09`) on the existing pannable/zoomable canvas, **project cards** (project name, client, rate tier, est/actual hours, open task count), colored by the owning client's derived phase (color is only a tint on the card; do **not** group columns under macro zones). Optional filter by client (from the breadcrumb). Any empty or collapsed column still shows its slim tab with arrow and count. Dragging a project card to another column changes its SprintStage.

**5.7 Make moves stick even before live writes.** In snapshot mode, keep drags as a **local overlay** (`localStorage`, key `szs.overlay.v1`) merged over the CSV data, with a badge in the status strip: "N local changes not in sheet". When a live write is confirmed (Step 4), drop the overlay entry. This fixes "it forgets the new AccountPhase".

**5.8 Solar:** show both the AccountPhase chip and the SprintStage track on the Sun. Do not otherwise change Solar.

**5.9 Derived phase:** implement the derive rule from section 1 as one pure, unit-tested function. For clients in `auto` mode show the derived phase; if the sheet's `AccountPhase` differs, show a small "sheet says X" note and a Housekeeping `INFO` item.

**Acceptance:** with real CSV data loaded, Universe shows real clients by AccountPhase, Galaxy shows real projects by SprintStage, no old four-lane layout exists in the code or UI, collapsed columns have visible arrow tabs, the top bar has the ▾ and the breadcrumb and no department badges, nothing auto-shrinks, and a dragged card survives a browser reload.

**Implementation checkpoint (2026-10-31):** Step 2's navigation, Universe
client board, ten-stage Galaxy project board, local snapshot overlay, derived
phase behavior, camera controls, and Solar breadcrumbs are implemented.
Verification passed at 1680x1050 and 762x1366; the portrait view had no
horizontal overflow. Browser checks confirmed ten Galaxy stages, all six
projects when unfiltered, drill-down to Solar with a selected project, Esc
back-navigation, Galaxy pan/zoom persistence, and an HTML5 drop from
`01: Intake` to `02: Session Zero` stored only in the local overlay. The test
overlay and camera changes were cleared/reset afterward. `npm run lint`,
`npm test` (53/53), and `npm run build` passed; build reports the existing
large-chunk warning. The owner then confirmed physically dragging a card
between boards and refreshing; it remained in the changed board, completing
the drag-persistence acceptance. The synthetic HTML5 drop and overlay path
also work. Task counts remain unavailable until a Tasks connection is
configured. No live write or commit was made.

## 6. Step 3: Live reads (Master Control to HUD)

Goal: the HUD reads the working copy directly, with CSV snapshot as the fallback.

1. **Find the transport that already works.** The owner confirmed Google sign-in works, and a service-attach test previously wrote to a disposable copy, so something already reaches Master Control. Read `api.ts` and the auth code and report which route it uses (Web App `/exec` or Apps Script API `scripts.run`). **Keep that route.** If you cannot tell, use the API Executable route (`scripts.run`) as the v7 docs describe. Do not ask the owner which one; decide and report.
2. Add `engines/master-control/HUD_API.gs` (new file) with **read-only** functions, each guarded by the existing `AUTHORIZED_USER_EMAILS` check:
   - `hud_getSnapshot()` returns Clients, Projects, Finances, Services_Rates, Alfred_Alerts, Schema_Registry, Schema_Change_Log as arrays of objects keyed by header name, plus a `schemaVersion` and `generatedAt`.
   - `hud_getProjectTasks(projectId)` (used in Step 5) reads the project's Google Tasks list via `Projects.Google_Tasklist_ID`.
3. Add `authorizeHudScopes()` (touches Spreadsheet, Drive, and Tasks once so the owner can grant permissions in one click path). Enable the Tasks advanced service and add the scope in `appsscript.json` if missing. Verify on the working copy.
4. Deploy: `clasp push`, then update the existing API Executable deployment (`clasp deployments`, then `clasp deploy -i <deploymentId>`) so `scripts.run` sees the new version. Report which deployment IDs were updated.
5. Finish `LiveAdapter`: `VITE_DATA_MODE=live|snapshot|mock`. If live fails, fall back to snapshot and show why in plain English on the status strip. Status values `live / stale / snapshot / mock / offline`. Refresh on load and on a manual Refresh action plus every 60 seconds while the tab is visible.
6. Run the same Zod validation on live rows as on CSV rows.

**Owner test:** the bot gives exact steps for `clasp login` / `authorizeHudScopes` if needed. Then the status strip shows `LIVE`, and 3 values (client count, one client's contract value, one project's SprintStage) match the sheet.

### Implementation status — 2026-10-31

The Step 3 code is implemented and deployed to the owner-verified Working
Copy. `HUD_API.gs` provides authorized read-only snapshot and project-task
endpoints plus `authorizeHudScopes()`; `LiveAdapter` reuses CSV/Zod mapping,
supports visible-tab polling and manual refresh, and falls back to the CSV
snapshot with a visible reason. The Apps Script source fails closed if no
Master Control target is configured. The owner confirmed the Working Copy
target and the `MASTER_CONTROL_SHEET_ID`, `ORACLE_DB_ID`, and `MCC_DB_ID`
Script Properties.

The eight-file remote source backup is retained at
`docs/private/backups/working-copy-2026-10-31/`. After complete diff review
and explicit owner approval, 10 files were pushed and version 3 was deployed
through an isolated Clasp config; the repository Clasp config still targets
Original and was not used. The Tasks scope is included. Three existing
deployments had no descriptions, so a new deployment was created rather than
updating an unidentified deployment. A version-3 pull matched the reviewed
staging files 10/10.

**Verification update (2026-11-01; supersedes the initial API execution
blocker above):** the HUD now reads the Working Copy through its API
Executable deployment. The owner confirmed `DATA LIVE` and compared the
12-client count, one contract value, and one project stage against the
Working Copy; all three matched. Invalid optional Schema Registry rows are
skipped with visible warnings and do not block the valid core data.

**Verification update (2026-11-02):** the local HUD still shows `DATA LIVE`.
The current snapshot skips 69 invalid Schema Registry rows, summarized as a
count and two examples. The count-only task summary control is wired in Galaxy,
but all six current projects lack a configured Google Tasks list, so the
project-task endpoint remains unverified. No Master Control data write has
been run through the HUD.

## 7. Step 4: Writes (HUD actions into the databases)

**One write path.** Every write goes through a single Apps Script entry `hud_write(action, payload, requestId)` that: checks the allowlist; takes the script lock with a 30-second wait and releases it in `finally`; rejects a repeated `requestId` (idempotency); appends a row to a new tab **`HUD_Audit_Log`** (timestamp, user, action, entity, before, after, requestId); performs the change; reads it back; returns `{ ok, before, after }`. Create `HUD_Audit_Log` additively and log it in `Schema_Registry` / `Schema_Change_Log`.

**Actions (build in this order):**
1. `setAccountPhase(clientId, phase, mode)` writes `Clients.AccountPhase`. Add an additive column `AccountPhase_Mode` (`auto` or `manual`, default `auto`) at the far right of `Clients`; log it as an approved schema change (the owner approved the manual-override design). Dragging in Universe sets `manual`; a "Reset to auto" menu item sets `auto` and rewrites the derived value.
2. `setSprintStage(projectId, stage)` writes `Projects.SprintStage`. For a client in `auto` mode, recompute and write `AccountPhase` in the same call.
3. `resolveAlert(alertId, status)` updates `Action_Status`, `Dismissed_Status`, and `Resolved_At` on `Alfred_Alerts`.
4. Service attach already exists; leave it and its confirmation dialog alone.
5. Contract value and deposit changes: through the existing Financial Mutation confirmation only.
6. Task actions are Step 5.

Dragging to `06: Archived/Sunset`: write the phase and add an `Alfred_Alerts` row (`Department: Daisy`, `Action_Status: Requested`, message "Sunset requested") so Daisy's workflow can act. The HUD does **not** move Drive folders.

**HUD behavior:** optimistic update with a "saving…" marker, then confirmed from the read-back; on failure, revert the card and show the reason. Remove the local overlay entry on success.

**Tests:** create fake client `ZZZ` / project `ZZZ-01` on the working copy, exercise every action, confirm `HUD_Audit_Log` rows and read-backs, then delete the fake rows. Unit tests for the derive rule, the write queue, retries, and idempotency.

### Implementation status — 2026-11-01

The local implementation adds the authorized `hud_write` entry, additive
`AccountPhase_Mode` and audit/schema registration, server-side stage gating,
request-ID duplicate rejection, read-back confirmation, rollback, and the
approved Sunset alert. The HUD client now sends phase, stage, and alert
updates; shows optimistic saving state; reverts on failure; supports resetting
to automatic phase derivation; and resolves/reopens alerts. Snapshot changes
remain local overlays, including manual/automatic mode overrides.

Verification: 59 HUD tests and 42 Master Control VM tests pass; root lint and
build pass (the existing large-chunk warning remains). VM tests cover manual
and auto phase changes, stage gates, resolve/reopen, Sunset alert creation,
authorization, request-ID duplication, failed writes, and read-back rollback.
That was the initial local-only checkpoint. Live stage-gate verification and
the current Working Copy deployment status are recorded in the Step 5 update
below; the live AccountPhase mutation and manual audit-sheet inspection remain
unverified.

## 8. Step 5: Planet view and Google Tasks

1. **Route:** `/client/:clientId/project/:projectId` as a real DOM page, lazy-loaded; `Esc` or the breadcrumb returns to Solar with the camera restored. Reachable by double-clicking a project/service node in Solar.
2. **Layout:** Gantt in the **center**; project details panel on the **side** (right); task list **below** the Gantt.
   - Details: project name, SprintStage, rate tier, est vs actual hours, links built from `SOW_DocID`, `Project_Brief_DocID`, `Project_Outline_DocID` (`https://docs.google.com/document/d/<id>/edit`), `COMS_Sheet_URL`, `MeetingNotes_DriveFolderID`, chat spaces; the client summary; the project's invoices from `Finances` by `ProjectID`.
   - Gantt v1: a 45-day cadence axis from project kickoff, SprintStage markers, and task bars/markers by due date grouped under parent tasks. Google Tasks has due date but no start date or duration, so a bar starts from an optional `Start: YYYY-MM-DD` line in the task's notes, otherwise it is a marker on the due date. Completed, upcoming, and overdue use different colors. Do not build drag-to-reschedule yet.
   - Task list: title, due, status, notes, parent/subtask indentation, virtualized past ~100 rows.
3. **Task writes** (`hud_getProjectTasks` is a read; add writes through `hud_write`): `createTask(projectId, {title, notes, due, parent})` and `completeTask(projectId, taskId)` / `reopenTask`, performed on the list named by `Projects.Google_Tasklist_ID`. Confirm by read-back.
4. Verify that the Google account running the script owns the lists (try a `Tasks.Tasklists.get`). If not, report exactly which account is needed.
5. Test on `ZZZ-01` with a throwaway Google Tasks list, then delete it.

### Current implementation status — 2026-11-02

The HUD has a count-only task response parser and an on-demand Galaxy control
for projects with a configured `Google_Tasklist_ID`. The control does not
display task contents. The owner-approved Working Copy test on SolarPulse
Energy's `SE-01` created a uniquely named temporary list with one task, and
the Galaxy control confirmed **1 open / 1 total**.
The owner authorized temporary task-test materials and changed the test target
from fake `ZZZ-01` to SolarPulse Energy (`SE-01`), with cleanup afterward.
This is a test-only exception to the plan's fake-record-only write rule; it
supersedes the prior fake-only test target and also authorizes similar tests on
other existing clients/projects. This verification used `SE-01` first. The owner
confirmed the Working Copy target and that its Google services are active.

The temporary cleanup helper cleared `SE-01.Google_Tasklist_ID` through the
audited writer, then failed to delete the list because
`Tasks.Tasklists.delete` is not available in the Apps Script advanced
service. The exact test list and its task were verified and deleted in Google
Tasks. A final live snapshot confirmed the task-list field blank and the
project still at `04: Session Zero Kickoff`. The temporary setup/cleanup
endpoints and their `setProjectTaskListId` writer action were removed from the
source and VM tests; cleanup was pushed to the verified Working Copy as
version 8 and the existing HUD API deployment was updated to version 8.

A safe same-stage-04 request was rejected by the server gate because the
required `DepositPaid`, `MSA_DocID`, and `SOW_DocID` conditions were not met;
read-back confirmed no stage change. `SE-01` remains in auto phase mode with
raw `AccountPhase` `02: Inception`, mapped by the HUD to `02: Session Zero`.
The approved attempt to write canonical `02: Session Zero` was rejected with
the sheet's approved-list validation error. A fresh live snapshot verified
rollback: the raw phase remains `02: Inception`, mode remains `auto`, stage
remains `04: Session Zero Kickoff`, and the task-list field remains blank. The
owner confirms that Working Copy `Clients` column H currently has the
appropriate canonical `01`–`06` AccountPhase options. The tracked
`DatabaseGuardrails.js` source has since been aligned with the canonical
options, but this source change was not deployed or executed and does not
explain the rejection. The rejection's cause remains unresolved; inspect the
active writer deployment and live validation details before retrying. No live
validation change was made. The latest live read reports 79 invalid optional
Schema Registry rows, which remain warnings.

The live task-count read and stage-gate check are verified. The manual/auto
AccountPhase mutation and manual audit-sheet inspection, full Planet view,
and task writes remain incomplete. Final validation passed: Master Control
router tests 33/33, root lint, HUD tests 60/60, root build (existing >500 KB
chunk warning), and `git diff --check` (Windows line-ending notices only).

## 9. Step 6: Reports

1. **Status summary:** read-only modal for the selected client (phase, stage, finances, open alerts, task counts).
2. **Invoice draft:** creates a draft invoice from the invoice master template (use the private link registry in `docs/private/` for the template location) into the client's Drive folder, **through the Financial Mutation confirmation**. Log it in `HUD_Audit_Log`.
3. **OSINT sweep:** only adds an `Alfred_Alerts` row (`Department: Oracle`, `Action_Status: Requested`). It runs nothing and touches nothing in `quarantine/oracle-mmd/`.
4. Reports live in the existing dispatch drawer or a client context menu; add no new always-visible surface.

## 10. Step 7: Verify and report

Run lint, build, and all tests, then do a browser pass at 1680x1050 and 762x1366. Update `PROGRESS.md`. Give the owner this final click-through, with the real client and project names filled in from his data:

1. Start the app (`npm run dev` from the repo root) and open the exact URL you print. The status strip shows `LIVE` (or `SNAPSHOT` with the reason).
2. Universe: real clients are in AccountPhase columns; `05` and `06` are collapsed tabs with arrows that expand.
3. Drag one client card to another phase, refresh the page: it stays. Check the sheet's `Clients` tab and `HUD_Audit_Log`.
4. Open Galaxy: real projects in 10 SprintStage columns. Drag one project card forward one stage, refresh, check the sheet.
5. Double-click a project: Solar opens with both AccountPhase and SprintStage. Drag, zoom, and the bays all work.
6. Double-click a project node: Planet opens with Gantt center, details side, tasks below. Complete one task and see it complete in Google Tasks.
7. The top bar has no department badges and no floating toolbar; the ▾ holds the old controls; the breadcrumb works; `Esc` goes up.
8. Resize the window: nothing shrinks on its own.

## 11. Questions to ask the owner (put these in your first report; start working on the defaults and change course if he answers differently)

1. **Drill rules** (default in 5.4): Universe client double-click → Galaxy filtered to that client; Galaxy project double-click → Solar; Solar project node double-click → Planet. OK?
2. **Gantt starts** (default in Step 5): bars start from an optional `Start:` line in task notes; otherwise markers on the due date. OK, or does the project brief carry real start dates somewhere?
3. **Alerts columns** (default in section 1): treat `Client_ID` and `Severity` as canonical and `ClientID`, `Priority`, `Category` as fallbacks. OK?
4. **Sunset** (default in Step 4): dragging to `06` writes the phase and adds a "Sunset requested" alert for Daisy, and does not move Drive folders. OK?
5. Anything you found in the repo or sheets that contradicts section 1. Quote it and propose the fix instead of silently changing course.

## 12. Report format (every step)

```
Step:
Needs owner (exact copy-paste commands or exact clicks, or "none"):
What changed (files):
What I ran and the results:
Row counts / values compared:
What I could not verify:
Defaults I used:
Next step:
```
