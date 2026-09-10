---
title: "Dawn Workbench Execution — the floor runs where the work is"
date: 2026-09-03
status: draft
---

# Dawn Workbench Execution — Brief

## Problem

Dawn's master claims component 6's verify is "the universal floor: it runs on
every tier." In a workbench — the standard shape of every real project on
this machine — it refuses on the first call, and `atdawn run` cannot execute
at all (the code root is unreachable from the plan root; see
`workbench-trust-fixes/research.md` F1). The floor is universal everywhere
except where the work actually happens. Component 7 (external agents) would
dispatch work into exactly these workbenches, inheriting the gap.

## Proposed Direction

**Teach the run and verify lanes the plan-root/code-root split for the
single-repo workbench, keeping the multi-repo refusal.** This is Dawn
component 6.5 — between the keystone (6) and agent integration (7).

1. **Verify, cross-repo (single-repo case).** The ledger gains a per-repo
   baseline (`VerifyRecord` grows a code-root discriminator);
   `resolveVerifyRoots` returns `{ planRoot, codeRoot, split: true }` instead
   of refusing when exactly one repo is declared (the dead `split` branch in
   `verify.ts:97-98` already anticipates this); red-tests + bootstrap baseline
   + phantom resolve against `codeRoot`; ledger I/O, goalpost drift, and gate
   scripts stay on the plan root — those are plan-repo questions. `Test`
   column paths become code-repo-relative by definition.
2. **Run, cross-repo.** `runLoop` carries both roots: tools and bash execute
   against the code root (worktree confinement moves with them), impl/gate
   reads stay on the plan root, and commit-cadence commits **to the code
   repo** for code items — with plan-doc checkoffs either committed separately
   to the workbench repo or left to `workbench sync`, decided in the ADR.
3. **Eval attribution follows.** With both roots explicit, the pending-eval
   queue records which repo a sha belongs to; the drain hands the evaluator
   the right `gitRoot`.
4. **Shared resolution, single definition.** One `resolveExecutionRoots`
   (verify's `resolveVerifyRoots` generalized or wrapped) used by run, verify,
   and the drain — pinned by a single-definition test like its siblings.

## Context

- Depends on the refusals existing first (`workbench-trust-fixes`) so this
  plan lifts them deliberately, case by case, instead of the gaps being open
  the whole time.
- `workbench-code-roots` supplies "where is code *inside* the repo" — wanted
  by red-tests' runner detection on polyglot repos; not a hard dependency for
  the single-repo split itself.
- The cross-repo baseline was named as a follow-on in three documents
  (decisions/dawn-verify, reference/cli/verify, versioned-workbench D8) and
  scheduled in none — this plan is that follow-on.
- **Three refusal sites now exist, and this plan's resolver absorbs all
  three.** `workbench-trust-fixes` (2026-09-10) installed the same
  "this is a workbench; its code lives in X; run inside Y" refusal at
  `bin/commands/run.ts`, `lib/cleanup/oversized.ts` and `lib/verify/roots.ts`,
  each reading the shape through `isWorkbench` / `readWorkbenchRepos` /
  `repoDir`. Its cleanup ritual met the rule of three and deliberately did not
  extract a refusal helper, because `resolveExecutionRoots` is the designated
  single home — so the single-definition pin here must cover run, cleanup and
  verify, not run and verify alone.

## Scope

### In Scope
- Single-repo workbench: verify + run + eval attribution across the split
- Per-repo baseline in the verify ledger (with a migration story for the
  chained ledger — `readLedger` throws on malformed lines by design)
- The `resolveExecutionRoots` shared primitive + single-definition pin
- Acceptance re-run: dawn-verify's 6-cell matrix executed **in a workbench**

### Out of Scope
- Multi-repo workbenches (refusal stays; needs plan-declares-its-repo — its
  own follow-on)
- Any component 7 work (external agents)
- Shape/cleanup cross-repo (cleanup refuses per workbench-trust-fixes;
  lifting that is a candidate stretch goal here, else a named follow-on)

## Success Criteria

- A plan in a single-repo workbench (all four layouts) runs end-to-end under
  `atdawn run`: code edits land in the code repo, per-item commits are made in
  the code repo, gates enforce, and `atdawn verify --phase N` produces
  verdicts against the code repo's diff.
- The dawn-verify acceptance matrix (5 planted classes + honest control)
  re-run inside a workbench: 5/5 caught, 0 false positives.
- Multi-repo still refuses, naming the repos.
- Dawn master's "universal floor" claim is true again, unqualified.

## Depends On
- `.indusk/planning/archive/workbench-trust-fixes/` (refusals + record; closed 2026-09-10)
- Soft: `.indusk/planning/hook-cwd-independence/` — the gates this plan runs under are cwd-relative and silently off from a subdirectory (found at trust-fixes' retrospective); fix first or `cd` to the root before every gated edit
- Soft: `.indusk/planning/workbench-code-roots/` (polyglot runner detection)

## Blocks
- `dawn-agents` (component 7) — external agents dispatch into workbenches;
  without this, every dispatched phase lands in the gap
