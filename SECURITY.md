# SZS Command HUD — Security & Threat Model

**Author:** Session Zero Solutions Security Architecture  
**Scope:** Command Bridge 2.0 Client & Apps Script Execution Boundary  
**Last Review:** 2026-10-26

---

## 1. Secrets & Credentials Architecture

### Bridge Token Storage
- The Google OAuth 2.0 access token resides **in-memory only** within React state (`App.tsx: accessToken`).
- The token is **never persisted** to `localStorage`, `sessionStorage`, cookies, or indexedDB.
- Refresh occurs on demand through `@react-oauth/google` implicit token flows. When the browser tab is closed, the in-memory token is immediately garbage collected.

### Environment Secrets
- `VITE_APPS_SCRIPT_ID`: Public deployment identifier for the Apps Script API endpoint. Does not grant access on its own; all execution calls require an active Bearer token signed by an authorized Google Workspace account.

---

## 2. OAuth Scopes

The client requests the minimum authoritative scopes required for Google Workspace CRM synchronization:

1. `https://www.googleapis.com/auth/drive` — Access to client Drive vaults and scoped subdirectories.
2. `https://www.googleapis.com/auth/documents` — Access to client MSAs, SOWs, and meeting notes.
3. `https://www.googleapis.com/auth/spreadsheets` — Read/Write to Master Control Sheets (`Projects`, `Clients`, `Finances`, `Alfred_Alerts`).
4. `https://www.googleapis.com/auth/userinfo.email` — Identity verification for actor authentication in the Central Router.
5. `https://www.googleapis.com/auth/script.scriptapp` — Execution rights for Master Control API functions (`hud_getSnapshot`, `hud_write`, `hud_getProjectTasks`, `hud_previewClientMessage`, `attachClientServiceNode`).
6. `https://www.googleapis.com/auth/tasks` — Read access to project task lists through the guarded HUD API.

> [!CAUTION]
> **Zero Scope Expansion Rule:** Under no circumstances should additional scopes be added without explicit written authorization and review.

---

## 3. Threat Model & Compromise Blast Radius

### Dev Machine Compromise
If a developer workstation is compromised:
- Local git repository contains frontend code and local mocks.
- Production Google Workspace data is **not exposed** unless an active user session token is intercepted in real time.
- Master Control spreadsheet permissions are governed by Google IAM; revoking developer account access immediately halts all bridge execution.

### Token Rotation & Revocation
1. Navigate to [Google Account Security Permissions](https://myaccount.google.com/permissions).
2. Revoke the Session Zero Solutions OAuth application.
3. In Google Cloud Console -> APIs & Services -> Credentials, regenerate the OAuth Client ID if credentials are compromised.
4. Redeploy the Apps Script API deployment to mint a new deployment ID.
