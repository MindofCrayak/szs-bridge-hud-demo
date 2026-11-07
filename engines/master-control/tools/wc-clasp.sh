#!/usr/bin/env bash
# Run clasp against the Master Control WORKING COPY only (Master Plan v3.1, section 2).
# Usage (Git Bash, from anywhere):
#   bash engines/master-control/tools/wc-clasp.sh pull        # remote -> docs/private/wc-staging/remote-<date>/
#   bash engines/master-control/tools/wc-clasp.sh stage       # copy local deployable sources -> staging dir
#   bash engines/master-control/tools/wc-clasp.sh <clasp args> # e.g. deployments, versions, push, redeploy <id>
# The staging dir is git-ignored. The repo's engines/master-control/.clasp.json (Original) is never used.
set -euo pipefail

WORKING_COPY_SCRIPT_ID="1H02jmtB9AuYant9x5paAZceoaPSaRv-5SepRBRvmkJ-kawWpx_q9_sif"
ORIGINAL_SCRIPT_ID="12l72F8nuKnaz-CqfPDccExeCPE41oQzGqzVhLKDRPGn21ZoI5lQZUs2L"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$ENGINE/../.." && pwd)"
STAGE="$REPO/docs/private/wc-staging/current"

write_config() {
  local dir="$1"
  mkdir -p "$dir"
  printf '{\n  "scriptId": "%s",\n  "rootDir": "./"\n}\n' "$WORKING_COPY_SCRIPT_ID" > "$dir/.clasp.json"
}

verify_config() {
  local dir="$1" id
  id="$(sed -n 's/.*"scriptId": *"\([^"]*\)".*/\1/p' "$dir/.clasp.json")"
  echo "clasp target scriptId: $id"
  if [ "$id" = "$ORIGINAL_SCRIPT_ID" ]; then echo "REFUSING: config points at the ORIGINAL." >&2; exit 2; fi
  if [ "$id" != "$WORKING_COPY_SCRIPT_ID" ]; then echo "REFUSING: config is not the Working Copy." >&2; exit 2; fi
  echo "OK: matches Working Copy (section 2)."
}

stage_sources() {
  rm -rf "$STAGE"
  write_config "$STAGE"
  cp "$ENGINE/appsscript.json" "$ENGINE"/*.gs "$STAGE"/
  # 2026-11-06: root .js files are optional now (the last two were merged into .gs); a missing glob must not abort
  # staging half-way, which once pushed the project without src/.
  for js in "$ENGINE"/*.js; do [ -e "$js" ] && cp "$js" "$STAGE"/; done
  mkdir -p "$STAGE/src"; cp "$ENGINE"/src/*.gs "$STAGE/src/"
  for required in src/Central_Router.gs src/Master_Control_Auth.gs HUD_Writes.gs appsscript.json; do
    [ -f "$STAGE/$required" ] || { echo "REFUSING: staging is missing $required" >&2; exit 3; }
  done
  verify_config "$STAGE"
  echo "Staged files:"; (cd "$STAGE" && find . -type f | sort)
}

cmd="${1:-}"
case "$cmd" in
  pull)
    dest="$REPO/docs/private/wc-staging/remote-$(date +%Y-%m-%d-%H%M%S)"
    write_config "$dest"; verify_config "$dest"
    (cd "$dest" && clasp pull)
    echo "Pulled into: $dest" ;;
  stage)
    stage_sources ;;
  "")
    echo "usage: wc-clasp.sh pull | stage | <clasp args>" >&2; exit 1 ;;
  *)
    [ -f "$STAGE/.clasp.json" ] || write_config "$STAGE"
    verify_config "$STAGE"
    (cd "$STAGE" && clasp "$@") ;;
esac
