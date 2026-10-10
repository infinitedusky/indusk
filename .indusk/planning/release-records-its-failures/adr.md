---
title: "release-records-its-failures"
date: 2026-10-09
status: accepted
---

# release-records-its-failures

## Goal

**A release runs in the order its project declares, and what its slow tests find becomes incidents and bugfix plans instead of a stopped release.**

On 2026-10-09 the 1.69.0 release stopped on three system-tier tests that had fallen behind two deliberate changes, because nothing had run the slow tier since they landed. With this decision, dusk declares its slow tests `after` the publish: the publish happens, the slow tests run in the same command, and each failure is routed to the promise its plan's row names, or to a draft bugfix plan when no promise claims it.

## Y-Statement

**In the context of:**
releasing a project whose slow tests (dusk's system tier: real Jaeger, `next dev`, VS Code, Claude sessions) take minutes and no longer run at landing, where Sandy has decided he would rather ship a failure than wait, and where every release since 1.63.0 has failed its first run.

**Facing:**
a release that is one opaque shell chain with the slow tests welded in front of the publish; failures that exist only as terminal output; test files that, for most of dusk's slow tier, are named by archived rows with no promise (or by no row at all); incidents that are shaped around Jaeger traces, not tests; and a "facts, never logic" rule for `workflow.steps` that forbids growing a scripting language.

**We decided for:**
an `indusk release` command that runs `workflow.steps.release` as declared. Two new facts under `release`: `slow_tests` (`command`, `report` — a path or glob to JUnit XML — `when: before | after`, and an optional `rerun` command template taking `{files}`) and `done_when: published | green`. The runner takes its commands, clock and reads as inputs, so its order and outcome rules are unit tests. Failing tests are read from the JUnit report, rerun once by file when `rerun` is declared, and each file still failing is routed through the trajectory rows that name it: a row with a promise opens or extends an incident on that promise (evidence: tests and release, source `release`), reopening the owner through the existing Maintenance-phase path; anything else opens, or adds to, one draft bugfix plan for that file, started on its own branch. Every routed failure names the commits since the last green slow run. Each release appends one line to a release record in the project's home.

**And against:**
parsing the runner's printed output (ties the feature to one runner; Dawn verify already rejected it); a pipeline runner of our own (stages, caching, retries — `act`, Dagger and Earthly exist); running the slow tests detached in the background (Sandy chose the foreground: nothing dies silently); recording every failure with no rerun (each timing flake would become a plan); one "release findings" plan per release (mixes unrelated failures and cannot be reused by the next release); writing a bugfix brief on `main` (breaks `a-plan-is-written-on-its-own-branch`); and keeping the slow tests inside dusk's `release` script (the order would stay invisible to InDusk).

**To achieve:**
a release that publishes on its first run when the project says so, a red slow test that lands where someone will fix it — the plan that owns its promise, or a plan of its own — with the commits that likely broke it named, and the same behaviour for any project whose runner writes JUnit.

**Accepting:**
that most of dusk's slow tier routes to bugfix plans until its archived rows gain `For` cells (a separate backfill); that a runner without JUnit output gets "the slow tests failed" with no test named; that a rerun needs a declared command template, and without one every failure is recorded; that `indusk release` keeps running after the publish (about seven minutes for dusk) and ends by printing what it opened; and that green-run records written before this plan carry no commit, so their first failure names no suspects.

**Because:**
the order and the meaning of "done" are facts about a project, and facts belong in its declaration, where `indusk checks show` already prints them; JUnit is the one report format nearly every runner writes; the trajectory row is the only place that already links a test file to a promise; and the incident and reopen machinery already exists, so a test-born incident is a new kind of evidence on an old path rather than a second system.

## Context

See `research.md` (the 1.69.0 failures, what `workflow.steps` already declares, the three routing cases, trace-shaped incidents) and `brief.md` (five promises, one change to `dusk-installs-its-own-build`). The test plan's 21 assertions constrain each decision below; the row IDs are named where they apply.

## Decision

1. **`indusk release` runs the declared release.** It reads `workflow.steps.release` and runs, in order: the slow tests if `when: before` (a red run stops here — A2), the release `command` (a failure stops here, no slow tests — A4), the slow tests if `when: after` (A1). A project with no `release.command` is told so and nothing runs (A5). The slow run is skipped when a fully green run already covered the tree (`findCoveringRun`, unchanged — A20). Commands run through the shell from the project root, exactly as declared (A21). The command name does not revive release-ritual's rejected `indusk release <major|minor|patch>`: this runs a declared step, it never bumps.

2. **The declaration.**
   ```json
   "release": {
     "command": "pnpm release",
     "slow_tests": {
       "command": "pnpm -w test:system",
       "report": "apps/*/test-results/system.junit.xml",
       "when": "after",
       "rerun": "pnpm -w test:system -- --passWithNoTests {files}"
     },
     "done_when": "published"
   }
   ```
   `steps.ts` validates each as a fact: `when` one of two words, `done_when` one of two, `report` a path or glob, `rerun` a command containing `{files}`. A project that declares none of them behaves as today. `land.slow_tests` is unchanged.

3. **Outcome and exit.** The release reports published or not, and done or not: `done_when: published` is done once the command succeeds (A1); `done_when: green` is done only when the slow run is green, and a red after-run reads "published, not done" (A3). `indusk release` exits 0 when done, non-zero otherwise.

4. **Failures come from the JUnit report** (`lib/release/junit.ts`). The `report` glob is resolved after the run and every file read as one report (A6); a failed or errored `testcase` names its file by its `file` attribute, else its `classname`, else its `testsuite`'s `file` or `name`, as a repository-relative path. Parsing uses `fast-xml-parser`, added as a dependency of indusk-mcp — not a hand-rolled parser. A red exit with no readable report reports "the slow tests failed" and routes nothing (A7). A8, a contract test in the system tier, holds vitest's JUnit output to this reading.

5. **One rerun, by file.** With `rerun` declared, the failing files are substituted into `{files}` and run once; a file green on the rerun is a flake, listed on the release record, routed nowhere (A9). Only failing files rerun, and only once (A10). Without `rerun`, every failure is recorded.

6. **Routing a failing file.** `lib/release/route.ts` reads every impl, active and archived, through the trajectory parser and collects the rows whose `Test` cell names the file.
   - A row whose `For` names a promise: the failure goes to that promise (A11). Several promises: each.
   - Otherwise (a row with no promise, or no row): a bugfix plan (A15, A16).

7. **A test-born incident.** `INCIDENT_SOURCES` gains `release`. `recordTestFailure(registry, promise, failure)` in `lib/promises/incidents.ts` writes an incident whose evidence is `tests:` (file, test names) and `release:` (version, commit) instead of `traces:`, with the suspects in its body; an open incident on the same promise is extended instead (A12). Opening it goes through the same `ensurePromiseCarries` and `reopen.ts` path as a watcher's incident, so the promise turns `known-violated`, the owner gains its Maintenance phase and the incident names its rows (A13), and every reader shows it (A14). `violationState` and the chips are unaffected: a state promise has no chip, and they read `traces:` only.

8. **A bugfix plan for an unclaimed failure.** `fix-<test-file-stem>` is started with `startPlan("bugfix", …)` — its own branch and worktree — and its brief written as `status: draft` with the failing tests, the release, the suspects, and for a promise-less row the plan and row that were testing it (A15, A16). If that plan is already open, the new failure is appended to its research instead (A17). The working agent, or the person, takes it from draft.

9. **Suspects.** The green-run record gains the commit (`sha`) it ran on, written from now on. The suspects are `git log <sha>..HEAD` over the slow tests' `covers` paths; a record without `sha` names none and says so.

10. **The release record.** One JSON line per release in the project home (`releases.jsonl`): version, commit, when, published, done, the slow run's result, failing files with where each was routed, and flakes. It is what the brief's first expectation counts.

11. **dusk's own declaration** (A18). `apps/indusk-mcp/package.json`'s `release` script loses `pnpm -w test:system`; each package's `vitest.system.config.ts` gains the JUnit reporter writing `test-results/system.junit.xml`; `.indusk/config.json` declares the block above; `dusk-installs-its-own-build` is changed to its new sentence in the build phase that makes it true. `record-release.js` stays dusk's script, run by the release command as today. A19 is the first real `indusk release`, recorded once.

## Alternatives Considered

### Read the runner's output
Rejected: one runner's format, broken by its next release; Dawn verify set the rule (files and exit codes, never runner output).

### A pipeline runner (stages, caching, retries)
Rejected: that category exists (`act`, Dagger, Earthly) and owning it would be reinvention. InDusk orders two declared steps and routes their failures.

### Background slow run
Rejected by Sandy (2026-10-09): a detached run can die unseen; the foreground prints what it recorded.

### No rerun
Rejected by Sandy (2026-10-09): every timing flake would become an incident or a plan to close.

### One findings plan per release
Rejected: it groups unrelated failures and the next release's failure of the same file cannot find it to reuse (A17).

### A bugfix brief written on `main`
Rejected: every such commit is a recorded violation of `a-plan-is-written-on-its-own-branch`.

### Keep the slow tests in dusk's release script
Rejected: the order would stay invisible to InDusk and to every other project.

## Consequences

### Positive
- dusk's releases publish on the first run when the publish is sound.
- A red slow test reaches a plan with the likely culprit commits named.
- Any project with a JUnit-writing runner gets the same.

### Negative
- Until archived rows gain `For` cells, most of dusk's slow-tier failures become bugfix plans rather than incidents.
- `indusk release` runs for minutes after the publish.
- A new incident evidence shape (`tests:` beside `traces:`) for every reader of incidents to tolerate.

### Risks
- **Bugfix-plan churn from a broken environment** (the whole tier red at once, e.g. no Jaeger): the rerun does not help when everything fails. Mitigation: when more than half the files fail, record one finding on the release record and open nothing, saying so — a run that broke everywhere says the environment broke, not the code.
- **`startPlan` from inside a release** writes worktrees: mitigation — it is the same call the admin's Start makes, already refusing a name that exists.
- **JUnit attribute differences across runners**: mitigation — the reader's fallback order (`file`, `classname`, suite `file`, suite `name`), and A8 pins vitest's.

## Documentation Plan

### Pages
- New: `reference/cli/release.md` — `indusk release`, its order, outcome and exit, the record.
- Update: `reference/cli/checks.md` — `release.slow_tests`, `done_when` in `checks show`.
- Update: `reference/skills/retrospective.md` — Step 11: run `indusk release`.

### Diagrams
- A Mermaid flowchart in `reference/cli/release.md`: before/after order, rerun, routing to incident or bugfix plan.

### Changelog
- Added: `indusk release` runs the declared release; slow tests before or after; failures from JUnit become incidents or bugfix plans.

### ADR in Docs
- Yes: `decisions/release-records-its-failures.md` at the retrospective.

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder.
- `.indusk/planning/archive/release-checks-run-once/` — `workflow.steps`, facts never logic, the green-run record.
- `.indusk/planning/archive/incident-recording/` — incidents, the recorder, reopen.
- `/decisions/dawn-verify` — files and exit codes, never runner output.
