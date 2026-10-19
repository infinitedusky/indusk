---
title: "A plan runs what must not break"
date: 2026-10-18
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "2b2bc9af22cbaa40b4e100ccf5dcc19d96869d718e6f7270324c5f826a3a1d2d"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T00:00:44.078Z"
---

# A plan runs what must not break

## Goal

Each phase runs its own rows' tests and the tests of the brief's Must-not-break promises; a landing runs every row's tests and those same tests; the tests a change merely imports are no longer searched for or run. `indusk promises change` learns to carry clauses, so the promise's registry entry says what is now true. See [brief.md](brief.md) and [test-plan.md](test-plan.md).

## Scope

### In Scope
- `planTestSet` and `indusk plans tests` (`lib/plans/test-set.ts`, `lib/plans/plan-tests.ts`).
- `indusk promises change --clause`, and the change of `a-plan-runs-its-tests-and-what-must-not-break`.
- The work, verify and retrospective skills.

### Out of Scope
- Choosing tests by what each test executes (`the-sampler`).

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | A phase's tests are the files of the rows it writes or makes pass and the tests of the brief's Must-not-break promises, and nothing a change merely imports | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/its-own-tests | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T2 | A landing's tests are every row's files and the Must-not-break promises' tests, and nothing a change merely imports | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/what-must-not-break | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T3 | Running a plan's tests starts no search for the tests its changed files reach | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs | apps/indusk-mcp/src/lib/plans/plan-tests.test.ts |
| T4 | The work, verify and retrospective skills say a phase runs its rows and its Must-not-break tests, and never mention tests a change reaches | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs | apps/indusk-mcp/src/__tests__/skills-run-the-plan-test-set.test.ts |
| T5 | Changing a promise can replace its clauses, and the registry then holds the new clauses and not the old | Test Phase 1 | Build Phase 1 | passing | unit | the means of this change: `promises change` could rewrite only a sentence | apps/indusk-mcp/src/__tests__/promises-change.test.ts |

## Checklist

### Test Phase 1: Write the failing tests against today's test set and commands

**Tier**: med — the work step's default

This phase writes the tests that show what changes: a phase's set that should hold the Must-not-break tests and not the reached ones, a landing's set without reached tests, a command that should start no search for them, skills that should say so, and a promise change that should carry clauses. Each fails today on its own assertion, so the build phase starts with every test written.

- [x] Create or confirm this plan's worktree, so the plan tools read the plan from it.
  <details><summary>Technical</summary>

  `indusk worktree create a-plan-runs-what-must-not-break` from the trunk; the worktree from `indusk plans start` exists, so this confirms it.

  </details>
- [x] Write the tests that a phase's and a landing's sets hold the rows and the Must-not-break tests and nothing reached, failing today.
  <details><summary>Technical</summary>

  T1, T2 in `apps/indusk-mcp/src/lib/plans/test-set.test.ts`: `planTestSet` with rows, a Must-not-break promise and a `reached` list: a phase's set includes the promise's tests and excludes the reached file; a landing's set excludes the reached file. Red today (phases omit Must-not-break; both include reached). Update the existing tests that assert today's reached behaviour (T2/T6 of tests-never-make-us-wait in the same file) to the new rule, saying so in the commit; those rows belong to an archived plan whose promise this plan changes.

  </details>
- [x] Write the test that running a plan's tests starts no search for reached tests, failing today.
  <details><summary>Technical</summary>

  T3 in `apps/indusk-mcp/src/lib/plans/plan-tests.test.ts` (create if missing): `plansTestsOutcome` with a fake `Runner` that records calls, on a temp plan with one row; assert no call's args include `related`. Red today.

  </details>
- [x] Write the tests that the skills name the new rule and that a promise change can carry clauses, failing today.
  <details><summary>Technical</summary>

  T4: extend `skills-run-the-plan-test-set.test.ts` so each of work, verify and retrospective mentions Must-not-break tests at a phase and none mentions tests a change reaches (`related`, `reach`). T5 in `promises-change.test.ts`: `indusk promises change <name> --plan p --statement … --reason … --clause "a (split). …"` leaves the registry entry with exactly the given clauses. Red today (unknown option `--clause`). That file runs the built CLI; it is already in the system tier if the guard put it there, else add it.

  </details>

#### Test Phase 1 Verification

- [x] Each test exists and fails on its own assertion, not on a missing file.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/test-set.test.ts src/lib/plans/plan-tests.test.ts src/__tests__/skills-run-the-plan-test-set.test.ts`; T5 under `--config vitest.system.config.ts` after a build.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new; the rule lands with the build phase.
  <details><summary>Technical</summary>

  Confirm no context file needs a line yet.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  Confirm the docs change with Build Phase 1.

  </details>

### Build Phase 1: Each phase runs its rows and what must not break

**Tier**: med — the work step's default

This phase changes what a plan runs: the Must-not-break promises' tests move from landing-only into every phase, the search for tests a change imports is removed, the skills say so, and the promise is rewritten with its new clauses through a promise change that can now carry them. Once it closes, a phase's set is small and certain, and the precise choice of tests waits for the sampler.

- [x] Make a phase's set include the Must-not-break promises' tests, and drop reached tests from both scopes.
  <details><summary>Technical</summary>

  `lib/plans/test-set.ts` `planTestSet`: the Must-not-break loop runs for both scopes; the `reached` input and its reason go. T1, T2.

  </details>
- [x] Remove the search for tests a change reaches from the plan tests command.
  <details><summary>Technical</summary>

  `lib/plans/plan-tests.ts`: drop `findReached`, the changed-files computation it needed and `collectResults`' reached half; keep `runFiles` from `lib/tests/run-files.ts`. Delete `findReached` and its now-unused helpers from `lib/plans/test-set-run.ts` (grep callers first; `describeTestSet` stays). T3.

  </details>
- [x] Make the work, verify and retrospective skills say a phase runs its rows and its Must-not-break tests, and resync their installed copies.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/{work,verify,retrospective}.md` where they describe `indusk plans tests`; copy to `.claude/skills/`; run `skill-sync-parity.test.ts`. T4.

  </details>
- [x] Let a promise change carry the promise's clauses.
  <details><summary>Technical</summary>

  `indusk promises change` gains a repeatable `--clause` (the same spec `declare` takes; read `bin/commands/promises.ts` and `lib/promises/write.ts` `changePromise`); given clauses replace the entry's list, and the change's History records the old clauses; without `--clause` the clauses stay. The MCP `change_promise` tool takes the same. T5.

  </details>
- [x] Rewrite the promise with its new sentence and clauses.
  <details><summary>Technical</summary>

  From the worktree: `indusk promises change a-plan-runs-its-tests-and-what-must-not-break --plan a-plan-runs-what-must-not-break --statement "<the sentence under Changes in the brief, up to the first full stop after 'no other test runs'>" --reason "phases ran about 100 reached tests that overloaded the machine; the Must-not-break tests are the certain set (Sandy, 2026-10-18)" --clause "its-own-tests (split). Each phase runs the tests of the rows it writes or makes pass." --clause "what-must-not-break (split). Each phase and the landing run the tests of the promises the brief lists as Must not break." --clause "nothing-else-runs (limit). No other test runs while a plan is built or landed."`; then `indusk promises contract a-plan-runs-what-must-not-break` and `indusk promises check`.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 1 Verification

- [x] A phase and a landing run their rows and the Must-not-break tests, nothing reached, and the promise reads as changed.
  <details><summary>Technical</summary>

  T1–T4: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/test-set.test.ts src/lib/plans/plan-tests.test.ts src/__tests__/skills-run-the-plan-test-set.test.ts src/__tests__/skill-sync-parity.test.ts`; T5 under the system config after a build; then `indusk plans tests a-plan-runs-what-must-not-break --phase "Build Phase 1"` with its seconds.

  </details>

#### Build Phase 1 Context

- [x] Correct the package context line about a plan's tests to the new rule.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, Run, verify, Shape, cleanup: the `planTestSet` line — rows and Must-not-break at each phase and landing, no reached search.

  </details>

#### Build Phase 1 Document

- [x] Update the plans reference and the tests-never-make-us-wait decision page to the new rule, and add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` (`plans tests`), `decisions/tests-never-make-us-wait.md` (a dated note: reached tests dropped, Must-not-break every phase), `reference/cli/promises.md` (`change --clause`); changelog.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/{test-set,plan-tests,test-set-run}.ts` | the new rule; reached search removed |
| `apps/indusk-mcp/src/lib/promises/write.ts`, `src/bin/commands/promises.ts`, the MCP tool | `change --clause` |
| `apps/indusk-mcp/skills/{work,verify,retrospective}.md`, `.claude/skills/` | the new rule |
| tests named in the trajectory | new and updated |
| `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/...` | context and docs |

## Dependencies

- None.
