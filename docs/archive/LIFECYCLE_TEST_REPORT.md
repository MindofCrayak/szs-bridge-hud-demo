# Lifecycle Test Report (Phase H), 2026-11-05

Scope: the Working Copy of Master Control and the HUD on fake `[TEST]` data. Lead intake through the forms (H1, H2) was **deferred by the owner to Phase Q** (the Lead DB overhaul), so this walk starts from seeded clients.

## What was walked

| Step | Result |
|---|---|
| SEN-01, stage 04 → 05 | Saved (9.5 s). The background project automation created the 23-task Google Tasks list (Galaxy shows "23 open / 23"). Its Dolores alert showed only "Stage change: Review the new assets"; fixed in version 26 so the alert lists what was created. |
| SEN-01, stages 06, 07, 08, 09 | Saved. Status Summary shows 1 paid and 3 open invoices ($7,000). The mid-flight and final invoices were created by the stage writes. |
| Client documents | Brief, Outline, Chat Spaces and Command Deck links work. **The SOW still shows `${…}` tags.** |
| SEN → Sunset | **Not reached.** SEN stayed at "02: Session Zero (manual)" while SEN-01 sat at 09 and SEN-02 at 03. One client phase cannot show two projects at different points in their lifecycle. |
| Drive archival | Manual by design: nothing moves the folder from Sanctum Active to Sanctum Inactive. |
| MCC / Oracle | Preview only. The columns match the sync. Applying would overwrite 2 Oracle baseline owners (PAC "Amanda Cole" → "Pat Alvarez", ZES "Brian O'Connor" → "Zoe Ellis") because the test IDs collide with Oracle's rows; MCC would get no changes. **Not applied; waiting on the owner.** |

Earlier in Phases E–G, these all worked: audited writes at 5–7 s each, client tasks synced to the Command Deck, Daisy's Chat posts, the Planet view, the reports, the invoice drafts with tags filled, Solar drops with task sync, and the addendum refusal. The browser regression suite passes 12/12.

## What broke and is fixed

- **Slow saves (30–55 s).** HUD reads, deck syncs, the Police sync audit and the Solar task sync all held the shared lock. Police now runs in the background. Saves take 5–7 s.
- **Menus closed on any scroll.** The ⋮ button and right-click now work, with Move phase, Move stage and Reset to auto.
- **Galaxy was a fixed zoom canvas.** It is now a plain board with collapsed empty stages and edge scrolling.
- **Text was 8–9 px.** The minimum is now 11 px.
- **Invoice drafts were unfilled.** They are now filled from Finances.
- **Write results were invisible.** Saves now show toasts.
- **Two canvas bugs.** Clicking empty canvas did not deselect, and Duplicate copies could not be deleted.

## Still manual

- Drive archival at Sunset.
- Marking an invoice paid, which is done in the Finances sheet (`recordPayment` is not implemented).
- Lead graduation (Phase Q).

## Proposed fix list (owner to prioritise)

1. **Multi-project clients in Universe.** Today a client has one AccountPhase, so a client with one project in Sunset/Retainer and another in Active Sprints appears only once. Options:
   - (a) The client card shows one chip per project with its stage, and project-level actions such as Sunset act on a project.
   - (b) The client appears in every phase column where one of its projects sits.
   This changes the decision record ("Universe = AccountPhase"), so it needs the owner.
2. **Multi-sun Solar (owner idea).** A client with several active projects opens one Solar view with one sun per project (binary, trinary, and so on). Department satellites and wires attach to a chosen sun, and each sun keeps its own stage progress, components and Planet link. This is a sizeable redesign of the Solar workbench and its wire storage, which is currently one client with one sun.
3. **The SOW keeps `${…}` tags** for values the seed did not have, and does not refresh when the contract changes. Fill the remaining tags from Projects and Finances, and add a "Refresh SOW" action that goes through the Financial Mutation gate.
4. **R9 alerts for HLW-01 and MBS-01.** Both are past stage 03 but have never been automated; automation now runs only on stage saves. Add a one-time "run project automation for all ready projects" action. It creates Groups and Chat Spaces for those test clients.
5. **Sunset per project vs. per client.** Make Daisy's Sunset request check every project, or move the request to the project level (ties to item 1).
6. **MCC/Oracle IDs.** Decide whether to overwrite the 2 colliding Oracle rows, use test copies, or leave the sync off until Phase Q.
7. Parked items: lead graduation (Phase Q), Flag Blocker still a placeholder, setting prices for the 11 new catalog services, and the per-tab Audience review.
