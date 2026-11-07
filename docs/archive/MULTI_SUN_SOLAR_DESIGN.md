# Multi-sun Solar: design for owner approval (2026-11-05)

Owner idea: a client with several projects opens **one** Solar view with one sun per project (binary, trinary and so on), instead of one sun per Solar view. No code is written until this is approved.

## Today

- Solar is per client. It has one Sun (`core-node`) that shows the selected project (or the first project): its stage bar, deposit and installed components.
- Five department satellites sit around that Sun: Pamela, Oracle, Dolores, Vala and Daisy.
- Wires are stored per client in the browser (`szs.links.<ClientID>`). The default wires all point at `core-node`, for example `pamela-sun`, `dolores-vala` and `daisy-sun`.
- A service dropped in Solar attaches to the selected project. Since Phase G, the price goes to that project's contract-row TCV.
- Double-clicking the Sun opens that project's Planet page.

## Proposal

1. **One sun per project.**
   - Node ids are `sun:<ProjectID>`.
   - Layout: 1 sun is centred. 2 suns sit side by side about 560 px apart. 3 form a triangle and 4 a square. Beyond 4 they form a ring.
   - Each sun shows its own stage bar, deposit or invoice state, components count and task count.
   - Double-clicking a sun opens that project's Planet page.
2. **Sunset projects** (stage 09) show as a small dimmed sun at the edge, behind a "show sunset projects" toggle.
3. **Department satellites.** Option A (recommended) or B:
   - **A: shared ring.** One set of five satellites around the whole system. Each department has one wire to each sun. Simple, and matches that Pamela (MSA), Oracle (baseline) and Daisy (client voice) are client-level.
   - **B: per-sun satellites.** Each sun gets its own five satellites. Clearer per project, but crowded at 3+ projects.
4. **Service components orbit the sun they are dropped next to.** The drop goes to the nearest sun: the orbit snap uses that sun's position, and the attach writes that sun's ProjectID. Each component node shows which sun it belongs to.
5. **Migrating existing wires.**
   - On first load, wires that point at `core-node` are re-pointed to the client's primary project sun (the most advanced open project).
   - For each other project sun, the default wires (dept → sun) are created as "suggested" defaults, the same rule as today. Custom wires are kept as they are.
   - A one-time export of the old wires is kept in the browser, so this can be undone.
6. **Galaxy → Solar** double-click focuses the camera on that project's sun. **Planet → Esc** returns to the same sun.
7. **Unchanged:** Universe (now one card per project), Galaxy, audited writes, the money dialog, and the rule that wires exist only in Solar.

## Questions for the owner

1. Department satellites: **A (shared ring)** or **B (per sun)**?
2. Sunset projects: hidden behind a toggle (proposed) or always shown dimmed?
3. Should a project's own components be able to wire to another project's sun (cross-project dependencies), or only to their own sun?

## Effort and risk

- This is about the size of Phase F.
- The main risk is the wire migration, which is covered by the one-time backup and browser tests.
- The e2e suite gets multi-sun tests: two suns render, a drop near sun 2 attaches to project 2, a wire migrates, and double-clicking sun 2 opens Planet for project 2.

## Owner answers (2026-11-05)

1. Department satellites: **A, a shared ring** around the whole system.
2. Sunset projects: a completed project's sun **dims and then goes out**; the departments keep orbiting the remaining suns.
3. Cross-project wires: **yes**. A component may wire to another project's sun.

Status: approved for build.

Status: **built** (2026-11-05). Primary sun = first open project (stable), not the selection; selection focuses the camera.
