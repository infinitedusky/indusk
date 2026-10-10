# `indusk release`

Run the release a project declares, in the order it declares, and record how it went.

```bash
indusk release
```

It reads `workflow.steps.release` in `.indusk/config.json` (see [`indusk checks`](/reference/cli/checks)) and runs the declared commands from the top of the checkout, with their own output. It never bumps a version and never runs a path of InDusk's own: `release.command` is whatever the project already runs (`pnpm release`, `fly deploy`, `just release`).

## The order

```mermaid
flowchart TD
  start([indusk release]) --> declared{release.command declared?}
  declared -- no --> none[no release declared, exit 1]
  declared -- yes --> before{slow tests when: before?}
  before -- yes --> slow1[slow tests]
  slow1 -- red --> stop[release not published, recorded]
  slow1 -- green --> cmd
  before -- no --> cmd[release.command]
  cmd -- fails --> notpub[release not published, recorded]
  cmd -- succeeds --> after{slow tests when: after?}
  after -- yes --> slow2[slow tests]
  after -- no --> done
  slow2 --> done[outcome from done_when, recorded]
```

A slow run that a fully green run already covered is skipped, with the same rule as `indusk checks slow --unless-covered`: `slow tests skipped: covered by the green run at <time> (<checkout>)`. A green slow run the release makes over a clean tree is recorded as a green run, as `indusk checks slow` records one (with the commit it ran on), so the next release can skip it.

## Declaring it

```json
"release": {
  "command": "pnpm release",
  "slow_tests": {
    "command": "pnpm -w test:system",
    "report": "apps/*/test-results/system.junit.xml",
    "when": "after"
  },
  "done_when": "published"
}
```

`slow_tests.report` is a glob of JUnit files; `slow_tests.rerun` is optional and must contain `{files}`. A project that declares no `slow_tests` runs only its command.

## Outcome and exit

| Line printed | Meaning |
|---|---|
| `release published` / `release not published` | The release command exited 0, or did not run or failed. |
| `release done` / `release not done` | `done_when: published` is done once published. `done_when: green` is done only when the slow run is green (or was covered). |
| `the slow tests failed` | The slow command exited non-zero. Printed whether or not the report could be read; when it could not, no test is named. |
| `failing: <file>` | A test file the report marks failed, and still failing after its rerun (or with no rerun declared). |
| `flaky: <file>` | A file that failed, then did not fail on its rerun. |
| `the environment failed: <n> of <total> slow test files failed` | More than half the report's test files failed. |
| `open failures: ...` | The release is published and not done; what is open. Each failing file; the slow command when none could be named. |
| `recorded: releases.jsonl` | The release record was appended. |
| `no release declared` | No `release.command`; nothing ran. Exit 1. |

`indusk release` exits 0 when the release is done, non-zero otherwise.

## The record

Each release appends one line to `releases.jsonl` in the project's home (the folder [`indusk eval home`](/guide/eval) prints): `version` (from `release.version_file`), `commit`, `at`, `published`, `done`, `slow` (`green`, `red`, `skipped` or `not run`), `failed` and `flakes`. It is what "releases that published on their first run, against all releases" counts.

## The report, the rerun, the environment

Failures are read from the declared JUnit report, never from what the command printed. Every file matching `slow_tests.report` is read as one report (one per package is fine). A case counts as failed when it has a `failure` or `error` child; its test file is the case's `file`, else its `classname`, else its suite's `file` or `name`, made relative to the repo. A red run whose report is missing or cannot be parsed says `the slow tests failed` and names no test.

When more than half the report's test files failed, it is the environment, not the code: the release prints the `the environment failed` line, records `environment: {failed, total}`, and nothing else is opened. Exactly half is not.

Otherwise, with `slow_tests.rerun` declared, the failing files are substituted space-separated into `{files}` and run once. The report is read again: a file the rerun does not leave failing is a flake, listed under `flakes` on the record and opening nothing; a file still failing is recorded under `failed`.

## Routing a failure

Each file still failing is looked up in every plan's trajectory, active and archived: the rows whose `Test` cell names it. Each promise those rows' `For` cells name, live in the registry, claims the file. A file no promise claims stays `unrouted` on the record (a draft bugfix plan, as it lands).

A claimed failure becomes an incident on its promise, one per promise with every file it claims:

```markdown
---
id: i-2026-10-10-seat-released
promise: seat-released
source: release
status: open
date: '2026-10-10'
opened: '2026-10-10T04:43:43Z'
last_seen: '2026-10-10T04:43:43Z'
tests:
  - "src/seat-released.test.ts > holds a seat"
release:
  - "1.4.0 at 2dc1394"
---

## Symptom

Release 1.4.0: src/seat-released.test.ts failed in the slow tests and was still failing when the release recorded it.

## Suspects

Release 1.4.0 (2dc1394) — failing: `src/seat-released.test.ts > holds a seat`.

Commits since the last green slow run (8025898) touching `src`:

- 2dc1394 rewrite the seat release timer

## Proven by

- `seat-holds` row R1 — passing (src/seat-released.test.ts)
```

The evidence is `tests:` and `release:` where a watcher's incident carries `traces:`. The suspects are `git log <sha>..HEAD` over `release.covers` (the whole repository when it declares none), from the commit the last green slow run was made on; a green run recorded without a commit, or none at all, names none and says why. Opening the incident goes the way a watcher's does: the promise lists it and an `enforced` one turns `known-violated`, and the owning plan gains `### Build Phase N: Maintenance — <id>`. It then shows in `indusk promises status`, `promise_health`, catchup and the admin like any open incident.

When the promise already has an open incident, a later release adds to it: its tests and release are appended, its block goes under `## Suspects`, and `last_seen` moves forward.

| Line printed | Meaning |
|---|---|
| `recorded: incident <id>` | An incident the release opened or extended. The record's `failed` entry for the file reads `routed: "incident <id>"`. |
| `  reopened <owner>: Build Phase N: Maintenance — <id>` | The owner gained the incident's Maintenance phase. |
| `incident <id>: <owner> was not reopened — …` (stderr) | The owner is not a plan folder, already has a heading this incident did not write, or its worktree assignment could not be read. |

The incident is written, not committed: commit it with the rest of the release's bookkeeping.
