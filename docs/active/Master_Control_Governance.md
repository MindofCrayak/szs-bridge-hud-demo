# Master Control Governance Contract

## Current implementation boundary

The tagged Master Control sources have been imported into
`engines/master-control/`. Only `Central_Router.gs`,
`Drive_Provisioning.gs`, `Master_Control_Auth.gs`, and the phase-gate helper
are in the active source directory. Duplicate legacy `doGet`/`doPost` handlers
and the schema migration are retained under `reference/` and excluded from
clasp uploads. The migration source is review-only and must not be run; it
rewrites data and schemas across Master Control, Lead Database, and Oracle.

The local manifest restricts Web App access to authenticated domain users and
executes as the accessing user. Server functions also require explicit email
allowlists in Script Properties. These are local source changes only: the
existing deployment has not been updated or verified, and OAuth client/API
configuration remains incomplete. Do not deploy or run production operations.

The HUD's browser-shared-secret calls have been removed. Its Master Control
read/write adapter now fails with an explicit OAuth-not-configured error
instead of making unauthenticated or secret-bearing requests. Live HUD data
and remote actions remain unavailable until the approved OAuth connector and
API-executable deployment are configured.

## Pipeline phase gate

> **2026-11-06:** `updateKanban` and `getHudState` were removed. Stage changes go through the audited `hud_write` action `setSprintStage` (which applies the same stage-04 gate), and the HUD reads with `hud_getSnapshot`. The text below is kept as history.

The local `updateKanban` handler evaluates the gate while holding a 30-second
script lock. It reads the authoritative fields from their current schemas:

- `Clients`: `ClientID`, `PipelineStage`, and `MSA_DocID`.
- `Finances`: at least one matching client's `DepositPaid` value must be true.
- `Projects`: a matching project's `SOW_DocID` must be a non-empty string.

Before stage `04` or later, the handler requires a paid deposit, non-empty MSA
ID, and non-empty SOW ID. These checks establish that IDs are recorded; they
do not query Drive or prove the documents' contents or continued existence.
The handler updates only the client's `PipelineStage` field.

An exception requires the request to set `overrideAuth: true`, include a
non-empty reason, and come from an email in the separate
`PIPELINE_OVERRIDE_EMAILS` Script Property. The audit row records actor,
timestamp, stable `ClientID`, source and target stages, missing prerequisites,
and reason before the stage update. If the audit sheet, required schema,
authorization, or audit write is unavailable, the transition is denied.
Because Sheets does not provide a transaction across the audit append and
stage update, a stage-write failure can leave a valid override-attempt record
without a completed transition.

The local handler tests cover authorization, cross-sheet prerequisite
mapping, lock release, audit ordering, and fail-closed behavior. They do not
verify the live spreadsheet schema or deployed handler.

## Mutating endpoints

- `updateKanban` is the only currently enabled stage mutation and uses the
  shared 30-second script lock.
- `doPost` authenticates the active Workspace user before dispatch and also
  holds the lock. `graduateLead` is explicitly disabled until its
  non-idempotent Drive/sheet/MCC side effects are reviewed. `recordPayment`
  returns `501` because it is not implemented.
- `runSystemPoliceAudit` requires its separate `POLICE_AUDIT_EMAILS`
  allowlist and uses the same lock. It currently force-synchronizes selected
  owner/email fields from Master Control into Oracle and MCC. Do not install
  its 15-minute trigger until those overwrite semantics and recovery behavior
  are approved and tested.
- The backend Apps Script source-snapshot workflow was removed because it
  copied peripheral source—including quarantined Oracle code—into a shared
  document. Provisioning no longer writes `case_file.json` into client Drive.
- No trigger has been installed, no migration has been run, and no production
  spreadsheet or Drive operation has been performed.

Use Script Properties for approved spreadsheet, folder, and template IDs.
`AUTHORIZED_USER_EMAILS`, `PIPELINE_OVERRIDE_EMAILS`, and
`POLICE_AUDIT_EMAILS` are comma-separated email allowlists. Do not put private
values in source, Vite configuration, URLs, logs, or client bundles. Rotate
credentials exposed in the tagged source before production reliance.

## Validation

Run from the repository root:

```powershell
node --test engines/master-control/test/pipeline-phase-gate.test.mjs engines/master-control/test/master-control-router.test.mjs
```

This validates local logic only. Production enablement still requires the
approved OAuth client, Apps Script API configuration, API-executable
deployment, verified live schemas and scopes, and owner authorization.
