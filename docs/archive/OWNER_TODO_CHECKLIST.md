> **Superseded by Master Plan v3.1** ([`docs/archive/SZS_HUD_MASTER_PLAN_v3.1.md`](./SZS_HUD_MASTER_PLAN_v3.1.md), itself completed 2026-11-05).

# Owner To-Do Checklist: meeting the bot in the middle

**Status:** active. **Place at:** `docs/active/OWNER_TODO_CHECKLIST.md` (the bot reads Part B).
**Legend:** `[ ]` to do, `[~]` partial/deferred, `[x]` done. **Test:** how to prove it worked. Always do Apps Script work on a **copy** of Master Control first.

**Division of labor**

| You (and Apps Script) | The coder bot |
|---|---|
| Everything inside Google: Master Control, COMS, persona sheet, registry, secrets | Everything inside the repo: HUD code, tests, docs |
| Decisions in Part B | Uses your answer, or the stated default |
| Approves schema changes | Never edits `engines/master-control/` |

## Current answer and progress record (2026-10-31)

This section separates owner answers from defaults used by the bot. A default is
not an owner approval for a live schema change, finance action, deployment, or
credential rotation.

### Explicit owner answers and clarifications

- **D1-D5:** No suggested rules are approved; do not build uninstall until there
  is a need; pull chevrons are hollow; wire controls belong in the
  Multi-Agent Dispatch Wires tab while AlfredDock stays dormant; and the
  minimal link rollback model is acceptable.
- **D6:** The department notification ribbon was approved earlier. It is
  implemented in the existing SkyHeader top bar.
- **D19:** The requested destination is a `Client_Journey` tab in Master
  Control, owned by Daisy and joined to Clients/Projects; MCC retains
  responsibility for sends. This is a requested design, not evidence that the
  schema change was approved/applied.
- **OAuth:** The owner confirmed Google sign-in works. This confirms HUD
  authentication only; it does not identify which Master Control deployment
  type is authoritative or prove live snapshot/Finance/schema endpoints work.
- **Working Copy deployment (2026-10-31):** The owner confirmed both
  downstream Script Properties are set and explicitly approved the dated
  private backup, full local project push/deployment, and Tasks scope. The
  backup and diff review are complete; 10 files were pushed and version 3 was
  deployed as a new deployment through an isolated Clasp config. Three
  existing deployments had no descriptions, so none was selected for update.
  The deployed source was pulled back and matched the staged files 10/10.
  No live data write was made. The owner subsequently ran
  `authorizeHudScopes()` in the Working Copy editor and reported
  **Execution Completed** with API access enabled, and the read-only
  `hud_getSnapshot()` succeeded from the editor. The owner reports the Original
  is linked to the standard GCP project and has Web App and API deployments;
  the owner confirms the Working Copy uses the OAuth client's project. The
  only approved local development origin is `http://127.0.0.1:3002`; 3001
  fails with `origin_mismatch`. A browser `scripts.run` call
  returned HTTP 403; the HUD was also passing the project Script ID where
  Google's API requires an API Executable deployment ID. The code now uses
  `VITE_APPS_SCRIPT_DEPLOYMENT_ID`, but the incorrect Web App ID was removed
  from local config. Verify the Working Copy's Cloud project, enable the Apps
  Script API, deploy the Working Copy as an API Executable with Workspace
  access, and record that deployment ID privately. No HUD API snapshot or task
  read is verified. No IDs or credential values belong in this tracked
  checklist.
- **Cloud project alignment:** The owner chose to keep the Apps Script
  project's current standard GCP project and use an OAuth client from that
  project for the HUD. A client ID was added to the private registry. The
  owner confirms the Original and Working Copy use the OAuth client's standard
  GCP project. Use only `http://127.0.0.1:3002` for local OAuth; other ports
  can fail origin validation. The client
  prefix still does not match the recorded Cloud Project Number; reconcile it
  privately. The HUD now requires an API Executable deployment
  ID; local config remains empty until one is created for the Working Copy.
  Verify the Apps Script API is enabled, deploy as API Executable, and
  record the deployment ID privately. Never send IDs or credentials.
- **Local CSV snapshot:** The owner clarified that the snapshot consists of the
  five files (`clients.csv`, `projects.csv`, `finances.csv`, `alerts.csv`, and
  `services_rates.csv`), not a separate `snapshot.csv`, and authorized reading
  the sheets to make CSVs. The five exports were imported read-only into the
  ignored app-local snapshot. Latest counts: Clients 12 loaded / 0 rejected;
  Projects 6 / 0; Finances 4 / 27; Alerts 4 / 3; Services_Rates 3 / 0.
  Formula/blank rows ignored: 987, 0, 968, 0, and 0 respectively. Twenty-seven
  finance rows lack a client ID; three alerts have client IDs outside the
  validated format. No source values or IDs were included in the report.
- **Private registry:** The owner authorized it as a read-only reference for
  testing and said credential/security cleanup should happen after the HUD is
  working. Keep it private and untracked; do not reproduce its contents in
  reports or commit it. The security cleanup is deferred, not completed.
- **Phase work:** The owner asked to proceed through the remaining Phase 3
  blocks. This authorizes implementation within the approved plan, not
  unapproved spreadsheet schema changes, production writes, or finance-flow
  changes.
- **Master Plan decisions (2026-10-31):** the owner confirmed the plan defaults
  for navigation drill rules, Gantt start parsing, alert field precedence, and
  Sunset behavior; reported no contradictions; and said they would export
  `Services_Rates`. The file has since appeared in root `local_data/` and
  currently contains 3 data rows. These answers approve the described design,
  not live writes to real client records; write tests remain restricted to
  `ZZZ` / `ZZZ-01`.
- **Invalid alert client references:** the owner chose to keep rejecting the
  three rows whose client IDs do not match the validated ID format, rather
  than display them without a client link.
- **Step 2 drag acceptance (2026-10-31):** the owner physically dragged a
  client card between Universe columns and refreshed; the card remained in
  the changed board. This confirms browser-local persistence and completes
  Step 2's drag acceptance. The change is only in this browser's snapshot
  overlay, not written to Master Control.

### Partially answered or still requiring owner action

1. **D15 — API route and Working Copy (partially complete):** The owner
   confirmed the route is Apps Script API `scripts.run`, privately verified
   the Working Copy Script ID, confirmed its `MASTER_CONTROL_SHEET_ID`
   Script Property, and confirmed the Clasp account has access. A read-only
   pull initially failed, then succeeded with a separate explicit Working
   Copy config (eight files). The 10-file project was later pushed and
   deployed as version 3. The recorded Working Copy deployment is a Web App,
   not an API Executable. The ignored app-local
   `VITE_APPS_SCRIPT_DEPLOYMENT_ID` remains empty until a Working Copy API
   Executable deployment is created. The repository Clasp config still targets
   Original and must not be used.

   **Still needs owner:** confirm whether `ORACLE_DB_ID` and `MCC_DB_ID` are
   set in Working Copy Script Properties; if not, downstream sync remains
   inactive until those properties are configured. Explicitly authorize a
   dated private backup and Working Copy push/deployment after the complete
   diff is reviewed. The pulled Working Copy manifest lacks the Tasks scope;
   the local manifest includes it, so deployment will require scope
   authorization. No IDs or property values should be sent in chat.
2. **D17 — final invoice stage:** Still open. No SprintStage is selected; keep
   the final-invoice stage unspecified and do not infer one.
3. **D7-D14, D16, D18:** No separate owner answer is recorded in the answer
   column. Their listed defaults have been used for implementation where
   applicable; record them as defaults, not as explicit owner approvals.
4. **D9/D10/C13 — schema changes:** No approval to add `ParentProjectID`,
   `AddendumRef`, or `Finances.ProjectID` is recorded. Do not add them unless
   their stated conditions are met and the owner approves. D19's requested
   `Client_Journey` design still needs the schema approval/application process.
5. **Gemini:** The owner confirmed OAuth, but Alfred's server-side Gemini
   requests returned HTTP 400 (invalid/rejected API key). The owner must
   verify or replace `GEMINI_API_KEY` in the repository-root `.env.local` and
   restart Vite; never paste the key into chat. Do not confuse Google sign-in
   OAuth with Gemini API-key validity.
6. **Snapshot data:** Current exports are in the ignored app-local snapshot.
   The mapper was checked against the real headers and all six Projects rows
   join to a client. Compare these sheet-to-HUD examples: `02: Inception` →
   `02: Session Zero`; `04: Session Zero Kickoff` remains unchanged; and
   `Normal ($85)` → `Normal`. Re-run `npm run data:import` from
   `C:\Users\craya\GitHub\szs-bridge HUD` after replacing any export. Inspect
   the rejected-row list in the HUD for the 27 unmatched finance rows and
   three invalid alert client references. Several project details (Google
   Tasks ID, estimated/actual hours, document/chat links, parent/addendum) and
   finance details (`ProjectID`, balance/tax/margin) are detected but not yet
   represented in HUD contracts or displayed; these remain implementation
   work, not missing exports.
7. **Block 8 catalog check:** `Services_Rates.csv` is now present under ignored
   root `local_data/` (3 data rows observed); it still needs a sanitized copy
   under `docs/private/inputs/`, along with `task_repositories.txt` containing
   repository names only. Do not copy raw client/contact data into the
   repository.
8. **Phase 2 closeout:** Decide whether to defer the money-proposal route or
   provide an already-approved integration path into the existing Financial
   Mutation confirmation. Remaining browser acceptance checks are listed in
   the Phase 2 audit. Native browser download capture was explicitly deferred.
9. **Live schema and end-to-end checks:** Confirm the authoritative deployment
   before live snapshot/schema tests. The Phase 3 Block 10 record lists
   remaining regression checks. `docs/PARKING_LOT.md` is absent.
10. **Security sweep:** Per the owner's direction, credential removal/rotation
    waits until the HUD is working. Before any commit/push, keep the private
    registry untracked and review the bearer-token/credential exposure, history,
    and remaining `VITE_API_SECRET_KEY` references. This is not a waiver to
    commit secrets.
---

## Part A. Before the bot starts (about 15 minutes)

- [x] **A1.** Put these in the repo under the paths shown:
  - `docs/`: `SZS_DB_LOGIC_AND_PERSONA_CHARTER.md`, `SZS_SCHEMA_CONTROL_SPEC.md`, `alfred-grounding-document-v7.md`, `copilot-instructions-v7.md`, `HUD_HANDOFF_SUMMARY.md`
  - `docs/active/`: `ANTIGRAVITY_PHASE2_IMPLEMENTATION_PLAN.md`, `ANTIGRAVITY_PHASE3_IMPLEMENTATION_PLAN.md`, `OWNER_TODO_CHECKLIST.md`
- [x] **A2.** Put `szs-master-template-link-registry.md` in **`docs/private/`**, not plain `docs/`. It lists Script IDs and deployment URLs, which must stay out of version control.
- [x] **A3.** Add to `.gitignore`: `docs/private/` and `.env*.local`. Verified from repo root with `git check-ignore -v docs/private/szs-master-template-link-registry.md .env.local`; both paths are ignored.
- [~] **A4.** Remove the bearer-token line from section 8 of the registry **before** anything is committed (see Part E). **Deferred per owner direction** until the HUD works; registry remains private/untracked and must not be committed. Complete removal and rotate any still-valid credential during the security sweep.
- [x ] **A5.** Tell the bot: *"Read docs/active/ANTIGRAVITY_PHASE3_IMPLEMENTATION_PLAN.md and follow it. Start with Block 0."*

**Test:** from the repo root run `git status` and `git check-ignore -v docs/private/szs-master-template-link-registry.md`. Expect: the registry is **not** listed as untracked, and `check-ignore` prints the matching `.gitignore` rule.

---

## Part B. Decisions (fill in; blank means the default is used)

Mark your answer by editing the **Your answer** column (`Y`, `N`, or text).

| ID | Decision | Default if blank | My recommendation | Your answer |
|---|---|---|---|---|
| D1 | Approve any `suggested` event rules? | None approved | Keep none until you've watched them propose for a week | None approved |
| D2 | Build a component "uninstall" that reverses the ledger (through the Financial Mutation gate)? | No | No, until a real need appears |Not until need appears |
| D3 | `pull` chevrons hollow, or truly reversed? | Hollow | Hollow | Hollow |
| D4 | Which existing filter/view control hosts the collapsed "Wires ▸" group? | Bot names the existing filter control and uses it | Fine | MultiAgentDispatch Wires tab; AlfredDock remains dormant |
| D5 | Is a minimal link undo stack acceptable until the command system exists? | Yes (only if none exists) | Yes | Yes; minimal rollback model |
| D6 | New always-visible element: department notification ribbon in the existing top bar | **Approved** (you asked for it). `N` = build the data layer only | Y | Approved earlier; implemented in the existing SkyHeader top bar. |
| D7 | Severity scale `INFO / WARN / BLOCK`; COMS `MEDIUM / HIGH / CRITICAL` map to them | Accept | Y | No separate answer recorded; default adopted for implementation. |
| D8 | Hub IDs win; COMS adds `Master_Client_ID` / `Master_Project_ID` mapping first | Yes | Y | No separate answer recorded; default used. |
| D9 | Add `Projects.ParentProjectID` and `AddendumRef` (SCH-0007) | **Not added**; connectors stay local-only visuals | Y, before the first multi-project client | No explicit approval recorded; keep not added unless the stated condition is met and owner approves. |
| D10 | Add `Finances.ProjectID` (SCH-0008) | Not added | Y, before the first multi-project client is billed | No explicit approval recorded; keep not added unless the stated condition is met and owner approves. |
| D11 | Three data tiers: raw, internal summary, client-safe | Adopt | Y | No separate answer recorded; default adopted for implementation. |
| D12 | Daisy is the single outbound voice to clients (all client-facing proposals route through her) | Adopt | Y | No separate answer recorded; default adopted for implementation. |
| D13 | Add `zod` dependency | Yes | Y | No separate answer recorded; default adopted; Zod is installed and used. |
| D14 | Dial scales: Compliance, Wit, Proactivity, Drift 0 to 1; Candor -1 to 1 | Adopt | Y | No separate answer recorded; default adopted for implementation. |
| D15 | Which Master Control deployment is live: Web App `/exec` (the registry) or API Executable (v7)? | Bot stays on mock data | Confirm after Part C | Master Plan default is API Executable when code route cannot be determined. `api.ts` uses `scripts.run`; confirm the configured deployment points to the working copy and verify live read endpoints. |
| D16 | HUD autonomy cap = proposal-only for every persona | Yes | Y | No separate answer recorded; project default adopted. Production rules remain suggestions. |
| D17 | Which SprintStage triggers the **final** invoice: 07, 08, or other? | Left unspecified; Vala shows "final invoice stage not set" | Tell me | **Still open.** Keep unspecified; do not infer a stage. |
| D18 | Typed joins for legacy IDs during migration (`ICA-02` ambiguity) | Adopt | Y | No separate answer recorded; default adopted and covered by typed-ID validation. |
| D19 | Where does the client journey and feedback log live (SCH-0010)? | Flagged only | A `Client_Journey` tab in Master Control owned by Daisy (it joins to Clients/Projects; MCC keeps the sends) | **Owner answer recorded:** use `Client_Journey`, owned by Daisy and joined to Clients/Projects; MCC keeps sends. Schema approval/application is still pending. |

- [~] **B1.** Partially answered. D1-D6 and D19 have owner answers recorded; D7-D14, D16, and D18 use defaults without a separate answer; D15 and D17 remain unanswered. See the status record above.

**Test:** per-block reports distinguish explicit answers from defaults and list only the defaults actually used. Do not treat an unanswered item as an owner approval.

---

## Part C. Apps Script work in Master Control (on a COPY first)

**Progress note:** C1-C11 remain checked as recorded in the existing checklist;
they were not independently revalidated during this documentation update.
C12 and C13 remain partial as detailed below.

You'll add **one new file**, `Schema_Control.gs`. It is additive: it never edits, reorders, or deletes existing tabs, columns, or rows. It has been syntax-checked and run against a mock spreadsheet, but **not** in real Apps Script, so treat step C4 onward as the first live test.

- [x ] **C1. Back up.** In Google Sheets: File, Make a copy of SZS Master Control. Do all of Part C on the copy until C9 passes.
- [x ] **C2. Add the file.** Open the copy's Apps Script project. Add a new script file named `Schema_Control`. Paste in `Schema_Control.gs` (provided separately). Save.
- [x ] **C3. Only if** the script is **not** bound to the sheet: Project Settings, Script Properties, add `MASTER_CONTROL_SHEET_ID` with the copy's ID. (Keep the ID out of the code.)
- [ x] **C4. Create the tabs.** Run `setupSchemaTabs` and approve the permissions prompt.
  - **Test:** tabs `Schema_Registry` and `Schema_Change_Log` exist with header rows. Run it **again**: nothing is duplicated or changed. Status, Severity, and Change_Type cells have dropdowns.
- [x ] **C5. Baseline the live schema.** Run `snapshotLiveSchemaToRegistry`.
  - **Test:** the registry has one row per non-empty header on `Clients`, `Projects`, `Finances`, `Services_Rates`, `Alfred_Alerts`. Spot-check that **`Clients` column `H` is `AccountPhase`** and **`Projects` column `D` is `SprintStage`**. Run it again: it adds 0 rows.
- [x ] **C6. Complete the registry** (this is Dolores's checklist job, done by you for now). For each row fill `Data_Type`, `Owner_Persona`, `Data_Class` (`public` / `internal` / `pii` / `secret`). For enums fill `Allowed_Values`: the 6 AccountPhase values and the 10 SprintStage values (from the Charter, section 4). Set `Schema_Version` to `1.0` when you're satisfied.
  - **Test:** no blank `Data_Class` on any row; AccountPhase and SprintStage rows list all values.
- [x ] **C7. Seed the known gaps.** Run `seedSchemaChangeLog`.
  - **Test:** 14 rows, `SCH-0001` to `SCH-0014`, all `Noted`. Run again: 0 added.
- [ x] **C8. Run the conformance check.** Run `runSchemaConformanceCheck`.
  - **Test 1 (clean):** the Logger says 0 new findings.
  - **Test 2 (drift):** on the **copy**, add a header `Test_Col` to the right of `Clients`, and `Sneaky` to `Finances`. Run the check. Expect exactly **2** new rows, source `police.schema`, status `Noted`: `Clients` as **WARN**, `Finances` as **BLOCK**. Run again: **no duplicates**. Delete the two test headers.
- [x ] **C9. Hook into Police (one line).** Open `Police_Engine.gs`, find `runSystemPoliceAudit`. Add near the end:
  ```javascript
  try { runSchemaConformanceCheck_({ alreadyLocked: true }); }
  catch (e) { Logger.log('Schema check failed: ' + e); }
  ```
  Use `alreadyLocked: true` **only if** that function already holds the script lock; otherwise use `false`.
  - **Test:** run `runSystemPoliceAudit` manually; Executions shows success; the Logger shows "Conformance check done". After the next 15-minute trigger, all executions are green and no duplicate findings appear.
- [x ] **C10. Alerts shape.** Run `reportAlertsHeaderGap`; it lists missing target columns. Add them to the **right** of the existing columns in `Alfred_Alerts` (never reorder or rename existing ones).
  - **Test:** run it again: the missing list is empty. Existing alert rows are untouched. Update the registry rows for the new columns.
- [x ] **C11. Police transparency review.** Open `Police_Engine.gs` and check: does it **log old value, new value, rule, and time before overwriting**? If not, paste the file (with IDs removed) back to me and I'll write a patch.
  - **Test:** after a deliberate conflict on the copy, the log shows a before/after entry.
- [~] **C12. Promote to live.** A disposable-copy service-attachment test was authorized and read back successfully; this does not establish that the full schema-control setup was promoted to the authoritative live Master Control. Confirm deployment target (D15) and complete the remaining approved live steps only after that confirmation.
- [~] **C13. Schema changes needing approval** (only after D9, D10, D19). D19 has a requested design, but no applied `Client_Journey` schema change is verified. D9/D10 columns remain unapproved/not added. Follow the approval/signature and copy-first steps before any schema mutation.
  - **Test:** the check returns 0 new findings after the change; the HUD shows no version mismatch.

---

## Part D. Sheet and document edits

**Progress note:** checked COMS and Personality Controls entries are carried
forward from the prior checklist and were not independently revalidated in
this update. D-1's README-tab item remains open. D-2 is partial: the
supersession notices are present in the repo documents, but the owner-maintained
Alfred document still contains the legacy wording.

### D-1. Personality Controls sheet
- [x ] Replace Daisy's Role, House Function, Relay_Pipeline, Primary_Payload with Charter section 7.4.
- [x ] In Alfred's Operational Rules, replace "90/10 ratio" with a line about the tunable `Wit_Allocation`.
- [? ] Add a README tab documenting dial scales (Charter 7.1). Still needs owner-side sheet work/verification.
- **Test:** the bot's `personas.config` values for any three personas match the sheet.

### D-2. v7 documents
- [~] In `alfred-grounding-document-v7.md` and `copilot-instructions-v7.md`: supersession notes now point to Charter sections 7.4 and 7.5. The old body text remains by design because these are owner-maintained reference documents; owner may replace it when ready.
- **Test:** supersession note is present in both files. The old `90/10` phrase still exists in the Alfred document body, so the former "zero hits" test is not satisfied; do not mistake a supersession note for a body rewrite.

### D-3. COMS (Oracle)
- [x ] Add `Master_Client_ID` and `Master_Project_ID` columns to `01_Client_Baseline` and fill them (SCH-0001/0002).
- [x ] Make tabs 11 to 13 use the same client ID style as tabs 00 to 10 (SCH-0003).
- [x ] Fix or remove the references to AST-005, 008, 009, 012, 014 in tab 13 (SCH-0004).
- [ x] Make tab 12's `Linked_Module_09_Action` codes point at real `MCC-DRIP-###` / `ALN-###` rows (SCH-0005).
- [ x] Add a `Data_Tier` value (raw / internal / client-safe) to each report output.
- **Test (dangling refs):** in tab 13 add a helper column, `=IF(COUNTIF('05_Master_Asset_Pipeline'!A:A, C2)=0, "MISSING", "ok")` (adjust the tab name to the real one). Expect **no** `MISSING`. Repeat for tab 12's action codes against tab 09 and tab 08. Delete the helpers afterward.
- **Test (ID style):** a filter on `Client_ID` across tabs 00 to 13 returns one ID style per client.

### D-4. Link registry
- [x ] Already includes the two new sheets (done in the provided copy).
- [~] Remove the bearer token line (Part E). Deferred until the security sweep, per owner direction; do not commit the registry.
- [~] **Router row (D15):** the HUD uses Apps Script API `scripts.run`; the
  read-only function succeeds in the editor. The owner reports the Original
  has an API deployment, but the Working Copy currently has only a Web App.
  The Working Copy must use the OAuth client's standard Cloud project and
  have its own API Executable deployment. The HUD previously passed the
  project Script ID; code now expects the API Executable deployment ID, and
  local config remains empty until the correct Working Copy deployment exists.
- **Test (after security sweep):** open the registry; no line contains "Bearer" or the token name. Until then, keep it ignored/untracked and never commit it.

---

## Part E. Security (owner-directed deferral; complete before any commit/push)

- [~] **E1.** The registry's section 8 has a static bearer token in plain text. **Deferred per owner direction** until the HUD is working. During the security sweep, remove the line and rotate the credential if anything still accepts it; never print or copy its value.
- [~] **E2.** Confirm the registry was never committed: `git log --all --oneline -- "*link-registry*"` should print nothing. If it does, tell me; history cleanup is your call. **Current check:** `git ls-files --error-unmatch docs/private/szs-master-template-link-registry.md` reports it is not tracked. The required all-history search is still pending.
- [x] **E3.** `git check-ignore -v .env.local` prints a rule. Verified from repository root; `.env*` ignores `.env.local`.
- [~] **E4.** `grep -rn "VITE_API_SECRET_KEY" apps/ engines/` returns nothing (v7 says it's purged). Still needs a repository-wide check as part of the deferred security sweep.
- [~] **E5.** Alfred's server-side proxy reads `GEMINI_API_KEY` from repo-root `.env.local` (no `VITE_` prefix). The configured key was rejected by Google with HTTP 400; owner must verify/replace it locally and restart the dev server. Never paste or print the key.

---

## Part F. Inputs for the bot (optional but unlock Block 8)

All under `docs/private/inputs/` (gitignored). Sanitize first: no client names, no contact data.

- [~] **F1.** `Services_Rates.csv`: service ID, name, rate (export from Master Control). **Unlocks:** price drift check. An export is present under ignored root `local_data/` (3 data rows observed); provide/use a sanitized copy at `docs/private/inputs/`. Do not use or commit raw client/contact exports.
- [ ] **F2.** `task_repositories.txt`: the repository **names only**, one per line (from registry section 4, no links). **Unlocks:** task-set drift check. Still needed in sanitized form at `docs/private/inputs/`.

If skipped, the bot lists Block 8 under "Needs owner" and moves on.

---

## Part G. End-to-end test script

| # | Who | Action | Expected |
|---|---|---|---|
| 1 | You | Part A | Registry untracked and ignored |
| 2 | Bot | Block 0 | Closeout report; Phase 2 doc in `docs/archive/` (or `closing` with a Needs owner list) |
| 3 | You | Part C on the copy | C4 to C10 tests pass |
| 4 | Bot | Blocks 1 to 9 | Each report: lint and build pass; tests pass; no secrets scan hits |
| 5 | You | Run the HUD in mock mode (`npm run dev`, http://127.0.0.1:3002) | Status shows `mock`; ribbon shows per-department counts |
| 6 | You | Click each department badge | Opens that department's menu with its log and proposals |
| 7 | You | Type `Staff Meeting` in Alfred Core | Six briefs in order, closing with 1 to 3 decision gates; no emails, phones, or IDs appear |
| 8 | You | Fire the dev event `stage.changed` | A proposal appears in the tray; **nothing** is sent, created, or written |
| 9 | You | Fire the dev event `police.corrected` | A node badge and an alert; **no wire animates** |
| 10 | You | Fire `police.schema` | Housekeeping badge increments |
| 11 | You | In Housekeeping, use "Draft schema change request" | Copyable block; field names equal `Schema_Change_Log` columns; nothing is written |
| 12 | You | Paste the draft into `Schema_Change_Log` on the copy; run the check | Logged as `Requested`; no new Police finding |
| 13 | You | Check at 762x1366 and 1680x1050 | Ribbon and menus fit; no overflow; bays still visible |
| 14 | You | Fire the `addendum.signed` dev event on a client | One proposal offering **both** expand and spawn |
| 15 | You (when OAuth live, D15) | Switch to live adapter at http://127.0.0.1:3002 | Status `live`; 3 values match the sheet |

**Current execution status (2026-11-01):** Part G has not been run as one
complete owner-run end-to-end sequence. The live-read check in row 15 is
complete: the HUD showed `DATA LIVE`, and the owner confirmed the 12-client
count, one contract value, and one project stage against the Working Copy.
One malformed optional Schema Registry row appears as a warning without
blocking live client/project data. The project-task read remains unverified.
The Step 4 write path is implemented locally and has unit/VM coverage, but has
not been deployed or run against Master Control; no live writes have occurred.
Keep live write tests restricted to the approved fake `ZZZ` / `ZZZ-01` records
and wait for server read-back before treating a change as persisted. Other
Part G items and the app-local snapshot's rejected finance/alert rows remain
as recorded above. Gemini was rejected with HTTP 400, and catalog inputs are
missing. Complete applicable rows as their prerequisites are resolved.

**Done when:** every applicable row in Part G passes; Parts A, C, and E are
complete or explicitly owner-deferred; and no credential or private registry
content is committed. A deferred item remains visible and must not be reported
as completed.
