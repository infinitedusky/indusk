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

`slow_tests.report` and `slow_tests.rerun` are declared now and validated, and are used as the later parts of this feature land. A project that declares no `slow_tests` runs only its command.

## Outcome and exit

| Line printed | Meaning |
|---|---|
| `release published` / `release not published` | The release command exited 0, or did not run or failed. |
| `release done` / `release not done` | `done_when: published` is done once published. `done_when: green` is done only when the slow run is green (or was covered). |
| `the slow tests failed` | The slow command exited non-zero. |
| `open failures: ...` | The release is published and not done; what is open. Today that names the slow command, because the report is not read yet. |
| `recorded: releases.jsonl` | The release record was appended. |
| `no release declared` | No `release.command`; nothing ran. Exit 1. |

`indusk release` exits 0 when the release is done, non-zero otherwise.

## The record

Each release appends one line to `releases.jsonl` in the project's home (the folder [`indusk eval home`](/guide/eval) prints): `version` (from `release.version_file`), `commit`, `at`, `published`, `done`, `slow` (`green`, `red`, `skipped` or `not run`), `failed` and `flakes`. It is what "releases that published on their first run, against all releases" counts.

Reading failures from the JUnit report, the rerun, and routing a failure to an incident or a bugfix plan are described here as each lands.
