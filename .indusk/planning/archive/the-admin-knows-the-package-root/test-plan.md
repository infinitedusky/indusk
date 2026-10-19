---
title: "The admin knows the package root — Test Plan"
date: 2026-10-19
status: draft
---

# The admin knows the package root — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the fix is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. The assertions here become the source rows for the impl's `## Test Trajectory` table.

This is a bugfix plan: no ADR is written (the bugfix workflow is brief + test-plan + impl), so the decisions below are recorded here.

## Behavioral Assertions

**Every assertion is observable from outside the system:** what the daemon is started with, where a planning run stops, what a caller of the lookup gets back.

## Clause plans

The brief's `## Promises` → `### This plan makes` is `None`, and the brief does not opt into `clauses: required`. There is therefore no promise clause to plan and no clause row to write: `(none needed — the brief makes no promise, so there is no clause to measure)`. The measure for the one promise the plan must not break is below.

## `an-accepted-brief-is-planned-unasked` (must not break)

An accepted brief starts a planning session that writes each document the workflow needs and stops at "ready for approval" — here the existing promise from plan `a-brief-is-planned-unasked`, which the brief lists under Must-not-break. Its tests are named in `.indusk/promises/an-accepted-brief-is-planned-unasked.md` and run through `indusk plans tests` for this plan; this plan adds no clause to it.

- Signal: the planning run's stop reason, read from the build session's events in the admin (the planning loop). Upheld when an unattended run over an accepted brief ends "ready for approval"; broken when it ends "cannot continue" on the package-root lookup, which is the failure found 2026-10-19 in the `mark-first` and `a-plan-says-how-long-it-took` runs.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | When the admin was started by the `indusk` command, the daemon's environment names the package root that command resolved, so code inside the daemon is handed the right folder rather than finding its own. | unit |
| A2 | Inside the admin's production bundle, the lookup of the package's shipped files returns the folder that holds the shipped impl-structure hook, not the `.../apps/apps/indusk-mcp/dist/lib` folder the bundler's rewritten module location produced. | live check |
| A3 | A planning run over an accepted brief, in the admin as started by `indusk ui`, ends "ready for approval" instead of "cannot continue". | live check |

### Not for a promise

Assertions that prove no promise but keep the fix from costing something else.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A4 | Run from the terminal, outside the admin (the `indusk` command itself, `demo`, `worktree`, plan start), the package root is found exactly as before — from where the code sits — and no handed value is needed. | unit | a regression guard: the fix must not change the one resolution every CLI path relies on |
| A5 | When the handed root does not hold this package (an empty value, a folder with no package named `@infinitedusky/indusk-mcp`, a stale value from another install), it is ignored and the lookup falls back to finding the root from where the code sits, rather than returning a wrong folder. | unit | a stale or wrong environment value must never beat a correct lookup; the failure it would cause is the same one this plan fixes |
| A6 | The existing guard that the planning reader names the impl hook through the package-root lookup (and not through `"node"` or a path built from the module's own location) still passes. | unit | a regression guard (`read-planning-hook-path.test.ts`); the fix goes through the same lookup, not around it |

## Decisions

Decided unattended (`INDUSK_GATE_POLICY=auto`); each with its reason, for the reviewer to approve with the plan.

1. **The fix is in the one lookup, not at each caller.** The handed root is read inside `induskMcpPackageRoot()` (`lib/package-root.ts`), the single function every shipped-file lookup uses, so planning, new-project and every future caller get it. Reason: the root `CLAUDE.md` rule that the admin's bundled code finds shipped files through `induskMcpPackageRoot()`; patching `read-planning.ts` alone would leave the next caller broken the same way.
2. **The root is handed down through the daemon's environment**, beside `INDUSK_PROJECT_ROOT` in `daemonStart`'s `env` (`lib/admin/daemon.ts`). Reason: `daemonStart` already builds that environment and runs in the `indusk` process, which resolves the root correctly; no new channel is needed. The variable's exact name is the impl's to choose.
3. **A handed root is trusted only if it holds this package** (A5): a `package.json` named `@infinitedusky/indusk-mcp` is checked, the same check the walk-up uses. Reason: a daemon outlives the install that started it, and a stale value would silently produce the wrong folder with no error.
4. **A3 and A2 are live checks, not unit tests.** The bug exists only in the bundler's output, so a unit test over the source cannot reproduce it. Reason: they run in the slow tier after landing, never as a gate on landing or release (`/decisions/release-checks-run-once`; a failure there reads as a broken promise); A1, A4, A5 and A6 are the everyday rows.
5. **No level `promise` row.** The brief makes none, and the must-not-break promise already has its own rows; A3 is a live check of its outcome. Reason: a `promise` row would claim a clause this plan does not own.

## Untestable Assertions

(none needed — every assertion above has a level; A2 and A3 depend on a built admin bundle and a running daemon, which the slow tier provides.)

## Notes

- A3's compensating signal after landing: the planning run's stop reason on the next unattended plan; a "cannot continue" naming the package-root lookup would break `an-accepted-brief-is-planned-unasked`.
- Open: whether A2 can run without a full admin build (a built bundle's output file read directly) is the impl's to find; if it cannot, A2 folds into A3.
