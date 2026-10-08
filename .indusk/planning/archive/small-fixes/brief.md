---
title: "Small fixes"
date: 2026-10-08
status: accepted
workflow: bugfix
---

# Small fixes — Brief

Eight fixes from `known-issues.md`, agreed one at a time with Sandy on 2026-10-08. The first changes how dusk updates itself; the rest are rules that were only words, or two copies of one rule.

## Expectations

1. **Landing a plan costs the fast suite and nothing else, and `indusk` is current the moment it lands.**
   - Measure: for the next three plans, the time from the merge to `indusk --version` reporting the landed build, and whether anything slower than `pnpm test` ran between; against 1.67.0's close (a release, an install, a propagation wait).
   - Look: when the third lands.
2. **No plan is built without approval again.**
   - Measure: `plans review` and the admin never show an `in-progress` plan whose impl was never `approved`; the hook's refusal count in the next admin-started planning session.
   - Look: at the next plan started from the admin.

## Promises

### This plan makes

1. **`dusk-installs-its-own-build`** (state). After a plan lands, this machine's `indusk` is the landed build, installed from the checkout without a publish; publishing is a deliberate act that runs the full slow tests first.
2. **`a-plan-builds-only-after-approval`** (state). A plan leaves `draft` only through `indusk plans approve`, and no build item is checked off on a plan that is not approved.
3. **`a-session-says-how-it-ended`** (state). The admin's session panel says a turn failed, a turn finished, or the session ended, with the reason; never Claude Code's own status word beside an error.
4. **`a-stash-never-crosses-worktrees`** (state). A bare `git stash` or `git stash pop` in a worktree is refused, naming the safe way (a temporary commit, or a tagged push applied by its sha).
5. **`installed-hooks-match-the-package`** (structure). This repository's installed hooks are byte-identical to the package's, the way its installed skills are.
6. **`indusk-stops-only-its-own-daemons`** (state). `indusk telemetry stop` and `indusk ui stop` judge a process by its command line, never by whether its port answers; each signals only its own, and says, non-zero, when one would not stop.

### Existing promises

**Must not break**

- **`nothing-ships-until-accepted`**. Landing still refuses an unaccepted plan; approval gains a gate before it, not after.
- **`a-plan-is-written-on-its-own-branch`**. The planner's Key Decisions line moves to the first build phase; the branch rule is unchanged.
- **`one-definition-per-shared-rule`**. The daemon-stop rule becomes one definition for two daemons.
- **`everyday-suite-stays-fast`**. Nothing slow is added to `pnpm test`; the slow tier runs only at a deliberate publish.

**Changes**

None.

**Replaces**

- **`telemetry-stop-stops-what-it-started`**, by **`indusk-stops-only-its-own-daemons`** (state). `indusk telemetry stop` and `indusk ui stop` judge a process by its command line, never by whether its port answers; each signals only its own, and says, non-zero, when one would not stop.

### Not promised

- **The planner's Key Decisions line at the first build phase**, so `plans approve` no longer refuses the branch for it: a fix to the planner skill with a regression test, not a promise.
- **The version notice comparing numbers, not text** (`1.10.0` is newer than `1.9.0`): a one-line fix with a regression test.
- **The two workbench items** (the planner's worktree kickoff inside a workbench; `init` dropping a workbench's `worktree` config): deferred, nothing runs in a workbench this week; they stay in `known-issues.md`.
- **The telemetry restart race**: deferred; the cause is a moderate-confidence guess, and the slow tier now runs only at publish, where a flake costs one rerun. Stays in `known-issues.md`.
- **The slow tier after release as a promise, and the npm token for moving `latest`**: superseded by `dusk-installs-its-own-build`. With no publish per plan there is nothing to gate; the publish that does happen runs the tests before it.

## Depends On

- release-checks-run-once (closed 2026-10-08): `workflow.steps`, which this plan's local install reads for dusk's release command.

## Blocks

- incident-recording: next in the sequence after this bundle.
