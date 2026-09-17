# Admin UI Phase Progress — one lifecycle, three bars

**Status:** accepted (2026-09-16) · Day step 3, "Execution visible live"
**Full ADR:** `.indusk/planning/archive/admin-ui-phase-progress/adr.md` · **Lessons:** [Admin UI Phase Progress — Lessons](../lessons/admin-ui-phase-progress.md)

## What was decided

The plan lifecycle is written down **once**, in `apps/indusk-mcp/src/lib/lifecycle.ts`, and everything that says where a plan stands reads it: `parsePlan` (so `list_plans`), the retrospective readiness gate, and the admin UI. The admin draws that definition as three progress lines, each a zoom into the one above it, and reloads them itself every few seconds.

| Question | Decision |
|---|---|
| Where does a plan stand? | **Positions are nouns** — `research`, `brief`, `test-plan`, `adr`, `impl-approved`, `executing`, `falsify`, `cleanup`, `retrospective`, `archived` (`monitor` reserved for Midnight, never derived here). Derived from documents and their status, never from which files happen to exist. A position skipped by a workflow is drawn as skipped, so every plan's bar has the same shape. |
| What is happening right now? | **Activities are verbs**, and only inside `executing` — `authoring`, `implementing`, `verifying`, `capturing-context`, `documenting`, `falsifying`, `cleaning-up`, `closed`. Derived from a phase's gate items and its boundary record. |
| Which phase is active? | The phase with the most recent boundary record among phases that still have unchecked gate items; with no records at all, the first open phase in document order, drawn with a visible "no boundary record" hint. A malformed record file is an error block on the page, never a guess. |
| How is a phase named? | **`{kind, number}`** — `Test Phase 1`, `Build Phase 4` — through progress, Shape and the boundary record. A record without `kind` is a build phase by rule (every record before this plan was one); the file is never rewritten. |
| How does the admin parse an impl? | Through the package parser (`parseImplString`, a filesystem-free core exported at `./impl-parser`), never a local heading regex. Trajectory rows attach by `(passesAtKind, passesAt)`. A parity row runs the adapter and the parser over every impl in both planning folders. |
| What do the bars show? | Every segment is `done / active / pending / skipped`; exactly one is active, and it carries the message. The **plan bar** says `executing: Phase 4`; the **phase bar** under it says `Phase 4: Verification`; the **stage line** says `verifying: <next unchecked item> (n of m)`. A parent plan shows a **master bar** instead, one segment per declared subplan. Segments are equal width and the bar says so — steps, not time. |
| How is it live? | A client wrapper calls `router.refresh()` every `admin.refresh_ms` (default 5000, floor 1000), pauses on a hidden tab, and stops visibly on failure. Server components re-render from disk; no route handler, no fetch, no write surface. |
| What keeps the definition and the rendering in step? | **A plan that adds a lifecycle position, activity or gate kind also adds its admin rendering, in the same plan.** The label maps are typed `satisfies Record<…>` over the lifecycle's unions, so a new member fails the type-check, and a parity test renders each member and names the one without a label. |
| The sidebar and the registry | The sidebar draws one root node (the root master) with parents and unclaimed plans beneath it. `indusk ui prune [--dry-run]` removes registry entries whose path is gone, with a backup first; every test that spawns `init`, `update` or `ui` sets `INDUSK_HOME`, pinned by a scan. The project list labels each project `workbench` or `normal-mode` and lists dead entries in a note. |

## Why

The admin's phase view had its own heading regex, written before Test Phases existed, so every impl written since August rendered wrong: test phases invisible, rows attached to the wrong phase, gate stages unknown. The retrospective gate restated the ritual order; `plan-parser` kept a private stage order that skipped `test-plan`. Three definitions of one lifecycle, drifting the only way such copies drift — silently. Building the bars on top of the drift would have added a fourth. So the plan defines the lifecycle first and renders it second, and pins that the next stage cannot be added without its rendering.

The three-line zoom came out of the human review: three bars that each said "Phase 4" were the same fact three times. Each line now names the level below it.

## What was rejected

- **Composing the lifecycle in the admin** from `parsePlan` and `checkRetrospectiveReadiness`. A fourth definition, in the one app the others cannot import.
- **Keying phases by ordinal.** Document position is unique and is what the run loop iterates, but nobody can say "ordinal 3" and mean anything, and inserting a phase renumbers everything after it. `{kind, number}` is what the impl already writes.
- **Migrating the boundary record** to explicit kinds. Absence means build; the file is never rewritten — the same rule `codeSha` and `repo` used the week before.
- **A polled JSON route** or **websockets / a file watcher**. A second data path to keep in step with the server render, for a page that reloads itself correctly at five seconds.
- **Filtering the project list to workbenches.** A normal-mode project is a real project. Label by shape, prune the dead.
- **Weighting the plan bar in v1.** No evidence for the weights; the review accepted the equal-width bar as is.

## What it cost

A UI plan touched the plan parser, the retrospective gate, Shape's twelve signatures and the package's export map; two parity rows guard the parser and the corpus. The plan page re-renders every document on every tick, acceptable at one open page on a local daemon. The admin's own type-check is a test now, which found ten fixture errors that had been red for a month.

## See also

- [Plan lifecycle](/guide/plan-lifecycle) — the definition, and the convention
- [Admin UI overview](/reference/admin-ui/overview) — the three lines, live refresh, the phase view
- [Admin UI CLI](/reference/admin-ui/cli) — `indusk ui prune`
- [Shape](/guide/shape) — `{kind, number}` at the boundary
- [Test phase structure](/decisions/test-phase-structure) — the two sequences the parser reads
