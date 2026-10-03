---
title: "watch opens an incident and silently does not reopen its owner — Retrospective"
date: 2026-10-03
status: completed
---

# watch reopen collision — Retrospective

## What We Set Out to Do

The numero promise smoke found `indusk promises watch` printing `opened …` and
exiting 0 while the promise's owner gained no Maintenance phase. An incident
file had been deleted with its phase left behind; the next violation the same
day reused the deleted file's id, the reopen saw the old phase and called it
"already" done, and the CLI printed nothing for that outcome. A violation
became an incident no plan owned, reported as success — the outcome the
monitor exists to prevent.

The accepted brief chose both halves: the id allocator avoids ids the owner's
Maintenance phases already name, and a collision that happens anyway is an
error with a non-zero exit. The test plan added a fourth row (A4): the two
other "did not reopen" outcomes — no owner folder, unreadable worktree
record — also exited 0.

## What Actually Happened

24 commits on `plan/watch-reopen-collision`, 16 files, +715 / −120; the
package code and tests are 9 files, +585 / −89, most of it tests.

- **Test Phase 1** wrote A1–A4 against today's code; A1, A3 and A4 went red on
  exactly the predicted assertions, A2 (the quiet extend) passed as a guard.
- **Build Phase 1** — `maintenanceIncidentIds`, the allocator's `avoid` set
  read from the owner's live copy, `reopenOwner(…, kind)` with a `collision`
  reason, and `watchReport`, which owns every line `watch` prints and its exit
  code.
- **The test plan was corrected while writing the impl.** Once the allocator
  avoids the owner's ids, `watch` can no longer *produce* a collision through
  the CLI — the numero case becomes A1. A3 moved to the two places a
  collision is decided and reported, with the assertion unchanged; the change
  is recorded in the test plan.
- **Falsification** found the fix loud exactly once. A5: an *extended*
  incident whose owner is not a plan folder still exited 0. A6: after a run
  that recorded an incident and could not reopen, every later run skipped the
  promise ("No new violations", exit 0), and nothing ever retried the reopen
  — fixing the owner did not repair it. Now any reopen that did not happen
  fails the run except `already`, and every run retries the reopen of an open
  incident whose owner carries no phase, reporting it as `unowned`.
- **Cleanup** moved the watched-promise fixtures (spelled three times) into
  `helpers/promises-fixture.ts`, and made the reopen ask the same function the
  retry asks whether the owner carries an incident.

## Getting to Done

- **The test-tier merge earlier the same day broke `pnpm test`.** The package
  suite now runs its files in parallel on every core, and turbo ran the admin
  suite beside it; the admin's real-Jaeger HTTP tests timed out (3 failed,
  8/8 alone). Root `pnpm test` now runs the packages one after the other
  (77 s). Found by this plan's verification, fixed as discovered work in its
  own commit.
- **A fourth copy nearly landed during cleanup**: the fixture began to restate
  the "unwritten root cause" text the library already exports. It imports the
  constant instead.
- I wrote two impl phases from Python scripts, which skips the structure hook;
  each was fed to the validator by hand afterwards and passed.

## What We Learned

- **Failing the run that creates bad state is not enough; a monitor must fail
  every run while the bad state persists.** The first fix made the opening
  run exit 1 and left the incident unowned afterwards with every later run
  green. Ask of any "say it loudly" fix: what does the *next* run say?
- **When a fix makes a failure unreachable through the public surface, its
  test moves inward, and the test plan says so.** A3 could not be produced
  through the CLI once the allocator was fixed; testing it at the reopen and
  the report kept the assertion honest instead of quietly dropping it.
- **Parallelising one package's tests changes the load every sibling package
  runs under.** The admin's timing-sensitive HTTP tests were fine until the
  package beside them started using every core.

## What We'd Do Differently

- **Write the persisting-state row in the test plan.** For a change whose
  whole point is "never report success while X", the plan should carry a row
  for the run after the one that caused X. Falsification found A6; the test
  plan could have.
- **Run the whole `pnpm test` on trunk right after merging a change to how
  tests run**, not only the package it changed. The test-tier merge was
  verified per package and broke the combined run.

## Insights Worth Carrying Forward

- `watch` now has one rule a person can rely on: exit 0 means every open
  incident it touched is carried by its owner's Maintenance phase.
- The package's `CLAUDE.md` is at 16,043 of 16,384 bytes. Its next rule moves
  something down a tier or replaces an entry.

## Quality Ratchet

- No recurring lint or type errors. Biome flagged unused imports once, after
  the fixture extraction — already a rule.
- **Shape**: 0 findings raised across three build phases, 0 judged wrong. One
  reasoned leave-as-is (Build Phase 1: `watchReport` prints errors after the
  run's other lines). The previous plan, context-tiers, also had none judged
  wrong — no streak.

## Metrics

| | |
|---|---|
| Trajectory rows | 6, all passing (A1–A6) |
| Commits | 24 on the plan branch |
| Package code + tests | 9 files, +585 / −89 |
| `pnpm test` | mcp 1,668 passed / 5 skipped, admin 342, `promises check` clean |
| `pnpm test:system` | 22 files, 84 tests |

## Landing
