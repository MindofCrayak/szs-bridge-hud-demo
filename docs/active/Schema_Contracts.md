# Schema Contracts

Master Control is the source of truth for client, project, finance, service
rate, and alert records. The current Working Copy exports are represented by
the headers below. The Command HUD may normalize those values for display, but
must not treat UI state or local drafts as persisted records.

## Current Working Copy tabs

These are the exported column names, in sheet order:

| Tab | Headers |
| --- | --- |
| `Clients` | `ClientID`, `First_Name`, `Last_Name`, `Company_Name`, `ContactEmail`, `GoogleGroupEmail`, `Archetype`, `AccountPhase`, `ActiveRoadblock`, `ContractValue`, `DepositPaid`, `CurrentMilestone`, `CompletedMilestones`, `TotalMilestones`, `DriveFolderUrl`, `ChatSpaceUrl`, `NotesDocUrl`, `MSA_DocID`, `Tech_Stack`, `MCC_Subscriber_ID`, `Oracle_Baseline_ID` |
| `Projects` | `ProjectID`, `ClientID`, `ProjectName`, `SprintStage`, `AssignedRateTier`, `SOW_DocID`, `Project_Brief_DocID`, `Project_Outline_DocID`, `COMS_Sheet_URL`, `Google_Tasklist_ID`, `MeetingNotes_DriveFolderID`, `ChatSpaceURL`, `ChatSpace_Internal_URL`, `Est_Hours`, `Actual_Hours`, `ParentProjectID`, `AddendumRef`, `ActiveComponents` |
| `Finances` | `InvoiceID`, `ClientID`, `ProjectID`, `InvoiceNumber`, `MilestoneStage`, `TotalContractValue`, `DepositAmount`, `InvoiceAmount`, `DepositPaid`, `Remaining_Balance`, `InvoiceStatus`, `PaymentDate`, `Est_Hours_Allocation`, `Actual_Hours_Worked`, `EffectiveHourlyRate`, `EstimatedQuarterlyTax`, `OverheadCosts`, `NetMargin` |
| `Services_Rates` | `Rate_Tier`, `Hourly_Rate`, `Service_Category`, `Task_Item_Name`, `SOW_Invoice_Description`, `Default_Hours_Est`, `Package_Price` |
| `Alfred_Alerts` | `Alert_ID`, `Timestamp`, `ClientID`, `Priority`, `Category`, `Message`, `Action_URL`, `Dismissed_Status`, `Created_At`, `Source_Module`, `Department`, `Client_ID`, `Project_ID`, `Entity_Reference`, `Severity`, `Trigger_Condition`, `Prescribed_Action`, `Due_SLA`, `Assigned_Lead`, `Action_Status`, `Resolved_At` |

## Identifier convention

- New `ClientID` values use a recognizable 2–3-letter company shorthand and
  the two-digit onboarding year, for example `PAC-26`, `SE-26`, or `ZES-26`.
  Same-shorthand, same-year collisions append a two-digit counter, such as
  `PAC-26-02`.
- `ProjectID` appends a project sequence to the full `ClientID`
  (`PAC-26-01`); `InvoiceID` uses `INV-{ClientID}-{Sequence}`
  (`INV-PAC-26-01`).
- The year suffix records the onboarding year and must not be inferred from
  the current date. Legacy IDs remain accepted for reading during migration.

`Projects.ChatSpaceURL` is the current header spelling. The snapshot mapper
normalizes case and separators, so its internal `ChatSpace_URL` property is a
HUD field, not a second Master Control column. Likewise, `ProjectName` maps to
the HUD's `Title`.

The HUD also supports a local, read-only CSV snapshot in
`apps/command-hud/local-data/` using those five exported files. Select it with
`VITE_DATA_MODE=snapshot`; it does not authenticate, contact Google, or write
to Master Control. Snapshot moves are saved in browser storage under
`szs.overlay.v1` and are not authoritative. CSV rows are normalized and
validated with Zod; invalid rows are reported in the status strip.

## Pipeline fields and allowed values

- `Clients.AccountPhase` is column H. Its canonical values are `01: Intake`,
  `02: Session Zero`, `03: Active Sprints`, `04: Liftoff`, `05: Complete`,
  and `06: Archived/Sunset`.
- `Projects.SprintStage` is column D. Its canonical values are `00: Discovery`,
  `01: Vibecheck`, `02: Contract & Inception`, `03: Deep Intelligence`,
  `04: Session Zero Kickoff`, `05: Architecture & Builds`,
  `06: Mid-Flight Review`, `07: Final Staging & QA`,
  `08: Liftoff & Handover`, and `09: Sunset / Retainer`.
- A client's phase is derived from its projects unless manual mode is set.
  Stages 05–07 map to `03: Active Sprints`; 02–04 to `02: Session Zero`;
  00–01 to `01: Intake`; all projects at 08 to `04: Liftoff`; stage 09 to
  `06: Archived/Sunset`. `05: Complete` is manual-only.
- `AccountPhase_Mode` is an additive HUD-writer column, not one of the
  exported base headers. Its values are `auto` and `manual`.

The owner confirms that Working Copy `Clients` column H currently has the
canonical 01–06 options. The last verified record read still contained the
stored value `02: Inception`, which the HUD normalizes to `02: Session Zero`;
legacy stored values are read compatibility, not canonical dropdown options.
A prior canonical phase write was rejected and rolled back. Its cause is
unresolved; neither the current dropdown options nor the source schema alone
establish why it was rejected. See `docs/archive/PROGRESS_v3.1.md` (v3.1 log) and `docs/active/PROGRESS.md`.

## HUD normalization

The typed HUD records are normalized views, not literal sheet rows:

- Client identity is always keyed by `ClientID`. `Company_Name` is the display
  name; `First_Name` and `Last_Name` provide its fallback. `ActiveRoadblock`
  maps to the HUD's roadblock field. Do not expect `external_id`,
  `PrimaryContact`, `Lead_Source`, `PipelineStage`, `RootFolderID`, or
  `ProjectFolderID` in the current base schema.
- Project `ProjectName` maps to HUD `Title`. The project row does not contain
  milestone counts; where needed, the snapshot importer falls back to the
  linked client's `TotalMilestones` and `CompletedMilestones`.
- Finance rows are keyed by `InvoiceID` and linked by both `ClientID` and
  `ProjectID`; the normalized snapshot preserves the other current finance
  columns as well. Display fields map `InvoiceAmount` to `Amount`,
  `InvoiceStatus` to `Status`, and `PaymentDate` to `PaidDate`. The sheet's
  `InvoiceNumber` is distinct from `InvoiceID`. `DueDate` remains accepted
  only as a legacy snapshot field; it is not a current `Finances` header.
- Alerts prefer populated newer fields (`Created_At`, `Client_ID`,
  `Project_ID`, `Severity`, `Trigger_Condition`, `Prescribed_Action`,
  `Action_Status`, and related fields). Legacy `Timestamp`, `ClientID`,
  `Priority`, `Category`, `Message`, `Action_URL`, and `Dismissed_Status`
  remain fallback inputs for rows where newer fields are blank.

Only claim persistence after the server confirms the write by read-back.
Stage 04 and later are guarded by paid deposit, a client MSA, and a project
SOW. Write attempts and live acceptance status are tracked in
`docs/archive/PROGRESS_v3.1.md` (v3.1 log) and `docs/active/PROGRESS.md`.

## Service attachments

`Projects.ActiveComponents` stores comma-separated service IDs and maps to the
HUD's `activeComponents` array. `Clients.ContractValue` remains the
authoritative contract amount. A client-scoped attachment must resolve to
exactly one client row and one project row; ambiguous project matches are
rejected until the request contract includes a `ProjectID`. Reattaching an
already-installed service must not change the contract amount or create
duplicate tasks.

## Workspace and compliance

`DriveFolderUrl`, `NotesDocUrl`, and `ChatSpaceUrl` are client fields.
`MSA_DocID` is stored on the client; `SOW_DocID`, `Google_Tasklist_ID`,
`MeetingNotes_DriveFolderID`, and chat URLs are project fields. Do not infer
`RootFolderID` or `ProjectFolderID` from a URL or treat them as current
Master Control columns. Oracle case files and raw findings are quarantined and
must not be copied into client Drive folders or HUD payloads.
