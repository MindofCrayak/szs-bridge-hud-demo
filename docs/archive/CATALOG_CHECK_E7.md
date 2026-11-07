# Catalog check (Phase E7), 2026-11-05

Source: owner run of `runCatalogCheck` (read-only) plus `apps/command-hud/src/data/serviceRegistry.ts`. Nothing was changed.

## Three catalogs that do not line up

| Catalog | Where | What it holds |
|---|---|---|
| HUD service components | `serviceRegistry.ts` | 5 components with their own price, `tasksToInject` and legal clauses |
| Task templates | Template repository | 16 task tabs (`Project_Lifecycle_Base` plus 15 service tabs), 115 tasks |
| Rates | Master Control `Services_Rates` | 3 rows: tier, hourly rate, service category, default hours, package price |

## Findings

1. **Only 3 of 5 HUD components have a template tab.**
   - `comp_dns_shield` maps to `DNS_Security_Protocols`.
   - `comp_mcc_engine` maps to `MCC_Newsletter_Engine_Setup`.
   - `comp_oracle_deepscan` maps to `Oracle_OSINT_Recon`.
   - `comp_gantt_symphony` (Dolores 45-Day Gantt) has no tab. Its tasks are what the automation already does (task list, cadence).
   - `comp_iron_gate_legal` (Pamela Legal Vault) has no tab. Its tasks are what asset provisioning already does (folders, MSA, SOW).
2. **11 template tabs have no HUD component.** These tabs can only be reached by typing the tab name into `Projects.Task_Templates`:
   - `Workspace_Tenant_Setup`
   - `Custom_Apps_Script_Build`
   - `Local_SEO_and_GBP_PowerUp`
   - `SaaS_Debt_Consolidation_Sprint`
   - `Digital_Citadel_Client_Portal`
   - `Indie_Studio_Storefront_and_Launch_Prep`
   - `Omnichannel_Content_Waterfall`
   - `COMS_Editorial_Content_Calendar`
   - `Gmail_Actionable_Approval_Engine`
   - `Looker_Studio_Executive_War_Room`
   - `AppSheet_Field_Ops_Mobile_App`
3. **The tasks differ between catalogs.** The `tasksToInject` lists in the HUD components are different from the tasks in their mapped tabs. For example, the DNS component lists 3 tasks and the DNS tab has 5. The template tab is the one that feeds Google Tasks; `tasksToInject` is not used by the task automation.
4. **Prices disagree.**
   - HUD component prices are $1,500, $3,200, $2,400, $2,800 and $1,800.
   - `Services_Rates` package prices are $680, $1,380 and $260, priced from hours × tier rate.
   - Nothing links a component to a rate row. Contract values come from Finances (Phase D), so the HUD prices only affect the Solar catalog.
5. **`Services_Rates` categories map only roughly to tabs.**
   - "Core Setups" (Workspace & DNS) roughly covers `Workspace_Tenant_Setup` and `DNS_Security_Protocols`.
   - "Custom Automations" roughly covers `Custom_Apps_Script_Build`, `Gmail_Actionable_Approval_Engine` and MCC.
   - "Maintenance" has no tab.
6. **No project uses components or extra templates yet.** All 8 projects have empty `ActiveComponents` and `Task_Templates`, so every list is base plus offboarding only.
7. **The template tabs themselves are clean.** No duplicate task keys, no empty tabs, and every mapped tab exists.
8. **Client-facing counts come from the E2 defaults.** Several tabs have 0 client tasks even where the client clearly has to act, for example "Domain Registrar Access" or "Domain Verification" (the client grants access). The owner should review the `Audience` column per tab.

## Decisions needed (owner)

- How the 11 unmapped tabs become selectable (see the chat question).
- Whether HUD component prices should come from `Services_Rates` (hours × tier) or stay as fixed packages.
- Whether `tasksToInject` should be dropped in favour of the template tabs, so that the tabs are the single source of tasks.
