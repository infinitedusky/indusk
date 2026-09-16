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
  - hook-cwd-independence
  - indusk-v2-dawn
  - indusk-v4-day
  - midnight
  - admin-ui-phase-progress
  - indusk-makeover
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
[workbench-trust-fixes/research.md](archive/workbench-trust-fixes/research.md)): every
real project is now a versioned workbench, and four enforcement surfaces fail
*silently* there. Nothing downstream is worth building on signals that lie, so
the streams are ordered by trust, not by feature value.

## Stream 1 — Trust the substrate (now)

| Plan | Stage | What it delivers |
|------|-------|------------------|
| [workbench-trust-fixes](archive/workbench-trust-fixes/brief.md) | **closed 2026-09-10, merged 2026-09-11** — nine phases, 24 rows green, falsified, cleaned, retrospective written, archived. **Stream 1's gate is met**: zero silent wrong answers from run / cleanup / eval / restore in a versioned workbench | **Phase A (blocking, small)**: make the gate-reminder advisor actually speak (F9 — first, because it makes every later plan cheaper to execute correctly), then the four tourniquets — `indusk run` entry refusal, cleanup re-guard, eval-attribution guard, restore's destructive clone. **Phase B (trails, non-blocking)**: bash lane parity, record de-contradiction, close/re-scope of workbench-mode-rail-integrity. |
| [hook-cwd-independence](hook-cwd-independence/brief.md) | brief draft (2026-09-10, from trust-fixes' retrospective) — **recommended before 6.5** | Every hook is registered `node .claude/hooks/<name>.js` and Claude Code runs hooks in the session's drifting cwd; from `apps/indusk-mcp` every gate fails to load with a non-blocking exit 1 and is silently off (observed: eight checkoffs passed Gate B with two rows non-terminal). Absolute hook commands in `init`/`update`/this repo's settings, plus a row-terminality check in the close-out gate. |
| [workbench-code-roots](archive/workbench-code-roots/brief.md) | **folded into Dawn 6.5, archived 2026-09-14** | One `codeRoots` answer to "where is code *inside* the repo" — now `dawn-workbench-execution`'s to deliver. |

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
| 6.5 workbench execution | [dawn-workbench-execution](archive/dawn-workbench-execution/brief.md) | **closed 2026-09-16** (19 rows green, falsified 3, cleaned, retrospective, archived) — one resolver behind run/verify/cleanup, verify judges the code repo, the loop carries two roots with a cadence per repo, evals name their repo; matrix held inside a workbench (5/5, 0 false positives). hook-cwd-independence landed first (2026-09-15) |
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

Reconciled 2026-09-14 (batch one of the sequence reconciliation): every folder
outside the V4 sequence now has exactly one fate. Each archived folder carries
its reason in `closed_reason:` frontmatter.

**Standing rule (2026-09-14):** every active folder has exactly one fate — a
declared step in the sequence, archived with a reason, or standalone with a
reason written here — and the retrospective's context audit checks it at
every plan close. A folder with none is how a close-out goes unwritten for
weeks (indusk-makeover: 53 days). Follow-ons found mid-plan are written into
the brief of the step that owns them, never left in a retrospective, a
lesson title, or a chat log.

- [indusk-makeover](archive/indusk-makeover/brief.md) — closed 2026-09-14:
  retrospective written 53 days after the impl completed, archived; its two
  deferred rows now say what actually holds them.
- [admin-ui-phase-progress](admin-ui-phase-progress/brief.md) — Day step 3;
  absorbed `project-list-workbenches-only` (archived) as one phase.
- **Shipped, archived**: `work-autopilot` (the work skill's autopilot mode),
  `compaction-skill` (`/compact-context`), `falsify-phase-authoring` (1.27.4),
  `local-telemetry`, `doppler-extension` — residue named per folder.
- **Superseded, archived**: `indusk-worktree-extension` (by versioned-workbench),
  `evaluator-structured-scorecard-output` (Day replaces scores with verdicts).
- **Not now, archived, revivable**: `admin-ui-local-domain`,
  `hermes-inspired-improvements`, `react-native-support`.
- **Folded into a step, archived**: `workbench-code-roots` → Dawn 6.5,
  `cursor-support` → dawn-agents (step 8), `documentation-phase-gate` →
  day-pr-review (step 10, as an open question).
- **Salvaged**: `stale-indusk-docs-path` and `planner-hotfix-mode` closed in
  July on branches nobody merged; their archives and docs pages are on main
  as of 2026-09-14, the code deltas dropped as superseded (tips kept as
  `salvage/*` tags).
- The admin-UI scorecard-loads-only-after-a-prompt issue (Sandy, 2026-08-31)
  is carried by admin-ui-phase-progress as of 2026-09-14.
- **Small, not a step** (2026-09-15): `check_health` should report the three-way version state — installed, published (`lib/version-check.ts` already fetches and caches it), and the working tree — plus `git rev-list <release-commit>..HEAD` so every catchup states what is unpublished. The rule and the refusal already exist (CLAUDE.md; `scripts/release-guard.sh`); this makes the fact visible without anyone having to ask for it.
- Writing-skill's plain-language invocation check (skill discovery is per
  project, so it runs on the trunk): once, in a fresh session, five minutes.
  Not a step.
- **Closed 2026-09-15**: [worktree-config-schema-pointer](archive/worktree-config-schema-pointer/brief.md) — the bugfix below, shipped in four phases. Falsification found three more defects (the update path never re-ran an enabled extension's hook; the schema would have been shared into a workbench repo; restored clones got none) and the retrospective's docs audit found a fourth (declared layouts never reached the ignore top-up). See `/lessons/worktree-config-schema-pointer`.
- ~~**Bugfix, not a step** (Sandy, 2026-09-14, found in a consumer workbench):~~
  the worktree extension's config template ships
  `"$schema": "../../config.schema.json"`, which from
  `.indusk/worktree-configs/<repo>.json` resolves to nowhere in any project;
  the IDE loses validation and nothing else notices (the validator loads the
  schema from the package, never from `$schema`). Fix in
  `apps/indusk-mcp/extensions/worktree/templates/worktree-config.template.json`
  plus `on_enable.sh` shipping the schema beside the configs, verified by
  opening a materialized config in an IDE. `/planner bugfix` when picked up.

## Parked / needs re-scope

- [dusk-v2](dusk-v2/) — research parked.

## Change propagation

When a plan's brief or ADR changes materially: find it above, walk its
`Blocks` list, review each downstream brief, update both sides. And the
2026-09-03 lesson: **a plan that changes the substrate must update
indusk-v2-dawn/master.md and this file in the same close** — versioned-workbench
didn't, and Dawn's "where are we" file was wrong for a month.
