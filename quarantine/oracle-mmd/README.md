# Oracle MMD — INTERNAL IP — QUARANTINED

**Never package, publish, copy, or expose this directory to clients.**

This folder is the physical isolation boundary for Oracle MMD audit and
intelligence source. Do not add imports from this directory to
`apps/command-hud`, the client template vault, or any release build.

The source from `C:\Users\craya\GitHub\Oracle\oracle` is preserved under
`oracle/`; the former standalone repository remains in place. Its local
`.env` and `node_modules` were excluded. The HUD's legacy Oracle panel is
also preserved under `legacy-ui/`. Keep this entire folder internal-only.
