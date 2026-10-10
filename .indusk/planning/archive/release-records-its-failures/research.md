---
title: "release-records-its-failures"
date: 2026-10-09
status: complete
---

# release-records-its-failures — Research

## Question

How does a release become a declared step of the workflow, with its order (slow tests before or after the publish) and what "done" means stated in config, so that a red slow test is recorded against the promise it was proving, or as a bugfix plan when it proves none, instead of stopping the release?

## Background

**What happened on 2026-10-09.** 1.69.0 was bumped and `pnpm release` ran. The release script in `apps/indusk-mcp/package.json` is one shell chain:

```
release-guard.sh && pnpm -w test:system && npm whoami && release-image.sh && pnpm publish && record-release.js
```

`test:system` failed: one file in indusk-mcp and two in indusk-admin. Each failure reproduced when its file was run alone, so none is a flake:

| Failing test | Asserts | Likely cause |
|---|---|---|
| `apps/indusk-mcp/src/__tests__/always-on-health-tool.test.ts` A20 | `/catchup` says open violations come before the roadmap | `7d3d0545` (10-08) reworded `skills/catchup.md`: the phrase is now more than 200 characters from what the regex wants (high confidence) |
| `apps/indusk-admin/src/__tests__/http-promise-remote.test.ts` A17 | with the server unreachable, every behaviour chip is `unverified` | it reads `amber`; probably `7df79000` (10-08), promise health moved into the package (moderate) |
| `apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts` A9 | production's chip reads `fixed` once its incident is fixed | it stays `red`; the same 10-08 work (moderate) |

All three landed on 10-08 without the system tier running. Since release-checks-run-once (closed 2026-10-08, 1.67.0), dusk runs no slow tests at landing, and Sandy decided the slow tier should run *after* release as a promise. That second half was never built: the release script still runs the system tier first, so the first run of the slow tier since the regressions was the release, and it stopped the release.

**Every recent release has failed its first `pnpm release`** (known-issues.md, Releases: 1.63.0 twice, 1.64.0, and now 1.69.0). Most earlier failures were timing flakes; this one was real regressions.

## Findings

### What is already declared, and how generic it is

`workflow.steps` (`lib/checks/steps.ts`, release-checks-run-once D4–D5) holds facts, never logic: each step is a command, a path or a name. A step that needs logic names a script.

- `land.install`, `land.slow_tests`: commands.
- `release.command`, `release.version_file`, `release.changelog`, `release.covers`.
- `release.version_file` is read as JSON (its `version` key) or as a `version = …` / `version: …` line (`lib/checks/key.ts:91`), so `package.json`, `Cargo.toml` and `pyproject.toml` all work. Nothing in the declaration layer is npm-specific.
- `indusk checks show` prints the declared steps; `indusk checks slow [--unless-covered]` runs `land.slow_tests` and records a fully green run over a clean tree in the project home (`slow-runs.jsonl`, `lib/checks/record.ts`). Only green runs are written: a red run leaves no trace.

The npm-specific parts are dusk's own: `release-guard.sh`, `npm whoami`, `pnpm publish`, `record-release.js` (which appends the published version to `.indusk/current.md`). Another project declares its own command and never sees them.

### Knowing which tests failed, for any runner

Parsing a runner's printed output ties the feature to that runner, and Dawn verify already rejected it ("files and exit codes, never runner-output parsing", `/decisions/dawn-verify`). JUnit XML is the portable report format: vitest (built-in `junit` reporter with `outputFile`), jest (jest-junit), pytest (`--junitxml`), go (gotestsum), cargo-nextest and rspec all write it. dusk's three `vitest.system.config.ts` files declare no reporter today. A runner that cannot write JUnit leaves only the exit code: "the run failed", with no test named.

### From a failing test to a promise

A trajectory row's `Test` cell names test files and its `For` cell names the promise (planner-promises, 2026-10-07). An incident on a promise reopens its owning plan with a Maintenance phase (`lib/promises/reopen.ts`). So a failing file can be routed: the row that names it, the promise that row names, the incident, and the reopened plan.

For today's three failures, the routing finds no promise for any of them:

- `http-promise-timeline-sources.test.ts` is named by promise-timeline's row A9, which predates `For` cells and names no promise.
- `http-promise-remote.test.ts` and `always-on-health-tool.test.ts` are named by no row: day-always-on's rows have no `Test` cell, and the files appear only in its checklist prose.

Every plan archived before 10-07 wrote rows without `For` and often without `Test`. Most of dusk's slow tier is likely in that state (moderate confidence: checked for these three files, not for all 42). So the cases are three, not two:

1. **A row names the file and a promise**: an incident on that promise.
2. **A row names the file and no promise**: the owning plan is archived, and an archived plan reopens only through an incident, so this cannot reopen it.
3. **No row names the file**: an orphan.

Cases 2 and 3 need somewhere to go that is not an incident.

### Incidents today are trace-shaped

`recordViolations` (`lib/promises/incidents.ts:160`) records violations as Jaeger traces: an incident's evidence is `traces:`, it dedupes by trace id, and it extends the open incident on the same promise rather than opening a second. `INCIDENT_SOURCES` is `local | smoke | deployed | desk` (`lib/promises/vocabulary.ts:40`). A failing test has no trace; its evidence is the test file, the test's name, the release version and the commit. An incident born of a test needs that evidence shape and a source that says a release found it.

### Opening a bugfix plan

`indusk plans start bugfix <name>` (`lib/plans/start.ts`) creates `plan/<name>`, a worktree and the first document there, writing nothing on the trunk. A plan per failing file, each with a worktree, is heavy for an automatic path; a draft brief is the lightest record that still has an owner.

### Suspects

`slow-runs.jsonl` records the last fully green run with its key. The commits between it and the failing run are the suspects: here `7d3d0545` and `7df79000` among the 10-08 commits. The plan that owns a test is usually not the plan that broke it (promise-timeline's test was broken by the health move), so the suspects are what points the fix at the right code.

## Decisions

- **A release is a declared step of the workflow, and InDusk runs it** (Sandy, 2026-10-09): the order of publish and slow tests, and what "done" means, are stated in config, not buried in a shell chain.
- **Generic, not npm-only** (Sandy, 2026-10-09): the step works for any project that declares it; JUnit is the report format. Not a pipeline runner: no stages, caching or parallel jobs, which `act`, Dagger and Earthly already provide. InDusk's part is ordering the declared steps and routing failures to promises.
- **Config stays facts** (release-checks-run-once D5): a few named options (`when: before | after`, `done_when: published | green`), never a list of conditional steps.
- **The slow run happens in the same command, in the foreground** (Sandy, 2026-10-09): `indusk release` keeps going after the publish and ends by printing what it recorded.
- **One rerun of the failing files before recording** (Sandy, 2026-10-09): a file green on the rerun is a flake on the release record, not an incident or a plan.
- **Today's three regressions are fixed before 1.69.0 publishes** (Sandy, 2026-10-09), as their own small bugfix, outside this plan.
- **Release only** (Sandy, 2026-10-09): landing's slow tests after the merge use the same declaration in a follow-up.

## Open Questions

- Where a row-without-promise and an orphan failure go: one draft bugfix brief per test file, reused while open, is the current shape; a single "release findings" plan per release is the alternative.
- The incident's evidence shape for a test: test file and name, release version, commit; and its source word (a new `release`, or `local` with the release named).
- `done_when: green` with `when: after`: is the release "not done" while the slow run is red, and what reads that?
- A backfill of `For` and `Test` cells over archived plans' rows would move failures from case 2 or 3 to case 1. It is a separate plan.
- `record-release.js` writes `.indusk/current.md` after a publish. Does `indusk release` take that over for every project, or stay dusk's script?

## Sources

- `apps/indusk-mcp/package.json` — the `release` script.
- `lib/checks/steps.ts`, `lib/checks/key.ts`, `lib/checks/record.ts`, `bin/commands/checks.ts`.
- `lib/promises/incidents.ts`, `lib/promises/vocabulary.ts`, `lib/promises/reopen.ts`, `lib/plans/start.ts`.
- `.indusk/planning/known-issues.md`, Releases.
- `.indusk/planning/archive/release-checks-run-once/`, `/decisions/dawn-verify`.
- The 1.69.0 `pnpm release` output, 2026-10-09.
