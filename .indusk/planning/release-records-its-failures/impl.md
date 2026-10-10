---
title: "release-records-its-failures"
date: 2026-10-10
status: in-progress
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
| A6 | The tests recorded as failing are exactly the ones the declared JUnit report marks failed, whatever the command printed, and a report spread over several files (one per package) is read as one | Test Phase 1 | Build Phase 2 | written | unit | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A7 | A red run whose report is missing or unreadable reports "the slow tests failed" with no test named, and opens no incident and no plan | Test Phase 1 | Build Phase 2 | written | unit | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A8 | dusk's slow tests, run with its declared reporter, write a JUnit report whose failed cases name the test files that failed | Test Phase 1 | Build Phase 5 | written | contract | promise: a-failure-is-read-from-the-report | apps/indusk-mcp/src/__tests__/release-junit.contract.test.ts |
| A9 | A file that fails and then passes on its rerun appears on the release's record as a flake and opens nothing | Test Phase 1 | Build Phase 2 | written | unit | promise: a-flake-opens-nothing | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A10 | Only the failing files are run again, and only once; a file still failing after its rerun is recorded as failing | Test Phase 1 | Build Phase 2 | written | unit | promise: a-flake-opens-nothing | apps/indusk-mcp/src/__tests__/release-report.test.ts |
| A11 | A failing file named by a row whose `For` names a promise opens an incident on that promise, naming the test, the release version and the commits since the last green slow run | Test Phase 1 | Build Phase 3 | written | unit | promise: a-failing-slow-test-breaks-its-promise | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A12 | The same file failing in a later release adds to the open incident rather than opening a second | Test Phase 1 | Build Phase 3 | written | unit | promise: a-failing-slow-test-breaks-its-promise | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A13 | The incident reopens the promise's owning plan with its Maintenance phase and names the rows that were proving it, as an incident from a watcher does | Test Phase 1 | Build Phase 3 | written | unit | promise: a-failing-slow-test-breaks-its-promise, promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A14 | The incident shows in `promises status` and `promise_health` with its age, ahead of the roadmap, as any open incident does | Test Phase 1 | Build Phase 3 | written | unit | promise: a-failing-slow-test-breaks-its-promise, promise: an-open-incident-stays-loud | apps/indusk-mcp/src/__tests__/release-incident.test.ts |
| A15 | A failing file no row names opens one draft bugfix plan whose brief names the file, the failing tests, the release and the commits since the last green slow run | Test Phase 1 | Build Phase 4 | written | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A16 | A failing file named by a row with no promise opens a draft bugfix plan that also names the plan and row that were testing it | Test Phase 1 | Build Phase 4 | written | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A17 | The same file failing in a later release while its bugfix plan is open adds to that plan rather than opening another | Test Phase 1 | Build Phase 4 | written | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts |
| A18 | dusk's release command no longer runs the slow tests before publishing, and dusk's config declares them `after` with a JUnit report | Test Phase 1 | Build Phase 5 | written | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/__tests__/release-dusk-declaration.test.ts |
| A20 | A release whose slow run a green run already covered skips it, as before | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A21 | A non-npm release command declared by a fixture project (a shell command writing a file) is the command that runs | Test Phase 1 | Build Phase 1 | passing | unit | promise: landing-and-release-name-the-projects-commands | apps/indusk-mcp/src/__tests__/release-run.test.ts |
| A22 | A run where more than half the slow test files failed opens no incident and no plan, and the release says the environment failed, naming how many files failed | Test Phase 1 | Build Phase 2 | written | unit | promise: a-failing-slow-test-breaks-its-promise, promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/__tests__/release-report.test.ts |

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
- [ ] `apps/indusk-mcp/CLAUDE.md`: a `lib/release/` entry — the runner takes its commands, clock and reads as inputs; order and completion are declared facts, never logic

#### Build Phase 1 Document

- [ ] New `apps/docs/src/reference/cli/release.md` (order, outcome, exit, the record) with the ADR's Mermaid flowchart; sidebar entry; `reference/cli/checks.md` gains the new keys

### Build Phase 2: The report, the rerun, the environment

**Tier**: med

- [ ] Add `fast-xml-parser` to indusk-mcp's dependencies
- [ ] `lib/release/junit.ts`: `failedFiles(reportGlobs, root)` → `{ readable, files: Map<file, testNames[]> }`, a testcase's file by `file`, else `classname`, else its suite's `file` or `name`, normalised repo-relative (ADR D4)
- [ ] Rerun per ADR D5: the failing files substituted into `rerun`'s `{files}`, run once; green-on-rerun files are flakes on the record
- [ ] The environment rule: when more than half the report's test files failed, open nothing and record one environment failure naming the count (A22)

#### Build Phase 2 Verification

- [ ] A6, A7, A9, A10, A22 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-report.test.ts && pnpm exec vitest related src/lib/release/junit.ts src/lib/release/run.ts`)

#### Build Phase 2 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`, the `lib/release/` entry: failures are read from the declared JUnit report, never the runner's output — `lesson:` token if a guard is written for it, else the rule and `/decisions/dawn-verify`

#### Build Phase 2 Document

- [ ] `reference/cli/release.md`: the report, the rerun, flakes and the environment rule

### Build Phase 3: Routing and the test-born incident

**Tier**: strong — changes the incident file's shape, which every reader of incidents (catchup, `promise_health`, `promises status`, the admin, the editor) parses

- [ ] `lib/release/route.ts`: `routeFailure(root, file)` reads every impl, active and archived, through `parseTrajectory` and returns the promises the rows naming `file` name, and those rows (ADR D6)
- [ ] `lib/promises/vocabulary.ts`: `INCIDENT_SOURCES` gains `release`; `check.ts` accepts it
- [ ] `lib/promises/incidents.ts`: `recordTestFailure(registry, promise, failure)` writes `tests:` and `release:` evidence and the suspects, or extends the promise's open incident; through `ensurePromiseCarries` and `reopen.ts` (ADR D7). Every incident reader tolerates an incident with `tests:` and no `traces:` — grep the readers (`recorded`, `violationState`, `health.ts`, `status.ts`, the admin's `IncidentsTable.tsx`, the editor's health line) and add a case for each that reads `traces:`
- [ ] Suspects: `git log <green sha>..HEAD -- <covers>`; none, said so, when the green run has no `sha` (ADR D9)

#### Build Phase 3 Verification

- [ ] A11, A12, A13, A14 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-incident.test.ts && pnpm exec vitest related src/lib/promises/incidents.ts src/lib/promises/vocabulary.ts src/lib/release/route.ts`), and the admin's incident tests still pass (`cd apps/indusk-admin && pnpm exec vitest related src/components/IncidentsTable.tsx`)

#### Build Phase 3 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`, the incidents rule: an incident's evidence is `traces:` (a watcher's) or `tests:` + `release:` (a release's); a reader of incidents handles both

#### Build Phase 3 Document

- [ ] `reference/cli/release.md`: routing and the test-born incident; the promises reference page names the `release` source

### Build Phase 4: The bugfix plan for an unclaimed failure

**Tier**: med

- [ ] `lib/release/bugfix-plan.ts`: `openOrExtendBugfixPlan(root, failure)` — `fix-<test-file-stem>` through `startPlan("bugfix", …)`, its brief written `status: draft` with the failing tests, the release, the suspects, and for a promise-less row the plan and row; an open plan of that name gets the failure appended to its research instead (ADR D8)
- [ ] The runner sends unclaimed failures there and lists each opened or extended plan in its output and on the record

#### Build Phase 4 Verification

- [ ] A15, A16, A17 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-bugfix-plan.test.ts && pnpm exec vitest related src/lib/release/bugfix-plan.ts`)

#### Build Phase 4 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`, the `lib/release/` entry: an unclaimed failure is a draft bugfix plan on its own branch, reused by name while open — never a brief written on the trunk

#### Build Phase 4 Document

- [ ] `reference/cli/release.md`: the bugfix plan, its name and its reuse

### Build Phase 5: dusk declares its own release

**Tier**: med

- [ ] `apps/indusk-mcp/package.json`: the `release` script loses `pnpm -w test:system &&`
- [ ] Each `vitest.system.config.ts` (indusk-mcp, indusk-admin, vscode-extension) adds the `junit` reporter writing `test-results/system.junit.xml` beside the default reporter; `test-results/` is gitignored
- [ ] `.indusk/config.json`: the ADR D2 block under `workflow.steps.release`, with `rerun` passing the files through `pnpm -w test:system -- --passWithNoTests {files}` (confirm that form reruns only those files in each package)
- [ ] `indusk promises change dusk-installs-its-own-build --plan release-records-its-failures --statement "After a plan lands, this machine's \`indusk\` is the landed build, installed from the checkout without a publish; publishing is a deliberate act whose slow tests run after it, and what they find is recorded." --reason "the release no longer waits on its slow tests (release-records-its-failures)"`

#### Build Phase 5 Verification

- [ ] A8 and A18 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/release-dusk-declaration.test.ts && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/release-junit.contract.test.ts`); `indusk checks show` prints the declared release

#### Build Phase 5 Context

- [ ] root (Conventions), the "Landing installs, publishing is deliberate" line: a publish is `indusk release`, whose slow tests run after it and record what they find — always-on because every session that might publish reads it

#### Build Phase 5 Document

- [ ] `reference/skills/retrospective.md` and the retrospective skill's Step 11: the release is `indusk release`; changelog `### Added` entry under `## [Unreleased]`

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
