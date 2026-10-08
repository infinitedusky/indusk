---
title: "Small fixes — Test Plan"
date: 2026-10-08
status: accepted
---

# Small fixes — Test Plan

## Purpose

The behavioural assertions that, together, mean the eight fixes are in and holding. Each names the smallest level that proves it; all but one are fast tests, and the one live check is recorded once on this machine. They become the impl's Test Trajectory rows.

## Behavioral Assertions

### `dusk-installs-its-own-build` — after a plan lands, this machine's `indusk` is the landed build; publishing is deliberate and tested

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | After the local install, `indusk --version` run from any directory reports the checkout's version, and `indusk ui start` finds the admin, with nothing published | live check |
| A2 | A project that declares a local install command (`workflow.steps.land.install`) gets it named by `indusk checks show`, and the landing step runs it after the merge; one that declares none is told landing installs nothing | unit |
| A3 | `pnpm release` runs the full slow tests before it publishes, every time | unit |

### `a-plan-builds-only-after-approval` — a plan leaves `draft` only through `plans approve`

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | Editing a draft plan's status to `in-progress` by hand is refused, naming the lesson; after `indusk plans approve`, the same edit lands | unit |
| A5 | Checking off a build item on a draft plan is refused; on an approved plan it lands | unit |
| A6 | The planner skill ends at the written plan: it names `plans approve` as the only way on and nowhere tells the agent to start building | unit |

### `a-session-says-how-it-ended` — the session panel says what happened

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A turn that ends with an API error shows **Failed** and the error's first line, and the word "success" appears nowhere on the panel | unit |
| A8 | A turn that completes shows **Turn done**; only a session whose process exited shows **Session ended**, with its exit code | unit |

### `a-stash-never-crosses-worktrees` — a bare stash is refused where it could be popped by another session

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | In a repository with more than one worktree, `git stash` and `git stash pop` are refused before they run, and the refusal names a temporary commit and `stash push -m <tag>` / `stash apply <sha>` | unit |
| A10 | `git stash push -m <tag>`, `git stash list` and `git stash apply <sha>` are not refused; in a repository with one worktree nothing is refused | unit |

### `installed-hooks-match-the-package` — this repository's hooks are the package's

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | Every hook in the package has a byte-identical installed copy in this repository, and an installed hook with no package source is reported by name | unit |

### `indusk-stops-only-its-own-daemons` — both stops judge a process by its command line

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | `indusk ui stop` with a port slow to answer still stops its own daemon and removes its record; it never signals a process that is not its own, and exits non-zero naming one that would not stop | unit |
| A13 | `indusk telemetry stop` behaves exactly as `telemetry-stop-stops-what-it-started` proved: its four tests pass unchanged | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A14 | The command-line identity check is defined once, and both stops use it | unit | `one-definition-per-shared-rule`, which this plan must not break: two copies were the bug |
| A15 | The planner writes the root `CLAUDE.md` Key Decisions line as the first build phase's context item, never at ADR acceptance, so `plans approve` accepts the branch | unit | a fix to the planner skill; the approve rule is unchanged |
| A16 | The update notice says a newer version exists for `1.10.0` over `1.9.0`, and not for `1.9.0` over `1.10.0` | unit | a regression guard over a one-line fix |

## Notes

- A1 is the only live check: it installs into this machine's global `indusk`, so it runs once at the plan's close and is recorded with its output.
- A3 restores the slow tier to the release script that release-checks-run-once removed, now that no plan publishes; the script's pinned step list changes with it.
