# SZS Command HUD — Changelog

All notable changes to this project will be documented in this file.

---

## [Owner retests: ribbon, cockpit, blockers, calendar, service removal, console sliders] - 2026-11-06

### Added
- One navigation ribbon: Universe › Galaxy › Solar plus OSINT, Symphony, Treasure, Mail and Clients; Back button and Backspace; StarCraft-style resource readout; client picker as a ▾ on SOLAR; Windows shortcuts (Ctrl+K, Alt+1..8).
- Live cockpit, inline (Alt+8) or on a side screen fed over a BroadcastChannel.
- Flag Blocker: several blockers per client, each removable (audited `setBlocker`).
- Daisy "Final message": posting also moves the client folder to Sanctum Inactive; card menu "Restore client folder" undoes it.
- Remove service (`removeService` + preview): price off the final invoice only, open Google Tasks deleted, completed kept.
- Calendar bay: read-only Google Calendar (Today / 7 days, calendar picker, Join / Open, client chip).
- MENU › HUD size (100-125%).
- Master Control: SZS Tools menu in the spreadsheet; `hud_getWriteStatus` (audit row by request ID).

### Fixed
- Settings and command windows opened behind the main view; the Solar ▾ list opened under the canvas.
- Solar zoom control overlapped the top bar; it now sits in the workbench ribbon.
- Saves reported "Internal error encountered" although they went through: the HUD now checks the audit log; reads retry once.
- Remove service picked the wrong project on clients with several projects.
- Full-screen views were hidden behind the bottom dock and crystal.
- Restored the bottom console scale and per-bay width sliders (broken 2026-10-26/30, removed 2026-11-01).

### Removed
- Master Control dead code (about 1,200 lines: old edit guardrails, one-off repairs, unaudited `updateKanban` route, unused web feed). The fake calendar feeds window.

---

## [Milestone 0 & Solar Drag Fixes] - 2026-10-26

### Added
- **`STATUS.md`**: Architectural audit of Modules A through F with verification notes.
- **`SECURITY.md`**: Credential isolation boundary, OAuth scopes documentation, token handling rules, and developer compromise threat model.
- **`engines/master-control/src/Snapshot_Trigger.gs`**: Standalone daily snapshot script copying Master Control sheets to timestamped backups with automated 30-day retention pruning.
- **`DropConfirmDialog.tsx`**: Human authorization modal guarding any drag-and-drop or ECS module attachment that mutates Contract Value or ledger totals.
- **`HudErrorBoundary.tsx`**: Subsystem isolation boundary wrapping Tactical Canvas and Bottom Console Chassis with fallback UI.
- **Alt + Right-Click Context Menu**: Supported across both `SlimVitalsCard` and `ResizableNodeContainer` for quick locking/context menu triggers.

### Fixed
- **Solar Map Drag & Drop Diagnostics**:
  - Attached explicit `draggable="true"` and set `-webkit-user-drag: element; user-select: auto;` on draggable service nodes.
  - Removed container `user-select: none` blockers that prevented browser native drag initialization.
  - Replaced `w-0 h-0 overflow-visible` hit-testing bottleneck with a full-viewport interaction container (`inset-0 pointer-events-none` with `pointer-events-auto` on interactive nodes).
