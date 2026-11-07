# HUD Live Data Plan Progress

## Step 0 — Baseline and target verification (in progress)

- **Branch:** created local `live-data` from `main`; no commit created.
- **Plan:** copied to `docs/active/HUD_LIVE_DATA_MASTER_PLAN.md`; identifier-like
  tokens redacted from the tracked copy. Original download retained locally.
- **Worktree:** pre-existing HUD, Phase 2/3, and schema changes remain
  uncommitted. Raw CSV exports are untracked and now ignored by `.gitignore`;
  do not stage or commit the exports.
- **Owner answers:** accepted plan defaults for drill navigation, Gantt start
  dates, alert field precedence, and Sunset behavior; no contradictions
  reported. Owner said they would export `Services_Rates`; the file has since
  appeared in root `local_data/`.
- **CSV row counts observed:** Clients 999, Finances 999, Projects 6,
  Alfred_Alerts 7, Services_Rates 3. These include formula-filled rows and
  are not the number of keyed records. Step 1 now records validated counts.
- **Dev server:** OAuth requires the exact origin `http://127.0.0.1:3002`.
  Vite now binds to that address with `strictPort`; it will fail if the port
  is occupied instead of switching origins.
  Port 3000 is owned by a PM2 process and was not stopped because it is not
  verified as this repository's server.
- **Clasp safety:** local ignored `engines/master-control/.clasp.json` points
  to the original script, not the working-copy target. No `clasp pull` or
  `clasp push` has been run. Never use that config as-is. The code route in
  `apps/command-hud/src/data/api.ts` uses Apps Script API `scripts.run`.
- **Checks:** `git check-ignore -v` confirmed both raw export and app-local CSV
  paths are ignored. Clasp CLI version is 3.4.1.
- **Needs owner:** none for the already-confirmed plan defaults. If needed,
  export `Services_Rates` to
  `C:\Users\craya\GitHub\szs-bridge HUD\local_data\Working Copy of SZS Master Control - Services_Rates.csv`.
- **Not done:** baseline checkpoint commit (the dirty worktree contains raw
  data and substantial prior changes; stage only reviewed safe files), remote
  working-copy pull/merge, and live target verification. No commit was made.

## Step 1 — Real data in (snapshot mode)

- Added the root `npm run data:import` command and imported the five source
  exports from ignored root `local_data/` into ignored app-local
  `apps/command-hud/local-data/`. No export contents were printed or staged.
- Mapping coverage now handles the supplied headers, two-letter client and
  project IDs, client name fallback, dollar-formatted rate tiers, client-level
  milestone counts linked to each one-to-one project, invoice IDs separately
  from invoice numbers, and legacy alert values when newer alert columns are
  blank. Canonical non-empty alert values still win.
- Import results: Clients 12 loaded / 0 rejected / 987 ignored; Projects 6 /
  0 / 0; Finances 4 / 27 / 968; Alerts 4 / 3 / 0; Services_Rates 3 / 0 / 0.
  The 27 finance rows have no `ClientID` and cannot be associated with a
  client. Three alert rows have client IDs outside the validated ID format.
  Schema_Registry and Schema_Change_Log are optional and were not exported.
- **Owner decision:** keep rejecting alerts with invalid client references;
  do not silently show them as unlinked.
- **Remaining data mapping:** the HUD contracts still do not represent client
  `GoogleGroupEmail`, `Tech_Stack`, `MCC_Subscriber_ID`, and
  `Oracle_Baseline_ID`; project Google Tasks ID, estimated/actual hours,
  document/chat links, parent/addendum fields; or finance `ProjectID`,
  balance, tax, and margin fields. These columns are detected as unmapped and
  are not shown in the HUD yet; carry them into the later project-detail/data
  contract work rather than treating this import as complete coverage.
- Projects is six rows, not a truncated blank file: all six have project and
  client keys, and each joins one-to-one to a client. All six are at
  `04: Session Zero Kickoff`.
- Example sheet-to-HUD values: `02: Inception` maps to `02: Session Zero`;
  project stage `04: Session Zero Kickoff` is retained; rate tier
  `Normal ($85)` maps to `Normal`.
- The prior plan's “last row number minus one” owner check is invalid for
  formula-filled exports. Compare keyed `ClientID` / `ProjectID` records or
  the importer counts instead.
- Validation after the importer mapping fix: all 48 tests pass,
  `npm run lint` passes, and `npm run build` passes (existing chunk-size
  warning only). No live reads, writes, clasp push, or commit occurred.
- **Needs owner:** none to import the current five CSVs. The rejected rows can
  be inspected through the HUD's existing rejected-row status control.

## Step 2 — Universe, Galaxy, and navigation shell

- Replaced the old four-lane dashboard with Universe client-phase columns and
  ten Galaxy project-stage columns. The obsolete four-lane views and floating
  toolbar were unused and removed.
- Universe and Galaxy route to the existing Solar client workbench; project
  selection is passed through. The top bar now has clickable breadcrumbs,
  mobile collapse, Esc navigation, and a closed-by-default canvas-controls
  dropdown beside Solar Map. Department badges were removed from the top bar
  and remain available in the left rail and dispatch drawer.
- Snapshot drags update only `localStorage` key `szs.overlay.v1`; the overlay
  merges over snapshot data on load. The status strip labels the count as
  local changes not in the sheet, and reports a browser storage error rather
  than implying a Master Control write.
- Derived client phases follow the plan's bands with the sheet phase retained
  separately. Sheet/derived mismatches produce a visible card note and a
  Housekeeping INFO alert. `05: Complete` remains manual-only, and clients
  without projects retain their sheet phase.
- Solar and Galaxy camera pan/zoom and the selected screen/client/project are
  saved locally. Removed global UI and column scaling. Galaxy pointer-pan
  changed the saved camera from (0,0) to (-60,-40); zoom controls changed
  100% to 110% and updated the saved camera. Both were reset after testing.
  Task counts remain explicitly unavailable until a Tasks connection exists.
- Browser check with the real snapshot at 1680x1050: 12 clients loaded across
  phases (3/8/0/1/0/0), six projects shown across ten stage columns, and the
  Galaxy canvas showed all ten sprint stages. Double-click navigation opened
  Galaxy and Solar with the selected project; Esc returned Galaxy then
  Universe. At 762x1366, Universe showed all 12 cards with no horizontal
  overflow. A browser-dispatched HTML5 drop moved C-103 from 01 to 02,
  created one browser-local change, and was then cleared; the original phase
  and empty overlay were confirmed after reload. **Owner confirmed** a
  physical drag between Universe columns and a refresh; the client remained
  in the changed board. This completes the drag-persistence acceptance check.
- Checks after the latest code and documentation changes: `npm run lint`
  passed, `npm test` passed 53/53, and `npm run build` passed with the existing
  large-chunk warning. The importer, schema contract, and UI code were not
  connected to a live write.
- **Not done:** no commit; the branch already has many unrelated dirty
  changes, so changes remain uncommitted and must not be pushed.
- **Needs owner:** none for Step 2. Step 3 live-read verification is complete.
  Step 4 remains local and undeployed; keep the existing Original target
  protected and complete the fake-record/audit verification before accepting
  live writes.

## Step 3 — Live reads (Working Copy read verified)

- The existing transport is Apps Script API `scripts.run`, not a Web App
  `/exec` request. Google's current reference requires the API Executable
  **deployment ID** in the request path, not the Apps Script project Script
  ID. The HUD previously used the project ID here; the client now reads
  `VITE_APPS_SCRIPT_DEPLOYMENT_ID`. The Working Copy deployment ID in the
  registry is for a Web App, not an API Executable. The owner later configured
  the Working Copy API Executable deployment ID in the ignored local setting;
  that ID is intentionally not recorded here.
- Owner confirmed the Working Copy Script ID, `MASTER_CONTROL_SHEET_ID`,
  `ORACLE_DB_ID`, and `MCC_DB_ID` Script Properties, and Clasp account access.
  The repository `engines/master-control/.clasp.json` still targets Original;
  it was not used for any remote operation.
- The isolated Clasp pull captured an eight-file dated private backup at
  `docs/private/backups/working-copy-2026-10-31/`. The remote/local diff was
  reviewed, and the owner explicitly approved the full local project push,
  deployment, and Tasks scope. An isolated staging config targeted only the
  Working Copy.
- Added `engines/master-control/HUD_API.gs`: authorized read-only snapshot,
  project-task reads, and a one-time scope authorization helper. Required
  business tabs fail explicitly when missing; absent schema tabs are reported
  as visible warnings.
- Imported the remote-only `Schema_Control.js` and `DatabaseGuardrails.js`.
  The latter's database identifiers were replaced with `ORACLE_DB_ID` and
  `MCC_DB_ID` Script Property lookups. The owner confirmed both properties
  are set. The owner approved deploying the existing `onEdit` normalizer and
  downstream-sync functions with the full project; this work did not run
  `applyDatabaseGuardrails()` or `syncSelectedClientDownstream()`.
- Removed the hard-coded spreadsheet fallback from
  `getMasterControlSpreadsheet_()`; lookup now uses the configured property or
  bound spreadsheet and otherwise throws. The API reads use the same guarded
  helper and `AUTHORIZED_USER_EMAILS`.
- `LiveAdapter` uses the CSV parser/Zod contracts for live rows, displays
  a CSV snapshot fallback reason, refreshes on load/manual action/every 60
  seconds while visible, and exposes live/stale states. The HUD now also has a
  local Step 4 audited-write client, but it has not been deployed to the
  Working Copy. Snapshot moves remain browser-local.
- Google OAuth sign-in and the Apps Script API Executable path were confirmed
  working by the owner.
- Validation: root lint/build and HUD tests (55/55) passed in the prior
  frontend check; current Master Control tests pass 25/25, all nine
  deployable Apps Script source files parse, the staged-source credential scan
  returned zero matches, and `git diff --check` passed (line-ending notices
  only). The build retains the existing large-chunk warning.
- Pushed 10 files and created version 3 plus a new Working Copy deployment.
  The post-deploy pull matched the reviewed staging tree 10/10 files. Three
  older deployments had no descriptions, so the new deployment was created
  instead of updating an unidentified existing deployment. No Git commit or
  Git push was made.
- **Live read verification (2026-11-01):** the HUD signed in at the approved
  local origin and showed `DATA LIVE`. The owner compared the HUD's 12-client
  count, one contract value, and one project stage against the Working Copy
  and confirmed all three matched. Invalid optional Schema Registry metadata
  is skipped with a visible warning; it does not force a CSV fallback or block
  core live data.
- **Verification update (2026-11-02):** the HUD still responds at
  `http://127.0.0.1:3002` and shows `DATA LIVE`. The latest read reports 69
  invalid Schema Registry rows; the warning now shows the total and only two
  example rows rather than dumping every row. The count-only task summary
  helper and on-demand Galaxy control are wired and covered by tests. All six
  live projects currently show **No task list configured**, so no
  `hud_getProjectTasks` call was made.
- **Owner approval (scope update):** the temporary task-list test is now
  directed to SolarPulse Energy (`SE-01`), replacing `ZZZ-01`; the owner also
  authorized creating and removing test materials and confirmed the Working
  Copy as the target; Google services are active there. No setup or live data
  change has been made. The local Clasp config targets Original, and no
  isolated Working Copy config is present. The HUD deployment exposes task
  reads, but no temporary fixture setup or live write handler.
- **Needs owner:** provide/restore a verified Working Copy-only Clasp
  configuration before any remote setup or deployment. Test only `SE-01`
  first, preserve and restore its current values, and do not use the Original
  target. No live writes have been executed.

## Step 4 — Audited writes (Working Copy deployed; live acceptance partial)

- Added the `hud_write` Master Control entry for manual/automatic account
  phase, sprint stage, and alert status changes. It authorizes the caller,
  takes the script lock, rejects duplicate request IDs, records pending and
  final audit status, registers the additive mode/audit schema, confirms every
  mutation by read-back, and attempts rollback when mutation or confirmation
  fails. Stage 04+ retains the deposit/MSA/SOW gate.
- Wired the HUD to the write path with optimistic saving state, success
  read-back, failure rollback and visible error reporting, a Reset to auto
  control, live alert Resolve/Reopen actions, and the Daisy Sunset request.
  Snapshot moves and phase-mode overrides remain in `szs.overlay.v1`; a
  confirmed live write clears only its matching overlay entry.
- Sunset alerts use `Action_Status: Requested` as specified and remain
  actionable in the HUD. Resolve supports both `Resolved` and `Open`.
- Tests: `npm test` passed 59/59; Master Control router and phase-gate VM
  suites passed 42/42; root `npm run lint` passed; `npm run build` passed with
  the existing large-chunk warning. `git diff --check` passed with only
  expected Windows line-ending notices. A browser smoke check on the existing
  local server confirmed the demo Universe, ten-stage Galaxy, and read-only
  notice; no live write interaction was attempted.
- **Initial status:** no live write or remote deployment had occurred when
  this implementation was first recorded. The current live verification is
  documented below.
- **Current validation (2026-11-02):** `npm run lint` passed, `npm test`
  passed 60/60, and `npm run build` passed with the existing large-chunk
  warning. `git diff --check` passed with expected Windows line-ending notices.

## Live verification update (2026-11-02)

- Reauthenticated at the pinned HUD origin, `http://127.0.0.1:3002`. Live
  Master Control reads succeeded; `SE-01` remained at
  `04: Session Zero Kickoff`, its task-list field was blank, and its phase
  mode was `auto`. The source AccountPhase value is the legacy
  `02: Inception`, which the HUD maps to `02: Session Zero`. The approved
  attempt to write canonical `02: Session Zero` was rejected with
  `Please select an option from the approved list.` A fresh live snapshot
  verified rollback/no mutation: the phase remains `02: Inception`, mode
  remains `auto`, stage remains unchanged, and the task-list field remains
  blank. The owner confirms that Working Copy `Clients` column H currently
  has the appropriate canonical `01`–`06` AccountPhase options. At the time,
  the tracked `DatabaseGuardrails.js` source also listed legacy labels; it was
  later aligned with canonical options in the schema update below, without
  deployment or execution. Neither source state establishes why the live
  write was rejected. The cause remains unresolved; diagnose the active writer
  deployment and live validation details before retrying.
- The owner-approved temporary Tasks fixture created one task on a uniquely
  named list for `SE-01`. The Galaxy control returned **1 open / 1 total**.
  The audited writer cleared the project task-list field, but the temporary
  cleanup helper then failed because `Tasks.Tasklists.delete` is not an
  available Apps Script service method. I verified the exact fixture title
  and deleted that list and its task in Google Tasks. A final live snapshot
  confirmed the field was blank and the project stage was unchanged.
- A same-stage-04 write request was rejected by the server gate because the
  required `DepositPaid`, `MSA_DocID`, and `SOW_DocID` conditions were not
  met. Read-back confirmed the stage remained `04: Session Zero Kickoff`.
- Removed the temporary fixture endpoints and `setProjectTaskListId` test
  action from the source and VM tests. Pushed the cleanup to the verified
  Working Copy, created version 8, and redeployed the existing HUD API
  deployment at version 8. The Original target was not used. No Git commit or
  push was made.
- The latest live read reports 79 invalid optional Schema Registry rows
  (the earlier read reported 69); the rows remain warnings and core live
  data continues to load.
- Final validation passed: Master Control router tests 33/33; root
  `npm run lint`; `npm test` 60/60; root `npm run build` (with the existing
  >500 KB chunk warning); and `git diff --check` (Windows line-ending notices
  only).
- **Remaining:** the live manual/auto AccountPhase mutation remains unverified
  because the approved write was rejected despite the owner's confirmation
  that column H has the canonical options; diagnose the rejection before
  retrying. Manual audit-sheet inspection, full Planet view, and task writes
  remain incomplete.

## Working Copy schema alignment (2026-11-02)

- Updated the schema contract to list the current exported headers for
  `Clients`, `Projects`, `Finances`, `Services_Rates`, and `Alfred_Alerts`,
  including the actual `Projects.ChatSpaceURL` spelling.
- Aligned the tracked AccountPhase validation source, HUD node types, stage
  groupings, demo phases, and current pipeline guidance with the canonical
  AccountPhase and SprintStage values. Existing legacy stored values remain
  read-compatibility cases; the earlier rejected live write's cause is still
  unresolved.
- Extended snapshot contracts/mapping to retain current client metadata and
  project-linked finance fields, including the distinction between
  `InvoiceID` and `InvoiceNumber`. Updated compliance indicators to use the
  actual client Drive URL/MSA and project SOW/meeting-notes fields instead of
  nonexistent root/project folder IDs.
- Updated the initial client-schema generator's headers. These source changes
  were not deployed to Master Control; no live sheet or script was modified.
- Validation: root `npm test` passed 61/61; root `npm run lint` passed; root
  `npm run build` passed with the existing >500 KB chunk warning; Master
  Control router/gate tests passed 42/42; `git diff --check` passed with only
  existing Windows line-ending notices.

## Client ID standardization — preparation (2026-11-02; initial checkpoint superseded below)

- Implemented the agreed year-suffixed ID convention in HUD and Master
  Control ID generation: new IDs require an explicit onboarding year, and
  legacy ID shapes remain accepted for migration reads. The HUD's new-client
  flow supplies the current year because it creates a new record; migrations
  must supply the owner-approved year rather than infer one from today's date.
- Updated the schema-control spec, typed-ID examples, and legacy ambiguity
  notes. Expanded project-ID validation to cover a project sequence appended
  to a collision-suffixed ClientID.
- Validation: root `npm test` passed 62/62; root `npm run lint` passed; root
  `npm run build` passed with the existing >500 KB chunk warning; Master
  Control router tests passed 34/34; `git diff --check` passed with only
  Windows line-ending notices.
- **Initial checkpoint only:** no live rows or external assets had been
  changed. The browser issue and export-baseline status were updated below
  after later authentication/read attempts. The Oct 31 Projects/Finances/
  Alerts exports remain stale and are not a safe migration baseline.
- **Owner approval:** standardization remains audit-first. Prepare and present
  a before/after map from fresh exports; do not edit live records until the
  owner approves that proposed mapping.

## Status and handoff update (2026-11-02)

This entry supersedes earlier conflicting status notes in this log and the
handoff documents. The owner confirmed the current Working Copy schema matches
the canonical schema, including `Clients` column H's canonical AccountPhase
options. No Master Control schema edit or deployment is needed for that.

- **Current live-read evidence:** the HUD previously read the Working Copy
  successfully. The latest recorded HUD snapshot reported 79 invalid optional
  `Schema_Registry` rows as a warning and continued loading core data. The
  later attempted read-back of the owner's price test was inconclusive:
  Google Sheets was open to `Finances`, but the shared browser's accessible
  snapshot did not provide cell contents.
- **Price mapping:** Solar reads `Clients.ContractValue`; the Finance
  `TotalContractValue` field is separate. The exact cell the owner changed
  and its current value have not been verified. Do not state that the field
  mismatch caused the observed result until the changed cell and live values
  are confirmed.
- **AccountPhase write:** the live write was rejected with
  `Please select an option from the approved list.` A fresh read confirmed
  no mutation: phase remained `02: Inception`, mode `auto`, and stage was
  unchanged. The owner confirmed the sheet dropdown is canonical. Tracked
  validation source was subsequently aligned locally, but not deployed; the
  rejection cause remains open, and another live write must wait for diagnosis.
- **Tasks fixture:** the approved temporary `SE-01` list/task test returned
  1 open / 1 total. Cleanup cleared and read back the project's task-list
  field, then the exact temporary list and task were deleted. No permanent
  fixture remains from that test.
- **Client-ID preparation:** the onboarding-year convention and validators
  are local and tested: Prime Auto Collision (`PAC-26`), SolarPulse Energy
  (`SE-26`), and Zenith EdTech Solutions (`ZES-26`) use the two-digit
  onboarding year, with a collision counter and project IDs appended to the
  full client ID. No live client/project IDs have been edited.
- **Latest local validation:** `npm test` 62/62, root `npm run lint`,
  `npm run build` (existing large-chunk warning), Master Control router
  tests 34/34, and `git diff --check` passed. These latest schema/ID changes
  have not been deployed. No Git commit or push was made.
- **Migration baseline:** only the Nov 2 Clients CSV was found in
  `docs/active/`; available Projects/Finances/Alerts exports are older and
  stale for this purpose. No before/after mapping is ready and no live rows
  or enduring external assets have been changed. Keep standardization paused.

**Next owner input:** save fresh exports for `Clients`, `Projects`, `Finances`,
`Alfred_Alerts`, and `Services_Rates` to
`C:\Users\craya\GitHub\szs-bridge HUD\docs\active\` as
`Working Copy of SZS Master Control - <TabName>.csv`. Keep them untracked.
After auditing those current rows, provide a proposed mapping and wait for
approval before changing live records. Continue diagnosing the AccountPhase
writer separately; do not retry it yet.

---

# Master Plan v3.1

## Phase A — Checkpoint, housekeeping, target safety (2026-11-04)

- **A1 checkpoint:** committed all prior work on `live-data` as `b7cccfb checkpoint: before master plan v3.1`. Added `docs/active/*.csv` to `.gitignore`; verified with `git check-ignore` that `local_data/`, `apps/command-hud/local-data/*.csv`, and `docs/active/*.csv` are ignored (the Nov 2 Clients CSV is untracked). Ran `git remote set-url --push origin DISABLED`; `git push origin live-data` fails with `fatal: 'DISABLED' does not appear to be a git repository`. **done**
- **A2 archive:** moved the Phase 2, Phase 3, HUD Live Data, and Owner To-Do plans to `docs/archive/` with a "Superseded by Master Plan v3.1" header; rewrote `docs/README.md`; cut `docs/HUD_HANDOFF_SUMMARY.md` (397 lines) to a short status page; repointed references in the Charter (open decisions) and `STATUS.md`; renamed the empty `docs/PARKING_LOT` to `docs/PARKING_LOT.md`. **done**
- **A3 reference docs:** Alfred Core Directive now lists the section 3 AccountPhase and SprintStage values, the derivation rule, and the Daisy single-outbound-voice note. Schema Control Spec section 5 uses ClientID `^[A-Z]{3}\d{0,2}$`, ProjectID `^[A-Z]{3}\d{0,2}-\d{2,3}$`, InvoiceID `^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$`. The Charter's ID table also carried the dropped `PAC-26` format; aligned it to section 3. v7 supersession notes untouched. Code generators/validators are reverted in Phase C5. **done**
- **A4 clasp:** added tracked helper `engines/master-control/tools/wc-clasp.sh`. It writes a Working Copy `.clasp.json` into the ignored `docs/private/wc-staging/`, prints the script ID, and refuses to run if it is not `1H02jmtB9AuYant9x5paAZceoaPSaRv-5SepRBRvmkJ-kawWpx_q9_sif` (or if it is the Original). `clasp show-authorized-user`: drake@drakeaustinconsulting.com. Pulled 11 files into `docs/private/wc-staging/remote-2026-11-04-143024/`. Local source differs from remote in 7 files (the undeployed validation/ID work; expected).
  - Deployments (Working Copy): `@HEAD` (built-in test deployment, cannot be deleted); `AKfycbw_9sp…` @1, `AKfycbyG9xj…` @2, `AKfycbw3eNd…` @4, `AKfycbzATo…` @5 (versions 1, 2, 4, 5 have no description; no ID referenced anywhere in the repo); `AKfycbwsrrU6…` @8 = the HUD's `VITE_APPS_SCRIPT_DEPLOYMENT_ID` (version 8 "Remove temporary SE-01 task test helpers"). Keep @8.
  - Deleting @1/@2/@4/@5 with `clasp undeploy` was **blocked by the Claude Code permission classifier** (irreversible deletion). **Needs owner.**
- **A5 dev server:** a stale HUD Vite process (PID 11552, this repo's `vite.js`) still held 127.0.0.1:3002 and returns HTTP 200. Stopping it was blocked by the permission classifier; it hot-reloads source so it is usable. `DATA LIVE` needs the owner's signed-in browser. **Needs owner.**
- **Ran:** `npm run lint` pass; `npm run build` pass (existing >500 KB chunk warning); `npm test` 62/62; `node --test engines/master-control/test/pipeline-phase-gate.test.mjs engines/master-control/test/master-control-router.test.mjs` 43/43.
- **Needs owner:** (1) approve deletion of the 4 unused deployments; (2) open http://127.0.0.1:3002, sign in, and confirm the top bar shows `DATA LIVE`.

## Phase B1 — Find the AccountPhase rejection (2026-11-04, in progress)

- **Source of the text (found):** `Please select an option from the approved list.` appears in exactly one place, `setColumnDropdown()` in `engines/master-control/DatabaseGuardrails.js:260` (local and Working Copy). It is the help text of a `requireValueInList(..., true).setAllowInvalid(false)` rule. When a script calls `setValue()` on a cell whose rule rejects the value, Apps Script throws with that help text, which is the error the HUD received.
- **Second list (found):** the Working Copy's deployed `applyDatabaseGuardrails_()` still builds the Clients column H rule from the legacy labels `01: Intake`, `02: Inception`, `03: Active Partner`, `04: Liftoff & Alumni`, `05: Complete`, `06: Archived/Sunset`. The failing client's stored value was the legacy `02: Inception`. Hypothesis: that client's row (at least) still carries the legacy-list rule, even though the dropdown the owner checked is canonical, so writing `02: Session Zero` or similar is rejected. Not yet confirmed on the live sheet.
- **Live inspection tool:** added read-only `engines/master-control/HUD_Diagnostics.gs` (`diagnoseHudWritePath`). It reports every validation range on `Clients` AccountPhase and AccountPhase_Mode, each client row's value and rule, the `Schema_Registry` AccountPhase rows, duplicate and incomplete registry rows (for B3), and the latest non-confirmed `HUD_Audit_Log` rows. Unit test `engines/master-control/test/hud-diagnostics.test.mjs` uses a mock sheet whose every write method throws.
- **Push to Working Copy HEAD (not a new version; the HUD stays on deployment @8):** before pushing, found the remote manifest has advanced services the local copy lacked (Drive v3, AnalyticsData, Calendar, Chat, Docs, Slides, AdminGroupsSettings, Sheets). Adopted the remote `appsscript.json` locally so a push cannot strip them. Pushed 12 files with `wc-clasp.sh push --force`; a pull-back matched 11/11 code files. Remote HEAD had still contained the temporary SE-01 fixture code; the push removed it.
- **ID standard (section 3):** `mintClientID_` now returns a 3-letter abbreviation with a digit on collision (`PAC`, `PAC2`); the onboarding-year argument was removed. Default for names under 3 words: initials, then the next letters of the last word (`SolarPulse Energy` → `SEN`); single word → first 3 letters. `Schema_Control.js` seed notes updated. HUD generators follow in Phase C5.
- `clasp run-function diagnoseHudWritePath` failed ("Unable to run script function"; clasp is not linked to a user-owned Cloud project), so the owner must run it once.
- **Ran:** lint pass; build pass; `npm test` 62/62; `node --test engines/master-control/test/*.test.mjs` 44/44.
- **Needs owner:** run `diagnoseHudWritePath` (steps in the chat report) and paste the Execution log back.

### Owner answers (2026-11-04)

- Q1: the account running the Working Copy script **is a Workspace super admin**.
- Q2: the Phase E external test account is **SessionZeroSolutions@gmail.com**. This is a consumer Gmail account, not Workspace. The test Group must allow external members; I will create the test Group in Phase E and report the exact setting if Google blocks it.

### Phase B3 pre-work (code only)

- Both registry writers are idempotent by key: `snapshotLiveSchemaToRegistry` (`Schema_Control.js:140`, key Database|Tab|Column_Name) and `hud_registerSchemaColumn_` (`HUD_Writes.gs`, key Tab|Column_Name). The baseline appends rows with blank `Data_Type`, `Allowed_Values`, `Data_Class`, `Owner_Persona`, and `Required`, which fail the HUD contract (`contracts.ts` `SchemaRegistryRowSchema`). No code schedules it. The likely growth cause is a manual or editor-installed trigger run after new headers were added. Added a read-only trigger listing and HUD-contract enum checks to `diagnoseHudWritePath`, and pushed to Working Copy HEAD. Tests 44/44.

## Phase B1 result and B2/B3 fix (2026-11-04)

- **A5 done:** owner screenshot shows `DATA LIVE` (also `PIPELINE: $99,500`, `REJECTED 30`, `Schema registry: skipped 79 invalid r…`).
- **B1 exact source (confirmed live by `diagnoseHudWritePath`, owner run 2:59 PM):** `Clients!H2:H1000` carries one rule, `VALUE_IN_LIST [01: Intake | 02: Inception | 03: Active Partner | 04: Liftoff & Alumni | 05: Complete | 06: Archived/Sunset]`, `allowInvalid=false`, help text `Please select an option from the approved list.` It was installed by the legacy `applyDatabaseGuardrails_()`. Every stored phase is a legacy label. `AccountPhase_Mode` (column V) has no rule. `Schema_Registry` row 9 (`Clients|AccountPhase`) holds the same legacy list. Failed audit row 4 (2026-11-02, `setAccountPhase`, client `SE`, before `02: Inception`/auto) carries the same error. So the dropdown the owner saw was the legacy list, not the canonical one.
- **B3 cause:** 79 rows, 79 unique keys, 0 duplicates, 0 installed triggers. Growth 69 → 79 = the 10 rows `hud_registerSchemaColumn_` added once on the first live write (9 `HUD_Audit_Log` columns + `AccountPhase_Mode`). It is idempotent, not recurring. The diagnostic found 76 incomplete rows: non-standard `Data_Type` (`string`, `url`, `integer`, `timestamp`, `percentage`) and blank `Required`/`Allowed_Values`. The HUD skipped all 79 because cells arrive raw: `HUD_SCHEMA_VERSION` `'1.0'` is stored by Sheets as the number 1, and the HUD contract required a string. The baseline writer (`snapshotLiveSchemaToRegistry`) also appended blank fields.
- **Fix (code):** new `engines/master-control/HUD_Repairs.gs`:
  - `repairAccountPhaseValidation_`: clears the legacy rule on Clients AccountPhase; remaps `02: Inception`→`02: Session Zero`, `03: Active Partner`→`03: Active Sprints`, `04: Liftoff & Alumni`→`04: Liftoff`; installs the canonical reject-invalid rule; logs to `HUD_Audit_Log` and once to `Schema_Change_Log`.
  - `repairSchemaRegistry_`: idempotently fills only blank or invalid `Data_Type`/`Allowed_Values`/`Data_Class`/`Owner_Persona`/`Required`/`Schema_Version`; canonical lists for AccountPhase/SprintStage/Mode; section 3 regexes for ID columns; sets `Schema_Version` to plain text.
  - `runHudWriteSelfTest_`: creates fake `ZZZ` client, `ZZZ-01` project, and `ZZZ-ALERT-1` in blank input rows without touching formula cells. It runs manual phase, reset to auto, SprintStage 01→02, alert resolve, and alert reopen through `hud_write`, checks each with an independent read-back plus its `HUD_Audit_Log` row, then clears only the non-formula cells and verifies no ZZZ rows remain.
  - Wrapper `runPhaseBRepairsAndSelfTest` runs all three.
  - `snapshotLiveSchemaToRegistry` now writes valid defaults instead of blanks (root cause of new invalid rows).
  - HUD `SchemaRegistryRowSchema` (`apps/command-hud/src/data/contracts.ts`) accepts numeric/null text cells and trims/lowercases enum cells; non-standard types still reject.
- **Deployed:** pushed 13 files; created **version 9**; redeployed the HUD deployment `AKfycbwsrrU6…` to @9 (same ID, `.env.local` unchanged). Deployments @1/@2/@4/@5 still exist (owner approval pending).
- **Ran:** lint pass; build pass; `npm test` 63/63; Master Control `node --test engines/master-control/test/*.test.mjs` 46/46 (new `hud-repairs.test.mjs`: registry completion, idempotency, AccountPhase remap/rule/once-only change log).
- **Needs owner:** run `runPhaseBRepairsAndSelfTest` and paste the log; then one live HUD drag.
- **Fix (3:15 PM run failed):** `TypeError: Cannot read properties of undefined (reading 'join') @ HUD_Repairs.gs:41`. Apps Script loads files alphabetically, so a top-level map in `HUD_Repairs.gs` read `HUD_WRITE_ACCOUNT_PHASES` before `HUD_Writes.gs` defined it. Made it a function; the repair test now loads files in Apps Script order. 46/46. Pushed, **version 10**, HUD deployment redeployed @10. Nothing was written by the failed run (it failed at file load).

## Phase B — done (2026-11-04)

- Owner ran `runPhaseBRepairsAndSelfTest` (version 10, 3:19–3:20 PM):
  - **AccountPhase rule:** `H2:H1000` now holds the 6 canonical values (reject invalid). Remapped 5 rows: C-101, C-104, SE, ZES `02: Inception`→`02: Session Zero`; C-102 `04: Liftoff & Alumni`→`04: Liftoff`. Unknown values: 0.
  - **Registry:** 79 rows, 79 changed, 188 cells, **still invalid 0** (before: HUD skipped 79). Count stays 79; the baseline now writes valid defaults and both writers are key-idempotent.
  - **Self-test on fake ZZZ:** manual phase → `05: Complete`; reset to auto → `01: Intake`; SprintStage `01`→`02: Contract & Inception` with auto phase → `02: Session Zero`; alert resolve; alert reopen. All 5 were confirmed by independent read-back, with `HUD_Audit_Log` rows 7–11 `Confirmed`. Cleanup cleared Clients!14, Projects!8, Alfred_Alerts!9; leftovers none. `Alfred_Alerts` already has `Action_Status`, `Dismissed_Status`, `Resolved_At`.
- **Live HUD drag (owner):** moved C-103 to `02: Session Zero`; it persisted after refresh, showing `MANUAL` with a "Reset to auto" button. The status bar no longer shows the registry warning; `REJECTED 30` remains (Finance rows without ClientID, alerts with malformed ClientID; removed by the Phase C wipe).
- Not inspected by hand: the audit row for the owner's drag (a persisted HUD write only happens through `hud_write`, which writes the audit row first).
- **Done-when met:** live AccountPhase drag persists; audit rows Confirmed; invalid-registry count 79 → 0 and not growing.

## Phase C1–C2 — Backup and wipe manifest (2026-11-04, code ready)

- Added `engines/master-control/HUD_Wipe.gs`:
  - `hud_assertWorkingCopy_()` refuses unless the spreadsheet ID is the Working Copy; it explicitly rejects the Original.
  - `runPhaseCBackupAndManifest()` creates a new Drive folder `SZS HUD Backup - Working Copy - <stamp>` (under `BACKUP_DRIVE_FOLDER_ID` if set, else My Drive). It makes a full spreadsheet copy plus one CSV per tab, then writes `wipe-manifest-<date>.json`. The manifest lists every external asset in the input (non-formula) cells of Clients/Projects/Finances/Alfred_Alerts: Drive folders and files (name, trashed, owner via read-only lookup), Chat Spaces, Google Groups, Tasks lists, MCC Subscribers rows, and Oracle `1_Client_Baseline` rows matched by ClientID, with the MCC/Oracle spreadsheet IDs and names.
  - No data tab is modified.
- Tests: `engines/master-control/test/hud-wipe.test.mjs` (classifier for 9 asset types plus negatives; guard rejects the Original/other IDs). Master Control 48/48; HUD 63/63. Pushed to Working Copy HEAD (no new version; HUD stays @10).
- **Needs owner:** run `runPhaseCBackupAndManifest`, paste the log, and download the backup folder into `docs/private/backups/2026-11-04/`.
- Planned for C3: Chat Space and Group deletion need new OAuth scopes (`chat.delete`, `admin.directory.group`) and the Admin SDK Directory advanced service; the manifest currently grants neither. The owner will run `authorizeHudScopes` once when C3 is pushed.

## Phase C1–C3 — owner run and wipe prepared (2026-11-04)

- **C1/C2 run (owner, 3:33 PM):** Drive backup folder `SZS HUD Backup - Working Copy - 2026-11-04_1533` (`1bMJ29LA9Qvc0EEbl6jMLEA-vjZkF-5Wo`): full spreadsheet copy `1VwRfv9Yc2qY_h8xCQONojv_sROy6qJe5Z83XUm2dRQw` plus 8 tab CSVs. Manifest `wipe-manifest-2026-11-04.json` (`1Lbtp80efkhlpxYFpAMCF9Bi9Zh1tDkvO`). Data rows: Clients 12, Projects 6, Finances 31, Alfred_Alerts 7. Assets: 8 Drive folders, 9 Drive files, 4 Google Groups, 1 MCC subscriber reference, 0 Chat Spaces, 0 Tasks lists. **Formula columns: 0 in all four tabs.** The "~999 formula rows" are checkboxes and dropdowns down to row 1000.
- **`MCC_DB_ID` and `ORACLE_DB_ID` Script Properties are not set** on the Working Copy, so no MCC/Oracle rows are reachable or touched. Before Phase H, the owner chooses whether to point them at test copies.
- **Owner decision:** all Working Copy data is disposable. No local backup download wanted (plan C1 "docs/private/backups/" skipped by owner; the Drive backup remains). Clear all values; keep headers, formatting (checkboxes/dropdowns), and Apps Script.
- **C3 code:** `runPhaseCWipe()` in `HUD_Wipe.gs`:
  - Guard and manifest-ID check; deletes only manifest assets.
  - Never trashes the template/config/backup IDs from Script Properties, the spreadsheet itself, the Original, the backup folder, the manifest, or any item whose name contains "template".
  - Trashes Drive items (recoverable 30 days); deletes Groups via `AdminDirectory.Groups.remove`.
  - Then `clearContent()` on rows 2+ of Clients, Projects, Finances, Alfred_Alerts (keeps headers, formatting, validation, protections) and verifies the tabs are empty.
  - Services_Rates, Schema_Registry, Schema_Change_Log, HUD_Audit_Log are kept (config, metadata, and evidence; not business records).
- Added the Admin SDK Directory advanced service and scope `admin.directory.group` to `appsscript.json`, and the same scope to the HUD's `MASTER_CONTROL_OAUTH_SCOPES`. New test `api.test.ts` asserts the HUD scopes equal the manifest scopes (`scripts.run` needs every script scope). Pushed to HEAD only; the HUD deployment stays @10 until the HUD signs in with the new scope.
- **Ran:** HUD 64/64; Master Control 49/49; lint pass; build pass.

### C3 wipe result (owner run 4:21 PM)

- **Trashed 15 Drive items:** client folders for SE, ZES, and AL; their 3 Meeting Notes folders; kickoff notes, MSA, and SOW 01 docs for each. Skipped 2 already-trashed items.
- **Cleared** rows 2–1000 in Clients, Projects, Finances, Alfred_Alerts. `tabsStillHoldingData: []`. Headers kept: 22/18/18/21. The owner confirmed the HUD boards are empty.
- **Groups: 0 of 4 deleted** (client-pac, client-se, client-zes, client-al @sessionzero.solutions). Error: "Admin SDK API has not been used in project 1075865292896 before or it is disabled." Added `retryPhaseCGroupDeletion()` (groups only, from the same manifest). **Needs owner:** enable the API, then run the retry.
- **Manual leftover:** MCC subscriber `sub_al_4x5k8` (no MCC DB configured). If the owner's MCC sheet has it, delete that row by hand.
- **Deployments (owner approved):** deleted @1, @2, @4, @5. Remaining: `@HEAD` (built-in) and the HUD's `AKfycbwsrrU6…` @10. **A4 done.**

## Phase C3 close and C4/C5 (2026-11-04)

- **C3 groups:** `retryPhaseCGroupDeletion` (owner, 4:45 PM) found all 4 groups already absent ("not found"); they were never created. **C3 done.** Phase E inventory notes: `provisionDualChatSpaces_` returns placeholder `chat.google.com/room/...` URLs and creates no Spaces; provisioning only computes the Group email and creates no Group.
- **C5 (HUD IDs):** `apps/command-hud/src/data/contracts.ts` patterns are now ClientID `^[A-Z]{3}\d{0,2}$`, ProjectID `^[A-Z]{3}\d{0,2}-\d{2,3}$`, InvoiceID `^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$` (legacy shapes dropped after the wipe; COMS legacy mappers unchanged). `identity.ts`: `createClientId` mirrors Master Control `mintClientID_` (no year argument; call site in `CommandModals.tsx` updated); new `createProjectId`, `createInvoiceId`. Mock and test fixtures migrated (`INV-AAA-26-001`, `CSV`, `ABC`, `ABX-12`, …). Note: the ignored local CSV snapshot in `apps/command-hud/local-data/` still holds legacy IDs, so snapshot mode would reject those rows (it is a fallback only).
- **Finance contract rows (HUD):** `FinanceRowSchema` accepts `MilestoneStage = Contract` rows with no InvoiceID. Their `Amount` = `TotalContractValue` and `Status` defaults to `Contract`; invoice rows still need a valid InvoiceID.
- **C4 seed code:** `engines/master-control/HUD_Seed.gs`:
  - `seedTestData`: Working Copy guard; refuses if any data tab holds input. **Pre-flight checks every planned cell against its live dropdown/checkbox rule and writes nothing on a conflict**; the only allowed additive value is `Finances.MilestoneStage` += `Contract` (logged once in Schema_Change_Log).
  - Real Drive folders via the existing `provisionClientDriveArchitecture_` for PAC, SEN, HLW; others get `TEST-PLACEHOLDER-…` doc IDs.
  - Writes rows from row 2; stores a purge manifest in Script Property `HUD_SEED_MANIFEST`. `purgeTestDataDryRun` / `purgeTestData` clear exactly the manifest rows (key-checked) and trash only seeded folders whose names start with `[TEST] `.
  - Dataset:
    - 6 clients (PAC, SEN, ZES, HLW, MBS manual `05: Complete`, ORT) covering all 6 phases, each with a Group email.
    - 8 projects at stages 00, 02, 03, 04, 06, 08, 08, 09; PAC and SEN have 2 projects each; PAC-02 is an addendum of PAC-01.
    - 7 contract rows, 14 invoices (Paid/Sent/Overdue) with equal thirds and the remainder on the final; per-client-per-year numbering `INV-PAC-26-001..003`.
    - 3 alerts INFO/WARN/BLOCK.
    - Deliberate R1 mismatch: PAC ContractValue 12000 vs TCV 13500. Deliberate R8 malformed row: `INV-PAC-1`.
  - Tests `hud-seed.test.mjs`: 6 tests (IDs, test markers, phase coverage and derivation, stage gate, finance totals and numbering, mismatch only on PAC, pre-flight conflict/extension).
- **Ran:** HUD 66/66; Master Control 55/55; lint pass; build pass. Pushed to Working Copy HEAD.
- **Seed run 1 (owner, 4:59 PM): pre-flight stopped, nothing written.** `Finances.DepositAmount` (a currency column) carries stray checkbox rules on rows 10, 12, 16, 20 (and maybe others). Fix: the pre-flight now treats a checkbox rule on any column other than `DepositPaid`/`Dismissed_Status` as stray. The seed removes only those checkbox rules in that column (logged once in Schema_Change_Log); true checkbox columns stay strict. Test added; Master Control 56/56. Pushed.
- **Seed run 2 (owner ~5:05 PM):** rows were written (the dry run found Clients 6 and Finances 22 rows at their seeded positions). `driveFolders: []` means provisioning created no folders; the seed log with the reason is still needed.
- **Purge dry run 1 → bug (mine):** the manifest stored `ClientID` as the key for Projects and Alfred_Alerts rows (the writer took the first of ClientID/ProjectID/Alert_ID present). The dry run correctly refused (11 mismatches, `ok: false`); nothing was cleared. Fix: `hud_seedRowKey_` uses the tab's identity column; the purge now requires each manifest row's own key to be one the seed dataset produces (`hud_seedKnownKeys_`), so the existing manifest works. Test added; Master Control 57/57. Pushed.
- **HUD (owner screenshot):** `DATA OFFLINE`, `REFRESHING…`, `REJECTED 50`, only PAC and ZES from the old local CSV snapshot. Likely an expired sign-in token (last sign-in ~3:20 PM); the next sign-in also asks for the new Groups scope.
- **HUD after re-sign-in (owner screenshot):** `DATA LIVE`; Universe shows exactly one `[TEST]` client in each of the 6 phases (ZES 01, SEN 02, PAC 03, HLW 04, plus 05 and 06 collapsed with count 1 each); PAC contract shows $12,000 (the deliberate mismatch, read from `Clients.ContractValue`); pipeline $53,500. `REJECTED 8` = 7 contract rows + the deliberate `INV-PAC-1`: the shared row parser rejected blank-InvoiceID rows before the contract-row rule. Fixed in `snapshotData.ts` (contract rows are exempt from the required-InvoiceID check). New test; HUD 67/67, lint and build pass. Expected after reload: `REJECTED 1`.
- **Seed run 3 (owner, 5:34 PM):** `ok: true`, written; counts Clients 6, Projects 8, Finances 22, Alerts 3; manifest keys now correct (`PAC-01`, `ALT-TEST-001`, `contract:PAC-01`, …). Provisioning failed for PAC, SEN, HLW: `Invalid file or folder ID: ` (blank). The Working Copy has no `ACTIVE_PARENT_FOLDER_ID` / template Script Properties.
- **Purge dry run 2 (owner, 5:34 PM):** `ok: true`; would clear Clients 6, Projects 8, Finances 22, Alfred_Alerts 3; mismatches none. **"purgeTestData() dry-run successfully": done.**
- **Drive follow-up:** `runPhaseCDriveProvisioning()` sets only missing properties: MSA/SOW/Invoice template IDs from `docs/private/szs-master-template-link-registry.md` (each verified readable); `ACTIVE_PARENT_FOLDER_ID` = a new or existing `[TEST] SZS Working Copy - Active Clients` folder inside "SZS Master Clients Root". Default: not the live "Sanctum Active Folder". It then provisions PAC, SEN, HLW and fills `DriveFolderUrl`/`NotesDocUrl`/`MSA_DocID` and `<ID>-01` `SOW_DocID`/`MeetingNotes_DriveFolderID`, replacing placeholders. Idempotent (skips a client with a folder); adds folder IDs to the seed manifest; logs to HUD_Audit_Log. Master Control 58/58. Pushed.
- **Owner reference (onboarding standard, 2026-11-04):** client folders live in **Sanctum Active** (`1jUsGGSmNK1lAHgBmVcULtecLqjMxHSEm`), root `[Company Name] - [ClientID]`. `runPhaseCDriveProvisioning` now uses Sanctum Active as `ACTIVE_PARENT_FOLDER_ID` (no separate test folder); seeded folders are identifiable by the `[TEST] ` name prefix, which the purge requires before trashing.
- **Code vs. owner description (reported to owner):** the described flow (`graduateWonLeadsAndInvoice()`, `case_file.json`, `${Client Business name}` tags, `[InvoiceID] - [Company Name] Deposit` sheet name) exists only in `engines/master-control/reference/Legacy_Code.review-only.gs` (review-only, never pushed). Deployed `Drive_Provisioning.gs` creates the folder tree, MSA, SOW, invoice sheet (`[Company Name] Invoice 01 Deposit`), kickoff notes, and a Contact (best-effort). It writes no `case_file.json`, creates no Group (email string only), creates no Chat Spaces (placeholder URLs), and replaces `{{COMPANY_NAME}}`-style tags. The router's lead-graduation action returns 501 (disabled). Phase H depends on graduation, so it is a Phase E build item.
- **ID and naming conflicts (quoted for owner):** the description says collision `ICA-02`, ProjectID `PRJ-ICA-01`, InvoiceID `INV-2026-ICA-01`, docs `[Company Name] Master Services Agreement`. Plan v3.1 section 3 and its decisions record say `PAC2`, `PAC-01`, `INV-PAC-26-001`, docs `<ClientID> - <Project Name> - <document>`. Kept the plan standard for IDs pending the owner's answer; document names are unchanged in code until Phase E.
- **Owner decision (2026-11-04):** the onboarding description was outdated; the **Plan v3.1 naming policy overrides it** (IDs `PAC2` / `PAC-01` / `INV-PAC-26-001`; Drive `<ClientID> - <Project Name> - <document>`). Sanctum Active remains the parent folder. Implemented `driveNames_()` in `src/Drive_Provisioning.gs` as the single naming source. Defaults where the plan gives no pattern: client root `<ClientID> - <Company Name>`, project folder `<ClientID> - <Project Name>` (was `PRJ 01 Session Zero`), MSA `<ClientID> - <Company Name> - Master Services Agreement`. SOW `<ClientID> - <Project Name> - SOW`, invoice `… - Invoice <InvoiceID>`, kickoff notes `… - Session Zero Kickoff Notes`. Fixed subfolders (`00 Legal and Admin`, `Invoices`, `01 Strategy and Intelligence`, `Meeting Notes`, `Working Deliverables`) unchanged. The seed passes the first project's name; the purge now requires `[TEST]` anywhere in a folder name (root names start with the ClientID). Test added; Master Control 59/59. Pushed.
- **Provisioning run 1 (owner, 5:52 PM):** `Invalid file or folder ID: 1lr7HfMPQOksgOoOOuXc99Iiy2KJQaSLcG7TYl0LUs`. The registry's Invoice Master Template ID is 42 characters (Docs/Sheets IDs are normally 44), probably truncated. MSA and SOW IDs were readable and saved; no folders were created. Fix: if a template ID is unreadable, `hud_configureProvisioning_` searches Drive (Invoice: Google Sheet titled with "Invoice" and "Template"; MSA/SOW by title) and uses the file only when exactly one non-`[TEST]` match exists; otherwise it lists the candidates and stops. Pushed.
- **Provisioning run 2 (owner, 8:23 PM): `ok: true`.** The registry's invoice template ID had a typo (`…OksgOoOO…` vs correct `…OksgOhOoOO…`); the owner set the correct ID. Config: MSA_Master, SOW_Master, "MASTER - SZS - Invoice_Master Template" all opened by ID; `ACTIVE_PARENT_FOLDER_ID` set to Sanctum "Active". Real folders: PAC `1pO-yXgDlVI_W-IY98hVTf-Y_L1jVdSar`, SEN `11I0WWm7m0XUF090y9bZ1zDSrbKS0mFWJ`, HLW `1L4UYUsKQaXnC_wQ_06HN69iWaBzvfFCu` (added to the seed manifest). Corrected the ID in `docs/private/szs-master-template-link-registry.md` and the `HUD_Seed.gs` default; pushed.

## Phase C — done (2026-11-04)

- Done-when evidence: the HUD reads the seeded data live (owner screenshot: one `[TEST]` client per AccountPhase, `DATA LIVE`); Universe and Galaxy populated; `purgeTestDataDryRun` `ok: true` with 0 mismatches.
- Counts: Clients 6, Projects 8, Finances 22 (7 contract rows, 14 invoices, 1 deliberate malformed), Alerts 3 (INFO/WARN/BLOCK); 3 real Drive folders.
- Open checks (owner): status bar should read `REJECTED 1` after reload (only `INV-PAC-1`); whether MSA/SOW copies had their tags filled (`{{…}}` vs `${…}` template style). Both carry into Phase D/E.

## Phase D1 — Vala's invoice automation, read first (2026-11-04)

Findings (no code changed yet):
- **The only code that writes `Finances` is `executeLeadGraduation_()`** (`src/Central_Router.gs:147`), and nothing calls it: the `graduateLead` route returns 501 "Lead graduation is disabled…" (`Central_Router.gs:59-60`), and `recordPayment` returns 501 "Payment recording is not implemented." (`:73`). When enabled, it appends one row: `INV-${clientID}-01` (old ID shape), MilestoneStage `Deposit (1/3)`, TCV typed on the invoice row, `DepositAmount = InvoiceAmount = round(TCV/3)`, `Remaining_Balance = TCV - deposit`, status `Draft`, tax `deposit*0.25`, NetMargin the string `'67%'`.
- **The same function has bugs to fix before Phase H:**
  - It writes SprintStage `'02: Session Zero'`, which is not a valid SprintStage (the dropdown rejects it).
  - It hard-codes AccountPhase `02: Session Zero` instead of deriving it.
  - Its InvoiceID shape is old.
  - It uses `appendRow` on tabs whose checkbox columns run to row 1000, so new rows would land at row 1001.
  - It writes `MCC_Subscriber_ID` by fixed column 20 on `getLastRow()`.
- `populateInvoiceSheet_()` (`src/Drive_Provisioning.gs:150`) fills only the deposit line of the invoice template copy (`{{Client Name}}`, `{{Invoice #}}`, `{{Task 1}}`, …) and clears tasks 2–3.
- **Nothing exists** for stage 06 / stage 08 invoices, per-client-per-year numbering, schedule overrides, `TotalContractDue`, the ContractValue roll-up, or Police reconciliation. `DatabaseGuardrails.onEdit` only upper-cases Finances columns A–C.
- The HUD stage gate (`hud_enforceSprintStageGate_`, `HUD_Writes.gs:333`) reads `Finances.DepositPaid` per client.

Plan for D1 (additive only, each new column logged in Schema_Change_Log and Schema_Registry):
- New Finances columns: `TotalContractDue`, `Schedule_Deposit`, `Schedule_MidFlight`, `Schedule_Final` (blank = equal thirds, remainder on final), `AddendumRef`, `TCV_At_First_Invoice`.
- New `Finance_Model.gs` (Vala):
  - A pure schedule and numbering engine.
  - `recomputeFinances_()` keeps InvoiceAmount, TotalContractDue, and Remaining_Balance in sync from the contract row.
  - It installs a per-row `Clients.ContractValue` formula (`SUMIFS` of that client's contract-row TCVs).
  - Stage 06 / 08 triggers create the second and final invoice rows through the audited path when a SprintStage write reaches those stages.
- `executeLeadGraduation_` is rewired to create a contract row plus a deposit invoice in the new shape (fixing the bugs above); it stays disabled until Phase E/H.
- **Owner checks (2026-11-04):** status bar shows `REJECTED 1` (only the deliberate `INV-PAC-1`). MSA/SOW templates use `${...}` tags (e.g. `${Client Business name}`), so the seeded copies had unfilled tags. Fix in `src/Drive_Provisioning.gs`: new `templateTagValues_()` with the legacy tag names (today's date, Client Business name/Address, Business Owners name/Title; SOW adds Project Overview/Services/Start Date/End Date/Total/Deposit). `populateDocPlaceholders_` now skips empty values, so unknown tags stay visible. Deposit uses floor thirds (matches the finance model). Added `refillSeededDocuments()` for the 3 existing seed docs (reports any tags still open). Master Control 60/60. Pushed.

## Phase D2–D4 — code built and deployed (2026-11-04)

- **Template tags:** owner confirmed `${Client Business name}` style and `REJECTED 1`.
- **D1 `Finance_Model.gs` (Vala):**
  - Pure engine: `vala_defaultSchedule_` (thirds to the cent, remainder on final) and `vala_schedule_` (negotiated `Schedule_*` override when all three are filled).
  - `vala_nextInvoiceId_` (per client per year, continues past 003).
  - `vala_computeLedgerUpdates_`: TotalContractDue, InvoiceAmount, deposit DepositAmount, DepositPaid when paid, contract Remaining_Balance, and `TCV_At_First_Invoice` on first issue. Idempotent.
  - `vala_invoiceForStage_`: deposit at 02, mid-flight at 06, final at 08, each once, status Draft.
  - `vala_contractRollup_` and the `Clients.ContractValue` per-row `SUMIFS` formula. It is installed only where the cell is blank or already equals the roll-up, so typed mismatches stay visible to R1.
  - `vala_insertRecord_` writes into the first empty row, never row 1001.
  - The seed's schedule now uses the same engine.
- **D2 `Police_Reconciliation.gs`:**
  - R1–R10 as a pure `police_reconcile_`; findings name cells and values with severity and prescribed action.
  - `police_syncAlerts_`: one row per `POL-<rule>-<entity>` Alert_ID; updates in place, reopens when a finding recurs, auto-resolves when it clears.
  - `police_runReconciliation_` = ledger recompute + rules + alert sync.
- **D3 `Edit_Log.gs`:**
  - `Edit_Log` tab; `hud_onEditInstalled` (installable on-edit) logs watched money, phase, stage, and ID columns and re-runs reconciliation. Loop guard: CacheService flag plus never logging the Edit_Log tab.
  - `police_scheduledAudit` (15-minute trigger: existing sync audit plus reconciliation); `installPhaseDTriggers`.
  - `runPhaseDSetup` adds the 6 Finances columns, recomputes, installs the formulas, creates Edit_Log, registers schema, runs the first reconciliation, and installs the triggers.
- **Writer (`HUD_Writes.gs`):**
  - New audited action `resolveFinding` (R1: "finances" restores the roll-up formula; "clients" sets the single contract row's TCV to the Clients value, refused if several contract rows), with read-back and rollback.
  - SprintStage writes create the stage's invoice inside the audited write (rolled back on failure).
  - Police re-checks after every confirmed write. Schema-change reasons are now passed through.
- **HUD (D2 badges and resolve, D4 roll-up):**
  - `ContractValue` = Finances roll-up wherever contract rows exist (`contractRollup` in `pipeline.ts`); the typed value is kept as `SheetContractValue`.
  - Universe cards show "Contract mismatch: Clients sheet says $X; Finances says $Y".
  - In the Dispatch drawer, R1 alerts show **Use Finances value** / **Use Clients value** (surface: the existing alert card in the Multi-Agent Dispatch drawer). "Use Clients value" opens the existing `DropConfirmDialog` Financial Mutation confirmation, unchanged.
  - After a resolve, the HUD re-fetches.
- **Not yet done in D4:** surfacing `GoogleGroupEmail`, `Tech_Stack`, MCC/Oracle IDs, the project doc/chat links, parent/addendum, and the finance balance/tax/margin fields in the HUD (next step; surface: Client Dossier bay).
- **Tests:** new `finance-police.test.mjs` (12): schedule, numbering, ledger idempotency, stage invoices, formula, R1 and R8 on the real seed dataset, R2/R3/R4/R5/R7/R10/R6/duplicate-R8 on crafted rows, alert record, sync create/update/reopen/resolve, Edit_Log columns. HUD `contractRollup` test. **Master Control 72/72; HUD 68/68; lint and build pass.**
- **Deployed:** pushed 18 files; created **version 12** (version 11 exists with no description and was not created in this session); redeployed the HUD deployment `AKfycbwsrrU6…` to **@12**. It briefly pointed at @11 by mistake (under a minute) before being corrected.

## Phase D5 — live test (owner, 2026-11-04 ~9:10 PM)

- `refillSeededDocuments`: 6 docs filled (company, date, owner name, total, deposit). Still open by design (no data yet): `${Client Business Address}`, `${Business Owners Title}`, and SOW project overview/services/start/end.
- `runPhaseDSetup`: `ok: true`.
  - Added 6 Finances columns and 19 ledger updates (HLW thirds to the cent: 3333.33 / 3333.33 / 3333.34; TotalContractDue and TCV_At_First_Invoice on 7 contract rows).
  - ContractValue formulas installed for SEN, ZES, HLW, MBS, ORT; PAC kept typed (12000 vs roll-up 13500).
  - Reconciliation: `POL-R1-PAC` BLOCK, `POL-R8-INV-PAC-1` WARN, 5× R9 WARN (PAC-01, SEN-01, HLW-01, MBS-01, ORT-01 missing Brief/Outline/Chat/task list); 7 alerts created.
  - Triggers installed: `police_scheduledAudit` (CLOCK), `hud_onEditInstalled` (ON_EDIT).
- **Hand edit:** owner typed 2000 into `Clients!J3` (SEN). `Edit_Log` row 2: `Clients`, `J3`, `ContractValue`, `SEN`, old 13500, new 2000. The HUD Dispatch feed showed `[R1] Clients ContractValue Clients!J3 = $2,000.00, but the Finances contract rows (Finances!F7, Finances!F9) sum to $13,500.00.` with both resolve buttons. "Use Finances value" ran (Saving… shown) and the owner reports it resolved. The deliberate seed mismatch (R1 PAC) and malformed row (R8 INV-PAC-1) were caught. **Phase D done-when met** (caught, logged, resolvable from the HUD).
- **Bug found in the owner screenshot and fixed:** `TreasureLedgerView.tsx` (Vala Treasure Ledger) read old demo fields through an `as any` cast, showing blank names, `$NaN` deposits, and every client "GATED"; it was also hard-coded to a 50/25/25 split. It is now typed to `ClientRecord` and uses the shared `defaultInvoiceSchedule` (thirds to the cent, new in `pipeline.ts`, mirrors `vala_defaultSchedule_`). It shows the Finances roll-up plus the sheet value on mismatch, "NO CONTRACT" for ZES, and stage 02/06/08 tranche labels; the preview button states that no invoice is created. Three other prototype screens with the same cast are in `docs/PARKING_LOT.md`. HUD 68/68, lint, build pass.
- **Remaining D4:** surface GoogleGroupEmail, Tech_Stack, MCC/Oracle IDs, project doc/chat links, parent/addendum, finance balance/tax/margin in the Client Dossier.
- **Owner screenshot (Treasure Ledger after the fix):** names, IDs and stages show; pipeline $55,000 (Finances roll-up); PAC shows $13,500 with "Sheet: $12,000"; deposits are thirds (PAC $4,500, HLW $3,333.33); ZES "NO CONTRACT"; tranche buttons "Deposit · Stage 02 / Mid-Flight · Stage 06 / Final · Stage 08". Owner: "Looking good". Known simplification: client-level deposit = 1/3 of the client total (multi-project clients PAC and SEN); per-project billing is shown by Police and will be on the Planet page.
- **D4 (remaining fields):** `ClientRecord` gains `GoogleGroupEmail`, `Tech_Stack`, `MCC_Subscriber_ID`, `Oracle_Baseline_ID` (ID only; no Oracle internals), and `finance` (`financeSummary` in `pipeline.ts`: contract-row balance, tax total, latest margin, invoice list). Surface: the existing **Client Dossier** bay (`ClientDossierBay.tsx`). Three collapsed `<details>` sections (Identity, Projects with hours/task list/parent/addendum and Brief/Outline/SOW/chat/COMS links, Finances with balance/tax/margin/invoices) were added under the existing link rows; missing values show "MISSING". No new always-visible surface. HUD 69/69, lint, build pass.

## Phase D — done (2026-11-04)

Done-when evidence: a hand edit of `Clients!J3` was caught (R1 alert naming both cells and values), logged (`Edit_Log` row 2), and resolved from the HUD with "Use Finances value". The seed mismatch (R1 PAC) and malformed row (R8 INV-PAC-1) were caught. Not exercised live yet: "Use Clients value" (needs a single-contract client; it routes through the existing Financial Mutation dialog) and the stage 06/08 auto-invoices (covered by unit tests; live evidence in Phase G drag tests).

## Phase E1 — inventory (2026-11-04, code read; live part needs owner)

From the Apps Script source:

| Automation | Exists? | Where / note |
|---|---|---|
| Chat Space creation (internal + client) | **No** | `provisionDualChatSpaces_` returns placeholder `chat.google.com/room/...` URLs |
| Google Group creation + membership | **No** | provisioning only computes `client-<id>@sessionzero.solutions`; deletion only (`HUD_Wipe.gs`) |
| Tasks list creation | **No** | reads only (`HUD_API.gs`); `attachClientServiceNode_` inserts service tasks into the account's **first** list, not the project's |
| Drive tree | Yes | `provisionClientDriveArchitecture_` (Phase C naming) |
| Invoices | Partly | deposit sheet copy at provisioning; Finances rows at stage 02/06/08 (Phase D) |
| SOW and MSA | Yes | template copy + `${…}` tag fill |
| Project Brief / Outline docs | **No** | templates exist (registry IDs); nothing copies them |
| Lead graduation | Disabled | `graduateLead` returns 501; bugs listed under D1 |

**Conflict to fix in E:** `attachClientServiceNode_` writes `Clients.ContractValue` directly (`clientCell.setValue(updatedValue)`). That overwrites the Phase D roll-up formula and would trigger R1. The fix routes the price delta to the project's contract-row TCV (and, after the first invoice, requires an AddendumRef per R10).

Added read-only `Phase_E_Inventory.gs` (`runPhaseEInventory`). It dumps the Task List Template Repository structure, Services_Rates, Projects headers, and the Brief/Outline template tags, and checks advanced-service availability. Pushed to HEAD.

### E1 live inventory (owner run, 9:29 PM)

- **Template repository** `SZS_Task_List_Template_Repository` (`1dMtaK5…`): 1 dashboard tab plus **one tab per template**. 15 sprint tabs use `Sprint Phase | Task Name | Description & Execution Standard | Est. Time | Assignee | Status`; `Client_Work_Log_Template` is a billing log with different columns. 97 tasks total. Tasks have no offset, duration, audience, or milestone fields yet (E2 adds them per tab).
- **Services_Rates** holds only 3 rate tiers (Normal $85, Premium $115, Reduced $65); it is not a per-service catalog.
- **HUD service registry** (`serviceRegistry.ts`) has 5 components. Template-tab matches: `comp_dns_shield` → `DNS_Security_Protocols`; `comp_mcc_engine` → `MCC_Newsletter_Engine_Setup`; `comp_oracle_deepscan` → `Oracle_OSINT_Recon`. `comp_gantt_symphony` and `comp_iron_gate_legal` have no tab, and 11 tabs have no HUD component. (Input to E7 catalog check.)
- **Brief template** `1lujpag…` is named **"Del"** (`{{ProjectName}}`, `{{ProjectID}}`, `{{ClientID}}`, `{{Project_Summary}}`, contact, Drive/SOW/notes/tasklist/chat/COMS URL tags). **Outline template** "MASTER - SZS - Project_Outline Template" has 24 `{{…}}` tags.
- **Script runs as** `drake@drakeaustinconsulting.com` (domain `drakeaustinconsulting.com`); client Groups are planned as `@sessionzero.solutions`. Chat, AdminDirectory, Tasks, and Docs advanced services are available. Admin SDK calls now reach the API (the 4:45 PM retry returned "not found", not "disabled").

## Phase E2–E3 — code (2026-11-04)

- **Owner decisions:**
  - `sessionzero.solutions` is in the same Workspace; Groups are created via the Admin API.
  - Task source is a **combination**: new `Project_Lifecycle_Base` tab (every project) + tabs mapped from ActiveComponents + tabs named in a new `Projects.Task_Templates` column + `Offboarding_Sunset_Archive`.
  - The correct Project Brief template is `117A7YKF-bb4dqt6_J2KfWro7FbQNJwK3jBwxftwa2Xs` (the old `1lujpag…` "Del" file is not used). Updated in `docs/private/szs-master-template-link-registry.md`.
- **New `Project_Automation.gs`:**
  - **E2** `runPhaseESetup`: adds `Offset_Days`, `Duration_Days`, `Audience`, `Is_Milestone` to each task tab of the template repository (fills blanks only; defaults are phase offsets ×2 days, Est. Time → days, client-facing keyword hint, last task = milestone, all listed for owner review). Creates `Project_Lifecycle_Base` (16 tasks across stages 00–09, days 0–45). Adds Projects columns `Task_Templates`, `Kickoff_Date`, `Dashboard_Sheet_ID` (registered and logged).
  - **E3** `dolores_runProjectAutomation_`, for projects at stages 02–08:
    - Google Group `client-<id>@sessionzero.solutions` (external members allowed, contact added).
    - Brief and Outline copies in `<ClientID> - <Project Name>` with `{{…}}` tags filled.
    - Internal and client Chat Spaces (client space allows external users and gets the Group as a member).
    - At stage 03+, once Brief, Outline, both Spaces, and rate tier are present, the Tasks list titled with the ProjectID: parent task per template tab; child notes start `Audience:` / `Start:` / `Key:`; due dates from Kickoff_Date on the 45-day cadence. It writes `Google_Tasklist_ID`.
    - Idempotent: a filled field means skip; `syncMissingTasks(projectId)` adds only tasks whose Key is absent.
  - Runners: `runPhaseEAutomationDryRun` (all projects, no writes) and `runPhaseEAutomationPAC` (PAC-01 only, adds SessionZeroSolutions@gmail.com to the PAC group for the E4 test).
  - **Default used:** ActiveComponents is not required for list readiness (the base tab supplies tasks; seeded projects have no components). The plan listed "active components" as required information.
- **Scopes added** (manifest and HUD, kept equal by test): `chat.spaces.create`, `chat.memberships`, `chat.messages.create` (E5), `apps.groups.settings`. Pushed to HEAD only; the HUD stays @12 until it needs Phase E functions.
- Tests: `project-automation.test.mjs` (5). Master Control 77/77; HUD 69/69; lint passes.

### Phase E3 — first live run (2026-11-05)
- Owner ran `runPhaseESetupDryRun`: 15 template tabs, defaults listed (offsets 0..12 in 2-day steps, duration 1, last task = milestone, client audience on client-facing tasks). Nothing written.
- Owner ran `runPhaseEAutomationPAC`: Brief + Outline created in the PAC project folder. Errors: Groups Settings API and Google Chat API not enabled in Cloud project 1075865292896; `members.insert` returned "Resource Not Found: groupKey" right after the group was created (propagation delay).
- Fix: `dolores_retryNotFound_` (6 tries, 5 s apart) around the group settings patch, member insert and the group lookup for the client Chat Space. Test added (MC 78/78, HUD 69/69, lint and build pass). Pushed to Working Copy HEAD; HUD deployment stays @12.
- Owner to enable both APIs, configure the Chat app, then run `runPhaseESetup` and rerun `runPhaseEAutomationPAC` (idempotent: existing docs are skipped).

### Phase E2-E3 — live (2026-11-05)
- Owner enabled the Groups Settings and Chat APIs and saved the Chat app configuration (no visibility option was shown; not needed).
- `runPhaseESetup`: 15 template tabs filled (defaults as listed in the dry run), `Project_Lifecycle_Base` created (16 tasks), Projects columns `Task_Templates`, `Kickoff_Date`, `Dashboard_Sheet_ID` added.
- `runPhaseEAutomationPAC`: group `client-pac@sessionzero.solutions` with pat.pac@example.com and SessionZeroSolutions@gmail.com; Chat Spaces `spaces/AAQAdTyeZAM` (internal) and `spaces/AAQAabr8Jcc` (client, Group member); Tasks list `X0xXQncxak5XVFJlcXZUNA` with 23 tasks (2 parents + 16 base + 5 offboarding). ok: true.

### Phase E4 — client dashboard (code)
- New `Project_Dashboard.gs`: sheet `<ClientID> - <Project Name> - Task Dashboard` in the project folder, tab `Tasks` (Title, Due, Notes, Done, hidden TaskID and Synced). Client-audience child tasks only.
- Protection: whole tab protected except Done (D2:D501); only the script owner edits the rest. Shared with the client Group via Drive v3 Permissions (no notification email); falls back to member emails if refused.
- Sheet->Tasks: installable on-edit trigger `dashboard_onEdit` per dashboard. Tasks->Sheet: one `dashboard_scheduledSync` every 5 minutes. Loop guard is state-based (hidden Synced column = last agreed value; sheet side wins), plus the script lock. Trigger budget 18 of 20: past it, on-edit is skipped and the 5-minute sync pushes ticks.
- Ticks are recorded in the Working Copy Edit_Log as tab `Dashboard:<ProjectID>`.
- Wired into `dolores_runProjectAutomation_` after the task list. Owner check `runDashboardSyncNow`.
- Tests: `project-dashboard.test.mjs` (4). MC 82/82. Pushed to Working Copy HEAD.

### Phase E4 — moved into the owner's Command Deck (2026-11-05)
- Owner supplied the client Command Deck template (`MASTER - SZS - Client_Command_Deck Template`, in SZS_MASTER_TEMPLATES) and asked for tasks to live in it; schema realignment approved. Inspected read-only with `inspectCommandDeck` (tabs Client_Command_Deck and System_Data_SSOT; label/value SSOT in A:B, tickets D:J, retention L:P).
- Decision (default, owner may change): one deck per project, named `<ClientID> - <Project Name> - Command Deck` (plan section 3 updated). The template is never edited; each copy is realigned:
  - SSOT column B filled by label from Clients/Projects/Finances/Tasks every 5 minutes; `RootDriveFolderID` renamed `RootDriveFolderUrl` (it feeds HYPERLINK); legacy phase/stage/invoice dropdowns removed from column B; `MilestonePercent` wrapped in IFERROR; demo tickets and retention rows cleared.
  - Milestones = tasks whose template row has `Is_Milestone`; current milestone = first open one by due date; handover date from the base "Handover acceptance" task.
  - Launchpad rows link to the SSOT URLs (status "Available"/"Not issued yet"); "PMI-Compliant Project Charter" row becomes "Project Outline". The fixed 25% sparkline (L10) now shows client task completion.
  - New `Project_Tasks` tab (client tasks, Done checkbox, hidden TaskID/Synced). Every tab protected; only Project_Tasks Done is editable.
- Not mapped (no Master Control source yet, left blank): SaaSDebtTracker_SheetID, Sourcebook_Deck_URL. Tickets stay owner/form-entered.
- Tests: MC 84/84. Pushed to Working Copy HEAD.

### Phase E4 — live (2026-11-05)
- Owner ran `runPhaseEAutomationPAC`: deck `PAC - [TEST] Initial Project Build - Command Deck` (1HOG8JKifFiZk2vi2W-9je6SkCgRquAx9Uc3PDVp7W5U), 14 client tasks, 27 SSOT fields, shared with client-pac@sessionzero.solutions; 5-minute sync and on-edit trigger installed.
- Owner verified: SessionZeroSolutions@gmail.com (Group member) ticked boxes and the tasks completed in the owner's PAC-01 list; the account also joined the client Chat Space. **E4 done.**
- Owner plans to move client-facing tasks onto the front tab. Note: ticks sync only from Project_Tasks Done and all other tabs are protected; a front-tab Done range needs a code change (unprotect range + sync source). New decks copy the template as it is at copy time.

### Phase E5 — "Send to client" (code, deployed)
- `Client_Comms.gs`: `hud_previewClientMessage(projectId)` (read-only) composes the message in Daisy's voice (greeting, stage, Command Deck link, overdue client tasks digest, signature; `[TEST]` prefix hidden). New audited `hud_write` action `sendClientMessage` posts with `Chat.Spaces.Messages.create` to `Projects.ChatSpaceURL` only; refuses a missing space or one equal to `ChatSpace_Internal_URL`; read-back = the created message's name and text; logged in HUD_Audit_Log. A posted message cannot be unsent (no delete scope); a mismatch is reported.
- HUD: Client Dossier → Projects (existing bay, collapsed section) gains "Send to client…" per project with a client space (live only): preview → editable text → "Confirm and post" / Cancel. Also a Command Deck link. `Dashboard_Sheet_ID` added to the project contract.
- Tests: MC 88/88 (client-comms 4), HUD 70/70, lint and build pass.
- Version 13 created; HUD deployment redeployed to **@13**.

### Phase E5 — first live send (2026-11-05)
- Owner clicked Confirm and post for PAC-01: the message **did post** to the PAC client Chat Space, but the HUD showed "Master Control did not confirm the requested values on read-back" (audit row Failed). Cause: the read-back compared the echoed Chat text with the sent text exactly; Chat reformats the echo (link markup), so it never matched.
- Fix: confirmation is the created message resource name in the client space (`spaces/<id>/messages/<id>`); the echoed text is kept as `returnedText` in the audit After. Read-back failures now include the read-back JSON. Test added (MC 89/89). Version 14; HUD deployment @14.
- The failed audit row for that first send stays as history (the post itself happened).

### Phase E5 — owner feedback fix (2026-11-05)
- Owner: second send worked and opened the space, but the Dossier bay kept collapsing (hover bay, 300 ms leave timeout); collapsing unmounted the send control, so the in-flight post was forgotten and the button allowed endless re-sends.
- Fix (HUD): send state moved from the component into App (`clientSends`, per project: idle/loading/preview/sending/sent/error plus `lastSent`); the Dossier bay stays expanded while any draft is open or a post is in flight (`clientComms.busy`, same pattern as Alfred). After a send the project shows "Sent <time> · Open ↗"; another send needs "Send another…", a fresh preview, and shows "Already sent <time>. Confirming posts another message." In-flight sends cannot be started twice.
- Fix (Master Control): `sendClientMessage` refuses the exact same text to the same client space within 10 minutes (Confirmed or Pending audit rows), error DUPLICATE_MESSAGE, so a page reload cannot double-post either.
- Tests: MC 90/90, HUD 70/70, lint and build pass. Version 15; HUD deployment @15.
- **E5 done** (message posted after confirmation; owner verified).
- Owner retest 2026-11-05: "worked like a charm" (bay stays open, send tracked, duplicate refused).

### Phase E6 — HUD task writes and task counts (code, deployed)
- `Task_Writes.gs`: two new audited `hud_write` actions on the project's `Google_Tasklist_ID` list.
  - `createTask` { projectId, title, notes?, due? (YYYY-MM-DD), parentId?, clientFacing }: notes get `Audience: client|internal` and `Key: hud::<id>` then the description (section 3 conventions). Client-facing tasks must have a parent (the Command Deck shows client child tasks only); parent must be top-level (Tasks allows one level). Read-back = `Tasks.Tasks.get` of the new task (title, status, due, parent, audience); rollback removes the task.
  - `setTaskStatus` { projectId, taskId, done }: complete or reopen; read-back = task status; rollback restores the previous status; an unchanged status is refused (NO_CHANGE 409).
- HUD: Client Dossier → Projects (existing bay section) gains a per-project "Tasks · N open / M" control (live only, projects with a list) that opens a task panel: parents with indented subtasks, checkbox complete/reopen, "done" filter, Reload, and an add form (title, due, parent, Client-facing checkbox, notes). The Dossier bay stays open while the panel is open for the selected client. State (task lists) lives in App.
- Counts: task lists load automatically once live; Galaxy project cards show "open / total" (button reloads) and Universe client cards gain an "Open tasks" row (open / total across listed projects; "+" when partly read, "No list" when none). Counts derive from the loaded lists, so writes update them immediately.
- Client-facing changes reach the Command Deck through the existing 5-minute sync (new client tasks are appended; ticks pulled).
- Tests: MC 95/95 (task-writes 5), HUD 72/72, lint and build pass. Version 16; HUD deployment @16.

### Phase E7 — catalog check (read-only tool, pushed to HEAD)
- `Catalog_Check.gs` `runCatalogCheck()` (owner runs, writes nothing): dumps template tabs with task names, client-task counts and milestones, Services_Rates, the component → tab map and each project's ActiveComponents / Task_Templates, plus findings (mapped tab missing, unmapped tabs, duplicate task Keys, unknown component or template references). The comparison with the HUD service registry is written from the log. Nothing is changed without the owner.
- Tests: MC 96/96. Pushed to Working Copy HEAD (no deployment change needed; editor run).

### Phase E6 — owner verified (2026-11-05)
- Owner: task created from the HUD appeared in Google Tasks and on the Command Deck; counts show on Universe (PAC 19 / 24). **E6 done.** Owner feedback: the Dossier bay is too cramped for tasks and Send-to-client (layout follow-up).

### Phase E7 — report
- Owner ran `runCatalogCheck`; report in `docs/active/CATALOG_CHECK_E7.md`. Nothing changed; decisions pending with the owner. **E7 done (report).**

### Layout follow-up (owner decision 2026-11-05)
- Owner: the Dossier bay is too cramped. Decisions: the task list moves to the Planet view (Phase F); the Dossier keeps a task count; Send-to-client opens as an overlay in the Alfred Core bay (Vitals pattern). Catalog: add one HUD component per template tab (prices blank), template tabs become the only task source.
- Done: Dossier shows "Send to client…" + "Sent <time> · Open" + "Tasks: N open / M" only. The Daisy preview/editor is an overlay in Alfred Core; Alfred stays open while a draft is loading, open or posting. The Dossier no longer forces itself open. HUD 72/72, lint, build pass.

### E7 catalog decision applied (2026-11-05)
- Owner: add one HUD component per template tab, prices blank, template tabs the only task source.
- HUD `serviceRegistry.ts`: 11 new components (price 0 = "unpriced" in the catalog), every component has `templateTab` where a tab exists (14), all `tasksToInject` emptied. Test keeps the HUD map equal to Master Control `DOLORES_COMPONENT_TABS` (14 entries).
- Master Control: `DOLORES_COMPONENT_TABS` has the 11 new mappings; ActiveComponents parsing accepts JSON arrays too. `attachClientServiceNode_` no longer writes payload task titles into the owner's *first* Google Tasks list (old bug); after the attach it syncs the project's own list from the mapped tab (missing Keys only; no list yet = picked up at creation). priceDelta 0 is allowed (no money change); DropConfirmDialog unchanged.
- Still open (Phase G, parked): attach requires exactly one project per client and adds the price to Clients.ContractValue instead of the contract-row TCV. `comp_gantt_symphony` and `comp_iron_gate_legal` have no tab (their work is the automation itself).
- Tests: MC 97/97, HUD 73/73, lint, build. Version 17; HUD deployment @17.

### Phase F — Planet view (code, deployed)
- Route `/client/:clientId/project/:projectId` (history API; no router library), page lazy-loaded (`PlanetView` chunk). Opened by double-clicking the Solar Sun (the project) or a service node, or "Open <ProjectID> (Planet)" in the Sun menu; "Recenter Sun" stays in that menu. Esc, Close or the Solar breadcrumb return to Solar; Solar stays mounted under Planet so its camera is unchanged. Browser back/forward and deep links work (dev server serves the path: HTTP 200).
- Layout (owner): Gantt center, details right, task list below the Gantt.
  - Gantt: day 0 = `Kickoff_Date` (now mapped into the HUD), SprintStage markers on the 45-day cadence, today line, bars from the notes `Start:` line to due (diamond when no start), grouped under parent rows spanning their children, colors completed / upcoming / overdue, milestone ◆. No drag.
  - Task list: title (subtasks indented), due, status, notes, client tag, milestone ◆; complete/reopen and create (Phase E writes); windowed beyond 100 rows.
  - Details: name, SprintStage, AccountPhase, rate tier, hours, kickoff, parent/addendum, Brief/Outline/SOW/Command Deck/COMS/meeting notes/both Chat Spaces, client contact/Group/contract/deposit/balance, invoices by ProjectID.
- Milestones: `hud_getProjectTasks` now also returns `milestoneKeys` (template Is_Milestone for the project tabs, cached 10 minutes). Completing a milestone task (confirmed read-back) publishes the existing `milestone.done` event from node-dolores with production rules; the rule stays "suggested", so no proposal or side effect fires.
- Removed the unused compact Dossier task panel.
- Tests: MC 98/98, HUD 79/79 (gantt layout, route, windowing, parser), lint, build. Version 18; HUD deployment @18.
- Owner verified 2026-11-05: Planet opens from the Sun, Gantt and stage markers render, ticking a task completed it in Google Tasks (ZZZ test task), milestone tick published milestone.done, Esc returned to Solar. **Phase F done.**

### Phase G2/G3 — money proposals and reports (code, deployed)
- Master Control `Reports.gs`: audited `hud_write` actions `draftInvoice` { invoiceId } (copies the invoice template, script property INVOICE_TEMPLATE_ID or the provisioning default, into the client Drive folder as `<ClientID> - <Project Name> - Invoice <InvoiceID>`; read-back = the file in the folder; rollback trashes it; refuses an existing same-name draft) and `requestOsintSweep` { clientId } (appends one Alfred_Alerts row Department Oracle, Action_Status Requested; refuses a second open request; runs nothing).
- HUD: client actions menu (`CardContextMenu`) retyped to live `ClientRecord` (links were blank/disabled with live data); now opened by right-clicking Universe client cards and Galaxy project cards too (and from Solar as before). New items: Status Summary (read-only modal, copy as text), Draft Invoice… (pick invoice → existing Financial Mutation confirmation unchanged, ledger delta $0 → audited write → link to the draft), Request OSINT Sweep (audited alert row, board refresh). "Soft-Archive to 09: Sunset" (local-only placeholder that bypassed the audited write) is now "Request Sunset (06: Archived/Sunset)" through the audited AccountPhase write, which adds the "Sunset requested" alert. Advance Stage is demo-only (disabled live). Flag Blocker is still a local placeholder (parked).
- G2: Dispatch drawer money proposals of type draft_invoice get "Review in Financial Mutation gate…", which opens the invoice draft with the proposal shown; only a confirmed draft is written. No rule was approved; no other money proposal type carries an amount to act on (noted).
- Guard test: HUD write-action union equals Master Control HUD_WRITE_ACTIONS.
- Tests: MC 102/102, HUD 82/82, lint, build. Version 19; HUD deployment @19.

### Phase G — parked Solar attach fixes (code, deployed)
- Found: `attachClientServiceNode_` overwrote `Clients.ContractValue`, which since Phase D is the Finances roll-up formula, with a typed number (breaks the roll-up; Police R1 would fire).
- Fix: the price is added to the project's Finances contract-row `TotalContractValue` (`vala_planTcvIncrease_` / `vala_applyTcvIncrease_`), then the ledger is recomputed; the Clients formula follows. Planned before any write, so refusals change nothing: no contract row yet (NO_CONTRACT_ROW, contract rows appear at stage 02), two contract rows (DUPLICATE_CONTRACT), or invoicing started (CONTRACT_INVOICED: R10 needs an addendum). Rollback restores TCV and ActiveComponents. Price 0 writes no money.
- The HUD sends the Solar project ID, so clients with several projects (PAC) can attach; without it a multi-project client still gets AMBIGUOUS_PROJECT. DropConfirmDialog unchanged.
- Tests: MC 104/104 (attach-money 2, router multi-project), HUD 82/82, lint, build. Version 20; HUD deployment @20.

### Phase G4 — Phase 2 canvas regression, automated (2026-11-05)
- Added `npm run e2e` (`apps/command-hud/e2e/solar.e2e.mjs`): playwright-core 1.48.2 (dev dependency, pinned) drives the installed Microsoft Edge against the HUD in SNAPSHOT mode on its own port 3099 (local fake CSV data, no sign-in, nothing written to Master Control); fresh browser context per test; evidence in `e2e/results/` (git-ignored: results.json + a screenshot per test).
- Result: **10/10 passed**:
  - bays: CalendarBay / Alfred Core / Client Dossier visible and the Dossier header toggles in Universe, Galaxy, Solar and Planet
  - drag: Pamela moved 140,90 px; pamela-sun and dolores-vala wires followed
  - lock: L froze Oracle (0 px), unlock moved it 120 px
  - resize: Vala 220x130 -> 300x180
  - zoom/pan: wheel zoom changed the Sun width 420 -> 454; background pan moved it 120 px
  - menus: node (Lock, Edit, Arrange, Focus, Connect, Disconnect, Dispatch, Delete), Alt+Right-Click opens the node menu, Sun (incl. Open PAC-01 (Planet), Recenter), wire (Delete wire, Edit, Reverse, Disable), canvas (Add node, Select all, Wires)
  - wire delete: via menu gone, Ctrl+Z restored, delete + reload stays deleted
  - shortcuts: Ctrl+A selects all 5, canvas click clears, Ctrl+D duplicates, Delete removes the copy, Ctrl+Z restores, F focuses, Ctrl+A inside an input selects nothing
  - drop: priced drop opens the Financial Mutation dialog, the node snaps to the 220 px orbit, a second drop of the same service is ignored (duplicate guard)
  - Planet: Sun double-click -> /client/PAC/project/PAC-01, Esc returns with the camera unchanged
- Bugs found and fixed by the suite:
  1. Clicking empty Solar canvas did not clear the selection: the pan handler captured the pointer, so the click was retargeted away from the workbench. Removed the capture (pan uses window listeners already).
  2. A Duplicate (Ctrl+D) copy of a department node could never be deleted ("Built-in department nodes cannot be deleted"); copies are now removable with their wires (Delete key, node menu "Delete copy"), undoable.
- Observed (by design, noted): Esc in Solar clears nothing on its own; it returns to Galaxy (App level navigation), while Esc inside an open menu only closes the menu.
- Not automated (manual script for the owner): active event-flow wire animation, viewport culling, multi-selection menu actions.
- Tests: HUD 82/82, MC 104/104, lint, build, e2e 10/10.
- Added read-only `inspectHudAuditLog()` (HUD_Diagnostics.gs): newest 40 HUD_Audit_Log rows, one line each, for the G1 evidence. MC 105/105. Pushed to Working Copy HEAD.

### Owner feedback fixes (2026-11-05, during G1)
- Owner: saves took 30-45 s; no way from Universe to Galaxy in the top bar; text too small; right-click did nothing in Universe/Galaxy; no Sunset in Solar.
- Speed (Master Control, version 21):
  - The 5-minute Command Deck sync and the deck on-edit handler held the script lock that every audited HUD write needs (deck open, Tasks list, SSOT refresh, template repo read); a write arriving then waited. They now use a per-deck CacheService guard instead (`deck_tryMutex_`); the Synced column keeps overlap harmless.
  - Schema registration in every write (~10 registry/log sheet reads) now runs once per 6 hours (`hud_onceCached_`).
  - Police reconciliation runs after writes that can change a finding only (setAccountPhase, setSprintStage, resolveFinding).
  - `hud_write` returns `timings` (lock wait, audit setup, prepare, apply, read-back, total); the HUD logs "Saved <action> in N s (server …; Google round trip …)" in the status terminal. The 15-minute Police audit still takes the lock (it writes alerts/ledger).
- Navigation: the top bar always shows UNIVERSE › GALAXY › SOLAR (Galaxy/Solar use the selected client); the buttons were hidden at Universe level and on narrow windows.
- Client menu: closed itself on any scroll anywhere (live terminal auto-scroll, a board nudged by focus), so it looked like right-click did nothing. Now only a page scroll after 300 ms closes it. Universe client cards and Galaxy project cards also get a visible ⋮ actions button; the Solar Sun menu has "Client actions (status, invoice, Sunset)…".
- Type: owner minimum ~10-12 px. 523 tiny sizes (8-11.5 px) in 44 files mapped to a 5-step scale `text-hud-1..5` = 11 / 11.5 / 12 / 12.5 / 13 px, defined once in `src/index.css` @theme.
- e2e: new nav-actions test; 11/11 pass. HUD 82/82, MC 105/105, lint, build.

### Owner feedback round 2 (2026-11-05)
- Owner: saves now 55 s; ⋮ shows but opens nothing; right-click still nothing; Sunset unreachable.
- Could not read live execution logs (clasp logs needs a GCP project ID). Changes, now measured instead of guessed:
  - Read-only `hud_getSnapshot` (HUD refresh every 60 s) and `hud_getProjectTasks` no longer take the script lock, so a save never queues behind the HUD's own reads.
  - `police_scheduledAudit` (every 15 min) runs the legacy Oracle/MCC sync audit outside the lock; only the Master Control reconciliation is locked.
  - Every save writes its step timings into its HUD_Audit_Log row (After._timings: lock wait, audit setup, prepare, apply, read-back, Police ledger/read/alerts); `inspectHudAuditLog` prints them as a TIMINGS field.
- Client menu: renders through a portal on document.body at z 9000, never closes on scroll, ignores the opening press, and logs "Client menu requested / opened / closed (reason)" to the status terminal for diagnosis.
- Tests: MC 106/106, HUD 82/82, e2e 11/11, lint, build. Version 22; HUD deployment @22.

### Save timing evidence and speed round 3 (2026-11-05)
- First measured saves (version 22, audit rows): setAccountPhase ZES -> 06 Sunset: server 9.0 s (lock wait 0.1, audit setup 0.8, prepare 0.7, apply 2.6, Police 3.6 [ledger 1.5, read 1.8, alerts 0.3]); setSprintStage ZES-01 01 -> 02: server 10.1 s (lock 0.2, setup 0.8, prepare 1.7, apply 1.9, Police 4.0 [ledger 0.7, read 2.8, alerts 0.5]). Lock waiting is solved; the earlier 30-55 s is not explained by server time alone (HUD round trip not yet reported).
- Version 23: Police after a save runs in a debounced one-off background trigger (`police_afterWrite`, ~3 s later) instead of inside the save (findings appear on the next HUD refresh); the duplicate-request check reads only the Request_ID column. Expected server time ~5-6 s.
- G1 evidence from the audit log (all Confirmed): Universe drag ZES 01 -> 02 manual (19:27), Reset to auto (19:28), Galaxy drags ZES-01 00 <-> 01 (19:30, 19:31, 19:49), Sunset by drag ZES -> 06 with Daisy "Sunset requested" alert (20:13), stage 01 -> 02 creating the deposit row (20:13:50). Alert Resolve/Reopen: earlier evidence (POL-R1-SEN 05:15-05:17, ZZZ-ALERT-1 2026-11-04); the new Sunset alert not yet. Still owed: client menu, reports, money proposal, Solar drop, manual visual checks.
- MC 107/107. Version 23; HUD deployment @23.

### Galaxy rebuilt and menu moves (owner feedback 2026-11-05)
- Owner: Galaxy (10 fixed columns on a zoom/pan canvas, no gaps) was unusable: hard to grab the background, zoom only in a hidden ▾ menu, a card could not be dragged seven columns over; Sunset via the menu showed nothing (ZES was already sunset and hidden in the collapsed 06 column).
- Galaxy is now a plain board: 288 px columns with gaps, native horizontal scrollbar, empty stages collapsed to 56 px labelled strips that accept drops (click to expand, "Show empty stages" toggle), drop target highlighted, board scrolls when a dragged card nears either edge. No zoom canvas in Galaxy (the ▾ canvas menu is Solar-only).
- Client menu (⋮ / right-click): "Move phase ▸" (all six phases + "Reset phase to auto") and, from a Galaxy project card, "Move <project> to stage ▸" (all ten stages); allowed live (audited) and in snapshot (local), like drags. Menu height is capped to the window and scrolls.
- Universe: a client moved into a collapsed column (Complete/Sunset) opens that column; those columns start collapsed only while empty. Request Sunset on an already-sunset client now says so.
- e2e 12/12 (new galaxy-board: 9 empty stages as strips, PAC-01 dragged onto the far 09 strip, ⋮ Move to stage 04, ⋮ Move phase 06 shows Zenith in the opened Sunset column, Reset to auto offered). HUD 82/82, lint, build.

### Owner G test round (2026-11-05)
- Owner verified: saves 5-7 s; phase/stage moves via drag and ⋮ incl. Sunset and back; Solar unpriced drop + task sync; priced drop refused (addendum); wires animate, zoom/pan smooth; money proposal fixture opened the invoice draft. Audit timings: setAccountPhase 4.1-5.3 s, resolveAlert 2.2 s, draftInvoice 7.5 s.
- Found: (1) Draft Invoice failed once with "Lock timeout"; the OSINT request never reached the audit log (same cause; the HUD only showed a small WRITE ISSUE). The Solar attach held the script lock during the template task sync (one Tasks call per task, ~11 for Workspace Tenant Setup). Now the money/ActiveComponents write is locked and the task sync runs after release (test asserts it). (2) Invoice drafts were copies of the template, not filled: `draftInvoice` now fills {{Client Name}}, {{Business Name}}, {{Project Title}}, {{Invoice #}}, dates, {{Task 1}} = milestone + project, {{Task 1 Rate}} = InvoiceAmount, clears Task 2/3; read-back reports `filled` and the HUD warns if the tags were missing. (3) Write results were invisible: new toasts (green saved in N s, amber warning, red not saved until dismissed). (4) Drawer: the Priority Feed is collapsed in the all-alerts view (open when a department button is chosen); Pending Proposals opens and is highlighted when it has items. (5) Multi-select delete is now a top-level node-menu item "Delete N selected (departments kept)"; Duplicate copies count as deletable.
- MC 108/108, HUD 82/82, e2e 12/12, lint, build. Version 24; HUD deployment @24.

### Phase G — owner verified (2026-11-05)
- Retest after version 24: invoice draft INV-PAC-26-003 created and all template tags filled; OSINT request created (alert count +1) and the second request refused; Daisy feed opens from the gold D, Alfred feed collapsed with Pending Proposals visible; Ctrl+A + right-click offered "Delete 1 selected (departments kept)", deleted and Ctrl+Z restored.
- G1 (live writes: Universe/Galaxy drags, Reset to auto, alert Resolve/Reopen, Sunset request + alert): done (audit rows 19:27-21:10 and owner checks). G2 (money proposals into the Financial Mutation gate): done. G3 (status summary, invoice draft, OSINT request): done. G4 (Phase 2 regression): done, e2e 12/12 + owner visual checks (wire animation, smooth zoom/pan, multi-select actions). **Phase G done.**

### Phase H — start (2026-11-05)
- Owner decisions: lead graduation (Lead DB tracking and the Won -> client trigger) **parked until Phase Q** (Lead DB overhaul); H1/H2 (form-dropped test leads) wait for it. MCC and Oracle: use the registry databases as the working masters (Oracle Master Marketing Database `1iz-cWvW…`, Mail Command Center `1Dsnn9UG…`).
- `Linked_Databases.gs`: `previewLinkedDatabases()` (read-only: tabs, sync tab, headers, and every owner-name/email change the 15-minute Police sync would make) and `applyLinkedDatabases()` (sets ORACLE_DB_ID / MCC_DB_ID; never overwrites a different value). Owner runs preview first.
- Plan E3 made automatic: a confirmed stage save into 02-08 queues the project (Script Property queue) and a one-off background trigger runs `dolores_runProjectAutomation_` for it (Group, Brief/Outline, both Chat Spaces, task list at 03+, Command Deck), then posts a Dolores alert "Created: … / Waiting: … / Failed: …" when anything changed.
- Lifecycle walk choice: SEN-01 (deposit paid, MSA/SOW present; the stage gate blocks 04+ without them, so ZES cannot pass 04). Drive archival at Sunset is manual (nothing moves folders; plan: the HUD does not move Drive folders).
- MC 111/111. Version 25; HUD deployment @25.

### Phase H — lifecycle walk and report (2026-11-05)
- Owner walk of SEN-01 04 -> 09 (saves ~9.5 s): automation created the 23-task list; invoices created at 06/08 (Status Summary 1 paid / 3 open $7,000). Dolores alert text was generic; version 26 puts the summary in Trigger_Condition. SOW still has `${…}` tags. SEN did not reach Sunset: one client phase cannot represent SEN-01 at 09 and SEN-02 at 03.
- MCC/Oracle preview: columns match; applying would overwrite 2 Oracle baseline owners (PAC, ZES IDs collide with test data); MCC no change. **Not applied**, waiting on the owner.
- Report: `docs/active/LIFECYCLE_TEST_REPORT.md` (what worked, broke/fixed, still manual, proposed fix list incl. owner ideas: multi-project Universe, multi-sun Solar).

### Universe per project (owner decision 2026-11-05)
- Owner: card per project. Universe now shows one card per project in the phase its stage belongs to (00-01 Intake, 02-04 Session Zero, 05-07 Active Sprints, 08 Liftoff, 09 Sunset); a client set by hand to Complete/Sunset keeps all its projects there; clients without projects keep a client card. Dragging a project card moves that project to the phase's first stage (Complete stays client-level); collapsed columns now accept drops. Project card: title, client · ProjectID, stage, client contract, deposit, project tasks, alerts and client warnings on the client's first card, Reset phase to auto when the client is manual; ⋮ opens the menu with this project's moves. Menu: "Sunset this project (→ 09)" added; client-level item renamed "Sunset whole client (06)".
- Decision record change: "Universe = AccountPhase" becomes "Universe = projects grouped by phase" (owner, 2026-11-05).
- Oracle/MCC: owner chose "apply anyway"; owner runs `applyLinkedDatabases`.
- HUD 83/83 (universeCards test), e2e 13/13 (universe-projects: PAC-01 dragged to a collapsed Sunset column -> stage 09), lint, build.

### Owner feedback (2026-11-05, after the Universe change)
- Oracle/MCC IDs applied (owner run); the Police sync changed the two Oracle baseline names as previewed.
- Department buttons (left bar) only opened the drawer on the all-alerts feed and jumped the main view to the old prototype screens. They now filter the drawer feed to that department and leave the main view alone; the drawer has its own department chips (All / Pamela / Oracle / Dolores / Vala / Daisy with open counts). e2e 14/14 (drawer-departments).
- SOW `${…}` tags (SEN-01): the seed had no intake data. `refillProjectSows()` (Reports.gs, owner run) fills Project Overview, Services (project template tabs), Start (Kickoff_Date) and End (kickoff + 45 days) in every project SOW and lists tags still open; Client Business Address and Business Owners Title need intake fields (Phase Q). SEN-01 compensation $7,500 / deposit $2,500 is the SEN-01 contract row (SEN total $13,500 = both projects).
- Multi-sun Solar answers: A (shared department ring), a completed project's sun dims and goes out while departments keep orbiting, cross-project wires allowed.
- MC 112/112. Pushed to Working Copy HEAD.
- `refillProjectSows` (owner run 4:38 PM): PAC-01 and SEN-01 SOWs now only miss Client Business Address and Business Owners Title (intake data, Phase Q); HLW-01 also misses Start/End dates (no Kickoff_Date: its project automation never ran, same cause as its R9 alert).

### Multi-sun Solar (owner-approved, built 2026-11-05)
- `ecs/suns.ts` (pure, tested): primary sun = the client's first open project (keeps node id `core-node`, so existing wires never move); every other open project is a `sun-<ProjectID>` node (360x220) placed outside the department ring; a project at 09 Sunset/Retainer has no sun, and if every project is in Sunset the primary sun is shown dimmed ("going out"). Each secondary sun gets five default department wires (shared ring, option A; key `sun:<ProjectID>:<dept>`; deleting one suppresses it; they leave with the sun). Suns are wireable like the core (cross-project wires allowed).
- Solar workbench: sun cards (stage progress, stage, hours, Open Planet); double-click a sun opens its Planet; node menu "Open <ProjectID> (Planet)"; suns cannot be deleted or duplicated (they follow the project); suns stay visible when satellites are hidden. A service drop orbits and attaches to the **nearest sun's project** (the attach call sends that ProjectID, so the price goes to that project's contract TCV). Selecting a project (Galaxy/Universe/Planet) focuses the camera on its sun.
- Events treat `sun-*` nodes as core.
- e2e 15/15 (multi-sun: PAC-02 injected into the snapshot in the browser only: 2 suns, 5 wires to sun 2, drop beside sun 2 lands 276 px from it vs 853 px from the primary, sun 2 double-click opens Planet PAC-02, PAC-02 at 09 has no sun). HUD 87/87, lint, build.

### Multi-sun follow-up (owner 2026-11-05)
- Owner: arrangements snapped back after leaving Solar; the added Custom Apps Script service was not attached to the 2nd sun.
- Layout: node positions/sizes/locks were never saved (only wires and the Sun position). New `ecs/workbenchLayout.ts`: per-client layout in this browser (`szs_workbench_layout_<ClientID>`), applied on open (departments, components, copies, extra suns), saved on every change; saved sun positions are kept while a sun is absent.
- Attach: the drop converted screen to canvas coordinates with a centre/zoom estimate that drifts when zoomed out, so the nearest-sun pick (and the project the service attached to) could be wrong. Now measured against the core sun's real on-screen box (exact at any zoom/pan). Wires expose data-wire-from/to.
- e2e 15/15: multi-sun now also checks the service wire runs from sun-PAC-02, the layout survives Galaxy -> Solar, and a drop beside sun 2 at ~66% zoom attaches to sun 2. HUD 88/88, lint, build.
