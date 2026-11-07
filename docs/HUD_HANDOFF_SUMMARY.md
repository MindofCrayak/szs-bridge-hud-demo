# HUD status (2026-11-06)

**Plan:** none active. [Master Plan v3.1](./archive/SZS_HUD_MASTER_PLAN_v3.1.md) is complete; Phase Q (lead intake and graduation) comes in the owner's next plan.
**Log:** [`docs/active/PROGRESS.md`](./active/PROGRESS.md). The full v3.1 evidence is in [`docs/archive/PROGRESS_v3.1.md`](./archive/PROGRESS_v3.1.md).
**Open items:** [`docs/PARKING_LOT.md`](./PARKING_LOT.md).

## Targets

- Working Copy Master Control: spreadsheet `1KlP547wMInbfabpbAYI-sx8oirIQ8A19wlUquUdx3Rs`, script `1H02jmtB9AuYant9x5paAZceoaPSaRv-5SepRBRvmkJ-kawWpx_q9_sif`.
- The HUD calls API Executable deployment `AKfycbwsrrU6…S6CQ` (version @31 since 2026-11-06) through `scripts.run`. Deploy with `bash engines/master-control/tools/wc-clasp.sh` (stage, push --force, version, redeploy).
- The HUD runs on `http://127.0.0.1:3002`. Its tests are `npm test`, `npm run lint`, `npm run build`, and `npm run e2e` (Edge, snapshot data). Master Control's tests are `node --test engines/master-control/test/*.test.mjs`. As built: [`docs/DESIGN.md`](./DESIGN.md).

## State (2026-11-06, owner-confirmed)

- Every item from the 2026-11-06 owner retests works (owner: "worked great").
- Built and confirmed today: one navigation ribbon with Back, resource readout and the client picker on SOLAR; live cockpit (inline and side screen); several blockers per client; Daisy's final message archives the client folder (undo in the card menu); Remove service (price off the final invoice, open tasks deleted); real read-only Google Calendar bay; Solar canvas controls in the workbench ribbon; full-screen views clear the dock; MENU › HUD size; Settings › Bottom console (console scale and per-bay widths, restored).
- Lost replies from Google ("Internal error encountered") are checked against the audit log before a save is reported as failed.
- Waiting on Phase Q: prices for the 11 services, lead graduation.
- Tests at hand-off: HUD lint, 99/99 unit, build, audit:unused 0, e2e 22/22; Master Control 113/113.
