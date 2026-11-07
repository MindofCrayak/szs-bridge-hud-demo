# React Command HUD

Local tactical HUD for the Session Zero Solutions workspace. The application
uses Master Control as the authoritative source for client and project data.

## Run

From this directory, run `npm run dev` to serve the HUD at
`http://127.0.0.1:3002`. From the repository root, use `npm run dev`.
The development server binds only to this OAuth-authorized origin and fails
instead of selecting a different port if 3002 is already occupied.

Create `.env.local` from `.env.example` and configure the required endpoint
and model values locally. Vite `VITE_*` values are delivered to the browser:
they are not suitable for privileged credentials.

## Checks

Run `npm run lint` and `npm run build` here, or the matching root workspace
scripts. The Oracle MMD implementation is physically isolated under
`quarantine/oracle-mmd/` and is not imported by this package.
