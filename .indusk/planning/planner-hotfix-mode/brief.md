---
title: "Planner Hotfix Mode"
date: 2026-07-01
status: accepted
---

# Planner Hotfix Mode — Brief

## Problem

When production is actively broken, the planner's existing workflows are too slow to be honest about. Even `bugfix` — already the lightest workflow — requires a brief and a test plan before any code exists. In a real production-down scenario, nobody is going to write a test plan before shipping the one-line fix; they'll do it anyway, off-plan, undocumented, and the planning system will have nothing to show for it and nothing forcing a return trip to add the tests/docs that got skipped. There's currently no sanctioned fast path — just an implicit "ignore the plan system this one time," which means the backfill never gets tracked and often never happens.

## Proposed Direction

Add `hotfix` as a fifth workflow type, parsed the same way as the existing four (`/planner hotfix {slug}`, defaulting the remaining words to the kebab-cased plan name).

**Flow:**
1. Fix is written directly against the bug — no plan folder, no docs, no ceremony. Branch is `hotfix/{slug}` off `main`, created in the current working directory (not a worktree — see Research: the worktree extension's setup ceremony is real cost dusk itself doesn't pay, and defaults to being unavailable). In-progress work on the current branch is protected with `git stash` or a WIP safety commit first.
2. PR opens and merges as fast as normal review allows.
3. Immediately after (or in parallel with step 2), the plan folder is created retroactively: `.indusk/planning/{slug}/impl.md` only — no brief, no test plan, no ADR. Frontmatter sets `workflow: hotfix`, `gate_policy: auto`, `trajectory: required`.
4. `impl.md` has exactly three phases:
   - **Phase 1 — Ship the fix.** Documents what was already shipped (retroactively — the code and PR already exist by the time this is written). Every required gate section (per the workflow's gate map, see Scope) is written as `skip-reason: hotfix — deferred to Phase 2 backfill`, which `gate_policy: auto` permits at write time. No trajectory row targets this phase, so Gate B's phase-close check has nothing to block on.
   - **Phase 2 — Backfill (mandatory).** A real phase: authors the regression test(s) proving the original bug (`Writable at: Phase 0` — the bug was reproducible before any plan code existed, per the existing trajectory convention for reported bugs — `Passes at: Phase 2`, since that's when it's actually run against the already-shipped fix), completes real Verification/Document (and Context, if confirmed in scope below) gates.
   - **Phase 3 — Close.** A trivial, single-item phase (e.g. "confirm all Phase 2 trajectory rows are terminal"). This phase exists purely so Backfill is not the terminal phase — see Research for why: `check-gates.js`'s Gate B only inspects a phase's `Passes at` rows when a *later* phase's implementation item is checked, so without a Close phase, nothing would ever force Backfill's own rows to reach `passing` before the plan is marked done. Checking Close's one item is what triggers Gate B to inspect Backfill's rows.
5. `/falsify` and `/retrospective` run against the plan exactly as they would for any other workflow, after Phase 3 closes — unmodified, just later in wall-clock time than usual.

**Why this needs no new enforcement mechanism** (see Research for the file-level detail, including a mid-design correction): `gate_policy: auto` already allows write-time skip-reasons; the Test Trajectory system's existing Phase-0 rule for reported-bug regression tests already models "test conceived before the fix, confirmed after backfill." Gate B's phase-close check only blocks on trajectory rows that target a phase *before* the one whose item is being checked — which is why the template needs three phases, not two: without a trailing Close phase, Backfill would be terminal and Gate B would never inspect its rows at all (verified empirically; this is a real, previously-undocumented gap in Gate B that applies to every plan's terminal phase, not just hotfix's). With the Close phase, the existing mechanism — unmodified — works exactly as needed. The only actual code changes are recognizing `hotfix` as a workflow name at all — it isn't currently, so writing `workflow: hotfix` today would silently fall through to the strictest (`feature`) gate requirements in both hooks.

## Context

Full findings in `research.md`. Headline facts:
- Workflow dispatch is duplicated across three places with no shared source: `planner.md` (prose), `check-gates.js:119,147-152`, `validate-impl-structure.js:148,156-160`. All three need a `hotfix` entry.
- `gate_policy: auto` and the Phase-0 trajectory rule for regression tests are existing, unmodified mechanisms that happen to fit this use case exactly.
- No worktree involvement — plain branch, current working directory, protect WIP via stash/safety-commit.
- Branch pattern is new: `hotfix/{slug}`, distinct from the existing `fix/{slug}` (bugfix-outside-a-plan) pattern, per discovery decision — deliberately grep-distinguishable for any future automation that wants to detect "this was a hotfix."

## Scope

### In Scope
- `apps/indusk-mcp/skills/planner.md`: new `hotfix` row in the workflow table + argument-hint update + a new numbered step (or sub-step of the existing impl-authoring step) describing the retroactive, three-phase document flow above.
- `apps/indusk-mcp/hooks/check-gates.js`: add `hotfix` to the `detectWorkflow` regex; add a `hotfix` entry to `WORKFLOW_GATES_BASE`.
- `apps/indusk-mcp/hooks/validate-impl-structure.js`: add `hotfix` to its own workflow regex; add a `hotfix` entry to its own requirements map.
- `apps/indusk-mcp/skills/git.md`: add `hotfix/{slug}` to the branch naming table; short prose describing the stash-then-branch flow and explicitly noting "not a worktree."
- Decide and implement the hotfix gate-requirements shape (see Open Decision below) in both hook files, kept identical to each other.
- Regression test(s) / fixtures proving both hooks recognize `workflow: hotfix` and gate it correctly (mirrors existing hook test patterns, e.g. `extension-worktree-required-false.test.ts`-style subprocess or unit tests already used for these hooks).

### Out of Scope
- No new hook mechanism, no new `gate_policy` value, no new trajectory field — deliberately reuses `auto` + Phase 0 as-is.
- No CLI tracking surface (e.g. `indusk hotfix status`) — rejected in discovery in favor of the plan-based enforcer (Phase 2 is what forces backfill, via existing check-gates phase-close logic).
- No worktree-extension integration or automation.
- No change to `/falsify` or `/retrospective` skill logic — they already work unmodified against any workflow's terminal phase.
- Extracting the three duplicated workflow-dispatch implementations into one shared source. Real finding from research, genuinely tempting, but a separate refactor with its own blast radius (touches two hooks + skill doc + every test that pins current hook behavior) — not bundling it into this plan unless you want it folded in.

## Success Criteria
- `/planner hotfix payment-timeout-crash` is recognized by the planner skill and produces the flow described above.
- Writing a hotfix `impl.md` with Phase 1 fully skip-reasoned (under `gate_policy: auto`) is accepted by `validate-impl-structure.js` at write time, and Phase 1 closes cleanly under `check-gates.js` with zero trajectory obligations.
- The plan cannot reach a completed state (Phase 3's Close item can't be checked off) until Backfill's real trajectory rows reach `passing`/`skipped`/`blocked` and its required gate sections are genuinely filled in — verified against the live hook, not assumed.
- `/falsify {slug}` and `/retrospective {slug}` run against a completed hotfix plan with no code changes to either skill.
- A hotfix produces a `hotfix/{slug}` branch, not `fix/{slug}` and not a worktree.

## Decisions (resolved on brief acceptance — no objection raised, proceeding with proposed defaults)

1. **Gate requirements for the `hotfix` workflow map**: mirrors `bugfix` exactly — `verification` + `document` required, `otel` unconditionally excluded (not conditional on `otel.role` — that's how `bugfix` already works; the array simply never lists `"otel"`), `context` not required. Same rationale as bugfix: context updates aren't structurally forced, but nothing stops a hotfix's Phase 2 from adding one voluntarily.
2. **Retroactive plan-folder creation fires a highlight**: `mcp__indusk__highlight({ tag: "hotfix-shipped", level: "critical", note: "{slug}: {one-line what broke + what shipped}" })`, called when the plan folder + `impl.md` are authored (i.e., right after the PR merges). New trigger point, added to the planner skill alongside the existing brief-accepted/adr-accepted/test-plan-accepted triggers.

## Depends On
- None. Touches the same two hook files as `tests-first-planning` and `rationale-baseline-frontmatter` (adjacent code, no active dependency).

## Blocks
- None currently.
