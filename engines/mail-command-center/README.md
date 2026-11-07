# Mail Command Center

Isolated workspace for the MCC source and Apps Script engine. The supplied
repository is preserved under `production-source/`; its React interface and
Apps Script files are kept together as provided. The Apps Script project
source is under `production-source/apps_script/`.

The original `.clasp.json` was intentionally not copied because it contains
project-specific deployment metadata. Configure the placeholder in
`.clasp.example.json` only after verifying the authorized MCC script ID.
The example `rootDir` points at `production-source/apps_script/`.

Do not copy production subscriber data or internal Oracle source into this
workspace. The sanitized vault destination remains separate.
