# Session Zero Solutions workspace

Shared agent instructions for the modular SZS Airship Bridge monorepo.

Read [the Alfred Core Directive](../docs/Alfred_Core_Directive.md) before
changing product behavior. Honor the Master Control data contract in
[`docs/Schema_Contracts.md`](../docs/Schema_Contracts.md) and the Oracle
release boundary in [`docs/RELEASE_BOUNDARIES.md`](../docs/RELEASE_BOUNDARIES.md).

The React HUD lives under `apps/command-hud/`; Apps Script engines live under
`engines/`; Oracle MMD is internal-only under `quarantine/oracle-mmd/`; and
sanitized client starters belong under `vault/00_SZS_MASTER_TEMPLATES/`.

Run frontend checks from the repository root with `npm run lint` and
`npm run build`. Never treat optimistic browser state as persisted until
Master Control confirms the write. Never import quarantined Oracle source
into the HUD or commercial templates.
