# Master Control (Apps Script)

The system of record for clients, projects, finances and alerts. Every deploy goes to the **Working Copy** only
(`tools/wc-clasp.sh` refuses the Original). `docs/DESIGN.md` describes the whole system; this file covers the code.

## How the HUD talks to it

The HUD calls functions with `scripts.run` (API executable deployment):

| Function | What it does |
|---|---|
| `hud_getSnapshot` | Read-only. Clients, Projects, Finances, Services_Rates, Alfred_Alerts and schema metadata. No lock. |
| `hud_write(action, payload, requestId)` | Every change. Audit row, apply, read back, Confirmed/Failed (`HUD_Writes.gs`). |
| `hud_getProjectTasks` | Read-only Google Tasks for one project. |
| `hud_previewClientMessage` | Read-only. Daisy's composed message, shown before sending. |
| `attachClientServiceNode` | Solar service drop: ActiveComponents plus the project's contract TCV, then its template tasks. |

`hud_write` actions: `setAccountPhase`, `setSprintStage`, `resolveAlert`, `resolveFinding`, `sendClientMessage`,
`createTask`, `setTaskStatus`, `draftInvoice`, `requestOsintSweep`, `setBlocker` (several blockers per client), `restoreClientFolder`, `removeService`. Read-only helpers: `hud_getSnapshot`, `hud_getProjectTasks`, `hud_previewClientMessage`, `hud_previewServiceRemoval`, `hud_getWriteStatus` (audit row by request ID, for lost replies).

`doPost` (the web endpoint) only accepts `attachClientServiceNode`; `graduateLead` answers 501 until Phase Q.
The old unaudited `updateKanban` route and the legacy `getHudState`/`doGet` feed were removed on 2026-11-06.

## Files

| File | Role |
|---|---|
| `HUD_API.gs`, `HUD_Writes.gs` | HUD read snapshot and the audited write path; background Police and project-automation scheduling |
| `Client_Comms.gs`, `Task_Writes.gs`, `Reports.gs` | Daisy messages, Tasks writes, invoices / OSINT request / Flag Blocker |
| `Service_Removal.gs` | Remove a service: price off the final invoice, open tasks deleted, preview |
| `Finance_Model.gs`, `Police_Reconciliation.gs`, `Edit_Log.gs` | Vala ledger, Police rules R1–R10, hand-edit log (also cleans typed IDs/emails) and triggers |
| `Project_Automation.gs`, `Project_Dashboard.gs` | Dolores project assets and Tasks lists; client Command Decks |
| `Schema_Registry.gs` | Schema registry / change log and shared helpers (`colLetter_`, `withLock_`, `nextChangeId_`) |
| `Linked_Databases.gs`, `Catalog_Check.gs`, `HUD_Diagnostics.gs` | Read-only checks |
| `HUD_Seed.gs` | `[TEST]` data seed and purge |
| `Tools_Menu.gs` | The **SZS Tools** menu in the spreadsheet: every check and maintenance tool, with a Yes/No before changes |
| `src/Central_Router.gs` | `doPost`, service attach, the Police sync audit, parked lead graduation |
| `src/Master_Control_Auth.gs` | User allowlist and the Working Copy guard (`hud_assertWorkingCopy_`) |
| `src/Drive_Provisioning.gs`, `src/Pipeline_Phase_Gate.gs`, `src/Snapshot_Trigger.gs` | Drive folders/templates, the stage-04 gate used by `setSprintStage`, daily snapshot |

`reference/` holds review-only legacy sources; it is never deployed.

## Checks

```bash
node --test engines/master-control/test/*.test.mjs     # all local tests (mocks; nothing touches Google)
node engines/master-control/tools/find-unused.js       # functions nothing calls
```

## Deploy (Working Copy)

```bash
bash engines/master-control/tools/wc-clasp.sh stage
bash engines/master-control/tools/wc-clasp.sh push --force
bash engines/master-control/tools/wc-clasp.sh version "<what changed>"
bash engines/master-control/tools/wc-clasp.sh redeploy <HUD deployment id> --versionNumber <N>
```
