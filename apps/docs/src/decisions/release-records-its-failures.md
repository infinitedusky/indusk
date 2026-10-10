# Release Records Its Failures — the release as a declared step

**Decided 2026-10-10.** Full ADR: `.indusk/planning/archive/release-records-its-failures/adr.md`.

## What was decided

The release used to be one shell chain with the slow tests welded in front of the publish, so the first run of the slow tier after two deliberate changes stopped the 1.69.0 release. Now the release is a declared step of the workflow, and [`indusk release`](/reference/cli/release) runs it as declared:

- **The order and "done" are facts in config.** `workflow.steps.release.slow_tests` names the command, the JUnit `report`, `when: before | after`, and an optional `rerun` command taking `{files}`. `done_when: published | green` says what a completed release is. dusk declares `after` and `published`.
- **Failures come from the JUnit report**, never from what the runner printed. Any runner that writes JUnit works.
- **One rerun of the failing files.** A file the rerun's report shows passing is a flake, and opens nothing.
- **More than half the files failing is the environment**, recorded once, and opens nothing.
- **A failing file routes through the trajectory rows that name it:**
  - When a row names a promise, the promise gets an incident with `tests:` + `release:` evidence and the commits since the last green slow run. It is committed on the trunk and put in the break inbox like the recorder's.
  - Anything else gets a draft `fix-<file>` bugfix plan on its own branch, reused while open.
- **Every release appends a line to `releases.jsonl`** in the project's home.

## Tradeoffs accepted

- **A runner of our own was rejected.** It would need stages, caching and retries, and `act`, Dagger and Earthly exist. InDusk orders two declared steps and routes their failures.
- **Parsing the runner's output was rejected.** It ties the release to one runner, and Dawn verify already set the rule: files and exit codes.
- **Most of dusk's slow tier routes to bugfix plans for now.** Plans archived before 2026-10-07 wrote rows without `For` cells, so few failures reach a promise until those rows are backfilled.
- **`indusk release` runs for minutes after the publish**, in the foreground. Nothing can die unseen.

## What hardened it

- **Falsification found five gaps:**
  - stale reports read as this run's;
  - a routing error after the publish that lost the record;
  - two test files with one name sharing a plan;
  - a recurring failure colliding with its archived fix plan;
  - an unquoted file list reaching a shell.
- **The audit found two more:**
  - a file merely missing from the rerun's report counted as a flake;
  - a plan name held on the trunk or by a branch left a failure unrouted.

All seven were fixed before close.
