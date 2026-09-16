---
title: "Dawn Workbench Execution — Implementation"
date: 2026-09-15
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Dawn Workbench Execution — Implementation

## Goal

`indusk run` and `indusk verify` work at the root of a workbench that declares
one repo: the plan is read from the workbench, the code is executed, committed
and judged in the declared repo, and every artifact the two commands write
(ledger record, queued eval, checkoff commit) says which repository it is
about. One resolver answers "where is the plan, where is the code" for run,
verify and the cleanup scan. Two repos still refuse, by name. See `adr.md`.

## Scope

### In Scope
- `resolveExecutionRoots` in `lib/worktree/roots.ts`, consumed by run, verify and cleanup; `verify/roots.ts` deleted; single-definition pin
- Verify across the split: detectors on the code root, `codeSha` on the ledger record, bootstrap in the code repo, the "no `codeSha`, no code baseline" rule
- Run across the split: `planRoot` on the loop, two-root confinement, gates from the plan root, two commit cadences with the `Code-Commit:` trailer, the CLI refusal lifted for one repo
- Eval attribution: `repo` on the queued record, `--git-root` through the drain to the hook
- Four layouts in the fixture; the dawn-verify matrix re-run inside a workbench
- Docs: run and verify reference pages, rail-check guide, a decisions page, the two masters

### Out of Scope
- Multi-repo workbenches (refusal stays, routed through the shared resolver)
- The cleanup scan across the split (refuses through the resolver; a named follow-on)
- Component 7 (external agents)
- The carried items in the brief's Context (row terminality at close, the seven-day retrospective health error, the `runHook` helper migration) — they ride in whichever phase here first opens the relevant file, and are listed as items where that is known

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `flatLegacy()` in `helpers/versioned-workbench.ts`; the five test files, RED; the register | `makeVersionedWorkbench`, `verify.test-support.ts` (`buildImpl`, `nodeTestScript`), the run suite's `MockLanguageModelV4` harness, `helpers/cli.ts` |
| Build Phase 1 | `resolveExecutionRoots` (`lib/worktree/roots.ts`); `run.ts`, `oversized.ts`, `verify.ts` on it; `verify/roots.ts` gone | `isWorkbench`, `readWorkbenchRepos`, `repoDir`, `resolveReposRoot` |
| Build Phase 2 | verify across the split: `codeSha`, code-root detectors, code-repo bootstrap | Build Phase 1's roots |
| Build Phase 3 | run across the split: `RunLoopOptions.planRoot`, two-root tools and bash gate, two cadences, CLI lift | Build Phase 1's roots |
| Build Phase 4 | eval attribution: `PendingEvalRecord.repo`, drain `--git-root`, hook honours it | Build Phase 3's cadence records |
| Build Phase 5 | `matrix.md` (A15); decisions page; master updates | everything above, a headless agent |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | In a workbench declaring one repo, `runVerify` at the workbench root on an honest phase (code committed in the code repo, checkoffs in the plan repo, tests green) returns a clean verdict and exit code 0 | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A2 | From the workbench root, verify reports a red test living in the code repo, naming the trajectory row, with exit code 1 | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A3 | From the workbench root, verify reports phantom work when an implementation item is checked off and nothing in the code repo changed since the baseline | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A4 | A ledger line written before this plan (no `codeSha`) is never used as a code baseline: the first cross-repo verify reports `source: "merge-base"`; after a clean verdict, the next phase's verify reports `source: "ledger"` with the recorded code-repo sha | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A5 | A workbench declaring two repos still refuses, naming both, for `runVerify` and for `runLoop`'s CLI entry | Test Phase 1 | Build Phase 1 | written | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts, apps/indusk-mcp/src/__tests__/run-workbench-cli.test.ts |
| A6 | A flat project verifies exactly as before: the existing verify suite passes unchanged | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/lib/verify/verify.test.ts |
| A7 | Under `runLoop` with a plan root and a code root, a scripted phase's file edits land in the code repo's working tree and its checkoffs in the plan repo's `impl.md`; neither appears in the other | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A8 | Each checked-off item yields a code-repo commit holding that item's code and a plan-repo commit holding only the checkoff with a `Code-Commit: <sha>` trailer naming the code commit; the plan repo's diff never contains code | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A9 | A scripted model that checks off a phase while a trajectory row is non-terminal is refused with the gate's message, read from the plan repo's impl | Build Phase 3 | Build Phase 3 | planned | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A10 | The loop's file tools refuse a write outside both the code repo and `<planRoot>/.indusk/planning/<plan>/`, naming both allowed roots, and allow a write inside either | Build Phase 3 | Build Phase 3 | planned | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A11 | `indusk run <plan>` at the root of a one-repo workbench with no provider key fails with the provider-key error, not the workbench refusal | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/__tests__/run-workbench-cli.test.ts |
| A12 | Every eval the loop queues carries `repo`, the code repo's absolute path; draining passes that path to the evaluator, which a stub observes as its git root; a record without `repo` drains as before | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/lib/run/pending-repo-attribution.test.ts |
| A13 | A1, A7 and A8 hold on all four one-repo layouts: flat legacy, nested, sibling, declared `path` | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts, apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A14 | Exactly one definition of `resolveExecutionRoots` exists under `src/lib`, `verify/roots.ts` is gone, and `run.ts`, `oversized.ts` and `verify.ts` each import it | Test Phase 1 | Build Phase 1 | written | apps/indusk-mcp/src/__tests__/execution-roots-single-definition.test.ts |
| A15 | Inside a workbench, the dawn-verify matrix holds: an uncontrolled headless agent's honest phase verifies clean, and each of the five planted classes is caught | Build Phase 5 | Build Phase 5 | planned | manual: .indusk/planning/dawn-workbench-execution/matrix.md |

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author every row that can honestly be authored against today's refusals, each red on its own assertion; add the two fixture layouts; record the two rows that cannot be authored yet.

- [ ] Create/confirm this plan's worktree: `git worktree add ../dusk-worktrees/dawn-workbench-execution -b plan/dawn-workbench-execution main` (dusk is flat, so plain git; worktree-per-plan default); `pnpm install --offline` and `cd apps/indusk-mcp && pnpm exec tsc` there, then grep `dist/` for a symbol from this branch before trusting any CLI-boundary result (the hook-cwd-independence lesson: a build can return without rebuilding)
- [x] (the four in `LAYOUTS`: flat legacy, nested at name, sibling at name, nested at a declared path) `helpers/versioned-workbench.ts`: add `"flat"` to `WorkbenchLayout` (config `worktree.wrapped_repo: <name>` + `shape: "workbench"`, no `repos_root`, checkout at `<root>/<name>`) and a `flatLegacy(extra?)` builder; `oneRepoAtPath` already covers a declared `path`; export a `LAYOUTS` tuple of the four one-repo builders for A13's `describe.each`
- [x] (the runner config is written into the fixture's `.indusk/config.json` after the build, since the `LAYOUTS` builders take no extra config) Write `apps/indusk-mcp/src/lib/verify/workbench-split.test.ts`: fixture = `oneRepoAtPath("nested")` + `writePlan(wb, "demo", buildImpl({...}))` with rows carrying `Test: test/demo.test.mjs` and `verify.testCommand: "node --test"` in the workbench's `.indusk/config.json`; the code repo gets `test/demo.test.mjs` from `nodeTestScript(true|false)` and a source file, committed with `commitFile`; drive `runVerify({ root: wb.root, plan: "demo", phase: 1 })`
- [x] (observed red, all three: `Error: … is a workbench: its plan documents and its code (alpha) live in different repositories … Refusing`. A3 is authored as a two-phase chain — phase 1 verified clean records the baseline, then a phase-2 checkoff with no code commit — because a phantom verdict needs a code baseline to diff from, and that baseline is what Build Phase 2 introduces) Author A1 (honest phase → `verdict: "clean"`), A2 (planted `nodeTestScript(false)` → a `red-test` finding naming the row, `exitCodeForReport` 1), A3 (check off an item, commit only `impl.md` in the workbench → a `phantom-work` finding) — RED today: each throws the workbench refusal from `resolveVerifyRoots`
- [x] (observed red: the workbench refusal) Author A4: write one legacy ledger line by hand (`{plan, phase: 0, sha, trajectory, timestamp}`, no `codeSha`) before the first verify; expect `report.baseline.source === "merge-base"`; after the clean verdict, verify phase 2 and expect `source === "ledger"` and `baseline.sha` equal to the code repo's HEAD at the first verdict — RED today (refusal)
- [x] (green today, as the register says) Author A5 (verify half): `twoRepos()` → `runVerify` rejects with a message naming `alpha` and `beta` — green today; register below
- [x] (observed red on all four layouts, each refusal naming that layout's checkout path — `…/T/alpha` for flat, `…/workbench`'s sibling `…/alpha`, `…/alpha` nested, `…/code/alpha` declared) Author A13 (verify part): `describe.each(LAYOUTS)` running the A1 body — RED today (refusal) on every layout
- [x] (the scripted steps are `guineaPigHappyPathSteps` with every `impl.md` path rewritten to `.indusk/planning/semver/impl.md` by re-parsing each tool call's input, not by string replacement on the serialized step) Write `apps/indusk-mcp/src/lib/run/workbench-split.test.ts`: fixture = a one-repo workbench whose code repo is a copy of `fixtures/guinea-pig-semver` minus its `impl.md`, and whose plan folder holds that `impl.md`; hooks installed at `<wb.root>/.claude/hooks/` by copying `apps/indusk-mcp/hooks/*.js`; the scripted `MockLanguageModelV4` steps from `loop.test.ts` T5, with `edit` calls on `impl.md` addressed as `.indusk/planning/semver/impl.md` and code paths bare; drive `runLoop({ worktree: wb.repos[0].dir, planRoot: wb.root, implPath, model, gate: { scripts: realGateScripts } })`
- [x] (authored A7 and A8 against the post-plan call shape — `worktree: code`, `planRoot: workbench` through the cast — so the assertions never change; observed red: `status: "stopped-red"`, the one-root loop resolving the plan's relative path inside the code repo and never reaching the impl. **A9 deferred**, as this item allowed for: under the cast its red is only A7's, and with `worktree` pointed at the workbench it is green, so neither red speaks to the gate reading the plan repo; its body is in the register and its row now reads Writable at Build Phase 3) Author A7 (after the run: `semver.mjs` exists in the code repo, not in the workbench; `impl.md` checkoffs in the workbench; `git status --porcelain` clean in both), A8 (`git log` in the code repo has one commit per item whose diff touches only code; the workbench's matching commit touches only `.indusk/planning/semver/` and its message body carries `Code-Commit: <sha>` equal to the code commit), A9 (a scripted checkoff with a `written` row → the loop reports the gate refusal and the checkoff is not on disk) — RED today: `RunLoopOptions` has no `planRoot`, so TypeScript rejects the call — **so author these against `runLoop({ worktree: wb.root, … })` plus a cast for the extra option**, and assert the observable: today the code lands in the workbench repo (A7 red on "not in the workbench"), there is no `Code-Commit:` trailer (A8 red), and the gate refusal text still appears (A9 red only through A7's precondition). If the cast makes the red uninteresting, defer A9 alongside A10 with its body in the register
- [x] (observed red on all four layouts: `stopped-red`) Author A13 (run part): the A7 body under `describe.each(LAYOUTS)` — RED today
- [x] (the command function in-process with provider keys scrubbed, the harness `run-refuses-workbench-root.test.ts` already uses; observed: A11 red on the workbench refusal text, A5's run half green naming `alpha` and `beta`) Write `apps/indusk-mcp/src/__tests__/run-workbench-cli.test.ts`: A11 = `runCli(wb.root, ["run", "semver", "--model", "claude"])` with every provider key stripped from `env` → expect the stderr to name the provider key and not the workbench refusal — RED today (workbench refusal); A5 (run half) = `twoRepos()` → stderr names both repos — green today; register below
- [x] (driven through the installed hook, `eval-trigger.js --drain-pending`, with `INDUSK_EVAL_CMD` pointing at a stub that logs argv and cwd; observed red: the stub received `[sha, source]` for the record carrying `repo`, two arguments where three are asserted) Write `apps/indusk-mcp/src/lib/run/pending-repo-attribution.test.ts`: A12 = append a record with `repo: <codeDir>` and one without, run `drainPendingEvals` with `INDUSK_EVAL_CMD` pointing at a stub script that writes its argv and cwd to a file; expect the stub to receive the repo path for the first record and nothing extra for the second — RED today (`PendingEvalRecord` has no `repo`; the drain passes `[sha, source]` only — author the append through a cast so the assertion, not the type, is what fails)
- [x] (observed red on all three checks: zero definitions, `verify/roots.ts` present, no consumer imports it) Write `apps/indusk-mcp/src/__tests__/execution-roots-single-definition.test.ts`: A14 = grep `src/lib` for `export function resolveExecutionRoots` (expect exactly 1), `existsSync(src/lib/verify/roots.ts)` false, and each of `bin/commands/run.ts`, `lib/cleanup/oversized.ts`, `lib/verify/verify.ts` importing it — RED today (0 definitions)

#### Deferred to Build Phase 3

- **A9** — authored against today's one-root loop through the cast, its only red is A7's (the loop cannot reach the plan at all), which says nothing about the gate reading the plan repo's impl; and with `worktree` pointed at the workbench it is green today, because a one-root loop in the workbench refuses exactly as a flat one does. Neither red is about this row's claim, so it waits for the two-root loop. Body reviewed:

  ```typescript
  it("A9: a scripted checkoff while a row is non-terminal is refused by the gate read from the plan repo", async () => {
  	const { code, implPath } = splitFixture(wb);
  	const impl = readFileSync(implPath, "utf8");
  	// Tests written and rows → written, then the model checks off the
  	// Verification item without ever making T1–T3 pass.
  	const steps = stepsAddressingThePlan(impl).filter((s) => !JSON.stringify(s).includes("| passing |"));
  	const model = new MockLanguageModelV4({ doGenerate: steps });
  	const result = await runLoop({ worktree: code, planRoot: wb.root, implPath, model, gate: { scripts: realGateScripts } });
  	expect(result.status).toBe("stopped-red");
  	if (result.status !== "stopped-red") return;
  	expect(result.reason).toMatch(/T1|T2|T3|Trajectory/);
  	// The refused checkoff never reached the plan repo's impl.
  	expect(readFileSync(implPath, "utf8")).not.toMatch(/^- \[x\] `pnpm vitest run`/m);
  });
  ```

- **A10** — its subject is the two-root tool set (`createWorktreeTools({ codeRoot, planRoot, planDir })`), a signature Build Phase 3 introduces; today's `createWorktreeTools(root)` takes one string, so the file would fail to load. Body reviewed:

  ```typescript
  it("A10: a write outside both roots is refused, naming them; inside either is allowed", async () => {
  	const tools = createWorktreeTools({ codeRoot: wb.repos[0].dir, planRoot: wb.root, planDir: ".indusk/planning/semver" });
  	const write = executeOf(tools, "writeFile");
  	await expect(write({ path: join(wb.root, ".indusk/config.json"), content: "{}" }, execOptions))
  		.rejects.toThrow(/outside .*code.*plan/);
  	await expect(write({ path: "src/ok.mjs", content: "" }, execOptions)).resolves.toBeDefined();
  	await expect(write({ path: join(wb.root, ".indusk/planning/semver/notes.md"), content: "" }, execOptions)).resolves.toBeDefined();
  });
  ```

#### Deferred to Build Phase 5

- **A15** — an acceptance procedure, not a unit: it drives a headless `claude -p` session against the shipped feature inside a workbench and records six cells; nothing to author before Build Phases 2–4 exist. The procedure is `archive/dawn-verify/matrix.md`'s, cell for cell, on a `oneRepoAtPath("nested")` workbench with hook files installed and unregistered.

#### Regression Guards

- **A5** — the two-repo refusal exists today (workbench-trust-fixes) and this plan must not lose it while moving it into the shared resolver; green on authoring by design
- **A6** — the existing flat-project verify suite; green today and must stay so through every phase, which is the whole reason it is a row

#### Test Phase 1 Verification
- [x] Every red row red on its own assertion, none on a load error: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify/workbench-split.test.ts src/lib/run/workbench-split.test.ts src/__tests__/run-workbench-cli.test.ts src/lib/run/pending-repo-attribution.test.ts src/__tests__/execution-roots-single-definition.test.ts` — expected: A1–A4, A7–A9, A11–A14 failed with the refusal or the missing trailer/field in the message; A5 and both A6 halves green; then `cd` back to the worktree root — 2026-09-16: 19 failed (A1–A4 + four A13 verify layouts on the refusal; A7, A8 + four A13 run layouts on `stopped-red`; A11 on the refusal text; A12 on two arguments not three; A14's three checks), A5 both halves green, no load errors; A9 deferred rather than kept red for the wrong reason
- [x] A6 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify/verify.test.ts` — expected: all pass — 2026-09-16: passed in the combined run (the one green file of five)
- [x] Rows A1–A5, A7–A8, A11–A14 set to `written`; A6 to `passing`; A9 stays `planned` with Writable at Build Phase 3 (deferred, see the register)
- [x] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims? — A9: uses `planRoot` on `RunLoopOptions` (Build Phase 3 adds it) and the file's own `splitFixture`/`stepsAddressingThePlan`; asserts `stopped-red` naming the rows and that the refused checkoff is absent from the plan repo's impl — the claim. A10: uses the object-form `createWorktreeTools` (Build Phase 3's signature) and `executeOf`/`execOptions` from the harness; asserts a refusal naming both roots for an outside path and success for one inside each root — the claim. A15: a procedure, reviewed against the archive's matrix cell for cell
- [x] Shape (Test Phase 1, recorded by hand): review the five test files and the fixture helper against the typescript and testing craft prose — the verify file has one fixture builder (`honestPhase`) with two named knobs and one runner (`verifyAt`); the run file has one fixture (`splitFixture`), one step rewriter that re-parses tool inputs rather than string-replacing JSON, one commit reader (`commitsAfter`) and one shared outcome check (`expectSplitOutcome`) the A13 table reuses; the drain, CLI and pin files are single-purpose. Left as is: `run-workbench-cli.test.ts` restates `run-refuses-workbench-root.test.ts`'s key-scrubbing harness — two copies, inter-file, `/cleanup`'s question. Nothing to change

#### Test Phase 1 Context
- [x] Known Gotchas, the versioned-workbench fixture entry: the helper now builds four one-repo layouts and exports `LAYOUTS`; a test about "where the code is" runs over all four or it is blind to three

#### Test Phase 1 Document
- [x] `apps/docs/src/changelog.md` Unreleased, Added: "`indusk run` and `indusk verify` execute in a single-repo workbench across the plan-root/code-root split; queued evals name their repo; one shared root resolver behind run, verify and the cleanup scan" (the entry is written now and amended as phases land)

### Build Phase 1: One resolver

- [ ] `lib/worktree/roots.ts`: `export interface ExecutionRoots { planRoot: string; codeRoot: string; split: boolean }`, `export interface ExecutionRootsRefusal { error: string }`, `export function resolveExecutionRoots(planRoot: string): ExecutionRoots | ExecutionRootsRefusal`, `export function isRootsRefusal(r)` — the body and the three messages moved from `verify/roots.ts` (none declared / several / one), with the one-repo case now returning `{ planRoot, codeRoot: join(resolveReposRoot(planRoot), repoDir(repo)), split: true }` instead of a refusal
- [ ] Delete `lib/verify/roots.ts`; `verify.ts` imports the shared function; its existing `roots.test.ts` moves to `lib/worktree/roots.test.ts` with the one-repo expectation flipped from refusal to `split: true`
- [ ] `bin/commands/run.ts`: replace the inline `isWorkbench` refusal with the resolver — a refusal prints `error` and exits 1; a split result is carried forward (Build Phase 3 uses it; until then `run` still stops after the resolver with a "workbench execution lands in Build Phase 3" refusal so nothing half-works)
- [ ] `lib/cleanup/oversized.ts`: its refusal reads the resolver and refuses on `split: true` with the resolver's `codeRoot` in the message (the cleanup scan stays plan-root-only — out of scope)

#### Build Phase 1 Verification
- [ ] A14 and A5 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/execution-roots-single-definition.test.ts src/lib/verify/workbench-split.test.ts src/__tests__/run-workbench-cli.test.ts -t "A5|A14"` — expected: pass; then `cd` back
- [ ] The moved refusal suite and the neighbours: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/worktree/roots.test.ts src/lib/verify/verify.test.ts src/lib/cleanup src/__tests__/workbench-blindness.test.ts` — expected: all pass
- [ ] Rows A14, A5 set to `passing`
- [ ] Shape (Build Phase 1): `prepareShapeReview` over the phase's files against the typescript and testing craft rules; record findings or "nothing to change"

#### Build Phase 1 Context
- [ ] Known Gotchas, the `resolveImplPath`/`TERMINAL_STATES` single-definition entry: add `resolveExecutionRoots` (`lib/worktree/roots.ts`) as the fifth instance — the "where is the code" answer for run, verify and cleanup, pinned by `execution-roots-single-definition.test.ts`

#### Build Phase 1 Document
- [ ] `apps/docs/src/reference/cli/verify.md` and `run.md`: the refusal paragraphs now name one resolver and say the one-repo case is lifted (verify in Build Phase 2, run in Build Phase 3)

### Build Phase 2: Verify judges the code repo

- [ ] `lib/verify/ledger.ts`: `VerifyRecord` gains `codeSha?: string` with the rule in its docblock — present only when split; absent means "no code baseline" never "same as sha"
- [ ] `lib/verify/verify.ts`: when `split`, `assertGitRepo(codeRoot)`; baseline = `record?.codeSha` when split (else `record?.sha`), falling back to `resolveBootstrapBaseline(codeRoot, …)` with `source: "merge-base"`; `detectRedTests` runs with `root: codeRoot`; `detectPhantomWork` already takes `codeRoot`; goalposts and premature-checkoff stay on the plan root; the clean-verdict record writes `codeSha: await headSha(codeRoot)` when split
- [ ] `lib/verify/git.ts` `resolveBootstrapBaseline`: when the plan folder does not exist in `root` (the split case), skip the "commit before the plan folder appeared" fallback and return the merge base, else the root commit — never a sha from another repository
- [ ] `lib/verify/report.ts`: the report prints which repository each finding is about (`code: <path>` on red-test and phantom findings when split)

#### Build Phase 2 Verification
- [ ] A1–A4 and A13's verify part green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify/workbench-split.test.ts` — expected: all pass on all four layouts; then `cd` back
- [ ] A6 still green and the verify suite whole: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify` — expected: all pass
- [ ] Rows A1–A4 set to `passing`; A13 stays `written` until its run part passes
- [ ] Shape (Build Phase 2): review the phase's files; record findings or "nothing to change"

#### Build Phase 2 Context
- [ ] Conventions, the `indusk verify` entry: rewrite from "refuses inside a workbench" to the split rule — one-repo workbenches verify against the declared code repo with a `codeSha` baseline; multi-repo still refuses; `Test` paths are code-repo-relative when split

#### Build Phase 2 Document
- [ ] `apps/docs/src/reference/cli/verify.md`: the cross-repo section — where each detection looks, the `codeSha` field, the "no `codeSha`, no code baseline" rule, `Test` paths relative to the code repo; `apps/docs/src/decisions/dawn-verify.md` gains a superseded note pointing at this plan's decision page

### Build Phase 3: Run carries two roots

- [ ] `lib/run/loop.ts`: `RunLoopOptions.planRoot?: string` (default `worktree`), `planDir` derived from `implPath`; `resolveGateScripts(planRoot)`; the gate envelope `cwd: planRoot`
- [ ] `lib/run/tools.ts` + `worktree-paths.ts`: `createWorktreeTools({ codeRoot, planRoot, planDir })` — a path resolves inside `codeRoot` (relative paths resolve there) or inside `join(planRoot, planDir)`, else throws naming both; `gateBashTool` scans escapes against both roots and runs with `cwd: codeRoot`
- [ ] `lib/run/commit-cadence.ts`: `createCommitCadence` gains `pathspec?: string[]` (the plan cadence stages `.indusk/planning/<plan>/` only) and `trailer?: (record) => string`; `loop.ts` creates two cadences when split — code first, then plan with `Code-Commit: <sha>` when the code cadence landed one — and reports both in `PhaseReport.commits` tagged by root
- [ ] `bin/commands/run.ts`: on `split`, pass `worktree: codeRoot`, `planRoot`, `implPath` (under the plan root) — the Build Phase 1 stop is removed
- [ ] Author A10 from the register into `src/lib/run/workbench-split.test.ts`, RED against the pre-change tool set for one commit, then green

#### Build Phase 3 Verification
- [ ] A7–A11 and A13 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/workbench-split.test.ts src/__tests__/run-workbench-cli.test.ts` — expected: all pass; then `cd` back
- [ ] The run suite whole: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run` — expected: all pass (the flat guinea-pig fixture is unchanged: one root, one cadence)
- [ ] Rows A7–A11, A13 set to `passing`
- [ ] Shape (Build Phase 3): review the phase's files; record findings or "nothing to change"

#### Build Phase 3 Context
- [ ] Architecture, the `indusk run` entry: replace "Refuses at a workbench root … Dawn 6.5 lifts this" with the two-root rule — code root for tools, bash and code commits; plan root for impl, gates, ledger, queue; the plan-root checkoff commit carries `Code-Commit:`; multi-repo refuses

#### Build Phase 3 Document
- [ ] `apps/docs/src/reference/cli/run.md`: the workbench execution section with the Mermaid diagram from the ADR's Documentation Plan (two roots, what flows to each), the trailer, the two allowed write roots

### Build Phase 4: Evals name their repo

- [ ] `lib/run/pending-evals.ts`: `PendingEvalRecord.repo?: string` (absolute, realpath-normalized); `loop.ts` writes `repo: codeRoot` for code commits; plan-root checkoff commits are not queued
- [ ] `hooks/_pending-drain.js` `runOne`: when `record.repo` is set, append `--git-root <repo>` to the trigger invocation and `<repo>` as a third argument under `INDUSK_EVAL_CMD`
- [ ] `hooks/eval-trigger.js`: in drain/CLI mode, `--git-root` (parsed with `parseArgValue`) replaces the walk-up's `gitPath`; hook mode ignores it; the syslog line names the source of `gitPath`
- [ ] Carried (brief): migrate the three private `runHook` copies in `claude-md-budget-hook.test.ts`, `trajectory-a-prefix-ids.test.ts`, `rationale-baseline-*.test.ts` to `helpers/hook-runner.ts` — this phase opens the hook tests

#### Build Phase 4 Verification
- [ ] A12 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/pending-repo-attribution.test.ts` — expected: pass; then `cd` back
- [ ] The eval rail's pins still hold: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/installed-hook-drain.test.ts src/lib/run/drain-falsification.test.ts src/__tests__/eval-trigger*.test.ts src/__tests__/claude-md-budget-hook.test.ts src/__tests__/trajectory-a-prefix-ids.test.ts` — expected: all pass
- [ ] Row A12 set to `passing`
- [ ] Shape (Build Phase 4): review the phase's files; record findings or "nothing to change"

#### Build Phase 4 Context
- [ ] Conventions, the thin-lane eval rail entry: queued records carry `repo` when the loop knows it and the drain honours it; a record without it resolves by the hook's walk-up as before

#### Build Phase 4 Document
- [ ] `apps/docs/src/guide/rail-check.md`: the drain's attribution — `repo` on the record, `--git-root` to the hook, what a legacy record does

### Build Phase 5: The matrix, inside a workbench

- [ ] Build the acceptance workbench from `oneRepoAtPath("nested")` in the scratchpad: the semver plan in the plan folder, the code repo empty but for a README, hook files copied to `<root>/.claude/hooks/` and **not** registered in any settings file, `verify.testCommand: "node --test"` in the workbench config
- [ ] Run cell 0 (honest control) with `claude -p --permission-mode bypassPermissions` in the code repo with the corner-cutting prompt from `archive/dawn-verify/matrix.md`, then `indusk verify semver --phase 1` at the workbench root — record the verdict
- [ ] Run cells A–E (premature checkoff, skipped test-first, goalpost drift, red test, phantom) by planting each violation as the archive's matrix did, verify after each — record findings and exit codes
- [ ] Write `matrix.md` in this plan folder with the same cell table as the archive's, plus the workbench layout and the two repos' HEADs per cell
- [ ] Carried (brief): row terminality at close — `lib/cleanup/gate.ts` `checkRetrospectiveReadiness` gains `rowsNonTerminal(implContent)` in `missing`; `lib/trajectory/audit.ts` `auditPlanAtClose` gains `nonTerminal`; the retrospective skill's Step 0 and Step 4a text say the new behaviour; the two `written` rows workbench-trust-fixes left are the fixture (`src/lib/cleanup/gate.test.ts`)
- [ ] Carried (brief): `check_health` reports a plan whose impl has been `completed` for more than seven days with no `retrospective.md` as an error naming the plan — the impl's `updated:` (else `date:`) frontmatter is the clock; `lib/health.ts` + `system-tools.ts`; fixture at six and eight days

#### Build Phase 5 Verification
- [ ] A15: `matrix.md` records cell 0 clean with exit 0 and cells A–E each rejected with the expected finding kind and exit 1 — the same shape as the archive's table
- [ ] The two carried items have tests green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/cleanup/gate-row-terminality.test.ts src/__tests__/health-stale-completed.test.ts` (both new in this phase, beside `oversized-workbench-refusal.test.ts` and `health-check-roots.test.ts`) — expected: pass; then `cd` back
- [ ] The whole package: `cd apps/indusk-mcp && pnpm exec vitest run` — expected: green except the admin daemon suites known red without an admin build
- [ ] Row A15 set to `passing`
- [ ] Shape (Build Phase 5): review the phase's files; record findings or "nothing to change"

#### Build Phase 5 Context
- [ ] Current State: the 6.5 line — shipped, matrix held (N/5, false positives), the carried close-out checks live; Key Decisions already carries the ADR line

#### Build Phase 5 Document
- [ ] `apps/docs/src/decisions/dawn-workbench-execution.md` (this ADR, published) and the sidebar entry; `.indusk/planning/indusk-v2-dawn/master.md` component 6.5 → done with the acceptance result, the "universal floor" line rewritten; `.indusk/planning/master.md` Stream 3 row; `.indusk/planning/indusk-v4-day/master.md` component 2 → closed

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/worktree/roots.ts` | new: `resolveExecutionRoots` (moved from `verify/roots.ts`, one-repo case lifted) |
| `apps/indusk-mcp/src/lib/verify/roots.ts` | deleted |
| `apps/indusk-mcp/src/lib/verify/{verify,ledger,git,report}.ts` | split-aware baseline, `codeSha`, code-root detectors |
| `apps/indusk-mcp/src/lib/run/{loop,tools,worktree-paths,bash-gate,commit-cadence,pending-evals}.ts` | two roots, two cadences, `repo` on the queue |
| `apps/indusk-mcp/src/bin/commands/run.ts`, `src/lib/cleanup/oversized.ts` | refusals through the resolver; run lifted for one repo |
| `apps/indusk-mcp/hooks/{_pending-drain,eval-trigger}.js` | `--git-root` |
| `apps/indusk-mcp/src/__tests__/helpers/versioned-workbench.ts` | `flat` layout, `LAYOUTS` |
| five new test files (see trajectory), `matrix.md` | evidence |
| docs: `reference/cli/{run,verify}.md`, `guide/rail-check.md`, `decisions/dawn-workbench-execution.md`, changelog; three masters; CLAUDE.md | record |

## Dependencies
- `workbench-trust-fixes` (archived): the refusals this plan lifts
- `hook-cwd-independence` (merged 2026-09-15): the gates this plan runs under load from any cwd

## Notes
- A9's red is contingent on A7's precondition; if the cast makes it a rubber stamp, defer it beside A10 with its body in the register rather than keeping a red that says nothing.
- The plan-root checkoff commit is deliberately not queued for eval; a diff of checkboxes is not work to score, and queuing it would double the rail's load for nothing.
