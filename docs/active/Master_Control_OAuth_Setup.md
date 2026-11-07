# Master Control OAuth Setup

The HUD uses user OAuth and the Google Apps Script API; it does not use a
`VITE_*` shared-secret transport. Use **only**
`http://127.0.0.1:3002` for local development: Google OAuth returns
`origin_mismatch` on 3001, and Vite is configured to fail rather than switch
ports. The owner confirmed the Original and Working Copy share the OAuth
client's Cloud project and the HUD live snapshot previously succeeded after
the API Executable deployment ID was configured. The client expects
`VITE_APPS_SCRIPT_DEPLOYMENT_ID`; keep the deployment ID in ignored local
configuration, not tracked documentation. Do not put privileged credentials
in any `VITE_*` variable.

## Google Cloud and Apps Script prerequisites

1. In the authorized Apps Script project, open **Project Settings** and
   associate it with a standard Google Cloud project. Record the project ID
   locally; do not commit deployment IDs or credentials.
2. In that same Cloud project, enable the Google Apps Script API.
3. Configure the OAuth consent screen for the intended Workspace users. Prefer
   an internal audience when all users belong to the same Workspace
   organization.
4. Create a Google OAuth **Web application** client. Add only the actual HUD
   origins used for development and production as authorized JavaScript
   origins. An OAuth client ID is public configuration; do not create or ship
   a client secret for a browser application.
5. Deploy the authorized Apps Script project as an **API executable**. The
   Apps Script API calling application and script must share the standard
   Cloud project, and the user access token must include the script's required
   OAuth scopes. The `scripts.run` URL takes the API executable's **deployment
   ID**, not the script project ID.
6. Review `appsscript.json` and the full source to determine the actual
   required scopes. Use the narrowest scope set that supports the approved
   workflows; Apps Script API execution may require the union of scopes used
   by the script project.
7. Add explicit server-side authorization inside the script for allowed
   Workspace users and each action. Do not treat a client-supplied email,
   `overrideAuth` flag, or OAuth client ID as proof of user authorization.

Google's setup and execution requirements are documented in the [Apps Script
API execution guide](https://developers.google.com/apps-script/api/how-tos/execute),
[Apps Script web app guide](https://developers.google.com/apps-script/guides/web),
and [Google Identity Services overview](https://developers.google.com/identity/gsi/web/guides/overview).

## Local router status and remaining OAuth work

> **2026-11-06:** `updateKanban` and `getHudState` were removed. Stage changes go through the audited `hud_write` action `setSprintStage` (which applies the same stage-04 gate), and the HUD reads with `hud_getSnapshot`. The text below is kept as history.

The existing `/exec` Web App URL is not itself an OAuth-enabled API executable
contract. The HUD's `doPost`-style `action` requests cannot be assumed to work
through `scripts.run`. The local router now provides explicit callable
wrappers:

- `getHudState` returns JSON-safe HUD state for an authorized user.
- `updateKanban` reads deposit status from `Finances`, MSA from `Clients`, and
  SOW from `Projects`, then evaluates the phase gate under the mutation lock.

Server authorization uses `AUTHORIZED_USER_EMAILS`; exceptions and the police
audit use separate allowlists. Internal helper functions use the Apps Script
private-function suffix. Lead graduation is disabled pending idempotency and
side-effect review, and payment recording is explicitly unimplemented. The
HUD OAuth is implemented locally, but live requests remain unverified until
the OAuth client, API executable deployment, and scopes are configured and
approved.

The local gate and handler integration tests pass with mocked Apps Script
services. They do not validate the live sheet schema, deployed version,
Workspace authorization, or Apps Script API execution.

## HUD OAuth client requirements

- Keep only the public OAuth client ID and non-sensitive API configuration in
  browser variables.
- The HUD login screen requests the scopes declared in
  `engines/master-control/appsscript.json`, including `script.scriptapp`, which
  is required by `scripts.run`. Keep the two lists aligned when changing
  scopes.
- Configure `VITE_OAUTH_CLIENT_ID` and `VITE_APPS_SCRIPT_DEPLOYMENT_ID`
  locally. The `scripts.run` path takes the API Executable deployment ID, not
  the Apps Script project Script ID or a Web App URL/deployment.
- Access tokens are kept in React state only, expire out of state, and are
  cleared with HUD data on sign-out.
- Keep access tokens in memory; do not put them in URLs, logs, local storage,
  analytics, or crash reports.
- Handle token expiration, denied consent, and authorization errors
  explicitly. Never silently fall back to the old shared-secret request.
- Protect each backend function independently. Hiding a button or restricting
  the React interface is not authorization.

## Credentials and deployment hygiene

- Keep approved Drive, Oracle, MCC, and template identifiers in Apps Script
  **Script Properties**. The local source does not set production properties.
- Rotate any secret that has been pasted into a chat, ticket, or source file
  before relying on it for production authorization.
- Keep the actual `.clasp.json`, project IDs where restricted, OAuth tokens,
  and private credentials out of version control.
- Do not deploy the local helper or enable provisioning, email dispatch,
  scheduled triggers, or other mutations until the authorized source and
  deployment settings have been reviewed and tested.

## Verification checklist

- [x] Tagged `Central_Router.gs` is present locally; credentials and
  deployment-specific IDs were removed from active source.
- [x] Browser `VITE_*` shared-secret transport is removed; the HUD makes no
  unauthenticated fallback requests.
- [x] Stage-gate helper is wired to the local `updateKanban` handler and
  covered by local mocks.
- [x] Owner confirms the Original and Working Copy scripts share a standard
  Cloud project with the OAuth client. The private registry's
  client-prefix/project-number discrepancy still needs reconciliation.
- [ ] Apps Script API is enabled and an API-executable deployment exists.
- [ ] OAuth consent, authorized origins, user audience, and script scopes are
  approved.
- [x] Local server-side actor authorization is tested for allowed and denied
  users.
- [x] Phase-gate tests and handler integration tests pass locally.
- [x] Browser adapter uses an in-memory OAuth token and does not persist or log it.
- [x] HUD login screen starts Google OAuth and requests the manifest scopes.
- [x] HUD uses the Apps Script API `scripts.run` request shape with `devMode: false`.
- [ ] Enable Apps Script API if needed, deploy the Working Copy as an API
  Executable, and verify the read with the signed-in Workspace user.
- [ ] Production mutations remain disabled until the owner authorizes the
  verified deployment.
