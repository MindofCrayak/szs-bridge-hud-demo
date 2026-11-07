# Repository Release Boundaries

## Oracle quarantine

Oracle MMD source belongs only under `quarantine/oracle-mmd/`. The Command HUD
must not import or bundle files from that directory. Its app package is scoped
to `apps/command-hud`, and its distributable file allowlist excludes every
other workspace directory. Treat the quarantine as internal-only: do not copy,
publish, or include it in customer deliverables.

The legacy Oracle panel and the supplied Oracle repository are isolated in
the quarantine and are not included in the HUD build. The HUD may retain an
unconnected navigation stub, but it must not contain Oracle audit or scraping
implementation.

The HUD's `prebuild` boundary check rejects imports from the Oracle quarantine
or Apps Script engine directories, and its npm package allowlist excludes
workspace source and sibling directories.

## Master Control source of truth

Master Control is authoritative for client, project, pipeline, and alert data.
The HUD reads those records from its configured endpoint. Do not add a local
client-data fallback for live operation or treat optimistic UI state as
persisted until Master Control confirms the write. A user-selected
`VITE_DATA_MODE=snapshot` may load read-only CSV exports from
`apps/command-hud/local-data/`; that snapshot is not authoritative, does not
authenticate, and must not perform remote reads or writes. Keep endpoint URLs
and credentials local; do not commit `.env.local`, clasp project IDs, or
privileged credentials.

## Packaging

Package the Command HUD only from `apps/command-hud/`. Never package from the
repository root or from `quarantine/`. Vault templates must remain sanitized
and must not contain Oracle source or internal production credentials.
