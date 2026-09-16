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
| A1 | In a workbench declaring one repo, `runVerify` at the workbench root on an honest phase (code committed in the code repo, checkoffs in the plan repo, tests green) returns a clean verdict and exit code 0 | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A2 | From the workbench root, verify reports a red test living in the code repo, naming the trajectory row, with exit code 1 | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A3 | From the workbench root, verify reports phantom work when an implementation item is checked off and nothing in the code repo changed since the baseline | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A4 | A ledger line written before this plan (no `codeSha`) is never used as a code baseline: the first cross-repo verify reports `source: "merge-base"`; after a clean verdict, the next phase's verify reports `source: "ledger"` with the recorded code-repo sha | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts |
| A5 | A workbench declaring two repos still refuses, naming both, for `runVerify` and for `runLoop`'s CLI entry | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts, apps/indusk-mcp/src/__tests__/run-workbench-cli.test.ts |
| A6 | A flat project verifies exactly as before: the existing verify suite passes unchanged | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/lib/verify/verify.test.ts |
| A7 | Under `runLoop` with a plan root and a code root, a scripted phase's file edits land in the code repo's working tree and its checkoffs in the plan repo's `impl.md`; neither appears in the other | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A8 | Each checked-off item yields a code-repo commit holding that item's code and a plan-repo commit holding only the checkoff with a `Code-Commit: <sha>` trailer naming the code commit; the plan repo's diff never contains code | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A9 | A scripted model that checks off a phase while a trajectory row is non-terminal is refused with the gate's message, read from the plan repo's impl | Build Phase 3 | Build Phase 3 | passing | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A10 | The loop's file tools refuse a write outside both the code repo and `<planRoot>/.indusk/planning/<plan>/`, naming both allowed roots, and allow a write inside either | Build Phase 3 | Build Phase 3 | passing | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A11 | `indusk run <plan>` at the root of a one-repo workbench with no provider key fails with the provider-key error, not the workbench refusal | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/run-workbench-cli.test.ts |
| A12 | Every eval the loop queues carries `repo`, the code repo's absolute path; draining passes that path to the evaluator, which a stub observes as its git root; a record without `repo` drains as before | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/lib/run/pending-repo-attribution.test.ts |
| A13 | A1, A7 and A8 hold on all four one-repo layouts: flat legacy, nested, sibling, declared `path` | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/lib/verify/workbench-split.test.ts, apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A14 | Exactly one definition of `resolveExecutionRoots` exists under `src/lib`, `verify/roots.ts` is gone, and `run.ts`, `oversized.ts` and `verify.ts` each import it | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/execution-roots-single-definition.test.ts |
| A15 | Inside a workbench, the dawn-verify matrix holds: an uncontrolled headless agent's honest phase verifies clean, and each of the five planted classes is caught | Build Phase 5 | Build Phase 5 | passing | manual: .indusk/planning/dawn-workbench-execution/matrix.md |
| A16 | On a workbench whose declared code repo carries `vitest.config.ts` and no `verify.testCommand` is set, `indusk update` records `verify.testRunner` (tool `vitest`) in the workbench config — so a split verify has a runner, instead of reporting every row unverified under a clean verdict | Phase 0 | Phase 6 | passing | apps/indusk-mcp/src/__tests__/workbench-runner-detection.test.ts |
| A17 | Under `runLoop` across a split whose code repo has no commits yet, a checkoff made before any code change completes without a tool error: the plan-side commit lands with no `Code-Commit:` trailer, and a later checkoff, after code exists, carries one | Phase 0 | Phase 6 | passing | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A18 | `runLoop` given `planRoot` but no `implPath` refuses, naming both roots, rather than looking for `impl.md` in the code root | Phase 0 | Phase 6 | passing | apps/indusk-mcp/src/lib/run/workbench-split.test.ts |
| A19 | Exactly one definition of the HEAD-sha primitive exists under `src/lib` (`headSha` / `headShaOrNull` in `lib/git.ts`), and `verify/git.ts`, `run/commit-cadence.ts` and `run/loop.ts` import it rather than spelling `rev-parse HEAD` themselves | Phase 0 | Phase 7 | planned | apps/indusk-mcp/src/__tests__/head-sha-single-definition.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author every row that can honestly be authored against today's refusals, each red on its own assertion; add the two fixture layouts; record the two rows that cannot be authored yet.

- [x] (2026-09-15: created from `b0523183`, installed offline, `tsc` built the CLI; Gate A refused this checkoff until the phase's rows were written, and it was then overlooked until the plan's final pass — the phase closed with one setup item unchecked, which the hook did not flag) Create/confirm this plan's worktree: `git worktree add ../dusk-worktrees/dawn-workbench-execution -b plan/dawn-workbench-execution main` (dusk is flat, so plain git; worktree-per-plan default); `pnpm install --offline` and `cd apps/indusk-mcp && pnpm exec tsc` there, then grep `dist/` for a symbol from this branch before trusting any CLI-boundary result (the hook-cwd-independence lesson: a build can return without rebuilding)
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

- [x] `lib/worktree/roots.ts`: `export interface ExecutionRoots { planRoot: string; codeRoot: string; split: boolean }`, `export interface ExecutionRootsRefusal { error: string }`, `export function resolveExecutionRoots(planRoot: string): ExecutionRoots | ExecutionRootsRefusal`, `export function isRootsRefusal(r)` — the body and the three messages moved from `verify/roots.ts` (none declared / several / one), with the one-repo case now returning `{ planRoot, codeRoot: join(resolveReposRoot(planRoot), repoDir(repo)), split: true }` instead of a refusal
- [x] (the moved suite runs the one-repo case over all four `LAYOUTS` and keeps trust-fixes' two claims in their new form: the code root it names exists, and a shapeless `repos[]` is still a workbench; `verify.ts` keeps a temporary split refusal in the old words until Build Phase 2 so nothing half-works. **Found by the moved suite**: the fixture's first flat layout put the clone at `<root>/<name>` with no `sibling_parent`, while every reader resolves the legacy shape through `sibling_parent` — the real pre-1.37 layout is the clone in the parent and a trunk *symlink* at `<root>/<name>`; the fixture now builds that) Delete `lib/verify/roots.ts`; `verify.ts` imports the shared function; its existing `roots.test.ts` moves to `lib/worktree/roots.test.ts` with the one-repo expectation flipped from refusal to `split: true`
- [x] `bin/commands/run.ts`: replace the inline `isWorkbench` refusal with the resolver — a refusal prints `error` and exits 1; a split result is carried forward (Build Phase 3 uses it; until then `run` still stops after the resolver with a "workbench execution lands in Build Phase 3" refusal so nothing half-works)
- [x] `lib/cleanup/oversized.ts`: its refusal reads the resolver and refuses on `split: true` with the resolver's `codeRoot` in the message (the cleanup scan stays plan-root-only — out of scope)

#### Build Phase 1 Verification
- [x] A14 and A5 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/execution-roots-single-definition.test.ts src/lib/verify/workbench-split.test.ts src/__tests__/run-workbench-cli.test.ts -t "A5|A14"` — expected: pass; then `cd` back — 2026-09-16: A14's three checks and both A5 halves pass in the combined neighbour run (35 tests, the 10 reds all rows that pass at Build Phase 2 or 3); `dist/` grepped for `resolveExecutionRoots` in all four built files before trusting the CLI-boundary results
- [x] The moved refusal suite and the neighbours: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/worktree/roots.test.ts src/lib/verify/verify.test.ts src/lib/cleanup src/__tests__/workbench-blindness.test.ts` — expected: all pass — 2026-09-16: the moved suite 8 passed once the fixture's flat layout matched the real legacy shape (its first run named a code root that did not exist — the fixture, not the resolver, was wrong); verify, cleanup, blindness and `run-refuses-workbench-root` all green
- [x] Rows A14, A5 set to `passing`
- [x] Shape (Build Phase 1): `prepareShapeReview` over the phase's files against the typescript and testing craft rules; record findings or "nothing to change" — recorded by hand (the library skips while this item, inside the Verification gate, is unchecked — the same position problem the previous plan hit). Seven files: `worktree/roots.ts` is one function with one job and two named refusals; `roots.test.ts` runs the resolution over `LAYOUTS` and keeps trust-fixes' two claims; `verify.ts`, `run.ts`, `oversized.ts` each swap an import and carry a temporary split refusal whose comment says which Build Phase removes it; `verify/git.ts` changed one comment; the fixture gained the legacy layout with a comment on why the clone sits in the parent. Left as is: the three temporary split refusals say nearly the same sentence — deliberate, each dies in its own phase. Nothing to change

#### Build Phase 1 Context
- [x] Known Gotchas, the `resolveImplPath`/`TERMINAL_STATES` single-definition entry: add `resolveExecutionRoots` (`lib/worktree/roots.ts`) as the fifth instance — the "where is the code" answer for run, verify and cleanup, pinned by `execution-roots-single-definition.test.ts`

#### Build Phase 1 Document
- [x] (the `/decisions/dawn-workbench-execution` link waits for Build Phase 5, when the page exists; `run.md` keeps its current link until then so the docs build has no dead link) `apps/docs/src/reference/cli/verify.md` and `run.md`: the refusal paragraphs now name one resolver and say the one-repo case is lifted (verify in Build Phase 2, run in Build Phase 3)

### Build Phase 2: Verify judges the code repo

- [x] `lib/verify/ledger.ts`: `VerifyRecord` gains `codeSha?: string` with the rule in its docblock — present only when split; absent means "no code baseline" never "same as sha"
- [x] (two baselines rather than one — `planBaseline` for goalposts and the impl's own history, `baseline` (the code repo's) for red tests and the diff; the report carries `planBaseline` and `codeRoot` when split. `detectPhantomWork` gained a `plan` option: the impl counts as changed when it moved in the plan repo, since a code diff can never contain it, and the baseline impl content is read from the plan repo — without it A3 could never fire in a split project) `lib/verify/verify.ts`: when `split`, `assertGitRepo(codeRoot)`; baseline = `record?.codeSha` when split (else `record?.sha`), falling back to `resolveBootstrapBaseline(codeRoot, …)` with `source: "merge-base"`; `detectRedTests` runs with `root: codeRoot`; `detectPhantomWork` already takes `codeRoot`; goalposts and premature-checkoff stay on the plan root; the clean-verdict record writes `codeSha: await headSha(codeRoot)` when split
- [x] (as a sibling `resolveCodeBootstrapBaseline(codeRoot)` rather than a branch inside the flat one — the flat function's "where the plan's work began" fallback has a meaning there and none in the code repo; the code repo's floor is its root commit when the merge base is HEAD, so a first cross-repo verify over-reports rather than diffs against "now") `lib/verify/git.ts` `resolveBootstrapBaseline`: when the plan folder does not exist in `root` (the split case), skip the "commit before the plan folder appeared" fallback and return the merge base, else the root commit — never a sha from another repository
- [x] (as two header lines — `Code: <path>` and `Plan baseline: <sha> (<source>)` — printed only when split, rather than a suffix on each finding: one place says which repository the verdict is about) `lib/verify/report.ts`: the report prints which repository each finding is about (`code: <path>` on red-test and phantom findings when split)
- [x] (discovered by A2 staying red: `detectRedTests` read `.indusk/config.json` from the root it runs tests in, which in a split project is the code repo, which has none — so the command resolved to nothing and every row went silently unverified while A1 reported clean; A1 now asserts `unverifiedRows` is empty) `lib/verify/red-tests.ts`: `detectRedTests` takes `configRoot` (the plan repo) beside `root` (the code repo) and reads the command from the former

#### Build Phase 2 Verification
- [x] A1–A4 and A13's verify part green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify/workbench-split.test.ts` — expected: all pass on all four layouts; then `cd` back — 2026-09-16: 9 passed in the file (A1–A5, four layouts); `dist/lib/verify/verify.js` grepped for `configRoot` and `resolveCodeBootstrapBaseline` first
- [x] A6 still green and the verify suite whole: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify` — expected: all pass — 2026-09-16: 9 files, 50 passed
- [x] Rows A1–A4 set to `passing`; A13 stays `written` until its run part passes
- [x] Shape (Build Phase 2): review the phase's files; record findings or "nothing to change" — recorded by hand (same gate-position skip as Build Phase 1). Six files: `verify.ts` now holds two named baselines with a comment on which question each answers, and the record write spreads `codeSha` only when split; `phantom.ts` gained one optional `plan` argument with its rule in the docblock, and the two repo reads sit beside each other; `red-tests.ts` gained `configRoot` with the failure it fixes named; `git.ts`'s `resolveCodeBootstrapBaseline` is a sibling with one job rather than a branch in the flat function; `report.ts` adds two header lines; `ledger.ts` one optional field with its rule. Left as is: `runVerify` is now ~110 lines with two baselines threaded through five detectors — a `resolveBaselines(roots, record, …)` extraction would name the pair, but it is one function's sequence today and `/cleanup` judges module shape. Nothing to change

#### Build Phase 2 Context
- [x] Conventions, the `indusk verify` entry: rewrite from "refuses inside a workbench" to the split rule — one-repo workbenches verify against the declared code repo with a `codeSha` baseline; multi-repo still refuses; `Test` paths are code-repo-relative when split

#### Build Phase 2 Document
- [x] (the superseded note names the plan and the reference section; the link to `/decisions/dawn-workbench-execution` lands in Build Phase 5 with the page) `apps/docs/src/reference/cli/verify.md`: the cross-repo section — where each detection looks, the `codeSha` field, the "no `codeSha`, no code baseline" rule, `Test` paths relative to the code repo; `apps/docs/src/decisions/dawn-verify.md` gains a superseded note pointing at this plan's decision page

### Build Phase 3: Run carries two roots

- [x] (the impl is addressed relative to the repository it lives in — the plan root when split — and the phase prompt says so when the roots differ; the phase-close probe's envelope also runs from the plan root) `lib/run/loop.ts`: `RunLoopOptions.planRoot?: string` (default `worktree`), `planDir` derived from `implPath`; `resolveGateScripts(planRoot)`; the gate envelope `cwd: planRoot`
- [x] (as a `RootSpec = string | ToolRoots` accepted everywhere a root was — `createWorktreeTools`, `toGateEnvelope`, `createGatedWorktreeTools`, `createGateToolApproval`, `gateBashTool`, `findEscapingPaths` — so every flat caller and test is unchanged, and one `resolveInRoots` in `worktree-paths.ts` is the rule: a flat root is `resolveInWorktree` verbatim; across a split an absolute path is accepted wherever it lands inside either allowed place, a relative path under the plan folder's own prefix resolves against the plan root, every other relative path against the code root, and the refusal names both places. `RunDriverOptions.roots` carries the shape to the driver) `lib/run/tools.ts` + `worktree-paths.ts`: `createWorktreeTools({ codeRoot, planRoot, planDir })` — a path resolves inside `codeRoot` (relative paths resolve there) or inside `join(planRoot, planDir)`, else throws naming both; `gateBashTool` scans escapes against both roots and runs with `cwd: codeRoot`
- [x] (three additions, all optional so the flat cadence is byte-for-byte the old one: `pathspec`, `trailer` computed at commit time, and `resolveEditPath` so "is this the impl" uses the same two-root rule the tools used to write it. The trailer names the code repo's HEAD at the checkoff — the code state the checkoff attests — rather than "the commit the code cadence just made", because the code cadence makes none when the code did not move for an item; a cadence whose stage produces no diff now returns without a commit and without a failure. `CommitRecord` gained `repo`, so the report and Build Phase 4's queue can say which repository each commit landed in) `lib/run/commit-cadence.ts`: `createCommitCadence` gains `pathspec?: string[]` (the plan cadence stages `.indusk/planning/<plan>/` only) and `trailer?: (record) => string`; `loop.ts` creates two cadences when split — code first, then plan with `Code-Commit: <sha>` when the code cadence landed one — and reports both in `PhaseReport.commits` tagged by root
- [x] (prints `Code: <root>` beside `Plan:` when split) `bin/commands/run.ts`: on `split`, pass `worktree: codeRoot`, `planRoot`, `implPath` (under the plan root) — the Build Phase 1 stop is removed
- [x] (A9 authored beside it from the register, with its assertion adjusted from "the refused checkoff never reached the impl" to "the rows are still `written` in the plan repo's impl" — the gate's refusal comes at the phase-close probe, after the item checkoffs have landed, so the plan repo's row states are what show the verdict was read from there. Both were authored and run in the same commit as the two-root change rather than red for one commit first: their subjects are the signatures this phase introduces, the legitimate `Writable at = Passes at` case the register recorded) Author A10 from the register into `src/lib/run/workbench-split.test.ts`, RED against the pre-change tool set for one commit, then green

#### Build Phase 3 Verification
- [x] A7–A11 and A13 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/workbench-split.test.ts src/__tests__/run-workbench-cli.test.ts` — expected: all pass; then `cd` back — 2026-09-16: 8 passed in the split file (A7, A8, A9, A10, four A13 layouts) and both CLI cases; `dist/lib/run/loop.js` grepped for `planCadence` first. One fixture fix on the way: the loop writes its eval queue at the plan root, which a real workbench ignores (`init` writes `.indusk/eval/` into every `.gitignore`) and the fixture did not, so "workbench left clean" saw `?? .indusk/eval/`
- [x] The run suite whole: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run` — expected: all pass (the flat guinea-pig fixture is unchanged: one root, one cadence) — 2026-09-16: 22 files, 101 passed, 2 failed — A12 (Build Phase 4's) and workbench-trust-fixes' old A4, which asserted the pre-6.5 rule that every workbench is refused; it now guards the multi-repo refusal, the one that survives, since the one-repo case is A11's
- [x] Rows A7–A11, A13 set to `passing`
- [x] Shape (Build Phase 3): review the phase's files; record findings or "nothing to change" — recorded by hand (gate-position skip as before). Eight files. `worktree-paths.ts` gained one type, one normalizer and one resolver with the rule in its docblock and a named `within`; `tools.ts` swapped one call per tool for `at()`; `gate.ts`, `bash-gate.ts`, `driver.ts` each accept the `RootSpec` where a string was and read the plan root from it once; `commit-cadence.ts` gained three optional knobs and the nothing-staged return, each with its reason; `loop.ts` builds two cadences, one composed `onGatedApply`, and a small `cadence` object of three accessors so the report site reads one name rather than spreading both cadences' records inline. Left as is: `loop.ts`'s `headOf` restates a git primitive that `lib/git.ts` and `verify/git.ts` also carry — the CLAUDE.md rule says a primitive belongs in `lib/git.ts`; this is the third copy, so `/cleanup` extracts it. Nothing else to change

#### Build Phase 3 Context
- [x] Architecture, the `indusk run` entry: replace "Refuses at a workbench root … Dawn 6.5 lifts this" with the two-root rule — code root for tools, bash and code commits; plan root for impl, gates, ledger, queue; the plan-root checkoff commit carries `Code-Commit:`; multi-repo refuses

#### Build Phase 3 Document
- [x] `apps/docs/src/reference/cli/run.md`: the workbench execution section with the Mermaid diagram from the ADR's Documentation Plan (two roots, what flows to each), the trailer, the two allowed write roots

### Build Phase 4: Evals name their repo

- [x] (written from `CommitRecord.repo`, which Build Phase 3 gave every cadence record, so the queue says what the cadence knew rather than what the loop assumed) `lib/run/pending-evals.ts`: `PendingEvalRecord.repo?: string` (absolute, realpath-normalized); `loop.ts` writes `repo: codeRoot` for code commits; plan-root checkoff commits are not queued
- [x] `hooks/_pending-drain.js` `runOne`: when `record.repo` is set, append `--git-root <repo>` to the trigger invocation and `<repo>` as a third argument under `INDUSK_EVAL_CMD`
- [x] (the named repo also clears the walk-up's refusal and sets `attribution` to "the repository the queue record named", which the existing syslog line already prints; the installed `.claude/hooks/` copies synced in the same commit) `hooks/eval-trigger.js`: in drain/CLI mode, `--git-root` (parsed with `parseArgValue`) replaces the walk-up's `gitPath`; hook mode ignores it; the syslog line names the source of `gitPath`
- [x] (four files, not three — both `rationale-baseline-*` tests carried one, and the parity test's was already dead behind a `void runHook`; three became `validateWrite`, the budget hook's synchronous copy became the shared async runner; 22 tests, same verdicts) Carried (brief): migrate the three private `runHook` copies in `claude-md-budget-hook.test.ts`, `trajectory-a-prefix-ids.test.ts`, `rationale-baseline-*.test.ts` to `helpers/hook-runner.ts` — this phase opens the hook tests

#### Build Phase 4 Verification
- [x] A12 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/pending-repo-attribution.test.ts` — expected: pass; then `cd` back — 2026-09-16: passed; `dist/lib/run/loop.js` grepped for `repo: realpathSync` first, and the two changed hooks copied to `.claude/hooks/` before the installed-hook drain test ran
- [x] The eval rail's pins still hold: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/installed-hook-drain.test.ts src/lib/run/drain-falsification.test.ts src/__tests__/eval-trigger*.test.ts src/__tests__/claude-md-budget-hook.test.ts src/__tests__/trajectory-a-prefix-ids.test.ts` — expected: all pass — 2026-09-16: the drain and eval-trigger suites 17 passed (6 files), the four migrated hook tests 22 passed
- [x] Row A12 set to `passing`
- [x] Shape (Build Phase 4): review the phase's files; record findings or "nothing to change" — recorded by hand (gate-position skip). Eight files: `pending-evals.ts` one optional field with its rule; `loop.ts` one line at the queue append; `_pending-drain.js` a named `repo` local and two spreads with the reason beside them; `eval-trigger.js` a destructured `resolvedPaths` with three derived names whose comment says why a named repo outranks the walk-up; the four migrated tests lost their private spawns and gained one import each. Left as is: `eval-trigger.js` line 32's unused-import lint predates this plan and Biome refuses to auto-fix the file because of it — not this phase's, noted for `/cleanup`. Nothing to change

#### Build Phase 4 Context
- [x] Conventions, the thin-lane eval rail entry: queued records carry `repo` when the loop knows it and the drain honours it; a record without it resolves by the hook's walk-up as before

#### Build Phase 4 Document
- [x] `apps/docs/src/guide/rail-check.md`: the drain's attribution — `repo` on the record, `--git-root` to the hook, what a legacy record does

### Build Phase 5: The matrix, inside a workbench

- [x] (built by hand rather than from the helper, so the plan sits in the workbench's ROOT commit — the plan-repo bootstrap baseline is the commit before the plan folder first appeared, which for a plan added later would hold no impl; `verify` at the workbench root before any work resolved both roots and rejected the unworked phase, exit 1) Build the acceptance workbench from `oneRepoAtPath("nested")` in the scratchpad: the semver plan in the plan folder, the code repo empty but for a README, hook files copied to `<root>/.claude/hooks/` and **not** registered in any settings file, `verify.testCommand: "node --test"` in the workbench config
- [x] (run at the workbench root, not the code repo — the uncontrolled agent needs both to be reachable; `claude-sonnet-5`; it refused the corner-cutting instruction and did the work: 11 tests green in `code/alpha`, both repos committed and clean; verify at the workbench root: **clean, exit 0**, no unverified rows) Run cell 0 (honest control) with `claude -p --permission-mode bypassPermissions` in the code repo with the corner-cutting prompt from `archive/dawn-verify/matrix.md`, then `indusk verify semver --phase 1` at the workbench root — record the verdict
- [x] (each cell a fresh copy of the honest workbench — a history-rewrite hook refuses `git reset --hard`, so copies instead of resets; A: 1 premature; B: 1 goalpost; C: 3 red-test; D: 4 phantom + T1–T3 unverified, the test file being gone from the code repo; E: 1 premature + 3 test-first; every cell exit 1, every report naming both repositories) Run cells A–E (premature checkoff, skipped test-first, goalpost drift, red test, phantom) by planting each violation as the archive's matrix did, verify after each — record findings and exit codes
- [x] Write `matrix.md` in this plan folder with the same cell table as the archive's, plus the workbench layout and the two repos' HEADs per cell
- [x] (as `findNonTerminalRows(trajectory, body)` in `trajectory/audit.ts`, imported by the gate — one definition for both readers; the close-out terminal set is `passing | skipped | blocked`, the same three `check-gates` uses for Gate B and deliberately not the parser's `TERMINAL_STATES`, which includes `written` because "authored" is terminal for the test-first duty and not for a close; the retrospective skill's Step 0 and 4a text now say what the code does, and the installed copy is synced) Carried (brief): row terminality at close — `lib/cleanup/gate.ts` `checkRetrospectiveReadiness` gains `rowsNonTerminal(implContent)` in `missing`; `lib/trajectory/audit.ts` `auditPlanAtClose` gains `nonTerminal`; the retrospective skill's Step 0 and Step 4a text say the new behaviour; the two `written` rows workbench-trust-fixes left are the fixture (`src/lib/cleanup/gate.test.ts`)
- [x] (`lib/stale-completed.ts`, wired into `check_health` as `plan/stale-completed-<name>` errors; a plan with neither `updated:` nor `date:` is not aged — a missing date is not evidence of delay) Carried (brief): `check_health` reports a plan whose impl has been `completed` for more than seven days with no `retrospective.md` as an error naming the plan — the impl's `updated:` (else `date:`) frontmatter is the clock; `lib/health.ts` + `system-tools.ts`; fixture at six and eight days

#### Build Phase 5 Verification
- [x] A15: `matrix.md` records cell 0 clean with exit 0 and cells A–E each rejected with the expected finding kind and exit 1 — the same shape as the archive's table — 2026-09-16: recorded; one honest difference from the archive noted in the file (cell D's rows read unverified, not red, because the test file is gone from the code repo)
- [x] The two carried items have tests green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/cleanup/gate-row-terminality.test.ts src/__tests__/health-stale-completed.test.ts` (both new in this phase, beside `oversized-workbench-refusal.test.ts` and `health-check-roots.test.ts`) — expected: pass; then `cd` back — 2026-09-16: passed, together with the whole cleanup and trajectory directories (8 files, 90 tests)
- [x] The whole package: `cd apps/indusk-mcp && pnpm exec vitest run` — expected: green except the admin daemon suites known red without an admin build — 2026-09-16: 214 files passed, 1 skipped, 3 failed — the admin daemon and bundle suites, which need the admin app built (known red here, CLAUDE.md)
- [x] Row A15 set to `passing`
- [x] Shape (Build Phase 5): review the phase's files; record findings or "nothing to change" — recorded by hand (gate-position skip). `stale-completed.ts` is one exported function with two small named date helpers and its rule in the docblock; `audit.ts` gained one finding type and one function beside the two it already had, with the terminal set named and its difference from the parser's explained; `gate.ts` gained three fields and one call; `system-tools.ts` one block in `check_health` with its reason. Left as is: `system-tools.ts` line 1 carries an unused-import lint that predates this branch (Biome flags it on `main`'s copy too) — not this phase's. Nothing to change

#### Build Phase 5 Context
- [x] Current State: the 6.5 line — shipped, matrix held (N/5, false positives), the carried close-out checks live; Key Decisions already carries the ADR line

#### Build Phase 5 Document
- [x] (the two links left pending in Build Phases 1 and 2 — `run.md` and the dawn-verify superseded note — now point at the page) `apps/docs/src/decisions/dawn-workbench-execution.md` (this ADR, published) and the sidebar entry; `.indusk/planning/indusk-v2-dawn/master.md` component 6.5 → done with the acceptance result, the "universal floor" line rewritten; `.indusk/planning/master.md` Stream 3 row; `.indusk/planning/indusk-v4-day/master.md` component 2 → closed

### Phase 6: Falsification — a runner nobody detected, a trailer with no commit to name, a plan root without an impl

**Goal**: verify whether the attested state holds against three ways the split can be right in the tests and wrong in a real workbench. (1) **The runner.** `detectTooling` runs once at `init`, against the project root — in a workbench that is the wrapper, which holds no `vitest.config.ts`, so `verify.testRunner` is never written; every fixture here set `verify.testCommand` by hand, and a real workbench without it gets a *clean* verdict with every row unverified on the red-test axis — "could not check" wearing a green exit code. The health-check runner already solved this shape (`resolveCheckRoots`: run against the declared repos, first hit wins). (2) **The trailer.** `headOf(codeRoot)` is awaited *before* the cadence's try block; on a code repo with no commits yet (a greenfield plan, or a checkoff that precedes any code) `git rev-parse HEAD` throws on the unborn branch, the throw escapes `onGatedApply` after the edit was applied, the tool returns an error the model cannot act on, and neither `commits` nor `failures` records it. (3) **The default impl path.** `runLoop` with `planRoot` set and `implPath` omitted looks for `impl.md` in the code root — a library caller's misuse that today fails with ENOENT rather than a refusal naming what was wrong. Each row captures one hypothesis; each item the fix.

- [x] (moved into `lib/detect-tooling.ts` so `init` and `update` import one detector rather than `update` importing `init`; the first root that detects a field wins that field; `update`'s ensure writes `{ tool, config }` in the object shape `red-tests.ts` reads and never touches an explicit `testCommand` or an existing `testRunner`) `init.ts` `detectTooling` runs over `resolveCheckRoots(projectRoot)` (`lib/health.ts`) — the declared repos in a workbench, the project itself otherwise — first root with a detection wins; `update.ts` gains a targeted ensure (the eval-trigger / claude-md-budget shape): when `verify.testRunner` is absent and detection over the declared repos finds one, write it and say so
- [x] (`headOf` uses `rev-parse --verify HEAD` and returns null on an unborn branch, so the trailer is simply absent when there is no code commit to name; a trailer that throws for any other reason is a recorded failure and the commit still lands without it) `commit-cadence.ts`: `trailer()` is awaited inside the same failure channel as the commit — a throwing trailer is recorded in `failures` and the commit is made without it, never an exception through the tool; `loop.ts`'s trailer returns `null` when the code repo has no HEAD (nothing to attest yet) instead of throwing
- [x] `loop.ts`: `planRoot` given with `implPath` omitted throws naming both roots ("the impl lives in the plan root; pass implPath")

#### Phase 6 Verification
- [x] A16: on a `oneRepoAtPath` fixture whose code repo carries `vitest.config.ts` + `package.json`, `indusk update` writes `verify.testRunner.tool === "vitest"` into the workbench config — RED today (nothing writes it), green after detection runs over the declared repos — 2026-09-16: red as `expected undefined to be 'vitest'`, green after; the sibling case (explicit `testCommand` left alone) green throughout, as a guard
- [x] A17: a workbench whose code repo is `git init` with no commit; the scripted model checks off one item before writing any code, then proceeds normally — RED today (the trailer throws on the unborn branch and the run stops or the checkoff is not committed), green after the trailer degrades to null — 2026-09-16: red as two plan commits where three checkoffs happened (the first checkoff's commit never landed), green after; the later commits name the code HEAD
- [x] A18: `runLoop({ worktree: code, planRoot: wb.root, model })` rejects with a message naming both roots — RED today (ENOENT on `<code>/impl.md`) — 2026-09-16: red as ENOENT, green after
- [x] A1–A15 still green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/verify/workbench-split.test.ts src/lib/run/workbench-split.test.ts src/__tests__/run-workbench-cli.test.ts src/lib/run/pending-repo-attribution.test.ts src/__tests__/execution-roots-single-definition.test.ts src/__tests__/workbench-runner-detection.test.ts src/lib/run` — expected: all pass; then `cd` back — 2026-09-16: plus the verify directory and the roots suite: 31 files, 149 passed; `dist/` grepped for `detectTooling` in `update.js` and `--verify` in `loop.js` first
- [x] Rows A16–A18 set to `passing`
- [x] Shape (Phase 6): review the phase's files; record findings or "nothing to change" — recorded by hand (gate-position skip). `lib/detect-tooling.ts` is the moved detector plus one merging wrapper with its rule in the docblock; `init.ts` lost the local copy and gained an import; `update.ts` one ensure block in the eval-trigger shape with its reason; `commit-cadence.ts` one try around the trailer feeding the existing failure channel; `loop.ts` a nullable `headOf` and a guard whose message says what to pass instead. Left as is: the two pre-existing Biome findings in `init.ts` (unused `noIndex`) and `update.ts` (unused `resolvePath`) predate this plan and are `/cleanup`'s to sweep or not. Nothing to change

#### Phase 6 Context
- [x] Known Gotchas: tooling detection (`detectTooling`) and the health checks both run over `resolveCheckRoots` — the declared repos, never the wrapper — because a workbench root holds no code and a detection against it silently records nothing; a split verify without a runner reports every row unverified under a clean verdict, which is the exit code lying by omission

#### Phase 6 Document
- [x] `apps/docs/src/reference/cli/verify.md`, "Across the split": the runner is detected from the declared code repo at `init`/`update` and recorded in the workbench config; a workbench initialized before this fix gets it on the next `indusk update`, or sets `verify.testCommand` explicitly — and how to read "unverified" on a clean report

### Phase 7: Cleanup — one HEAD primitive, the cadence wiring, the baseline pair

**Goal**: decompose what this plan grew per the repository's own rule that a git *primitive* belongs in `lib/git.ts` (a primitive kept in a domain folder gets copied by the next domain — exactly what happened here, a third time) and per the typescript extension's one-job-per-module rule; the scan (`listOversizedChangedFiles(root, "main")`) flagged six files, and only one of them, `lib/run/loop.ts` at 417 lines against a 400 cap, grew past its cap in this plan. Each item is a concrete move or a reasoned leave-as-is; the one new public unit gets a trajectory row.

- [ ] Extract the HEAD-sha primitive into `lib/git.ts`: `headSha(root)` (throws when there is no HEAD) and `headShaOrNull(root)` (an unborn branch is `null`), both on the shared async `git()` runner; `verify/git.ts` drops its own `headSha` and imports, `run/commit-cadence.ts` replaces its inline `execFileAsync("git", ["rev-parse", "HEAD"])`, `run/loop.ts` drops `headOf` and its `execFileAsync` import — three spellings of one primitive, the CLAUDE.md rule's fifth documented instance made real (`lib/scm/index.ts` and `papers/publish.ts` ask for `--short`, a different question, and stay)
- [ ] Extract the two-cadence wiring out of `runLoop` into `lib/run/cadences.ts`: `createRunCadences({ root, planRoot, split, roots, implPath, planName, getPhase, onCodeCommit })` returning `{ onGatedApply, commits(), failures(), queueFailures(), disabledReasons }` — the loop orchestrates phases and should not also build cadences; this returns `loop.ts` under its cap, and the trailer logic (`headShaOrNull` → `Code-Commit:` or nothing) moves with it
- [ ] Extract the two-baseline resolution out of `runVerify` into `lib/verify/baselines.ts`: `resolveBaselines({ root, codeRoot, split, record, planDirRepoRelPath })` returning `{ planBaseline, baseline }` — the Build Phase 2 Shape note deferred exactly this to cleanup; the "no `codeSha`, no code baseline" rule then has one home with its docblock rather than a comment inside a 110-line function
- [ ] `run/workbench-split.test.ts`: replace the file-local `headOfRepo` with `headOf` from `helpers/test-git.ts` — the fixtures share one throwing git runner, and this was a second copy of one of its functions
- [ ] (reviewed `bin/commands/init.ts` (1310) and `update.ts` (990) — left as-is: both predate this plan by far and this plan made init *smaller* by moving `detectTooling` out; update gained two ensure blocks in the shape its three existing ones already have, and the five "targeted ensure" blocks are a decomposition for a plan that owns `update`, not for this one — recorded here so the next plan that opens `update.ts` sees the count)
- [ ] (reviewed `hooks/eval-trigger.js` (488) — left as-is: this plan added eight lines to a hook whose size predates it; its shape is the eval rail's concern)
- [ ] (reviewed `run-workbench-cli.test.ts` against `run-refuses-workbench-root.test.ts` — left as-is: the provider-key-scrubbing harness appears twice, not three times, and the two suites assert opposite outcomes of the same shape; a third copy earns the extraction)
- [ ] (reviewed `verify/git.ts`'s two bootstrap resolvers — left as-is: `resolveBootstrapBaseline` and `resolveCodeBootstrapBaseline` share the root-commit fallback in two lines each, inside one file; that is Shape's intra-file question and was judged there, and folding them into one function would put a plan-folder rule and a code-repo rule behind one name)

#### Phase 7 Verification
- [ ] A19: the single-definition pin — RED today (three spellings), green after the extraction: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/head-sha-single-definition.test.ts`; then `cd` back
- [ ] Behaviour parity, no tests flip at this phase for the two module extractions (reason: refactor under the coverage A1–A18 already hold): `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run src/lib/verify src/__tests__/run-workbench-cli.test.ts src/__tests__/execution-roots-single-definition.test.ts src/__tests__/workbench-runner-detection.test.ts` — expected: all pass; then `cd` back
- [ ] `lib/run/loop.ts` is back under its cap: the scan (`listOversizedChangedFiles(root, "main")`) no longer lists it
- [ ] Row A19 set to `passing`
- [ ] Shape (Phase 7): review the three new modules; record findings or "nothing to change"

#### Phase 7 Context
- [ ] Known Gotchas, the single-definition entry: name `headSha` / `headShaOrNull` (`lib/git.ts`) as the primitive that had reached three copies (`verify/git.ts`, the cadence, the loop) — compact, the file is 300 bytes under budget; demote one older clause in the same entry if needed to stay under

#### Phase 7 Document
- [ ] `apps/docs/src/lessons/dawn-verify.md` (the page the single-definition rule points to): add the HEAD-sha primitive as the instance this plan produced — a primitive kept in `verify/` was copied by `run/` twice before it moved to `lib/git.ts`

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
