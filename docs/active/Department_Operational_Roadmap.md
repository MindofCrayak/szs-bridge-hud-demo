# Department Console and Operational Roadmap

## Audit snapshot

The HUD currently runs as one browser application. The dashboard combines a
left dispatch dock, a client canvas, and a bottom console; it does not yet
provide a separate persistent second-display cockpit. The department icons in
the dock filter priority items and are not department workspaces.

Master Control is the declared source of truth. Its tagged Central Router is
now present and locally hardened, but the deployed version and live handler
contracts have not been verified. The HUD's legacy shared-secret transport was
removed; live reads and writes remain disabled until the approved OAuth/API
connector is configured.

| Department | Present evidence | Not yet operational / constraint |
| --- | --- | --- |
| Alfred | HUD alert and telemetry views; a client compliance checklist; selected-client context in the terminal. | Live feed is unavailable pending OAuth. Terminal intercom is a local stub. No police trigger is installed; alert dismissal and dead-letter retention are not implemented. |
| Pamela | Client intake draft UI, compliance evidence fields, and a compliance modal. | Intake scoring, automatic decisions, template preflight, and Drive provisioning are not connected. Existing draft records are local only. |
| Oracle | A standalone source tree exists under `quarantine/oracle-mmd/oracle/`; its separate code includes case-file and sourcebook workflows. | Strictly excluded from HUD imports and client packages. The HUD may not expose raw research code or make claims about live Oracle execution. |
| Dolores | Client task-list, chat, and notes references can be displayed or opened when supplied by Master Control. | Google Tasks synchronization, calendar availability scanning, time-block creation, and Workspace/Admin provisioning are not connected. |
| Vala | HUD can display contract/deposit fields and calculate basic pipeline/deposit indicators. | Invoice creation/sending, milestone accounting, rate metering, payment webhooks, and reconciliation are not connected. |
| Daisy | MCC source is present in its isolated engine workspace, including campaign, drip, bounce, and preference-center code. | No verified HUD-to-MCC contract or authorized project configuration. Intake funnel, archival, retention enrollment, and client exit workflows need contracts and safeguards. |

## Delivery sequence

### Phase 1 — Department console shell (implemented)

- Add an overlay console over the tactical canvas with department navigation,
  selected-client context, honest connector status, and current read-only
  indicators.
- Reuse existing HUD actions only where their limits are clear. Keep command
  entry local-only until a department dispatch contract exists.
- Keep Oracle visibly quarantined and non-invokable from the HUD.

### Phase 2 — Master Control contract and governance

- **Completed locally:** imported the tagged canonical router, moved duplicate
  legacy endpoints and the cross-database schema migration into a
  clasp-excluded review-only directory, removed embedded credentials/IDs from
  active source, and added Workspace-user allowlists.
- (2026-11-06: `updateKanban` was later removed; the gate now runs inside the audited `setSprintStage` write.)
- **Completed locally:** wired the phase gate into `updateKanban` under a
  30-second lock. It joins the existing `Clients`, `Finances`, and `Projects`
  schemas for MSA, deposit, and SOW requirements. Authorized overrides are
  audited before the stage write. Local integration tests cover allow/deny,
  audit ordering, and lock release.
- **Completed locally:** removed the browser `VITE_*` shared-secret transport.
  The HUD now reports OAuth as unavailable rather than falling back to an
  unauthenticated request. The local Apps Script manifest is domain-restricted
  and executes as the accessing user.
- **Blocked on authentication/deployment:** configure the approved Cloud
  project, OAuth client, Apps Script API, API-executable deployment, and
  required Script Properties. The local source and manifest have not been
  deployed or verified against the live project.
- **Blocked on operations approval:** the 15-minute police trigger has not
  been installed. Its current source overwrites selected Oracle owner and MCC
  email fields; verify this reconciliation scope and recovery behavior first.
  Lead graduation remains disabled because its multi-system provisioning
  effects are not idempotent. Payment recording is unimplemented.
- **Blocked on alert policy:** alert dismissal and dead-letter retention/
  redaction semantics are not yet implemented. The migration source remains
  review-only and must not be run; it rewrites data and schemas, including
  Oracle.

### Phase 3 — Pamela intake and provisioning

- Define transparent score inputs, thresholds, and review states; keep
  auto-decline and auto-provision disabled until the owner approves the policy.
- Validate MSA/SOW/invoice templates for unresolved tags before provisioning.
- Add an explicit, auditable provisioning handler and require user
  confirmation before Drive mutations.

### Phase 4 — Dolores workspace and scheduling

- Define the Master Control mappings for Tasks, Chat, and workspace resources;
  implement task synchronization with idempotency and conflict handling.
- Build calendar availability as read-only first. Require user confirmation
  before creating any time block.
- Treat Admin SDK deployment as a separately authorized product workflow:
  confirm tenant, scopes, billing, least privilege, and rollback before
  enabling OU, group, or Shared Drive changes.

### Phase 5 — Vala finance and reconciliation

- Define approved rate tiers, billable-unit rules, milestone completion
  semantics, and invoice numbering with the finance owner.
- Generate invoice drafts for review first; never automatically send or mark
  paid from HUD-only state.
- Add authenticated, idempotent payment reconciliation and unlock milestones
  only after Master Control confirms the payment.

### Phase 6 — Daisy communications and client exit

- Verify MCC deployment identity and map its records non-destructively from
  Master Control without changing MCC schema casing.
- Audit consent, unsubscribe, bounce, suppression, quota, and retry behavior
  before enabling campaigns or drip triggers.
- Add the lead diagnostic and retention enrollment only with explicit consent
  and tested unsubscribe handling.
- Implement folder archival as a reversible, audited operation with a
  preflight and verified destination; do not delete client records.

### Phase 7 — Oracle bridge (optional and isolated)

- Keep Oracle runtime, source, credentials, and raw findings inside the
  internal quarantine.
- If HUD review is approved, define a narrow sanitized result contract that
  contains no scraper implementation or sensitive raw research. Import no
  Oracle modules into the HUD.
- Independently verify case-file edits and Slides generation in the Oracle
  workspace before enabling those operations.

### Phase 8 — Dual-display and release verification

- Decide whether the cockpit is a synchronized second browser window or a
  responsive single-window layout before implementing cross-display state.
- Verify Master Control authority, optimistic rollback, audit logs,
  accessibility, reconnect behavior, and release boundaries end to end.
- Test the packaged HUD to ensure engine and quarantine source remain excluded.

## Release gates

- Never substitute mock clients or UI drafts for authoritative records.
- Label unavailable integrations as unavailable; a click or local echo is not
  proof of a backend action.
- Keep credentials and actual Apps Script project IDs out of browser bundles
  and source control.
- Do not deploy Apps Script or run production mutations until the authorized
  source and destination project IDs are verified.
- Keep Oracle source outside every HUD build and client deliverable.
