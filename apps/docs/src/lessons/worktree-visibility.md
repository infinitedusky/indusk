---
title: "Worktree Visibility — Lessons"
date: 2026-07-13
---

# Worktree Visibility — Lessons

Two lessons from the plan that made agent worktree isolation the default and observable. Both came
out of the falsification round, on a plan that was already marked `completed`.

## YAML coerces boolean-ish flag values — a string-equality opt-out silently inverts

A frontmatter opt-out checked by string equality (`data.worktree === "none"` → skip) has a footgun:
YAML parses `false`/`no`/`off`/`yes`/`on` as booleans or reserved words, not strings. `worktree: false`
— the most natural way a user expresses "no worktree" — becomes boolean `false`, so a
`typeof value !== "string"` guard short-circuits to the default branch and the user gets exactly what
they tried to opt out of.

The happy-path test (`worktree: none` → skip) passes, and the author never types `worktree: false`
because they already know the keyword. The person who hits it is the user expressing intent the
natural way.

**Carry-forward:** for any boolean-intent frontmatter flag, treat the opt-out as a **type-aware
predicate**, not a string equality — handle boolean `false` explicitly and accept the common falsy
strings case-insensitively (`none`/`no`/`off`/`false`/`skip`).

## The load-bearing environment facts belong in the Phase-1 test matrix

`indusk agent list` recomputes the caller's worktree/branch from cwd on every call. The Phase-1 tests
only exercised git cwds — so nobody noticed that running the command from a **non-git cwd wiped the
value to empty**, dropping the session off the board and out of collision detection. The catch: the
single most normal place to run `agent list` is the **workbench root, which is intentionally not a
git repo** (it's where `.indusk/` lives). The command the feature exists to serve, run from the
directory it's most naturally run in, produced the exact false-negative the feature was built to
prevent.

The non-git nature of the workbench root is documented elsewhere in the same repo. The recompute
forgot it; the tests didn't cover it. The failure was one `cd` away.

**Carry-forward:** when a feature recomputes state from the environment, enumerate the environment's
load-bearing facts (this repo: workbench root is non-git; TMPDIR is symlinked; worktrees vs trunk)
and put the awkward ones in the Phase-1 test matrix — don't wait for falsification to find the `cd`
that breaks it.

## Meta: falsify-after-completed earns its keep on *obvious* inputs

Neither bug was exotic. Both were a single keystroke (`worktree: false`) or a single `cd` (to the
workbench root) away, and both shipped past a `completed` impl. The ritual's value here wasn't
edge-case exhaustion — it was surfacing the *obvious realistic input the author didn't test because
they were thinking about the happy path.*
