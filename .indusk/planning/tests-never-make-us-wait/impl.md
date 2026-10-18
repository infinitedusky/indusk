---
title: "Tests never make us wait"
date: 2026-10-17
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "8bd6c4ba125e076ed97d19811da0d82596a5c234b644e5e085982333549bea6f"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-18T11:38:10.079Z"
---

# Tests never make us wait

## Goal

A plan runs the tests it writes, the tests its changes reach and the tests of the
promises its brief lists as Must not break, and nothing else; a visual test opens only
the looks a change touched. The decisions are in [adr.md](adr.md); the assertions in
[test-plan.md](test-plan.md).

## Scope

### In Scope
- The everyday guard counting a test that starts the command line, git or Node, and those files moved to the system tier.
- `indusk plans tests <plan> --phase <N> | --landing [--list]` and the skills that name it.
- `indusk looks check --changed <ref>` and the import closure of a page or a component.

### Out of Scope
- The sampler, and the release's tests (`the-sampler`).
- The Testing and telemetry approach docs section (a documentation plan later).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | the guard's process patterns; the moved `SYSTEM` entries; `everyday-tests-never-wait`'s new sentence | `vitest.tiers.ts` in each package |
| Build Phase 2 | `lib/plans/test-set.ts` `planTestSet`; `indusk plans tests`; the work, verify and retrospective skills naming it | `parseBriefContract`, `readPromises`/`findPromise`, `changedFilesForPhase`, `resolveTestCommand`, the trajectory parser |
| Build Phase 3 | `lib/looks/touched.ts`; `indusk looks check --changed`; the optional `page` in `screens.json` | `planReuse`, `screens.json`, the app's TypeScript |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | The tests a plan runs at a phase include the test file of every row that phase writes or makes pass, and no row's file from a phase not yet reached | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/its-own-tests | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T2 | A phase that changed a source file runs the tests whose imports reach that file, in each package the phase changed | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/what-its-changes-reach | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T3 | Vitest's related run names, in its JSON report, the test files whose imports reach a given source file | Test Phase 1 | Test Phase 1 | passing | contract | clause: a-plan-runs-its-tests-and-what-must-not-break/what-its-changes-reach | apps/indusk-mcp/src/__tests__/vitest-related-report.contract.test.ts |
| T4 | At landing, the tests a plan runs include the tests of every promise its brief lists as Must not break, with its rows' tests and the tests its changes reach | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/what-must-not-break | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T5 | A Must-not-break promise whose registry entry names no test is named as having none, not left out | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/what-must-not-break | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T6 | The tests a plan runs at landing hold nothing outside its rows, what its changes reach and its Must-not-break promises | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs | apps/indusk-mcp/src/lib/plans/test-set.test.ts |
| T7 | The work, verify and retrospective skills tell a plan to run its test set, and never the whole suite or the slow tier, at a phase or at landing | Test Phase 1 | Build Phase 2 | passing | unit | clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs | apps/indusk-mcp/src/__tests__/skills-run-the-plan-test-set.test.ts |
| T8 | A change to a page's file touches the screens drawn from that page, and no other screen | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-look-check-runs-what-changed/the-changed-looks | apps/indusk-mcp/src/lib/looks/touched.test.ts |
| T9 | A change to a component touches its stories and the screens whose pages import it | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-look-check-runs-what-changed/the-changed-looks | apps/indusk-mcp/src/lib/looks/touched.test.ts |
| T10 | A change to the app's design foundation, or a closure that cannot be read, touches every look of the app | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-look-check-runs-what-changed/the-changed-looks | apps/indusk-mcp/src/lib/looks/touched.test.ts |
| T11 | A look check of what changed opens each touched look on every device that look is drawn for | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-look-check-runs-what-changed/the-changed-looks | apps/indusk-mcp/src/lib/looks/reuse-run.test.ts |
| T12 | A look check of what changed reuses every look the change did not touch, whatever else about the app changed | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-look-check-runs-what-changed/no-other-look | apps/indusk-mcp/src/lib/looks/reuse-run.test.ts |
| T13 | An everyday test file that starts InDusk's command line, git or another Node process is refused by the guard, naming the file, line and call; the same file in the system tier is not | Test Phase 1 | Test Phase 1 | passing | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| T14 | Every test file this repository holds that starts the command line, git or another Node process is in its package's system tier | Test Phase 1 | Build Phase 1 | passing | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |

## Checklist

### Test Phase 1: Write every test that needs no new code, failing today

**Tier**: med — the work step's default

This phase writes the tests that can be written against today's code: the guard's new rule and its run over the repository, the skills' wording, and how Vitest reports the tests a file reaches. It records the tests whose subject is a module a build phase introduces, with their bodies, so each build phase starts with its tests written. It hands the first build phase a guard that fails on every slow file still in the everyday suite.

- [x] Create or confirm this plan's worktree, so the admin and the plan tools read the plan from it.
  <details><summary>Technical</summary>

  `indusk worktree create tests-never-make-us-wait` (worktree-per-plan default; the worktree from `indusk plans start` already exists, so this confirms and records the assignment).

  </details>
- [x] Teach the everyday guard that starting InDusk's command line, git or another Node process belongs in the system tier, and write its run over the repository so it fails today.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts`: add to `PATTERNS` `runCli(`, `runCliAsync(`, and `spawnSync`/`execFileSync`/`spawn`/`execFile` called with `"git"` or `"node"` as the program (helpers stay exempt). T13: the patterns applied to a sample line flag it with the call named, and the same file listed in `SYSTEM` is not flagged. T14: the existing repository scan, now red, naming the slow files. Header tokens: `promise: everyday-tests-never-wait`.

  </details>
- [x] Write the test that the work, verify and retrospective skills name the plan's test set, so it fails today.
  <details><summary>Technical</summary>

  T7, `apps/indusk-mcp/src/__tests__/skills-run-the-plan-test-set.test.ts`: each of `skills/work.md`, `skills/verify.md`, `skills/retrospective.md` names `indusk plans tests`, and none tells a plan to run `pnpm test`, `pnpm turbo test`, `indusk checks slow` or `test:system` at a phase or at landing (lines inside the release section of the retrospective, which the sampler changes, are read too: they must not tell landing to run them). Red today on `retrospective.md:128` and `:342`, `verify.md:68-72`. Tokens: `clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs`, `promise: a-plan-runs-its-tests-and-what-must-not-break`.

  </details>
- [x] Write the contract test that Vitest's related run reports the test files it ran, which the plan's test set reads.
  <details><summary>Technical</summary>

  T3, `apps/indusk-mcp/src/__tests__/vitest-related-report.contract.test.ts` (system tier, added to `SYSTEM`): in a temporary package with `a.ts`, `a.test.ts` importing it and `b.test.ts` not, `vitest related a.ts --run --reporter=json --outputFile.json=<path>` writes a report whose `testResults[].name` holds `a.test.ts` and not `b.test.ts`. Tokens: `clause: a-plan-runs-its-tests-and-what-must-not-break/what-its-changes-reach`, `promise: a-plan-runs-its-tests-and-what-must-not-break`.

  </details>

#### Deferred to Build Phase 2

- **T1, T2, T4, T5, T6** — their subject is `planTestSet` in `lib/plans/test-set.ts`, which Build Phase 2 introduces; the file would fail to load, not fail an assertion. Body reviewed:

  ```typescript
  // clause: a-plan-runs-its-tests-and-what-must-not-break/its-own-tests
  // clause: a-plan-runs-its-tests-and-what-must-not-break/what-its-changes-reach
  // clause: a-plan-runs-its-tests-and-what-must-not-break/what-must-not-break
  // clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs
  // promise: a-plan-runs-its-tests-and-what-must-not-break
  import { describe, expect, it } from "vitest";
  import { planTestSet } from "./test-set.js";
  const rows = [
    { id: "T1", writableAt: "Build Phase 1", passesAt: "Build Phase 1", tests: ["a.test.ts"] },
    { id: "T2", writableAt: "Build Phase 2", passesAt: "Build Phase 2", tests: ["b.test.ts"] },
  ];
  const reads = { rows, mustNotBreak: ["kept"], registry: [{ name: "kept", tests: ["k.test.ts"] }, { name: "bare", tests: [] }] };
  it("T1 a phase gets its rows' files and none from a later phase", () => {
    const set = planTestSet(reads, { phase: "Build Phase 1" });
    expect(set.files.map((f) => f.path)).toContain("a.test.ts");
    expect(set.files.map((f) => f.path)).not.toContain("b.test.ts");
  });
  it("T2 reached tests are part of a phase's set, named as reached", () => {
    const set = planTestSet({ ...reads, reached: ["r.test.ts"] }, { phase: "Build Phase 1" });
    expect(set.files).toContainEqual({ path: "r.test.ts", reason: "reached" });
  });
  it("T4 landing adds every Must-not-break promise's tests", () => {
    const set = planTestSet(reads, { landing: true });
    expect(set.files).toContainEqual({ path: "k.test.ts", reason: "must not break: kept" });
  });
  it("T5 a Must-not-break promise with no tests is named", () => {
    const set = planTestSet({ ...reads, mustNotBreak: ["bare"] }, { landing: true });
    expect(set.withoutTests).toEqual(["bare"]);
  });
  it("T6 landing holds nothing else", () => {
    const set = planTestSet({ ...reads, reached: ["r.test.ts"] }, { landing: true });
    expect(set.files.map((f) => f.path).sort()).toEqual(["a.test.ts", "b.test.ts", "k.test.ts", "r.test.ts"]);
  });
  ```

#### Deferred to Build Phase 3

- **T8, T9, T10** — their subject is `touchedLooks` in `lib/looks/touched.ts`, which Build Phase 3 introduces. Body reviewed:

  ```typescript
  // clause: a-look-check-runs-what-changed/the-changed-looks
  // promise: a-look-check-runs-what-changed
  import { expect, it } from "vitest";
  import { touchedLooks } from "./touched.js";
  const closures = {
    "home.full": ["app/page.tsx", "app/layout.tsx", "components/chip.tsx"],
    "plan.parts": ["app/plan/[name]/page.tsx", "app/layout.tsx"],
    "chip.waiting": ["components/chip.tsx"],
  };
  it("T8 a page edit touches its screens only", () => {
    expect(touchedLooks({ closures, foundation: [], changed: ["app/plan/[name]/page.tsx"] })).toEqual(["plan.parts"]);
  });
  it("T9 a component edit touches its stories and the screens importing it", () => {
    expect(touchedLooks({ closures, foundation: [], changed: ["components/chip.tsx"] }).sort()).toEqual(["chip.waiting", "home.full"]);
  });
  it("T10 a foundation edit, or an unreadable closure, touches every look", () => {
    expect(touchedLooks({ closures, foundation: ["tokens.json"], changed: ["tokens.json"] }).length).toBe(3);
    expect(touchedLooks({ closures: { ...closures, "plan.parts": null }, foundation: [], changed: ["x.ts"] })).toContain("plan.parts");
  });
  ```

- **T11, T12** — their subject is the `touched` input `planReuse` gains in Build Phase 3; today's `planReuse` takes no such option, so the call would not type-check. Body reviewed:

  ```typescript
  // clause: a-look-check-runs-what-changed/the-changed-looks
  // clause: a-look-check-runs-what-changed/no-other-look
  // promise: a-look-check-runs-what-changed
  it("T11 a touched look opens on every device it is drawn for", () => {
    const plan = planReuse({ ...base, touched: new Set(["home.full"]) });
    expect(plan.open.filter((o) => o.look === "home.full").map((o) => o.device).sort()).toEqual(["desktop", "phone"]);
  });
  it("T12 an untouched look is reused even when its key changed", () => {
    const plan = planReuse({ ...base, touched: new Set(["home.full"]), keyChanged: ["plan.parts"] });
    expect(plan.reused).toContain("plan.parts");
  });
  ```

  Body rewritten at Build Phase 3 against the real planReuse; asserts unchanged.

#### Regression Guards

- **T3** — it asserts how Vitest reports a related run, which is true today and is the fact the plan rests on; it has no red phase.
- **T13** — the guard's new rule applied to a sample line passes as soon as the patterns are added; the red half of the guard is T14 over the repository.

#### Test Phase 1 Verification

- [x] The guard's new rule, the skills' wording test and Vitest's report test exist, and each red one fails on its own assertion.
  <details><summary>Technical</summary>

  T13 and T3 pass; T14 fails naming the slow files; T7 fails naming `retrospective.md` and `verify.md` lines. `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/everyday-tests-never-wait.test.ts src/__tests__/skills-run-the-plan-test-set.test.ts` and `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/vitest-related-report.contract.test.ts`.

  </details>
- [x] Every deferred test body above has been read and judged.
  - Judged 2026-10-18 (bodies not edited). T1-T6: logic matches the rows; two fixes for Build Phase 2 to carry: `describe` is imported and unused (biome's unused-import rule fails the file), and the `reads` shape is the contract `planTestSet` must be written to. T8-T10: compile against the designed `touchedLooks` (closures may be `null`) and assert what the rows claim; no change.
  - **T11, T12 are wrong against today's code and must be rewritten in Build Phase 3.** `planReuse` in `reuse-run.ts` takes positional arguments `(app, root, base, screens, stories, served, opts: CheckOptions)`, not an options object, so `planReuse({ ...base, touched })` does not type-check; it returns a `ReusePlan` with `opened: Map<record, LookKey>`, `screens`, `stories` and `reused: Reused[]` (objects with `app`, `devices`, `at`), not `open`/`.device`/a list of names, so `plan.open` and `expect(plan.reused).toContain("plan.parts")` assert nothing real. There is also no `keyChanged` input; a key change is made by changing the held record or the facts. The body also has no imports and no `base` fixture (`reuse.test.ts` and `check-run.fixtures.ts` hold the existing ones).
  <details><summary>Technical</summary>

  Each body compiles at the phase it names and asserts what its row claims.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new about how the project works; this phase only adds tests whose rules land with their build phases.
  <details><summary>Technical</summary>

  Confirm no context file needs a line: the guard's rule is recorded in Build Phase 1, the command in Build Phase 2.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet; the pages change with the build phases.
  <details><summary>Technical</summary>

  Confirm `apps/docs` needs no change for tests alone.

  </details>

### Build Phase 1: The everyday suite holds no test that starts a process

**Tier**: med — the work step's default

This phase takes the slow files out of the everyday suite. Every test that starts InDusk's command line, git or another Node process moves to its package's system tier, where a plan runs it only when its rows name it or its changes reach it, and the promise about the everyday suite says so. Once it closes, a person running the everyday suite waits about half a minute, and the next phase can make a plan run only its own set.

- [x] Move every test file the guard now flags into its package's system tier.
  <details><summary>Technical</summary>

  Add each file T14 names to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts` (and `apps/indusk-admin/vitest.tiers.ts` if any), sorted, under a comment naming this plan. Run the moved files once under `vitest.system.config.ts` to confirm they still pass there.

  </details>
- [x] Change the everyday-suite promise to say what the suite now holds.
  <details><summary>Technical</summary>

  `indusk promises change everyday-tests-never-wait --plan tests-never-make-us-wait --statement "The everyday suite never starts a server, a process, the command line, a git repository or a workbench, and never waits on the wall clock; such a test runs when a plan's rows name it or its changes reach it, and in the release's tests." --reason "tests-never-make-us-wait: a test that starts the command line or git is a process start, and those files were 80% of the suite's time"`.

  </details>
- [x] Keep recording how long each everyday run takes, without naming the promise this plan replaces.
  <details><summary>Technical</summary>

  `package.json` `test` and `apps/indusk-mcp/scripts/suite-speed.js`: the `--mark everyday-suite-stays-fast` becomes a duration record the brief's expectation reads (the run's seconds, held in machine state), with no promise mark. Its own test, if one reads the mark name, follows.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules. Reviewed; nothing to change.
  <details><summary>Technical</summary>

  Reviewed 2026-10-18: both `vitest.tiers.ts`, `suite-speed.js`, `with-daemon-guard.js`, `suite-speed.test.ts` and `test-daemons-never-leak.test.ts`; biome clean; the record takes its folder as an input and never throws.

  </details>

#### Build Phase 1 Verification

- [x] No everyday test starts the command line, git or another Node process, and the moved files still pass in the system tier.
  <details><summary>Technical</summary>

  T14 passes: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/everyday-tests-never-wait.test.ts`; the moved files: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts <moved files>`.

  </details>
- [x] The everyday suite's time is recorded and comes down.
  <details><summary>Technical</summary>

  `pnpm test` once; read the recorded duration (expect roughly 30 s against 150 s on 2026-10-17); `pnpm promises:check`.

  </details>

#### Build Phase 1 Context

- [x] Replace the root's test-kinds decision line with this plan's, keeping the root under its budget.
  <details><summary>Technical</summary>

  root (Key Decisions): replace "Test kinds run at their moments; servers in the system tier — see `/decisions/test-kinds`" with "A plan runs its tests, what its changes reach and its Must-not-break tests; processes in the system tier — see `/decisions/tests-never-make-us-wait`" — always-on because every plan's verification follows it. The root has 68 bytes of headroom (14,677 of 14,745), so it is a replacement, not an addition.

  </details>

#### Build Phase 1 Document

- [x] Say in the test-levels guide that a test which starts a process is a system test.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/test-levels.md`; the changelog's unreleased section.

  </details>

### Build Phase 2: A plan runs its own set

**Tier**: med — the work step's default

This phase gives a plan its test set and makes it the only thing a plan runs. One command computes the set from the plan's rows, the files a phase changed and the brief's Must-not-break promises, runs it, and says why each file is in it; the skills that drive a phase and a landing name that command in place of the whole suite. Once it closes, a phase runs its own tests in seconds and a landing runs what the plan touched and must not break, and the next phase does the same for looks.

- [x] Compute a plan's test set from its rows, the files it changed and its brief's Must-not-break promises.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/test-set.ts` `planTestSet(reads, { phase } | { landing: true })`, pure (ADR decision 1): rows from the trajectory parser, `reached` handed in, `mustNotBreak` from `parseBriefContract`, the registry from `readPromises` filtered with `findPromise`. Returns `{ files: { path, reason }[], withoutTests: string[], manual: string[] }`. `promise: a-plan-runs-its-tests-and-what-must-not-break` at the site.

  </details>
- [x] Add a command that runs a plan's test set and says why each file is in it.
  <details><summary>Technical</summary>

  `indusk plans tests <plan> --phase <N> | --landing [--list]` in `src/bin/commands/plans.ts` (ADR decisions 2 and 3): changed files from `changedFilesForPhase` (phase) or the plan branch against the trunk (landing); per package touched, `vitest related <changed> --run --reporter=json --outputFile.json=<tmp>` and its report's files as `reached`; then the rest through `resolveTestCommand`; exit code non-zero when any file fails. A workbench resolves through `resolveExecutionRoots`.

  </details>
- [x] Make the work, verify and retrospective skills run the plan's test set, never the whole suite, and resync their installed copies.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/work.md` (`:283` table), `verify.md` (`:68-72`, `:150-151`), `retrospective.md` (`:128`, `:342`: landing runs `indusk plans tests <plan> --landing`); copy to `.claude/skills/`; run `skill-sync-parity.test.ts`.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules. Reviewed 2026-10-18; one finding, done below.
  <details><summary>Technical</summary>

  Read `test-set.ts`, `test-set-run.ts`, `plan-tests.ts`, the `plans tests` wrapper and the three skills. `planTestSet` pure, one reason to change; the process start is only `execRunner`, injected everywhere else. `plansTestsOutcome` also merged three result lists inline: extracted as the finding below. Left as is: `inSystemTier` reads `vitest.tiers.ts` as text (substring on the quoted path) rather than importing it, because the package's config is TypeScript outside `src` and a wrong guess errs toward running the file in the everyday config, which fails loudly.

  </details>
- [x] Shape finding: give the merging of the set's verdicts its own named, tested function instead of leaving it inline in the command.
  <details><summary>Technical</summary>

  `collectResults` in `test-set-run.ts`, out of `plansTestsOutcome` in `plan-tests.ts` (a unit has one reason to change).

  </details>
- [x] Find the tests a change reaches in the system tier too, not only the everyday suite, as the ADR decided.
  <details><summary>Technical</summary>

  Found at review (2026-10-18): `findReached` in `test-set-run.ts` ran `vitest related` under the package's default config only, so a system-tier test that imports a changed file was never in the set, narrower than the clause `what-its-changes-reach` and ADR decision 2 ("both tiers"). Fix: in each package that has `vitest.system.config.ts`, run the related search a second time with `--config vitest.system.config.ts` and take the union; a test in `test-set-run.test.ts` holds it.

  </details>

#### Build Phase 2 Verification

- [x] A phase's set holds its rows' files and what its changes reach, and a landing's adds the Must-not-break promises' tests and nothing else.
  <details><summary>Technical</summary>

  T1, T2, T4, T5, T6: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/test-set.test.ts`.

  </details>
- [x] The skills name the plan's test set and never the whole suite.
  <details><summary>Technical</summary>

  T7: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/skills-run-the-plan-test-set.test.ts src/__tests__/skill-sync-parity.test.ts`; then `indusk plans tests tests-never-make-us-wait --phase "Build Phase 2"` on this plan itself, which must exit 0.

  </details>

#### Build Phase 2 Context

- [x] Add to the package's context file that a plan's tests come from one command, never a hand-picked list.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, Run, verify, Shape, cleanup: one line, `planTestSet` the one definition, T1 and T6 as its guards.

  </details>

#### Build Phase 2 Document

- [x] Document the plan tests command and what a landing runs.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` (`plans tests`), `reference/skills/retrospective.md`, `guide/test-levels.md` (what a phase and a landing run); changelog.

  </details>

### Build Phase 3: A look check opens only what changed

**Tier**: med — the work step's default

This phase makes a visual test cost what changed. Each look learns which files it is drawn from (a screen from its page and that page's imports, a story from its component's), and a look check of what changed opens only the looks whose files changed, on every device they are drawn for, and reuses the rest. Once it closes, a page edit reopens only its screens, and the plan's promises are each proved.

- [x] Work out which looks a set of changed files touches, from each page's and component's imports.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/touched.ts` (ADR decision 5): `lookClosures(app, root)` reads each screen's page (`page` in `screens.json`, else derived from `path` under the Next.js `app/` folder with its `layout` files) and each story's component, and their import closure with the app's own TypeScript (`preProcessFile`, `resolveModuleName`, the app's `tsconfig`), `null` when unreadable; `touchedLooks({ closures, foundation, changed })` pure. `screens.json` gains an optional `page` per screen in its reader.

  </details>
- [x] Let a look check be limited to what changed since a commit, reusing every other look.
  <details><summary>Technical</summary>

  `bin/commands/looks.ts`: `--changed <ref>`; `planReuse` (`reuse-run.ts`) takes `touched: Set<string>`: a touched look opens on all its devices, an untouched one is reused from `readHeld` even when its key changed; `--all` still opens all (ADR decision 6). `promise: a-look-check-runs-what-changed` at the sites.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules. Reviewed 2026-10-18; one finding, done below.
  <details><summary>Technical</summary>

  Read `touched.ts`, `routes.ts`, `import-closure.ts`, `reuse-run.ts`'s `opens`, `changedSinceRef` and the command. `touchedLooks` pure and one rule; route matching, import reading and the git call each in their own unit with the process or the compiler injected or at the edge. Left as is: `changedSinceRef` has no everyday test because it starts git (the everyday guard forbids it); the smoke run below is its check.

  </details>
- [x] Shape finding: give a screen's and a story's sources their own named functions instead of one long `lookClosures`.
  <details><summary>Technical</summary>

  `screenSources` and `storySources` in `touched.ts`, out of `lookClosures` (a unit has one reason to change).

  </details>

#### Build Phase 3 Verification

- [x] A changed page touches its screens, a changed component its stories and the screens importing it, and a foundation change every look.
  <details><summary>Technical</summary>

  T8, T9, T10: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/touched.test.ts`.

  </details>
- [ ] A look check of what changed opens touched looks on every device and reuses the rest.
  <details><summary>Technical</summary>

  T11, T12: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/reuse-run.test.ts`; then `indusk plans tests tests-never-make-us-wait --phase "Build Phase 3"`.

  </details>

#### Build Phase 3 Context

- [x] Add to the package's context file that a look is touched by its import closure, and that an unreadable closure touches every look.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, Promises and telemetry (looks lines): one line, T10 as its guard.

  </details>

#### Build Phase 3 Document

- [x] Document the look check of what changed and the screen's optional page.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`; `decisions/tests-never-make-us-wait.md` (the ADR in docs, with its sidebar entry); changelog.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts` | process patterns |
| `apps/indusk-mcp/vitest.tiers.ts`, `apps/indusk-admin/vitest.tiers.ts` | moved files |
| `package.json`, `apps/indusk-mcp/scripts/suite-speed.js` | duration record without the replaced mark |
| `apps/indusk-mcp/src/lib/plans/test-set.ts`, `src/bin/commands/plans.ts` | the plan's test set and command |
| `apps/indusk-mcp/skills/{work,verify,retrospective}.md`, `.claude/skills/` | name the command |
| `apps/indusk-mcp/src/lib/looks/{touched,reuse-run,mockups}.ts`, `src/bin/commands/looks.ts` | looks of what changed |
| `apps/indusk-mcp/src/__tests__/*`, `src/lib/plans/test-set.test.ts`, `src/lib/looks/touched.test.ts` | new tests |
| `apps/docs/src/guide/test-levels.md`, `reference/cli/{plans,looks}.md`, `reference/skills/retrospective.md`, `decisions/tests-never-make-us-wait.md`, `changelog.md` | docs |
| `CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md` | context lines |

## Dependencies

- None. `the-sampler` follows.

## Notes

- **No look of the admin's interface changes**: `screens.json` gains an optional field and the admin's files are not edited, so the brief's `None` holds.
- **The release's tests are untouched** until `the-sampler`; the moved files run there after a publish, blocking nothing.
