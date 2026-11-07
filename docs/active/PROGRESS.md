# PROGRESS (running log)

The Master Plan v3.1 log (Phases A–H) is archived at [`docs/archive/PROGRESS_v3.1.md`](../archive/PROGRESS_v3.1.md). Append new entries below: date, step, what changed, what you ran, results, and what the owner needs to do.

## 2026-11-05: v3.1 closed
- Phase H5: the plan, the v3.1 log and the reports moved to `docs/archive/`; `docs/README.md` and `docs/HUD_HANDOFF_SUMMARY.md` updated. H1/H2 (test leads through the forms) are deferred by the owner to Phase Q.


## 2026-11-05: Housekeeping audits
- **Deployed code matches the repo:** a pull of the Working Copy matched the repo, 27 of 27 files. The HUD deployment was moved from version 26 to 27 (identical to HEAD), then to 28 after the clean-up below. `.env.local` points at that deployment, and the dev server on 3002 serves the current source. Pushing is disabled (`origin` push URL is DISABLED).
- **HUD unused code:**
  - Deleted 15 files nothing imported. Old board and hook modules: `ClientAccountCard`, `SpatialKanbanColumn`, `SprintStageColumn`, `ProjectSprintCard`, `WorkspaceConsole`, `CanopyCarapace`, `useCanvasZoomPan`, `useChassisLifecycle`, `useHudState`, `useKanbanMode`, `audioSynthesis`. Never shown: `ComplianceModal`, `GrandArchiveView`, `MailCommandCenterView`, `DepartmentConsole`.
  - Removed unused imports and state.
  - Removed the menu item **MENU → Departments Console**, which did nothing (its console was never rendered).
  - Fixed: data-load failures (`loadError`) were stored but never shown; they now show a red toast.
  - `tsconfig` now sets `noUnusedLocals` and `noUnusedParameters`, so `npm run lint` rejects new dead code.
- **Master Control unused code:**
  - Deleted the finished one-off tools `Phase_E_Inventory.gs`, `Command_Deck_Inspect.gs`, `refillSeededDocuments` (replaced by `refillProjectSows`) and `runPhaseEAutomationPAC` (automation now runs on stage saves).
  - Deleted dead private code: `src/SZS_Database_Generator.gs` and `authorizeDriveProvisioning_`.
  - `executeLeadGraduation_` is kept and marked "parked until Phase Q". No trigger handler was affected. The Working Copy now has 24 files.
- **Docs:**
  - Deleted the obsolete pre-wipe export `docs/active/Working Copy of SZS Master Control - Clients.csv`.
  - Archived the old wire export and the 2026-10-31 `STATUS.md`.
  - New `docs/DESIGN.md` describes the system as built, including the 2026-11-05 owner changes.
- **Stage check:** in v3.1, A–G are done. A's last items are resolved: the unused deployments are gone and the HUD shows `DATA LIVE`. H is done except H1/H2, which are deferred by the owner to Phase Q.
- **Ran:** HUD lint (strict), 88/88 tests, build, e2e 15/15; Master Control 112/112.
- Saved the scans: `npm run audit:unused` (HUD files nothing imports) and `node tools/find-unused.js` (Master Control, run from engines/master-control). Both are clean (0 HUD files; 1 private function, the parked graduation code).

## 2026-11-05: Owner dock skins merged
- Source: the owner's bundle `szs-dock-skins.patch` ("feat(dock): skinnable bottom console", made 2026-11-04 against GitHub `main` of 2026-10-30). The bundle was left in `public/assets/` (which ships with the HUD), so it was moved to `docs/private/dock-skins-bundle/` (git-ignored); only the skin images stay in `public/assets/hud/dock/<race>/` (127 webp).
- Applied as-is: 9 new files in `src/components/chassis/dock/`, the images, and `MacroPadBay`. Ported by hand onto the current code: `BottomConsoleChassis` (skin provider, frames, joints, power crystal, effects; kept every v3.1 change: Send-to-client overlay, task counts, readable type) and `ClientDetailInspector` (vitals meters).
- Review: no network calls; only the skin choice is stored in the browser. Two dock labels were under 11 px and now use the HUD type scale.
- Ran: HUD lint (strict), 88/88 tests, audit:unused 0, build, e2e 15/15 (bays still clickable in every view).

## 2026-11-05: Dock skin and toast fixes
- Owner: skins would not change; a red "Not saved: Data did not load … Google sign-in is required" toast showed although DATA LIVE.
- Crystal: `.szs-joint { pointer-events: none }` is plain CSS, so it beat Tailwind v4's layered `pointer-events-auto`; the crystal button never received clicks (also in the original bundle). Fixed in dock.css. Classic mode had no crystal at all (no way back to skins); it now shows a small crystal button.
- Toast: at startup the live read runs before sign-in finishes and records "sign-in required"; that toast stayed after live data loaded. Load toasts now clear themselves when the data loads, and only failed saves read "Not saved". OAuth was working (DATA LIVE).
- e2e 16/16 (new dock-skins: protoss -> zerg -> cassette -> classic -> terran -> protoss). HUD lint, 88/88, build.

## 2026-11-06: Backup push, parking lot, ribbon, cockpit, Master Control cleanup
- **Other branch checked:** `drakecollc-szs-hud-project-review` (5 commits, 2026-10-30) is fully contained in `main` and `live-data`; nothing missing. GitHub had nothing newer than local.
- **Pushed (owner: "push it"):** `live-data` and `main` (fast-forward) to GitHub at `4bab133`. Later commits below are local until the next push.
- **Parking lot:**
  - D4 prototype screens: live clients mapped onto the old screen shape (`data/clientUnit.ts`); no more `as any`.
  - E7 attach: already fixed in Phase G (drops send the project; price goes to the Finances TCV). Closed.
  - G3 Flag Blocker: audited `setBlocker` (Clients.ActiveRoadblock + a BLOCK alert in Dolores' feed; Clear resolves them) with a dialog.
  - Final message archive: Daisy's send has a "Final message" checkbox (allowed at 08/09 with the client's other projects at 09). The audited send posts, then moves the client folder Sanctum Active -> Inactive; undo is the card menu "Restore client folder" (`restoreClientFolder`).
  - Service uninstall/move: still parked; needs owner money/task decisions (see PARKING_LOT).
- **Ribbon (owner request):** one navigation bar (Universe > Galaxy > Solar plus OSINT/Symphony/Treasure/Mail/Clients, always shown); client picker as a dropdown on SOLAR; Back button and Backspace; StarCraft-style resource readout (paid, owed, projects, alerts, deposits due); Universe banner removed; Windows shortcuts (Ctrl+K palette, Alt+1..8; Ctrl+1..9 dropped because Windows browsers keep them for tabs); Settings and Q..C command windows opened behind the main view (z-50 under 115) and now open on top; bottom strip's fake "GA4 14 LIVE" and fixed "POLICE NOMINAL" replaced by real counts.
- **Cockpit:** all demo numbers and alert() buttons removed. It shows live resources, departments, a 45-day project runway, alerts and activity, inline (Alt+8) or on the side screen (MENU > Cockpit on the side screen), where the main window feeds it over a BroadcastChannel; its buttons refresh and drive the main window.
- **Master Control cleanup (deploy @29):** removed DatabaseGuardrails.js (fixed-column simple onEdit taking the script lock on every edit; stale dropdown installer; superseded Oracle/MCC push), Phase B repairs and self-test, Phase C backup/wipe, one-off schema seeding, the unaudited `updateKanban` route, the unused `getHudState`/`doGet` feed. Merged the schema files into `Schema_Registry.gs`; the Working Copy guard moved to `src/Master_Control_Auth.gs`. The edit handler cleans typed IDs/emails by header without a lock and queues Police in the background. New **SZS Tools** menu in the spreadsheet for every check and maintenance tool. About 1,200 fewer lines.
- **Deploy incident (fixed in a minute):** the first push after removing the last `*.js` files went out without `src/` (staging aborted on the empty glob after the root files were copied). The HUD was unaffected (pinned to @28); triggers could have failed for about a minute. `wc-clasp.sh` now tolerates the missing glob and refuses to stage without `src/`. Re-pushed; remote = local.
- **Deploys:** @29 (cleanup, setBlocker), @30 (final message). Remote matched local after each (22 and 23 files).
- **Ran:** HUD lint (strict), 90/90 tests, build, audit:unused 0 (now resolves real import paths), e2e 18/18 (new top-nav, cockpit); Master Control 106/106, find-unused (only the parked lead graduation).

## 2026-11-06 (later): Owner retest fixes, blockers, Calendar, service removal
- **Owner retest:** everything else worked. Fixed what was reported:
  - Solar ▾ client list opened under the canvas: the top bar was z-20 inside `<main>` while canvas pills were z-40. The top bar is now z-[70] and the canvas viewport is isolated. e2e `solar-ribbons` checks every list item is on top.
  - The zoom control in the top bar overlapped UNIVERSE: the Solar canvas controls (mode, satellites, zoom −/+, recenter) moved into the Solar workbench ribbon (`CanvasControls.tsx`).
  - Flag Blocker showed "Internal error encountered" although it saved; Clear did the same; a data load failed with the same text. That text is Google's HTTP 500 from the Apps Script API, not a script error. Writes now ask the audit log by request ID (`hud_getWriteStatus`) before reporting a failure; snapshot reads retry once. Not reproduced here (no signed-in browser); the recovery path is unit-tested.
  - Owner: several blockers per client, each deletable. `setBlocker` adds one / removes one (alertId) / clears all; the dialog lists them with Remove; the inspector's local-only "Pebble" text box became the list plus a button.
- **Owner decisions applied (parking lot):**
  - Remove a service: audited `removeService` + `hud_previewServiceRemoval`. Price off the final invoice only, open tasks deleted, completed kept. New `ServiceRemovalDialog` (DropConfirmDialog unchanged).
  - Calendar bay: real read-only Google Calendar (browser, `calendar.readonly` added to the sign-in only). Removed the unused fake-feeds connector window.
  - Prices for the 11 services and lead graduation: Phase Q.
- **Deploy:** @31. Remote = local (24 files).
- **Ran:** HUD lint (strict), 97/97 tests, build, audit:unused 0, e2e 20/20 (new solar-ribbons, calendar-bay); Master Control 113/113, find-unused (expected entry points only).

## 2026-11-06 (retest 2): Remove service project, screen padding, HUD size
- **Remove service said "comp_apps_script_build is not installed on PAC-01":** the Solar canvas shows the services of all the client's projects, and the node had no project, so the dialog used the primary project. The HUD now carries each project's ActiveComponents and removes from the project that has the service (PAC-02 here). Server was right to refuse; no Master Control change.
- **Padding:** OSINT/Symphony/Treasure/Mail/Clients now end above the bottom dock and its crystal (`--dock-clearance`). e2e measures it on every screen.
- **UI scaling:** the old "Master UI Scale" slider (removed 2026-11-01) only set a CSS variable nothing used. New MENU › HUD size (also in Settings): 100-125% scales the HUD text tokens and rem sizes; kept per browser. Not below 100% (11px rule).
- **Ran:** HUD lint, 98/98 tests, build, audit:unused 0, e2e 21/21 (new screen-padding-scale). Master Control unchanged (@31).

## 2026-11-06 (retest 3): Bottom console sliders restored
- Owner: the per-bay sliders and the UI scale "worked great, then something broke, then it got removed"; removal was never asked for.
- Found in history: 2026-10-24 working (bay widths `--bay-*-w`, "Master UI Scale" = transform scale of the console). 2026-10-26 the collapsible-dock rewrite dropped the scale (slider did nothing); 2026-10-30 widths became `clamp(.., NNvw, var(--bay-*-w))`, so a slider could only shrink a bay below ~16% of the screen; 2026-11-01 the dead scale slider was removed. Saved widths were never re-applied after a reload.
- Restored (`ui/dockLayout.ts`, `DockLayoutControls`): console scale 75-125% (`--dock-scale`, transform from the bottom) and four bay sliders (140-1000 px) used exactly; unset = responsive default; live, kept per browser, applied at startup; Reset to default. Full-screen view padding follows the console scale. Below 100% the console text is under 11px; the slider says so.
- Ran: HUD lint, 99/99 tests, build, audit:unused 0, e2e 22/22 (new dock-layout).

## 2026-11-06 (close): Owner confirmed, pushed
- Owner retested the console sliders: "Worked great". All 2026-11-06 items are confirmed by the owner.
- Logs updated: this file, `docs/HUD_HANDOFF_SUMMARY.md` (state as of today), `CHANGELOG.md` (2026-11-06 entry).
- **Pushed (owner: "push it"):** `live-data` and `main` to GitHub. Master Control Working Copy stays at @31 (remote = local, 24 files).
