---
title: "Workbench Trust Fixes"
date: 2026-09-03
status: accepted
---

# Workbench Trust Fixes — Brief

## Problem

Versioned-workbench made the workbench root a git repo and the layout
config-declared. Four enforcement surfaces that relied on the old shape now
fail **silently instead of refusing**: `atdawn run` commits plan docs as if
they were per-item code commits while the code is unreachable; the eval rail
attributes commits to the wrong repo's HEAD; the cleanup ritual reports
checked-and-clean without seeing any code; `workbench restore` clones a second
repo copy under a declared `path`. Every one is a trust failure — the tool
reports the reassuring case while doing the wrong thing (see
[research.md](research.md), F1–F8, with file:line evidence).

## Proposed Direction

**Restore every refusal first; teach surfaces the layout second; fix the
record third.** Same policy verify already ships ("the refusal is now
MAINTAINED"): a surface that cannot answer correctly in a workbench refuses
loudly and names why — never guesses, never reports the happy case.

**This plan is deliberately bounded into two halves, and only the first
blocks anything.** The findings are real but not equally urgent, and a
prerequisite that grows without limit is how the next plan gets delayed
again. Phase A is the short blocking set; Phase B is hygiene that can trail
alongside Midnight and Dawn work rather than gating it.

### Phase A — blocking (small, finite)

0. **Make the advisor speak** (F9) — `gate-reminder.js` emits
   `hookSpecificOutput.additionalContext` via `console.info` (stdout,
   lint-allowlisted) at exit 0, and the duplicated nudge helper collapses to
   one definition. **First, deliberately**: it is the only item here that makes
   every *subsequent* plan cheaper to execute correctly — it tells the agent
   which trajectory rows to author at the moment a phase opens, which is the
   discipline every plan after this one has to follow. Enforcement went on
   2026-08-12; the help has never been on.
1. **Tourniquets** — `indusk run` refuses workbench-shaped roots at entry
   (prior art `verify/roots.ts`); cleanup re-gains a maintained workbench
   refusal; eval-trigger refuses/mis-attribution-guards the workbench-root-cwd
   case and finally wires `declaredReposAt` into the message; `restore` clones
   at `repoDir(repo)`.
### Phase B — trailing (non-blocking)

2. **Layout parity** — port the 1.42.0 shared-resolver fix to its three bash
   siblings (`setup-worktree.sh`, `refresh-worktree.sh`, `preflight.sh`);
   `_hook-paths.js` + `stray-state-audit.ts` resolve by `repoDir`, not name;
   verify's refusal message prints a path that exists; `isWorkbench` treats
   `repos[]`-without-`shape` as workbench-shaped (or the readers warn);
   first-ever tests for `resolveVerifyRoots`.
3. **Record honesty** — resolve CLAUDE.md's self-contradiction; fix the ~8
   docs pages + cleanup skill carrying "the root is not a git repo"; record
   `workbench-sync.js` in the hook keep/shed audit; fix `guide/index.md`'s
   four-vs-five table; close or re-scope `workbench-mode-rail-integrity`
   (its U1 blocker is gated on a deleted Graphiti tool).

Cross-repo *capability* (run/verify actually working across the plan/code
split) is deliberately NOT here — that is `dawn-workbench-execution`. This
plan makes every surface honest; that plan makes them able.

## Context

Full evidence in [research.md](research.md). The commit history shows the
epic itself was thorough on the surfaces it touched — these are the surfaces
it never reached. The recurring lesson is already on file:
`a-refusal-that-holds-by-accident-is-not-a-guarantee`.

## Scope

### In Scope
- **Phase A**: F9 advisor fix, F1 entry refusal, F2 eval attribution guard +
  `declaredReposAt` wiring, F3 cleanup refusal, F4 restore clone target
- **Phase B**: F5 bash sibling ports, F6 silent-degradation fixes +
  `resolveVerifyRoots` tests, F7 record fixes, F8 close/re-scope of
  workbench-mode-rail-integrity

### Out of Scope
- Making run/verify/eval actually WORK cross-repo (→ `dawn-workbench-execution`)
- `codeRoots` / where-is-code-inside-the-repo (→ `workbench-code-roots`)
- `indusk init` authoring `repos[]`/`repos_root` (open question; feature-sized)
- Multi-repo verify (stays refusing by design)

## Success Criteria

- In every real workbench shape (flat legacy, sibling `repos_root`, nested,
  declared `path`, declared `worktrees`): `indusk run`, `/cleanup`, and the
  eval hook either work correctly or refuse with a message naming the reason —
  **zero silent wrong answers**, proven by tests per surface.
- `workbench restore` on a declared-`path` workbench is idempotent — never a
  second clone.
- `worktree create/refresh/preflight` behave identically to `wt` on every
  declared layout.
- Grep for "not a git repo" across CLAUDE.md + docs returns only historical
  records (decisions/lessons/archives).
- `workbench-mode-rail-integrity` is archived or re-scoped with a runnable
  acceptance criterion.

## Depends On
- Nothing. (1.42.0's shared bash resolver is the pattern F5 ports.)

## Blocks
- `.indusk/planning/dawn-workbench-execution/` — refusals must exist before
  they are selectively lifted
- `.indusk/planning/midnight/` — soft: Midnight's loop trusts eval/cleanup
  signals this plan makes honest
