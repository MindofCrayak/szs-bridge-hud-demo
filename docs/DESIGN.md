# SZS Command HUD: design (as built, 2026-11-06)

This document describes the system as the code is today. When the code and this document disagree, fix whichever one is wrong. It replaces the archived Master Plan v3.1 decisions record wherever the owner changed course on 2026-11-05.

## System

- **Master Control** (Apps Script + Google Sheet, Working Copy only) is the system of record for clients, projects, finances and alerts.
  - Every HUD change goes through `hud_write(action, payload, requestId)`:
    1. take the script lock
    2. append a Pending row to `HUD_Audit_Log`
    3. apply the change
    4. read it back to confirm
    5. mark the row Confirmed or Failed, with step timings stored in `After._timings`
  - Actions: `setAccountPhase`, `setSprintStage`, `resolveAlert`, `resolveFinding`, `sendClientMessage` (with optional `final`), `createTask`, `setTaskStatus`, `draftInvoice`, `requestOsintSweep`, `setBlocker`, `restoreClientFolder`, `removeService`.
  - There is no other write path: the old `updateKanban` web route was removed on 2026-11-06.
  - Lost replies: when Google answers HTTP 5xx ("Internal error encountered") the HUD asks `hud_getWriteStatus(requestId)` (audit log) whether the write was Confirmed, Failed or still Pending. Reads retry once.
- **Background work runs outside the save,** so saves don't wait for it:
  - Police reconciliation runs about 3 s after any phase, stage or finding save (`police_afterWrite`).
  - Project automation runs after a stage save into 02–08 (`dolores_afterStageChange`).
  - Command Deck sync runs every 5 minutes, with a per-deck guard instead of the script lock.
  - The Police audit runs every 15 minutes.
  - Read-only HUD calls take no lock.
  - A hand edit in the sheet is logged to `Edit_Log`, has typed IDs/emails cleaned, and queues the same background Police run. It takes no lock.
- **SZS Tools menu** (in the spreadsheet): every check and maintenance tool, with a Yes/No before anything that changes data.
- **Money:** a change to a contract value always goes through the Financial Mutation dialog. A price goes to the project's Finances contract-row TCV; `Clients.ContractValue` is a roll-up formula and is never written. Once invoicing has started, a TCV change needs an addendum (Police R10).
- **Agents propose; the owner approves.** Event rules stay "suggested": events fire, but no rule is approved.

## HUD (React/Vite, `apps/command-hud`)

- **Top bar (one navigation ribbon).**
  - UNIVERSE › GALAXY › SOLAR plus the OSINT, Symphony, Treasure, Mail and Clients tabs, always shown. The client picker is the ▾ on SOLAR.
  - **Back** (and Backspace) goes up one level: screen → board, Planet → Solar, Solar → Galaxy, Galaxy → Universe.
  - Resource readout: paid, owed, open/all projects, open alerts (BLOCK count), deposits due. All counters come from `data/hudStats.ts`.
  - MENU › HUD size (− 100% +, also in Settings): 100-125%, scales every HUD text size and rem-sized panel; kept per browser.
  - Settings (F1) › Display › Bottom console: console scale 75-125% and each bay's width (Calendar, Alfred Core, Client Dossier, Macro Pad); live, kept per browser, "Reset to default" = fit the screen.
  - Full-screen views (OSINT, Symphony, Treasure, Mail, Clients) end above the bottom dock and its crystal.
  - The Solar canvas controls (mode, satellites, zoom −/+, recenter) sit in the Solar workbench's own ribbon, not the top bar.
  - Shortcuts (Windows): Alt+1 Universe, Alt+2..6 screens, Alt+7 actions, Alt+8 cockpit, Ctrl+K palette, F1 settings, 1..9 / Shift+1..9 client groups.
- **Levels.**
  - **Universe:** one card per **project**, in the phase its stage belongs to (00–01 Intake, 02–04 Session Zero, 05–07 Active Sprints, 08 Liftoff, 09 Sunset).
    - A client set by hand to Complete or Sunset keeps all its projects there.
    - Clients with no projects get a client card.
    - Dropping a card moves that project to the first stage of the column. Dropping on Complete is client-level.
  - **Galaxy:** a plain board. Columns are 288 px wide; empty stages collapse into drop strips; dragging near an edge scrolls the board.
  - **Solar:** one **sun per open project**.
    - The first open project is the `core-node`, so wires on it stay put.
    - Each other open project is a `sun-<ProjectID>` node, with default wires from the department ring.
    - A project at 09 "goes out" (no sun). If every project is at 09, the main sun is shown dimmed.
    - A dropped service attaches to the project of the nearest sun.
    - Node layout is saved per client in the browser.
  - **Planet:** `/client/:id/project/:id`. Gantt in the centre, details on the right, task list below. Double-click a sun to open it; Esc returns to Solar.
- **Every action has a visible control.**
  - The ⋮ menu on cards (also on right-click, and in Solar under the Sun's "Client actions") has:
    - Status Summary, Draft Invoice, Request OSINT Sweep, Flag Blocker (several per client; each is a BLOCK alert with its own Remove; Clients.ActiveRoadblock lists them joined by " | ")
    - Move phase, Move stage, Reset to auto
    - Sunset this project, Sunset whole client, Restore client folder (Complete/Sunset clients)
  - Department buttons and the drawer chips filter the alert feed.
- **Daisy's final message:** the send window has a "Final message" checkbox, allowed when the project is at 08/09 and the client's other projects are at 09. Posting then moves the client folder from Sanctum Active to Sanctum Inactive (Script Property `INACTIVE_PARENT_FOLDER_ID` overrides the default folder).
- **Cockpit** (Alt+8, or MENU › Cockpit on the side screen): live resources, departments, the 45-day project runway, alerts and activity. The side window gets its data from the main window (BroadcastChannel), so it needs no sign-in; its buttons refresh and move the main window.
- **Remove a service** (Solar: the service node's REMOVE SERVICE… button or Delete): Master Control previews the change, then the audited `removeService` takes the price off the final invoice only (deposit and mid-flight frozen; TCV drops; AddendumRef note once invoicing started), drops the component and deletes its open Google Tasks. Refused when the final invoice is already issued or smaller than the price.
- **Calendar bay:** read-only Google Calendar (Today / 7 days, choose calendars, NOW badge, Join / Open, client chip opens Solar). Read in the browser with the sign-in token (`calendar.readonly`); Master Control is not involved.
- **Feedback:** every save shows a toast (green when saved, amber for a warning, red when not saved). Data-load failures also show a red toast.
- **Readability:** no text is smaller than 11 px. Use the `text-hud-1` to `text-hud-5` scale (11–13 px), defined in `src/index.css`.

## Integrations

- **Google Tasks:** one list per project, named with the ProjectID. Task notes carry `Audience:`, `Start:` and `Key:` lines.
- **Command Deck:** one per project, in the client folder, shared with the client Group. Client tasks sync both ways.
- **Chat:** each project has an internal space and a client space. Daisy posts only to the client space, after owner confirmation.
- **MCC and Oracle working masters:** the IDs are set. The 15-minute Police sync copies the Master Control owner name and email into rows whose ClientID matches.

## Not built yet (see `docs/PARKING_LOT.md`)

- Lead graduation and the Lead DB (Phase Q).
- Prices for the 11 new services.

## Checks

- **HUD:** `npm run lint` (strict; it rejects unused code), `npm run audit:unused` (resolves real import paths), `npm test`, `npm run build`, `npm run e2e` (Edge on offline snapshot data, nothing written to Master Control).
- **Master Control:** `node --test engines/master-control/test/*.test.mjs`, `node engines/master-control/tools/find-unused.js`.
- **Deploy Master Control:** `bash engines/master-control/tools/wc-clasp.sh stage`, then `push --force`, then `version`, then `redeploy` for the HUD deployment.
