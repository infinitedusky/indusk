---
title: "Master Plan — Execution Order"
date: 2026-04-19
updated: 2026-09-04
# Machine-readable plan hierarchy (dawn-ui-plan-grouping). Prose below is for
# humans; these keys are what the parser and admin sidebar read. Children of a
# parent (e.g. dawn-*) are declared in the PARENT's master.md, never here —
# one source of truth per link.
parents:
  - indusk-v2-dawn
  - indusk-v4-day
roadmap:
  - workbench-trust-fixes
  - workbench-code-roots
  - midnight
  - indusk-v2-dawn
  - indusk-v4-day
  - indusk-makeover
  - workbench-mode-rail-integrity
  - doppler-extension
  - local-telemetry
  - falsify-phase-authoring
  - documentation-phase-gate
  - evaluator-structured-scorecard-output
  - admin-ui-local-domain
  - admin-ui-phase-progress
  - project-list-workbenches-only
  - compaction-skill
  - hermes-inspired-improvements
  - work-autopilot
  - indusk-worktree-extension
  - graph-knowledge-architecture
  - cursor-support
  - react-native-support
  - dusk-v2
---

# Master Plan

**Rewritten 2026-09-03.** The previous version (Arcs 0–3, written pre-makeover)
described a Graphiti-centric pipeline the makeover rejected, a Midnight that has
since been rewritten, and no Dawn at all. It lives in git history
(`171d14df^:.indusk/planning/master.md`). This version is the sequence as it
actually stands: **three streams, in order — trust the substrate, then
Midnight, then finish Dawn.**

The organizing finding (2026-09-03 audit, evidence in
[workbench-trust-fixes/research.md](workbench-trust-fixes/research.md)): every
real project is now a versioned workbench, and four enforcement surfaces fail
*silently* there. Nothing downstream is worth building on signals that lie, so
the streams are ordered by trust, not by feature value.

## Stream 1 — Trust the substrate (now)

| Plan | Stage | What it delivers |
|------|-------|------------------|
| [workbench-trust-fixes](workbench-trust-fixes/brief.md) | brief draft | **Phase A (blocking, small)**: make the gate-reminder advisor actually speak (F9 — first, because it makes every later plan cheaper to execute correctly), then the four tourniquets — `indusk run` entry refusal, cleanup re-guard, eval-attribution guard, restore's destructive clone. **Phase B (trails, non-blocking)**: bash lane parity, record de-contradiction, close/re-scope of workbench-mode-rail-integrity. |
| [workbench-code-roots](workbench-code-roots/brief.md) | brief draft | One `codeRoots` answer to "where is code *inside* the repo" — detection, health, init-docs; the data verify-plural needs later. |

**Gate out of Stream 1:** only **Phase A** of workbench-trust-fixes gates
Stream 2 — zero silent wrong answers from the surfaces Midnight and Dawn
actually stand on. Phase B and workbench-code-roots run alongside later work.
This bound is deliberate: the prerequisite treadmill is itself a failure mode,
and an unbounded "fix everything first" is how the substrate plan eats the
plan it was supposed to protect.

## Stream 2 — Midnight (next)

[midnight/brief.md](midnight/brief.md) — rewritten 2026-08-28: one shared
**promise** name threads a test, a code site, and a span; telemetry grades the
tests; `enforced / known-violated / retired` states; plans become reopenable
with a `monitor` state instead of a new subsystem primitive. Proving ground:
looper (steps 2 and 4 already built there). Eight incremental steps, each
independently useful, ~2 weeks distributed.

Why before Dawn 7: Dawn's remaining components scale up *unattended
throughput*; Midnight is the only plan that adds a feedback loop fed from
outside the repo — the versioned-workbench close (12 defects in the first hour
of real use, after 32 green rows) is the standing evidence that inside-the-repo
loops cannot see what only running the thing reveals. Growing throughput before
growing trust repeats that at scale.

**Next actions:** accept the brief → write the ADR. **The ADR must settle the
Dawn relationship** (does the collapse signal feed `indusk run`, or are they
orthogonal?) — both documents name this as their shared open question.

## Stream 3 — Finish Dawn

Component status lives in
[indusk-v2-dawn/master.md](indusk-v2-dawn/master.md) — that file is the
authority, this is only the order: **6.5 → (component-4 "thin" ADR, paper) →
7 → 8**, with 5 (cloud) pulled in when wanted — and noting that
`workbench restore` is now most of 5's missing bootstrap.

| Component | Sub-plan | Stage |
|-----------|----------|-------|
| 6.5 workbench execution | [dawn-workbench-execution](dawn-workbench-execution/brief.md) | brief draft — depends on workbench-trust-fixes |
| 4 harness stays thin | ADR under indusk-v2-dawn | unwritten (paper only) |
| 7 agent integration | dawn-agents | not created — create with `/planner` when 6.5 closes; closes U1 via a non-Claude model |
| 8 Linear substrate | dawn-linear | not created |

## Destination — Day

The three streams above are the path; [indusk-v4-day](indusk-v4-day/master.md)
is where they lead. Day packages what the loop produced into a fixed
[PR shape](indusk-v4-day/pr-shape.md) and gives the reviewer a job that does
not require reading code. Trust-fixes, Dawn 6.5, Midnight, and the phase-progress
UI are each a Day component; the five `day-*` sub-plans close the rows the shape
says are missing (observed red, binding, uncovered surface, probe, the bundle).
The shape is on paper first and is accepted before any `day-*` plan is created.

## Close-outs and the small queue

- [indusk-makeover](indusk-makeover/brief.md) — impl complete; **owes its
  retrospective** (falsify → cleanup → retrospective). Any time.
- [doppler-extension](doppler-extension/) / [local-telemetry](local-telemetry/)
  — impl in progress; continue opportunistically.
- [falsify-phase-authoring](falsify-phase-authoring/) — was blocked by the
  test-phase-structure correction; resume when touched.
- [documentation-phase-gate](documentation-phase-gate/),
  [evaluator-structured-scorecard-output](evaluator-structured-scorecard-output/),
  [admin-ui-local-domain](admin-ui-local-domain/),
  [compaction-skill](compaction-skill/),
  [hermes-inspired-improvements](hermes-inspired-improvements/),
  [work-autopilot](work-autopilot/) — accepted briefs, independent, no
  ordering constraint; pull when adjacent work makes one cheap.
- [admin-ui-phase-progress](admin-ui-phase-progress/brief.md) — brief draft
  (Sandy, 2026-09-03): phases and their gate stages visible live while work
  runs; also fixes the UI's private phase regex, which cannot see
  `Test Phase` / `Build Phase` sequences today.
- [project-list-workbenches-only](project-list-workbenches-only/brief.md) — brief
  draft (Sandy, 2026-09-10): the registry holds 1,588 entries, 1,577 of them
  dead temp dirs from four tests that never set `INDUSK_HOME`; isolate tests,
  add an explicit `ui prune`, show workbenches only.
- The admin-UI scorecard-loads-only-after-a-prompt issue (Sandy, 2026-08-31)
  has no plan yet — likely folds into evaluator-structured-scorecard-output or
  admin-ui-local-domain when picked up.

## Parked / needs re-scope

- [graph-knowledge-architecture](graph-knowledge-architecture/) and
  [cursor-support](cursor-support/) — written against the Graphiti-canonical
  direction the makeover rejected; **re-scope or archive**, don't resume as-is.
  (Cursor as an *executor* is Dawn component 7's business now.)
- [react-native-support](react-native-support/) — parked; roll into dusk-v2 or
  archive.
- [dusk-v2](dusk-v2/) — research parked.
- [indusk-worktree-extension](indusk-worktree-extension/) — shipped;
  superseded in practice by versioned-workbench's model; owes archival.

## Change propagation

When a plan's brief or ADR changes materially: find it above, walk its
`Blocks` list, review each downstream brief, update both sides. And the
2026-09-03 lesson: **a plan that changes the substrate must update
indusk-v2-dawn/master.md and this file in the same close** — versioned-workbench
didn't, and Dawn's "where are we" file was wrong for a month.
