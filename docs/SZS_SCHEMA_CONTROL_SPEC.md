# SZS Schema Control Spec

**Status:** active source document. **Last verified:** 2026-10-31. **Place at:** `docs/SZS_SCHEMA_CONTROL_SPEC.md`
**Companion files:** `SZS_DB_LOGIC_AND_PERSONA_CHARTER.md` (the why), `engines/master-control/Schema_Registry.gs` (registry, change log and the read-only conformance check; formerly Schema_Control.gs).

**Rule:** Master Control holds the most current schema. Every other database conforms to it or has a logged exception. Schema drift is a first-class problem with an owner, a log, and a check.

---

## 1. Who does what

| Role | Who | Responsibility |
|---|---|---|
| **Registry and enforcement** | Alfred (System Policer) | Keeps `Schema_Registry` current. Police compares live sheets to it every 15 minutes. |
| **Change workflow** | Dolores | Runs each change request from Requested to Verified using a checklist. |
| **Requester** | Any persona, the HUD (as a draft), or Master Drake | Reports a gap or asks for a change. |
| **Approver** | Master Drake | Signs off on every schema change (Tier 2). |
| **Consulted** | Vala (Finances, Services_Rates), Daisy (MCC), Oracle (COMS, Oracle DB), Pamela (Lead DB) | Confirm impact on their spoke. |

---

## 2. The two tabs (in Master Control, under the Police report)

### `Schema_Registry` (current truth, one row per column)

| Column | Meaning |
|---|---|
| Registry_ID | `REG-{Tab}-{ColumnLetter}` |
| Database | `Master Control` for hub tabs; spoke names for registered spoke columns |
| Tab | Tab name |
| Column_Letter | Position, e.g. `H` |
| Column_Name | Header text |
| Data_Type | text, number, date, enum, id, currency, boolean, json |
| Allowed_Values | For enums, e.g. the 6 AccountPhase values |
| **Data_Class** | `public`, `internal`, `pii`, `secret`. Drives the HUD context whitelist. |
| Owner_Persona | Who owns the column |
| Required | yes / no |
| Schema_Version | e.g. `0.1-baseline`, then `1.0`, `1.1` |
| Last_Verified | Date last confirmed |
| Notes | Free text |

### `Schema_Change_Log` (requests and reports)

| Column | Meaning |
|---|---|
| Change_ID | `SCH-####` |
| Logged_At | Timestamp |
| Requested_By | Persona, HUD draft, or Drake |
| Target_Database / Target_Tab / Target_Column | What it affects |
| Change_Type | Add column, Rename column, Remove column, Add allowed value, Change type, New tab, ID format, Process, Other |
| Reason | Why |
| Impact | Which personas, HUD fields, wires, and reports read it |
| Severity | `INFO`, `WARN`, `BLOCK` |
| Status | `Noted`, `Requested`, `Approved`, `Applied`, `Verified`, `Rejected` |
| Approved_By | Drake |
| Applied_Version | Registry version after applying |
| Police_Check_Result | PASS / FAIL after the next check |
| Rollback_Note | How to undo |
| Source | `seed`, `police.schema`, `hud.draft`, `manual` |

### Status lifecycle

`Noted` (a gap was seen) to `Requested` (formal ask) to `Approved` (Drake signs) to `Applied` (column added or changed) to `Verified` (registry updated and the next Police check passes). `Rejected` is terminal. **A change is not finished until it is Verified.**

---

## 3. Police schema checks (read-only)

Every 15 minutes, for each baselined Master Control tab:

1. Live column not in registry: **Unregistered column** (WARN; **BLOCK** on Finances and Services_Rates).
2. Registry column not in live sheet: **Missing column**.
3. Column position changed: **Moved column**.
4. Registered tab missing from the live workbook: **Missing tab**.
5. ID format and dangling-reference checks (phase 2 of this work; spec in section 5).

Findings append to `Schema_Change_Log` as `Noted`, source `police.schema`, with no duplicates while one is still open. **The check never edits structure or data.** In the HUD these arrive as `police.schema` events: a Housekeeping badge, never a wire.

---

## 4. Common alert shape (`Alfred_Alerts` target columns)

`Alert_ID, Created_At, Source_Module, Department, Client_ID, Project_ID, Entity_Reference, Severity, Trigger_Condition, Prescribed_Action, Due_SLA, Assigned_Lead, Action_Status, Resolved_At`

Migration rule: **add missing columns to the right; never reorder, rename, or delete existing columns or rows.** Severity values: `INFO`, `WARN`, `BLOCK` (COMS `MEDIUM`, `HIGH`, `CRITICAL` map to these).

---

## 5. ID validation patterns (validate by typed column)

| Column | Pattern | Examples |
|---|---|---|
| ClientID | `^[A-Z]{3}\d{0,2}$` | `PAC`, `PAC2` (3-letter company abbreviation; digit on collision, no hyphen) |
| ProjectID | `^[A-Z]{3}\d{0,2}-\d{2,3}$` | `PAC-01`, `PAC2-03` (`<ClientID>-NN`) |
| InvoiceID | `^INV-[A-Z]{3}\d{0,2}-\d{2}-\d{3,}$` | `INV-PAC-26-001` (`INV-<ClientID>-<YY issued>-<NNN per client per year>`) |
| COMS legacy (read-only mapping) | `^CLT-\d{3}$`, `^CLI-\d{3}$`, `^PRJ-\d{4}-\d{2}$` | maps to hub IDs via `Master_Client_ID`, `Master_Project_ID` |

The year-suffixed client IDs (`PAC-26`) are dropped (Master Plan v3.1, section 3). Legacy shapes stay readable only until the Phase C wipe removes them.

Legacy IDs remain accepted for reads during migration, including `ICA`, `ICA-02`,
`ICA-01`, and `ICA-02-01`. The `ICA-02` namespace ambiguity is therefore a
legacy-only condition (SCH-0009); always validate and join IDs by typed column.

---

## 6. How the HUD uses this

1. **Validates snapshots** against the registry version; a mismatch shows a Housekeeping badge.
2. **Schema-driven whitelist:** columns with `Data_Class` of `pii` or `secret` are excluded from Alfred's context and exports.
3. **Draft requests only.** The HUD may generate a copyable schema change request matching the `Schema_Change_Log` columns. It **never writes** to the sheet; Dolores logs it. (Writing needs a new Master Control route, which is a stop-and-ask.)
4. Reads `Schema_Registry` and `Schema_Change_Log` through the data adapter (mock until live access is verified).

---

## 7. Seed entries (seeded once in 2026; the seeding code was removed on 2026-11-06)

| ID | Item | Severity | Decision needed? |
|---|---|---|---|
| SCH-0001 | COMS `Client_ID` uses `CLT-###`; add `Master_Client_ID` mapping | WARN | Confirm hub IDs win |
| SCH-0002 | COMS `Project_ID` uses `PRJ-2026-##`; add `Master_Project_ID` mapping | WARN | Same |
| SCH-0003 | COMS tabs 11 to 13 use `CLI-###`, tabs 00 to 10 use `CLT-###` | WARN | No, fix |
| SCH-0004 | COMS tab 13 references AST-005, 008, 009, 012, 014, not in tab 05 | WARN | No, fix |
| SCH-0005 | COMS tab 12 action codes (MCC-001/004/005, PR-002) match no real ID format | WARN | No, fix |
| SCH-0006 | `Alfred_Alerts` adopts the common alert shape | WARN | Confirm severity map |
| SCH-0007 | `Projects.ParentProjectID`, `AddendumRef` | INFO | **Yes** |
| SCH-0008 | `Finances.ProjectID` | BLOCK | **Yes** |
| SCH-0009 | Legacy ClientID / ProjectID namespace ambiguity (`ICA-02`) | WARN | Preserve typed joins during migration |
| SCH-0010 | Client journey and feedback log (Daisy) needs a home | INFO | **Yes** |
| SCH-0011 | Persona dial scales; replace 90/10; update Daisy row | INFO | Confirm scales |
| SCH-0012 | `AccountPhase` has 6 values, Galaxy shows 4 | INFO | Confirm filter approach |
| SCH-0013 | `Owner_Email` / `Owner_Phone` marked `pii` | WARN | No, do |
| SCH-0014 | One `MCC_Subscriber_ID` per client record vs per person | INFO | Confirm intent |
