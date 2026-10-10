---
title: "release-records-its-failures"
date: 2026-10-10
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# release-records-its-failures

## Goal

`indusk release` runs a project's declared release in its declared order, and what the slow tests find becomes incidents on the promises their rows name, or draft bugfix plans, instead of a stopped release. dusk declares its slow tests `after`.

## Scope

### In Scope
- `workflow.steps.release.slow_tests` (`command`, `report`, `when`, `rerun`) and `release.done_when`, validated as facts; printed by `checks show`.
- `indusk release`: order, outcome, exit, the release record, the green run's commit.
- The JUnit reader (`fast-xml-parser`), one rerun by file, flakes, the environment rule.
- Routing through trajectory rows; test-born incidents (source `release`); draft bugfix plans on their own branch; suspects.
- dusk's declaration: the release script, the JUnit reporters, the config, the changed `dusk-installs-its-own-build`.

### Out of Scope
- Slow tests after landing (the follow-up).
- Backfilling `For` and `Test` cells in archived rows.
- Reports from an outside CI.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `release-*.test.ts` over the CLI and fixture projects, all red; A8 and A18 red over dusk's own files | `helpers/cli.ts`, `helpers/git-tmp-project.ts`, `helpers/plan-fixture.ts` |
| Build Phase 1 | `lib/checks/steps.ts` facts; `lib/release/run.ts` (`runRelease(deps)`); `lib/release/record.ts` (`releases.jsonl`); `GreenRun.sha`; `indusk release` | `lib/checks/record.ts`, `lib/checks/key.ts` |
| Build Phase 2 | `lib/release/junit.ts` (`failedFiles(globs, root)`); rerun and flakes; the environment rule | Build Phase 1's runner |
| Build Phase 3 | `lib/release/route.ts` (`routeFailure`); `recordTestFailure` in `lib/promises/incidents.ts`; `release` in `INCIDENT_SOURCES`; suspects | `lib/trajectory/parser.ts`, `lib/promises/reopen.ts`, `ensurePromiseCarries` |
| Build Phase 4 | `lib/release/bugfix-plan.ts` (`openOrExtendBugfixPlan`) | `lib/plans/start.ts` (`startPlan`) |
| Build Phase 5 | dusk's release script, three `vitest.system.config.ts` reporters, `.indusk/config.json`'s block; `dusk-installs-its-own-build` changed | all of the above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | With slow tests declared `after`, the release command runs first and the slow tests second; when the slow tests go red, the release still reports itself done under `done_when: published` and lists what it recorded | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-release-runs-as-its-project-declares | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A2 | With slow tests declared `before`, a red slow run stops the release before its command runs, the release reports not published, and the failures are still recorded | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-release-runs-as-its-project-declares | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A3 | With `done_when: green` and slow tests `after`, a red slow run reports the release published but not done, naming the open failures | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-release-runs-as-its-project-declares | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A4 | A release command that fails reports the release not published and runs no slow tests after it | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-release-runs-as-its-project-declares | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A5 | A project that declares no release says so and runs nothing | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-release-runs-as-its-project-declares | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A6 | The tests recorded as failing are exactly the ones the declared JUnit report marks failed, whatever the command printed, and a report spread over several files (one per package) is read as one | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A7 | A red run whose report is missing or unreadable reports "the slow tests failed" with no test named, and opens no incident and no plan | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A8 | dusk's slow tests, run with its declared reporter, write a JUnit report whose failed cases name the test files that failed | Test Phase 1 | Build Phase 5 | passing | contract | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-junit.contract.test.ts |
| A9 | A file that fails and then passes on its rerun appears on the release's record as a flake and opens nothing | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-flake-opens-nothing | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A10 | Only the failing files are run again, and only once; a file still failing after its rerun is recorded as failing | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-flake-opens-nothing | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A11 | A failing file named by a row whose `For` names a promise opens an incident on that promise, naming the test, the release version and the commits since the last green slow run | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-failing-slow-test-breaks-its-promise | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A12 | The same file failing in a later release adds to the open incident rather than opening a second | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-failing-slow-test-breaks-its-promise | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A13 | The incident reopens the promise's owning plan with its Maintenance phase and names the rows that were proving it, as an incident from a watcher does | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-failing-slow-test-breaks-its-promise, promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A14 | The incident shows in `promises status` and `promise_health` with its age, ahead of the roadmap, as any open incident does | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-failing-slow-test-breaks-its-promise, promise: an-open-incident-stays-loud | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A15 | A failing file no row names opens one draft bugfix plan whose brief names the file, the failing tests, the release and the commits since the last green slow run | Test Phase 1 | Build Phase 4 | passing | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A16 | A failing file named by a row with no promise opens a draft bugfix plan that also names the plan and row that were testing it | Test Phase 1 | Build Phase 4 | passing | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A17 | The same file failing in a later release while its bugfix plan is open adds to that plan rather than opening another | Test Phase 1 | Build Phase 4 | passing | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A18 | dusk's release command no longer runs the slow tests before publishing, and dusk's config declares them `after` with a JUnit report | Test Phase 1 | Build Phase 5 | passing | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/__tests__/release-dusk-declaration.test.ts |
| A20 | A release whose slow run a green run already covered skips it, as before | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A21 | A non-npm release command declared by a fixture project (a shell command writing a file) is the command that runs | Test Phase 1 | Build Phase 1 | passing | unit | promise: landing-and-release-name-the-projects-commands | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A22 | A run where more than half the slow test files failed opens no incident and no plan, and the release says the environment failed, naming how many files failed | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-failing-slow-test-breaks-its-promise, promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A23 | An incident a release opens is committed on the trunk and appears in the project's break inbox, so a running agent hears it on its next prompt, as an incident the admin records does | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-break-reaches-the-working-agent | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A24 | A JUnit report left from an earlier run is not read: a red slow run that writes no new report, beside an old report naming failures, says "the slow tests failed", names no test and opens nothing; and a fresh report from one package is not mixed with another package's stale one | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A25 | When routing a failure throws after the publish (the incidents directory cannot be written), the release still prints its outcome — published, done or not — still appends its `releases.jsonl` line, and says what could not be routed and why | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-release-runs-as-its-project-declares | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A26 | Two unclaimed failing files with the same file name in different directories open two bugfix plans, each naming only its own file; neither failure is appended to the other's plan | Build Phase 6 | Build Phase 6 | passing | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A27 | A file failing again after its earlier bugfix plan was archived opens a new plan under a name the archive does not hold, whose brief names the archived plan it follows | Build Phase 6 | Build Phase 6 | passing | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A28 | A failing file whose path holds a space or a shell metacharacter reaches the rerun command as one argument, unchanged, and nothing else is run | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-flake-opens-nothing | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A29 | A failing file that the rerun did not run — absent from the rerun's report — stays failing and is routed, and is never listed as a flake; only a file the rerun's report shows with every case passing is a flake | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-flake-opens-nothing | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A30 | An unclaimed failing file whose `fix-<stem>` name is held by a plan folder on the trunk with no worktree, or by a leftover `plan/fix-<stem>` branch, opens a plan under the next free name instead of staying unrouted | Build Phase 8 | Build Phase 8 | passing | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |

### Deferred Verification

- **A19 — a real dusk release through `indusk release`**
  - reason: a publish runs only from `main` at a release commit (`release-guard.sh` refuses a plan branch), so it cannot happen before this plan lands
  - would require: the plan landed and a `chore(release):` commit on `main`
  - mitigation: the retrospective's Step 11 runs the first release with `indusk release` and records its output and its `releases.jsonl` line in the archived retrospective; a failure there is recorded by the very routing this plan builds

## Checklist

### Test Phase 1: Every row red, over the CLI and fixture projects

**Tier**: med

**Goal**: author every row against `indusk release` and dusk's own files; each fails on its own assertion today, because the command and the declarations do not exist.

- [x] Create/confirm this plan's worktree (created by `indusk plans start`; confirm `git worktree list` shows `plan/release-records-its-failures`)
- [x] A fixture helper, `src/__tests__/helpers/release-fixture.ts`: a temp git project (`git-tmp-project.ts`) with `.indusk/config.json` declaring `workflow.steps.release` as each test needs; release and slow commands are small shell commands that append to an `order.log`, write a given JUnit XML to the report path, and exit as told (a counter file makes "fail first, pass on rerun" possible); plan folders with impls whose trajectory rows name test files with and without promises; `INDUSK_HOME` pinned to a temp dir (as `runCli` does)
- [x] A1–A5, A20, A21 in `release-run.test.ts`, over `runCli(["release"])`; the file carries `promise: a-release-runs-as-its-project-declares` and the tokens of the two promises its guards name
- [x] A6, A7, A9, A10, A22 in `release-report.test.ts`; JUnit fixtures written in vitest's shape (`<testsuite name="<file>">` with `<testcase classname="<file>">` and `<failure>`)
- [x] A11–A14 in `release-incident.test.ts`: a fixture promise owned by a fixture plan whose row names the failing file; asserts read the incidents directory, the owner's impl (Maintenance phase) and `runCli(["promises", "status"])`
- [x] A15–A17 in `release-bugfix-plan.test.ts`: asserts read `git branch` and the started plan's brief in its worktree
- [x] A8 in `release-junit.contract.test.ts`, added to `vitest.tiers.ts` `SYSTEM`: runs vitest with dusk's declared system config on a fixture test that fails, and reads the report at the declared path
- [x] A18 in `release-dusk-declaration.test.ts`: reads `apps/indusk-mcp/package.json`'s `release` script and `.indusk/config.json`'s `release` block
- [x] Run each file and confirm every row fails on its own assertion (an unknown `release` command's exit and output, a missing report, a script that still names `test:system`), never on a load error; set each row `written`
- [x] Shape (`apps/indusk-mcp/src/__tests__/helpers/release-fixture.ts`) — extract the release declaration out of releaseProject into declaredRelease(opts); releaseProject was building the config block and the handle in one body. Rule: Shape intra-unit: does this unit have one reason to change? A block doing two jobs wants to be two named things

#### Test Phase 1 Verification

- [x] A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A20, A21, A22 are `written` and red on their own assertion: `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-run.test.ts src/__tests__/release-report.test.ts src/__tests__/release-incident.test.ts src/__tests__/release-bugfix-plan.test.ts src/__tests__/release-dusk-declaration.test.ts` and `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/release-junit.contract.test.ts`, with each file's failing count recorded here
  - Recorded 2026-10-10, every row red on its own assertion (no load error): `release-run.test.ts` 7 failed of 7 (A1-A5, A20, A21: `indusk release` is an unknown command, so no order log, no lines, no record; A5 reads `unknown command 'release'` where `no release declared` is asserted); `release-report.test.ts` 7 of 7 (A6, A7 twice, A9, A10, A22 twice: no `failing:`/`flaky:`/environment line, no record); `release-incident.test.ts` 4 of 4 (A11-A14: no incident file written); `release-bugfix-plan.test.ts` 3 of 3 (A15-A17: no `plan/fix-*` branch); `release-dusk-declaration.test.ts` 2 of 2 (A18: the release script still names `test:system`; config declares no `slow_tests`); `release-junit.contract.test.ts` (system config) 1 of 1 (A8: `vitest.system.config.ts` declares no junit reporter; with a reporter added temporarily the same test passed, then reverted)

### Build Phase 1: The declaration and the runner

**Tier**: med

- [x] `lib/checks/steps.ts`: `release.slow_tests` (`command`, `report`, `when: "before" | "after"`, optional `rerun` containing `{files}`) and `release.done_when: "published" | "green"`, each validated as a fact with a message naming the key; `lib/config.ts`'s `WorkflowSteps` type gains them
- [x] `indusk checks show` prints the slow tests, their `when`, the report and `done_when` under Release
- [x] `lib/release/run.ts`: `runRelease(deps)` — deps are `exec(command, cwd) → {code}`, `now()`, the steps, the covering-run lookup — returning `{ published, done, slow: { ran, green, skipped }, recorded }`; order per ADR D1, outcome per D3
- [x] `lib/release/record.ts`: append one line per release to `<home>/releases.jsonl` (version from `version_file`, commit, at, published, done, slow result, routed failures, flakes)
- [x] `lib/checks/record.ts`: `GreenRun` gains `sha`, written by `checks slow` and by the release's green slow run
- [x] `bin/commands/release.ts` + `cli.ts`: `indusk release` runs it from the project root, prints the order and the outcome, exits 0 when done
- [x] Shape (`apps/indusk-mcp/src/lib/release/run.ts`) — reviewed, left as-is: runSlow reads as skip-if-covered, run, record-if-green, settle-if-red, one ordered decision whose seams are already the injected deps (codeKey, coveringRun, recordGreen, settleFailures); splitting it would only thread the outcome through helpers
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] A1, A2, A3, A4, A5, A20, A21 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-run.test.ts && pnpm exec vitest related src/lib/checks/steps.ts src/lib/checks/record.ts src/lib/release/run.ts src/lib/release/record.ts`)
  - Recorded 2026-10-10: `release-run.test.ts` 7 passed of 7 (A1-A5, A20, A21); `vitest related` over steps.ts, record.ts, run.ts, release/record.ts 59 passed in 6 files; `pnpm exec tsc --noEmit` clean; biome clean on the changed files

#### Build Phase 1 Context

- [x] root (Key Decisions): `- Release as a declared step: \`indusk release\` runs \`workflow.steps.release\` — slow tests before or after, \`done_when\` — and routes failures from JUnit to incidents or bugfix plans — see \`/decisions/release-records-its-failures\`` — always-on because Key Decisions is the root's index of every ADR
- [x] `apps/indusk-mcp/CLAUDE.md`: a `lib/release/` entry — the runner takes its commands, clock and reads as inputs; order and completion are declared facts, never logic

#### Build Phase 1 Document

- [x] New `apps/docs/src/reference/cli/release.md` (order, outcome, exit, the record) with the ADR's Mermaid flowchart; sidebar entry; `reference/cli/checks.md` gains the new keys

### Build Phase 2: The report, the rerun, the environment

**Tier**: med

- [x] Add `fast-xml-parser` to indusk-mcp's dependencies
- [x] `lib/release/junit.ts`: `failedFiles(reportGlobs, root)` → `{ readable, files: Map<file, testNames[]> }`, a testcase's file by `file`, else `classname`, else its suite's `file` or `name`, normalised repo-relative (ADR D4)
- [x] Rerun per ADR D5: the failing files substituted into `rerun`'s `{files}`, run once; green-on-rerun files are flakes on the record
- [x] The environment rule: when more than half the report's test files failed, open nothing and record one environment failure naming the count (A22)

- [x] Shape (`apps/indusk-mcp/src/lib/release/junit.ts`) — extract the empty unreadable result into UNREADABLE(); failedFiles returned the same literal at three exits. Rule: Shape intra-unit: a repeated literal is a missing name

#### Build Phase 2 Verification

- [x] A6, A7, A9, A10, A22 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-report.test.ts && pnpm exec vitest related src/lib/release/junit.ts src/lib/release/run.ts`)
  - Recorded 2026-10-10: `release-report.test.ts` + `release-run.test.ts` 14 passed of 14 (A6, A7, A9, A10, A22 and A1-A5, A20, A21 still green); `vitest related` finds no unit test (the files are exercised through the CLI tests above); `pnpm exec tsc --noEmit` clean; biome clean on the changed files

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/CLAUDE.md`, the `lib/release/` entry: failures are read from the declared JUnit report, never the runner's output — `lesson:` token if a guard is written for it, else the rule and `/decisions/dawn-verify`

#### Build Phase 2 Document

- [x] `reference/cli/release.md`: the report, the rerun, flakes and the environment rule

### Build Phase 3: Routing and the test-born incident

**Tier**: strong — changes the incident file's shape, which every reader of incidents (catchup, `promise_health`, `promises status`, the admin, the editor) parses

- [x] `lib/release/route.ts`: `routeFailure(root, file)` reads every impl, active and archived, through `parseTrajectory` and returns the promises the rows naming `file` name, and those rows (ADR D6)
- [x] `lib/promises/vocabulary.ts`: `INCIDENT_SOURCES` gains `release`; `check.ts` accepts it
- [x] `lib/promises/incidents.ts`: `recordTestFailure(registry, promise, failure)` writes `tests:` and `release:` evidence and the suspects, or extends the promise's open incident; through `ensurePromiseCarries` and `reopen.ts` (ADR D7). Every incident reader tolerates an incident with `tests:` and no `traces:` — grep the readers (`recorded`, `violationState`, `health.ts`, `status.ts`, the admin's `IncidentsTable.tsx`, the editor's health line) and add a case for each that reads `traces:`
- [x] Suspects: `git log <green sha>..HEAD -- <covers>`; none, said so, when the green run has no `sha` (ADR D9)
- [x] Shape (`apps/indusk-mcp/src/lib/release/settle.ts`) — extract the claim collection out of routeFailures into claimsOf(root, failed, promises); routeFailures was reading every failing file's rows and recording incidents in one body. Rule: Shape intra-unit: does this unit have one reason to change? A block doing two jobs wants to be two named things

#### Build Phase 3 Verification

- [x] A11, A12, A13, A14 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-incident.test.ts && pnpm exec vitest related src/lib/promises/incidents.ts src/lib/promises/vocabulary.ts src/lib/release/route.ts`), and the admin's incident tests still pass (`cd apps/indusk-admin && pnpm exec vitest related src/components/IncidentsTable.tsx`)
  - Recorded 2026-10-10: `release-incident.test.ts` 4 passed of 4 (A11-A14); with `release-run.test.ts` and `release-report.test.ts` 18 passed of 18 (A1-A7, A9, A10, A20-A22 still green); the new reader unit test `lib/promises/test-born-incident.test.ts` 4 of 4 (check, registry read, `recorded`/`violationState`, open-incident age and line); `vitest related` over every changed indusk-mcp file 530 passed, 6 failed, none from this phase: A15-A17 (`release-bugfix-plan.test.ts`, Build Phase 4's rows, red as planned), `context-tiers-register.test.ts` A13 (root CLAUDE.md 14886 bytes against a 14745 ceiling, untouched here) and two in `lib/promises/inbox.test.ts` (red with this phase's promises files reverted too); admin `vitest related IncidentsTable.tsx` 15 passed in 3 files; `tsc --noEmit` clean in indusk-mcp, indusk-admin, vscode-extension; biome clean on the changed files; `indusk promises check` clean (72 promises, 3 incidents)

#### Build Phase 3 Context

- [x] `apps/indusk-mcp/CLAUDE.md`, the incidents rule: an incident's evidence is `traces:` (a watcher's) or `tests:` + `release:` (a release's); a reader of incidents handles both

#### Build Phase 3 Document

- [x] `reference/cli/release.md`: routing and the test-born incident; the promises reference page names the `release` source

### Build Phase 4: The bugfix plan for an unclaimed failure

**Tier**: med

- [x] `lib/release/bugfix-plan.ts`: `openOrExtendBugfixPlan(root, failure)` — `fix-<test-file-stem>` through `startPlan("bugfix", …)`, its brief written `status: draft` with the failing tests, the release, the suspects, and for a promise-less row the plan and row; an open plan of that name gets the failure appended to its research instead (ADR D8)
- [x] The runner sends unclaimed failures there and lists each opened or extended plan in its output and on the record
- [x] A23 (Sandy, 2026-10-10: "Yes, same as the recorder"): an incident a release opens or extends is committed on the trunk through the recorder's commit path (`lib/promises/record-commit.ts`) and appended to the break inbox (`appendInbox`, `lib/promises/inbox.ts`), as `recordBreaks` does; author A23 red in `release-incident.test.ts` first
- [x] Root `CLAUDE.md` back under its budget (Build Phase 1's Key Decisions line pushed it to 14,886 bytes against 14,745; `context-tiers-register.test.ts` A13 fails): move one root entry that applies to one area down to that area's `CLAUDE.md`, per `lesson: a-claude-md-past-its-budget-holds-a-rule-that-belongs-lower` — never trim another entry's words to fit
- [x] Shape (`apps/indusk-mcp/src/lib/release/settle.ts`) — extract the unclaimed-file loop out of routeFailures into routeUnclaimed; routeFailures was routing incidents and opening bugfix plans in one body. Rule: Shape intra-unit: does this unit have one reason to change? A block doing two jobs wants to be two named things

#### Build Phase 4 Verification

- [x] A23 passes, and `context-tiers-register.test.ts` passes again (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/release-incident.test.ts src/__tests__/context-tiers-register.test.ts`)
  - Recorded 2026-10-10: `release-incident.test.ts` 5 passed of 5 (A11-A14, A23); `context-tiers-register.test.ts` 6 passed of 6 (root CLAUDE.md 14687 bytes against 14745)
- [x] A15, A16, A17 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-bugfix-plan.test.ts && pnpm exec vitest related src/lib/release/bugfix-plan.ts`)
  - Recorded 2026-10-10: `release-bugfix-plan.test.ts` 3 passed of 3 (A15-A17); all `release-*.test.ts` everyday files 45 passed, 2 failed, both `release-dusk-declaration.test.ts` A18 (Build Phase 5's row, red as planned); `vitest related` over the changed lib files 132 passed, 2 failed, both in `lib/promises/inbox.test.ts` (red before this phase, as Build Phase 3 recorded); `tsc --noEmit` clean; biome clean on the changed files (one existing unused import in `lib/promises/store.ts`, not touched here); `indusk promises check` clean (72 promises, 3 incidents)

#### Build Phase 4 Context

- [x] `apps/indusk-mcp/CLAUDE.md`, the `lib/release/` entry: an unclaimed failure is a draft bugfix plan on its own branch, reused by name while open — never a brief written on the trunk
  - Refused 2026-10-10 by `claude-md-budget.js`: the file is 17083 bytes against its 16384 nested budget and the sentence grows it; needs room made in that file first
  - Done 2026-10-10 a tier lower: the `lib/release/` rules (this one included) moved into a new `apps/indusk-mcp/src/lib/release/CLAUDE.md`, and the three `lib/promises/`-only entries (the registry subpath, incident ids and evidence, `recordBreaks` commits on a trunk) into a new `src/lib/promises/CLAUDE.md`, per `lesson: a-claude-md-past-its-budget-holds-a-rule-that-belongs-lower`; the package file is 16,196 bytes, under budget; `context-tiers-register.test.ts` 6/6 and `indusk context check-pointers` pass

#### Build Phase 4 Document

- [x] `reference/cli/release.md`: the bugfix plan, its name and its reuse

### Build Phase 5: dusk declares its own release

**Tier**: med

- [x] `apps/indusk-mcp/package.json`: the `release` script loses `pnpm -w test:system &&`
  - Discovered: `release-script.test.ts` A3 (publish-hygiene) pinned the exact step list including `pnpm -w test:system`; the one entry and its comment were removed from that expectation, nothing else weakened.
- [x] Each `vitest.system.config.ts` (indusk-mcp, indusk-admin, vscode-extension) adds the `junit` reporter writing `test-results/system.junit.xml` beside the default reporter; `test-results/` is gitignored
  - Done 2026-10-10: `reporters: ["default", "junit"]` and `outputFile: { junit: "test-results/system.junit.xml" }` at the top level of each config's test options; root `.gitignore` carries `test-results/`
- [x] `.indusk/config.json`: the ADR D2 block under `workflow.steps.release`, with `rerun` passing the files through `pnpm -w test:system -- --passWithNoTests {files}` (confirm that form reruns only those files in each package)
  - Verified 2026-10-10 that the suggested form does NOT work: root `test:system` is `sh -c '...'` that never reads its arguments (pnpm appends them as `$0`/`$1`; a toy script of the same shape printed them as unread positionals), so `-- --passWithNoTests {files}` would rerun every file. Declared instead `rerun: node apps/indusk-mcp/scripts/rerun-system.js {files}`: groups repo-relative files by `apps/<dir>/`, runs each package's `vitest run --config vitest.system.config.ts <package-relative files>` behind the daemon guard (no package build), skips packages with no failing file, exits non-zero if a rerun does. Run with `apps/indusk-mcp/src/__tests__/release-junit.contract.test.ts`: only that file ran (1 test), 1.2 s wall, `test-results/system.junit.xml` rewritten with just it
- [x] Discovered: vitest writes JUnit file names relative to the package it ran in (`src/__tests__/x.test.ts`), and `lib/release/junit.ts` read them as repo-relative, so a real report's failing file would match no trajectory row. `junit.ts` now resolves a relative name that is no file at the repo root against the directories above the report (`apps/<dir>/` for `apps/<dir>/test-results/*.xml`); a name that is a file nowhere stays as written (the Phase 2 fixtures). Unit test: `src/lib/release/junit.test.ts` (2), `release-report.test.ts` still 7 of 7
- [x] `indusk promises change dusk-installs-its-own-build --plan release-records-its-failures --statement "After a plan lands, this machine's \`indusk\` is the landed build, installed from the checkout without a publish; publishing is a deliberate act whose slow tests run after it, and what they find is recorded." --reason "the release no longer waits on its slow tests (release-records-its-failures)"`
- [x] Shape — reviewed `lib/release/junit.ts` (the new `underReport` is one named step, report-relative name to repo-relative, called at the one place a name is read) and `scripts/rerun-system.js` (group by package, run each, one job); nothing to change.

#### Build Phase 5 Verification

- [x] A8 and A18 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-dusk-declaration.test.ts && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/release-junit.contract.test.ts`); `indusk checks show` prints the declared release
  - Recorded 2026-10-10: A18 2 passed of 2; A8 1 passed of 1 (system config); `checks show` Release section: `command: pnpm release`, `release slow tests: pnpm -w test:system  (run after the command by indusk release; report apps/*/test-results/system.junit.xml; rerun node apps/indusk-mcp/scripts/rerun-system.js {files})`, `done when: published`; all `release-*.test.ts` everyday files plus `lib/release` 43 tests, all passing after the `release-script.test.ts` A3 expectation changed; `tsc --noEmit` clean; biome clean on the changed files (one existing template-string warning in `release-script.test.ts`, not touched); `indusk promises check` clean (72 promises, 3 incidents)

#### Build Phase 5 Context

- [x] root (Conventions), the "Landing installs, publishing is deliberate" line: a publish is `indusk release`, whose slow tests run after it and record what they find — always-on because every session that might publish reads it
  - Done 2026-10-10: the sentence now reads `(`indusk release`: slow tests after, failures recorded)`; root 14,694 bytes (was 14,687, ceiling 14,745); `context-tiers-register.test.ts` 6/6

#### Build Phase 5 Document

- [x] `reference/skills/retrospective.md` and the retrospective skill's Step 11: the release is `indusk release`; changelog `### Added` entry under `## [Unreleased]`

### Build Phase 6: Falsification — stale reports, a throw after publish, and plan names that collide

**Tier**: med

**Goal**: verify whether the attested state holds against five ways a real release goes wrong that no row covers: a report left from an earlier run read as this run's (A24), a routing error after the publish that loses the outcome and the record (A25), two test files with one name sharing a bugfix plan (A26), a recurring failure colliding with its archived fix plan (A27), and an unquoted file list in the rerun command (A28). Each row is one hypothesis; each item the fix it needs.

**Read, not run (A24):** `settleFromReport` reads every file the `report` glob matches (`junit.ts` `failedFiles`), and nothing removes or dates them. dusk's reports are gitignored files that persist between runs. A slow run that dies before a package writes its report (`test:system` runs `prepublishOnly` first; a crash, a killed run) leaves that package's report from the last run — its failures are routed as this release's: incidents opened and committed, plans started, for tests that may be green now. The environment rule's denominator mixes the two runs too.

**Read, not run (A25):** `releaseCommand` awaits `routeFailures` with no `try`, and only then appends `releases.jsonl` and prints the outcome. `recordTestFailure` writes into `.indusk/promises/incidents/` and `ownerReopener` reads the worktree record; an exception from either (a permission error, a malformed incident file) after a successful publish ends the command with a stack trace: no "release published", no record line — the brief's first expectation counts records that were never written.

**Read, not run (A26):** `bugfixPlanName` keeps only the file's basename. dusk tracks several test files sharing one (`config.test.ts`, `registry.test.ts`, `session.test.ts`, `skip.test.ts` and more, across and within packages). Two such files failing open one `fix-skip` plan; the second is appended to the first's research as if it "failed again", and a later release routes either file's failure there.

**Read, not run (A27):** `startPlan` refuses an open worktree, a trunk folder and an existing branch, but not `archive/<plan>`. A file whose `fix-<stem>` plan landed and is archived starts a second `fix-<stem>`, whose own archival at close collides with the first's folder; and its brief says nothing of the earlier fix, though "it broke again after a fix" is the most useful fact a person could read.

**Read, not run (A28):** `settleFromReport` substitutes `names.join(" ")` into `rerun`, a shell command. A file name with a space splits into two arguments; one with `;`, `$(` or a backtick runs what follows. Test names come from the report the slow command wrote, so this is correctness rather than escalation, but a rerun of the wrong files reports wrong flakes.

**Not investigated further, and why:** the order and outcome rules in `runRelease` (A1–A5 cover every branch of `when` and `done_when`, and the covering-run skip re-checks the key before recording); `routeFailure` (it reads every impl through the shared parser and names unreadable ones); the suspects range (a non-ancestor green `sha` lists more commits than it should, never fewer, and `--no-ff` landings keep the sha an ancestor); `before`-mode incidents committed ahead of a publish moving HEAD off dusk's release commit (dusk declares `after`; the guard is dusk's, not the release step's); the environment rule applied per package report rather than over the whole run (it would change the sentences of `a-failing-slow-test-breaks-its-promise` and `an-unclaimed-failure-opens-a-bugfix-plan`, so it is Sandy's call, raised separately).

- [x] `lib/release/run.ts` + `settle.ts`: the slow run's start time is passed to settling, and `failedFiles` reads only report files modified at or after it; a red run whose reports are all older reads as "no readable report" (A24). Never delete files the glob matches: a broad glob would delete a project's own files
- [x] `bin/commands/release.ts`: routing runs inside a `try`; the release record is appended and the outcome printed whether routing succeeded or threw, and a throw is reported as `no failure routed: <reason>` and recorded on the release line (`routing: "<reason>"`) (A25)
- [x] `lib/release/bugfix-plan.ts`: a name already used by an open plan for a different file, or by an archived plan, takes the next free name — `fix-<stem>-<parent dir>` for a different file, `fix-<stem>-2`, `-3`, … after an archived one — and the brief names the plan it would have collided with (`follows archive/fix-<stem>`) (A26, A27); the name for a unique, never-fixed file stays `fix-<stem>`, as A15 asserts
- [x] `lib/release/settle.ts`: each file is shell-quoted (single quotes, embedded quotes escaped) before substitution into `{files}` (A28)

- [x] Shape (`apps/indusk-mcp/src/bin/commands/release.ts`) — extract routeWithoutLosingTheRelease out of releaseCommand; the A25 fix left a try/catch building a fallback `Routed` inline in the command that prints and records. Rule: Shape intra-unit: a block doing two jobs wants to be two named things
- [x] Shape (`apps/indusk-mcp/src/lib/release/bugfix-plan.ts`) — reviewed, left as-is: chooseName is one loop over candidate names with three outcomes (extend, follow an archive, take the free name); splitting it would only thread the candidate state through helpers

#### Build Phase 6 Verification

- [x] A24, A25, A26, A27, A28 pass, and every earlier row still does (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-run.test.ts src/__tests__/release-report.test.ts src/__tests__/release-incident.test.ts src/__tests__/release-bugfix-plan.test.ts src/__tests__/release-dusk-declaration.test.ts src/lib/release/junit.test.ts && pnpm exec vitest related src/lib/release/run.ts src/lib/release/settle.ts src/lib/release/junit.ts src/lib/release/bugfix-plan.ts src/bin/commands/release.ts`)
  - Recorded 2026-10-10: A24–A28 each red on its own assertion at the test commit (a stale report's `failing:` line read; the second skip file appended to `plan/fix-skip`; the archived name reused; a rerun argument split at the space and `;`; an EACCES stack trace with no outcome and no record), now green: the six files named (`release-run`, `-report`, `-incident`, `-bugfix-plan`, `-dusk-declaration`, `junit.test.ts`) 32 passed of 32; every `release-*.test.ts` 47 passed of 47 in 8 files; `vitest related` over the five changed sources 2 passed; `pnpm exec tsc --noEmit` clean; biome clean on the changed files (one existing warning in `release-script.test.ts`); `indusk promises check` exit 0

#### Build Phase 6 Context

- [x] `apps/indusk-mcp/src/lib/release/CLAUDE.md`: a report older than the slow run is not this run's and is never read; files from a report reach a shell only quoted; a bugfix plan's name never collides with an open or archived one

#### Build Phase 6 Document

- [x] `apps/docs/src/reference/cli/release.md`: stale reports are ignored, routing errors are reported without losing the record, and how a bugfix plan is named when its first name is taken

### Build Phase 7: Cleanup — routing in one module, the release's incident in its own

**Tier**: med

**Goal**: decompose the two files where this plan's phases each added a second job, per one-reason-to-change at the module boundary: `settle.ts` reads the report *and* routes failures, and `promises/incidents.ts` writes a watcher's incidents *and* a release's. Each item is a move with behaviour held by the existing rows; every other changed file is recorded as reviewed.

**Scan**: `listOversizedChangedFiles(<worktree>, "main")` flagged `bin/cli.ts` (1236), `lib/config.ts` (699), `lib/promises/registry.ts` (480), `lib/promises/incidents.ts` (432), `apps/docs/src/changelog.md`, `reference/cli/promises.md`, `reference/skills/retrospective.md`. Of the new files none is over the 400 cap; the largest are `settle.ts` (216) and `bugfix-plan.ts` (196). No domain extension (nextjs/react) applies: the plan's code is library and CLI.

- [x] Move routing out of `lib/release/settle.ts` into `lib/release/route.ts` — `routeFailures`, `routeUnclaimed`, `claimsOf`, `live` and the `RouteFacts` / `RoutedIncident` / `Routed` types join `routeFailure`, whose doc already reads "where a failing slow test goes"; `settle.ts` keeps `settleFromReport` (read, environment rule, rerun, flakes). Basis: Build Phase 2 wrote settling and Build Phase 3 added routing to the same file, so it has two reasons to change; the boundary between "what failed" and "where it goes" is now settled. Update `bin/commands/release.ts`'s imports; no export renamed
- [x] Move the release's incident out of `lib/promises/incidents.ts` into `lib/promises/test-incident.ts` — `TestFailure`, `Suspects`, `suspectsBlock`, `recordTestFailure` and their private helpers (`testItems`, `releaseItem`, `withSuspects`, `yamlList`), importing the shared pieces (`newIncidentId`, `ensurePromiseCarries`, `provenBy`, `oneLine`, `IncidentChange`) from `incidents.ts`. Basis: a watcher's trace incidents and a release's test incidents change for different reasons, and Build Phase 3 grew `incidents.ts` past its cap by 163 lines to hold the second. `lib/release/{route,suspects,bugfix-plan}.ts` and `test-born-incident.test.ts` import from the new module. The layering holds: `promises/` imports nothing from `release/`
- [x] (reviewed `git add` + `git commit -- <path>` in `bugfix-plan.ts` beside `plans/start.ts`, `plans/plan-branch.ts`, `plans/workbench-plan.ts`, `promises/record-commit.ts` — left as-is: four two-line copies, but each stages differently — one file, a filtered list, relative paths, paths under a home — so a shared helper would take a flag per caller; the plan added one copy, not the pattern)
- [x] (reviewed `bin/cli.ts`, `lib/config.ts`, `lib/promises/registry.ts` — left as-is: over their caps before this plan; it added a command registration (10 lines), the new config keys' types (16) and two optional incident fields (12), each in the file's existing shape)
- [x] (reviewed `bin/commands/release.ts` — left as-is: 167 lines, one command — run, route, record, print — and Build Phase 6's Shape already named its one inline block, `routeWithoutLosingTheRelease`)
- [x] (reviewed `lib/release/bugfix-plan.ts` — left as-is: one job, a draft bugfix plan opened or extended; its name choice, brief text and commit are private to it and change together; Build Phase 6's Shape kept `chooseName` as one loop on purpose)
- [x] (reviewed `lib/release/{run,junit,record,announce,suspects}.ts`, `scripts/rerun-system.js`, `lib/promises/watch.ts` — left as-is: each under 140 lines with one job; `watch.ts`'s `ownerReopener` was already made the one reopen path the release and `watch` share)
- [x] (reviewed the docs pages flagged by size — left as-is: a changelog and two reference pages; length is their nature)
- [x] Shape (`lib/release/route.ts`, `lib/promises/test-incident.ts`) — reviewed, left as-is: both are verbatim moves with one job each (route.ts 229 lines, test-incident.ts 168); `incidents.ts` fell from 432 to 288, under its cap

#### Build Phase 7 Verification

- [x] (no tests flip at this phase — reason: refactor) A11, A12, A13, A14, A15, A16, A17, A23, A25, A26, A27 still pass after both moves, and every other release row with them (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-run.test.ts src/__tests__/release-report.test.ts src/__tests__/release-incident.test.ts src/__tests__/release-bugfix-plan.test.ts src/__tests__/release-dusk-declaration.test.ts src/lib/release/junit.test.ts src/lib/promises/test-born-incident.test.ts && pnpm exec vitest related src/lib/promises/incidents.ts src/lib/promises/test-incident.ts src/lib/release/route.ts src/lib/release/settle.ts`); `tsc --noEmit` and biome clean; `indusk promises check` passes (the promise tokens move with the code)
  - 2026-10-10: the item's seven files, 7 files / 36 tests passed; `vitest related` over the four moved modules, 23 files, 133 passed and 2 failed — `src/lib/promises/inbox.test.ts` A17 (2 tests), which fails identically at `67b591b3`, before this phase, so it is not caused by the moves (recorded for the retrospective, not fixed here); `tsc --noEmit` clean in indusk-mcp and indusk-admin (dist rebuilt first); biome clean on the changed files (an unused `healthWindowMs` import elsewhere in `lib/promises` predates the phase); `indusk promises check` passes (72 promises, 3 incidents)

#### Build Phase 7 Context

- [x] `apps/indusk-mcp/src/lib/promises/CLAUDE.md` and `src/lib/release/CLAUDE.md`: a release's incident is written by `promises/test-incident.ts`; routing is `release/route.ts`, settling `release/settle.ts`

#### Build Phase 7 Document

- [x] `apps/docs/src/reference/cli/release.md`: where routing and the test-born incident live, if the page names modules; otherwise record here that it names none
  - 2026-10-10: the page names no source module (its only `.ts` mentions are example test files); nothing to update

### Build Phase 8: The audit's two fixes — a flake must pass, a taken name moves on

**Tier**: med

**Goal**: fix the two findings the audit (`audit.md`, a fresh reader on claude-opus-5-5) raised and Sandy chose to fix before closing (2026-10-10, "Fix both, then close"): `settleFromReport` counts a file as a flake when it is merely absent from the rerun's report, so a rerun that never ran it hides a real failure; and `chooseName` treats only an archived plan as taken, so a `fix-<stem>` folder on the trunk or a leftover branch makes `startPlan` refuse at every release.

- [x] `lib/release/junit.ts`: `failedFiles` also returns the files the report shows with no failed case (`passed: Set<string>`); `lib/release/settle.ts`: a file is a flake only when the rerun's report has it in `passed`; a file absent from the rerun's report stays failing (A29)
- [x] `lib/release/bugfix-plan.ts`: `chooseName` treats a name as taken when a plan folder of that name is on the trunk without an open worktree, or a `plan/<name>` branch exists, as it already does for an archived one, and takes the next free name, naming in the brief the plan it would have collided with (A30)

- [x] Shape (`apps/indusk-mcp/src/lib/release/bugfix-plan.ts`) — reviewed, left as-is: chooseName is one loop over a name's possible holders (open plan, archived, trunk or branch), each arm one outcome; the branch probe is its own named helper

#### Build Phase 8 Verification

- [x] A29 and A30 pass, and every earlier row still does (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-run.test.ts src/__tests__/release-report.test.ts src/__tests__/release-incident.test.ts src/__tests__/release-bugfix-plan.test.ts src/__tests__/release-dusk-declaration.test.ts src/lib/release/junit.test.ts src/lib/promises/test-born-incident.test.ts`)
  - Recorded 2026-10-10: A29 red at its test commit (the rerun report left out `src/seat-released.test.ts` and the release printed no `failing:` line for it: counted a flake), A30 red twice (`no bugfix plan opened — the branch plan/fix-orphan-flow already exists`, and the same for a trunk folder); now green: the seven files named 39 passed of 39; `pnpm exec tsc --noEmit` clean; biome clean on the changed files; `indusk promises check` exit 0. A9, A10 and A28 setups changed (not their assertions): their rerun report now carries the flaky file passing, since a flake must be shown passing

#### Build Phase 8 Context

- [x] `apps/indusk-mcp/src/lib/release/CLAUDE.md`: a flake is a file the rerun's report shows passing, never one it leaves out

#### Build Phase 8 Document

- [x] `apps/docs/src/reference/cli/release.md`: a flake must pass on its rerun; a file the rerun did not run stays failing; a plan name held on the trunk or by a branch moves to the next free one

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/checks/steps.ts`, `lib/config.ts`, `bin/commands/checks.ts` | the new facts, validated and shown |
| `apps/indusk-mcp/src/lib/release/{run,record,junit,route,bugfix-plan}.ts` | new |
| `apps/indusk-mcp/src/bin/commands/release.ts`, `bin/cli.ts` | `indusk release` |
| `apps/indusk-mcp/src/lib/checks/record.ts` | `GreenRun.sha` |
| `apps/indusk-mcp/src/lib/promises/{vocabulary,incidents,check}.ts` and incident readers | `release` source, `tests:` evidence |
| `apps/indusk-mcp/package.json`, three `vitest.system.config.ts`, `.indusk/config.json` | dusk's declaration |
| `apps/docs/src/reference/cli/release.md` (new), `checks.md`, `reference/skills/retrospective.md`, changelog | docs |

## Dependencies

- `fast-xml-parser` (new npm dependency of indusk-mcp).

## Notes

- Promises 4 and 5 were re-declared on 2026-10-10 to carry the ADR's environment rule; A22 asserts it.
- The tests reach `indusk release` through `runCli`, so the subjects are honest reds today (an unknown command) and no row defers into a later phase.
