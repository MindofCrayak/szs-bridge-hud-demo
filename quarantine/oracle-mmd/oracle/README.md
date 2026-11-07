# Oracle — Internal Research & Reporting

Oracle is an internal research workspace for producing Sourcebook Reports, with a design that can accommodate additional report types over time. It is intended for use within your Google Workspace, not as a public-facing tool.

## Run the development app locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
3. Run the app:
   `npm run dev`

The project includes Google Apps Script deployment files (`Code.gs` and `Index.html`) for Google Workspace deployment. Configure the deployment for your organization's access needs; this repository does not itself enforce Workspace identity or access restrictions.
