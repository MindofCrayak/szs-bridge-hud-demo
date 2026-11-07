# SZS DB Logic & Persona Charter

**Status:** active source document. **Last verified:** 2026-10-31. **Owner:** Master Drake Austin. **Maintained by:** Alfred (registry and enforcement), Dolores (change workflow).
**Place at:** `docs/SZS_DB_LOGIC_AND_PERSONA_CHARTER.md`
**Supersedes (where they conflict):** the Daisy role description and the "90/10" rule in `alfred-grounding-document-v7.md` and `copilot-instructions-v7.md`; the older persona domain wording in `HUD_HANDOFF_SUMMARY.md` section 1.

Purpose: explain, in one place, **why each database exists, who owns it, how data moves between them, and how the personas and the HUD use it.** If code, a sheet, and this document disagree, stop and report the disagreement; do not pick a winner silently.

---

## 1. Principles

1. **One question, one owner.** Every database answers exactly one question and has exactly one owner. Everyone else reads it.
2. **Hub and spokes.** Master Control is the hub and source of truth. Sub-databases report to it through `Sync_Handler.gs` and **never write to each other.** When a spoke disagrees with the hub, the hub wins and the Police Engine records the correction.
3. **Single writer.** Only Master Control writes to the sheets. The HUD never writes directly. Its only write path is: proposal, then human approval, then a Central_Router call.
4. **Agents propose; humans approve.** Event handlers and agents create proposals only. Money proposals pass through the Financial Mutation confirmation unchanged.
5. **Voice never changes facts or permissions.** Persona wit and tone shape wording only.
6. **Keep a trail.** Every automatic correction is logged before it happens.

---

## 2. Database map

| Database | The question it answers | Owner | Role | Notes |
|---|---|---|---|---|
| **Master Control** (`Clients`, `Projects`, `Finances`, `Services_Rates`, `Alfred_Alerts`, plus `Schema_Registry` and `Schema_Change_Log`) | Who is the client, what are we building, what is owed, what looks wrong, what is the schema? | Alfred (custodian); Vala owns Finances and Services_Rates; Dolores owns Projects | **Hub** | Authoritative. Police Engine enforces it every 15 minutes. |
| **SZS Lead Database** | Who might become a client? | Pamela | Spoke | Intake funnel. Graduates into `Clients`. |
| **Oracle Master Marketing Database** | What do we know about the market? | Oracle | Spoke (quarantined) | Raw content never reaches the HUD. |
| **COMS** (Content Operating System) | What is the content, search, and distribution strategy, and how is it performing? | Oracle | Spoke | Produces internal and client-facing reports. See section 11. |
| **Mail Command Center (MCC)** | Who do we keep talking to, and what did we send? | Daisy | Spoke | Daisy is MCC manager and overseer. |
| **Personality Controls sheet** | How does each persona sound, act, and what may it do? | Master Drake | Config | Read-only to the HUD. |
| **Schema tabs** | What is the current schema, and what changes are pending? | Alfred and Dolores | Part of hub | See `SZS_SCHEMA_CONTROL_SPEC.md`. |

---

## 3. Identity and IDs

| ID | Format | Example | Lives in |
|---|---|---|---|
| ClientID | 3-letter company abbreviation; on collision append a digit, no hyphen | `PAC`, `PAC2` | `Clients` |
| ProjectID | `{ClientID}-NN` | `PAC-01` | `Projects` |
| InvoiceID | `INV-{ClientID}-{YY}-{NNN}` (YY = year issued; NNN = that client's invoice count that year) | `INV-PAC-26-001` | `Finances` |
| Google Group | `client-{clientid lowercase}@sessionzero.solutions` | `client-pac@...` | Workspace |

Standard set by Master Plan v3.1, section 3. The earlier year-suffixed client IDs
(`PAC-26`) are dropped. Project and invoice references retain the complete
ClientID. Legacy shapes stay readable only until the Phase C wipe removes them.

**COMS rule:** COMS currently uses `CLT-###`, `CLI-###` and `PRJ-2026-##`. Hub IDs win. COMS adds `Master_Client_ID` and `Master_Project_ID` mapping columns first, then converges.

---

## 4. The stage machine (the spine of the event engine)

`Clients` column H `AccountPhase`, and `Projects` column D `SprintStage`. In the HUD both render as nodes; they still come from these columns.

### AccountPhase (client level)

`01: Intake`, `02: Session Zero`, `03: Active Sprints`, `04: Liftoff`, `05: Complete`, `06: Archived/Sunset`. The Galaxy view shows four columns (01 to 04); `05` and `06` must live in a hidden-by-default filter inside the existing filter control (SCH-0012).

### SprintStage (project level) and who leads

| SprintStage | Lead | What the HUD surfaces |
|---|---|---|
| 00 Discovery, 01 Vibecheck | Pamela | Intake status, gatekeeper PASS/FAIL |
| 02 Contract & Inception | Pamela, then Vala | MSA/SOW generated, 1/3 deposit invoice staged, Drive tree provisioned |
| 03 Deep Intelligence | Oracle | `sweep.complete`: **summary only** |
| 04 Session Zero Kickoff | Dolores | Tasklist, Chat Spaces, Google Group provisioned |
| 05 Architecture & Builds | Dolores | `task.overdue`, `milestone.done` |
| 06 Mid-Flight Review | Vala | Milestone 2 invoice proposal |
| 07 Final Staging & QA, 08 Liftoff & Handover | Dolores, Vala | Final billing (the trigger stage is **not specified** in v7; owner to confirm) |
| 09 Sunset / Retainer | Daisy | Drive migration, survey, MCC retention drip |

---

## 5. Event model

**Events come from diffing snapshots, not from clicks.**

```
Sheets > Master Control > normalized snapshot > HUD store
        diff(previous, current) > events (idempotent IDs)
        approved rules > wires animate > proposals (tray)
        user approves (money: Financial Mutation gate) > Central_Router write
        > Sheets > next snapshot confirms (or shows "reverted")
```

Every event carries:

| Field | Meaning |
|---|---|
| `id` | Hash of entity + field + version. A refresh never re-fires an event. |
| `type` | e.g. `stage.changed`, `invoice.paid`, `task.overdue`, `component.installed`, `addendum.signed`, `police.corrected`, `police.schema` |
| `source` | `user_write`, `police_correction`, `external`, `system` |
| `clientId`, `projectId` | Typed IDs |

Rules:
- **`police.corrected` and `police.schema` never fire wire rules and never animate a wire.** They create a badge and an alert only.
- Only rules with status `approved` fire. All draft rules are `suggested` until the owner approves.
- Loop guard: maximum depth 3, one fire per link per tick.
- Handlers only create proposals.

### Proposal shape

`{ id, proposer, eventId, type, surface, effect, requiresMoneyGate, clientFacing, status }`

`clientFacing: true` means it reaches a client. Such proposals are routed through Daisy (section 8).

---

## 6. The Police Engine charter

Its job: make the hub's version of the truth win every 15 minutes, **as transparently as possible.**

1. **Log before overwrite.** Record what changed, old value, new value, the rule that justified it, and the time. (Verify whether `Police_Engine.gs` does this today.)
2. **Severity ladder:** `INFO` (trivial auto-fix), `WARN` (fixed, needs review), `BLOCK` (not fixed, needs Master Drake). COMS maps as `MEDIUM` to `INFO`, `HIGH` to `WARN`, `CRITICAL` to `BLOCK`.
3. **Never auto-correct money.** Finances conflicts raise `BLOCK` and go through the Financial Mutation gate.
4. **Distinct HUD events:** `police.corrected` and `police.schema` (section 5).
5. **No silent reversals.** After an approved write, the HUD waits for a confirming snapshot. If Police reverted it, the node shows "Reverted by Police: [reason]".
6. **Schema conformance is a core check:** live columns and values vs `Schema_Registry`; ID format checks; dangling reference checks. It reads and logs; it never edits structure.
7. `LockService` gives mutual exclusion, not idempotency. Writes can wait up to 30 seconds, so the UI needs a pending state with timeout, and ledger writes still need idempotency keys (parked work).

---

## 7. Personas

### 7.1 Five layers (columns of the Personality Controls sheet)

| Layer | Columns | Role |
|---|---|---|
| **Voice** | Archetype & Tone, Signature Quote, Candor_Bias, Wit_Allocation | Wording only |
| **Behavior** | Compliance_Index, Proactivity_Index, Drift_Tolerance | How strictly rules are followed, how early things surface, how far it may deviate |
| **Authority** | Autonomy_Tier, Execution_Surface, Crisis_Override_State | What it may do and where output lands |
| **Routing** | Relay_Pipeline, Primary_Payload | The handoff chain and what travels on it |
| **Grounding** | Context_Doc_Link, Lore, House Function, Operational Rules | The persona's own document |

**Dial scales (proposed, owner to confirm):** Compliance, Wit, Proactivity, Drift are 0 to 1. Candor is -1 to 1 (negative = softening and diplomatic, positive = blunt). Lower Drift = stricter.

**Wit rule (replaces "90/10"):** Facts come first. Wit is tunable per persona through `Wit_Allocation` (0 = none, 1 = maximum). Wit shapes wording only and never alters facts, numbers, permissions, or approvals. In a crisis override it drops (Alfred to 0.05).

### 7.2 Persona profile template (code and sheet agree on this shape)

```yaml
persona: Vala
mission: Milestone billing
owns: [Finances, Services_Rates]
reads: [Projects.SprintStage, Clients.AccountPhase]
may_propose: [draft_invoice, ledger_increment]   # always through the money gate
never: [send, write ledger directly]
emits: [invoice.drafted, invoice.paid]
consumes: [milestone.done, stage.changed]
report(): { status, bottlenecks, risks, asks }    # computed deterministically from her own data
```

### 7.3 Authority table (values from the Personality Controls sheet; Daisy updated)

| Persona | Role | Tier | Surface | Relay | Primary payload |
|---|---|---|---|---|---|
| **Alfred** | Chief of Staff, orchestrator, System Policer, schema registry custodian | 3 | Internal HUD | System event, then routes to the designated persona | Status telemetry, API route |
| **Pamela** | Intake and lead qualification | 2 | Staged draft / Internal | Green Form, then Oracle and Alfred | Gate PASS/FAIL + draft MSA |
| **Oracle** | OSINT, market intelligence, COMS reports | 1 | Quarantined internal | Drake command or Pamela pass, then Alfred | `case_file.json`; **HUD gets a summary only** |
| **Dolores** | Workspace, tasks, and schema change workflow | 3 | Internal and team spaces | SOW signed, then Vala at milestone gates | Structured Markdown punch list |
| **Vala** | Milestone billing | 2 | Staged draft / Gate | Milestone hit, then Daisy on completion | Milestone invoice or webhook call |
| **Daisy** | Client journey manager, offboarding, **MCC overseer** | 2 | Staged client / Internal | Any persona's client-facing proposal, then Daisy; final delivery, then 09 Sunset | Sunset manifest, retention drip array, client-comms queue, journey and feedback digest |

### 7.3a Dial values (from the Personality Controls sheet; the HUD config is built from these)

| Persona | Compliance | Candor | Wit | Proactivity | Drift |
|---|---|---|---|---|---|
| Alfred | 0.90 | 0.40 | 0.70 | 0.95 | 0.30 |
| Pamela | 0.65 | 0.85 | 0.60 | 0.80 | 0.50 |
| Oracle | 0.95 | 0.90 | 0.10 | 0.85 | 0.15 |
| Dolores | 1.00 | -0.20 | 0.30 | 0.90 | 0.40 |
| Vala | 0.50 | 0.75 | 0.70 | 0.80 | 0.60 |
| Daisy | 0.80 | -0.40 | 0.50 | 0.70 | 0.55 |

Oracle's sheet tier is 1 (autonomous read and compile); the others are as in 7.3. The sheet remains the master copy; if a value changes there, update this table.

**Effective autonomy in the HUD = the lower of the sheet's tier and the HUD cap.** The HUD cap is **proposal-only for every agent** until the owner approves specific rules. A Tier 3 in the sheet is a Workspace ceiling, not HUD permission.

**Crisis overrides** (Vala financial pause, Pamela calendar revocation, Oracle connector severing, and so on) are actions. In the HUD they appear only as **staged states awaiting sign-off**. A Police `BLOCK` alert may propose a crisis state; nothing enters one automatically.

### 7.4 Proposed Daisy replacement text (for the sheet and v7 docs)

- **Role:** Client Journey Manager, Offboarding & MCC Overseer
- **House Function:** Teal Form processing; active-to-inactive Sanctum migrations; completion reviews; owns the Mail Command Center and every client-facing send; collects customer input, feedback, and journey signals from all departments.
- **Relay_Pipeline:** Any persona's client-facing proposal, then Daisy (consent, frequency, tone), then MCC send (staged, Drake sign-off). Project final delivery, then archives to 09: Sunset.
- **Primary_Payload:** Sunset_Manifest + Retention Drip Array + client-comms queue + journey and feedback digest.

### 7.5 Proposed replacement for "90/10" in both v7 docs (section 2)

> **Tone:** crisp, pragmatic, polished, terminal-style. **Wit** is tunable per persona through the `Wit_Allocation` dial in the Personality Controls sheet (0 to 1; Alfred is currently set to 0.70). Wit shapes wording only; it never alters facts, numbers, permissions, or approvals. During a crisis override it drops to 0.05.

---

## 8. Relay graph (two layers)

**Layer 1, status wires (kind `context`):** each department to the Sun. Carries status.

**Layer 2, handoff wires (kind `trigger`):**

- Pamela to Oracle and Alfred (on gate PASS)
- Oracle to Alfred (summary only)
- Dolores to Vala (at milestone gates)
- Vala to Daisy (on completion)
- **Every persona's client-facing proposal to Daisy** (Daisy is the single voice to clients)
- Alfred routes system events to the designated persona

The earlier draft rules that had Daisy acting at `milestone.done` or `invoice.paid` are too early; Daisy starts at completion unless a client-facing message is being routed through her.

---

## 9. Staff Meeting protocol (broken out, then looped back in)

1. Each persona owns its profile, its database or lens, and its own `report()`.
2. Command: `Staff Meeting` or `Staff Meeting: [topic]`.
3. Alfred calls each `report()` in v7 order: Alfred, Pamela, Oracle, Dolores, Vala, Daisy.
4. **Briefs are computed deterministically from each persona's data.** The language model only adds voice (per the Wit dial). Facts stay auditable.
5. Friction rules are cross-queries over two briefs (for example Pamela x Vala for unpaid prospects).
6. Alfred sees briefs, never raw rows. Context whitelist and the roughly 4,000-character cap hold. Oracle is summary only. No emails, phones, or document IDs.
7. Closing deliverable: the top 1 to 3 pending proposals as decision gates.

---

## 10. Alerts and notifications

**Common alert shape** (adopted from the COMS alert matrix, extended):

`Alert_ID, Created_At, Source_Module, Department, Client_ID, Project_ID, Entity_Reference, Severity (INFO/WARN/BLOCK), Trigger_Condition, Prescribed_Action, Due_SLA, Assigned_Lead, Action_Status, Resolved_At`

**HUD ribbon:** one symbol per department with an open-item count, colored by highest severity. Click opens that department's right-side menu: its log, and proposed ways of dealing with each item (proposals only). A **Housekeeping** badge (Alfred and Police) carries schema and Police items. Red is reserved for system errors.

---

## 11. Data classification and COMS

COMS now produces both internal and client-facing reports, so "quarantined" is too blunt. Three tiers:

| Tier | Meaning | HUD may read? |
|---|---|---|
| **Raw** | Scrapes, raw JSON, prompts, contact data | Never |
| **Internal summary** | Short findings and counts | Yes |
| **Client-safe** | Reviewed for external delivery | Yes |

Every COMS output carries its tier. Contact fields (`Owner_Email`, `Owner_Phone`) are `Data_Class = pii` and never enter HUD context or client-safe reports.

COMS hand-off points: `09_Mail_Command_Center_Sync` is the Oracle-to-Daisy contract (Oracle proposes sequences; **Daisy owns the sends**); `00_Command_Center` alerts feed the common alert shape.

---

## 12. Addendums and multi-project systems

A signed **SOW Change Order Addendum** (`SOW_Change_Order_Addendum` in the vault) is an **event**: `addendum.signed`. It has two outcomes, chosen by a human per addendum; the proposal always offers both:

| Outcome | Result | Connector node |
|---|---|---|
| **Expands** | Existing project scope grows (new tasks, billable chunk) | Scope-delta node on the same Sun |
| **Spawns** | New `PROJECT_OUTLINE` becomes a new ProjectID (`PAC-02`) | Parent link between Suns: a binary or trinary system |

Flow: Pamela handles the legal document; Dolores builds the outline and tasks; Vala bills the added scope (the 1/3 deposit and milestone pattern may not fit an addendum; billing rule to be defined).

Connector kinds: `expands`, `spawns`, `depends_on`, `shares`. By default connectors are **local-only visuals**. If a connector should gate billing or tasks, `Projects.ParentProjectID` and `Projects.AddendumRef` (SCH-0007) and `Finances.ProjectID` (SCH-0008) are required, which needs owner approval and a Master Control change.

Multiple Suns share a barycenter at (0,0) so the camera lock holds; each Sun has its own orbit origin for snap math.

---

## 13. Open decisions

Tracked in `docs/active/SZS_HUD_MASTER_PLAN_v3.1.md` (sections 8 and 9). Do not decide them in code; use the stated default and report it.
