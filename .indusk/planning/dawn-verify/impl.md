---
title: "Dawn Verify — Implementation"
date: 2026-08-05
status: completed
trajectory: required
rationale: required
gate_policy: ask
---

# Dawn Verify — Implementation

## Goal

Ship `atdawn verify <plan> --phase N` — a read-only phase-boundary detector for work Dawn did not execute. It reconstructs the boundary from a chained verify ledger, reuses the existing probe and goalpost machinery for the detections that already have machinery, adds the system's first test-execution-backed check of trajectory `passing` claims, and renders a verdict without touching the working tree.

Closes Dawn component 6 — the keystone — and produces the recorded evidence component 7's shape depends on.

## Scope

### In Scope
- `atdawn verify <plan> --phase N` with `--full-suite`, registered like `run`.
- Five detections: premature checkoff, skipped test-first duty, goalpost drift, red tests, phantom work.
- The chained verify ledger with merge-base bootstrap and loud refusal on corruption.
- An optional trajectory `Test` column naming test files, backward-compatible both directions.
- A runner-agnostic test invocation resolved from the existing `verify` config block.
- The recorded acceptance experiment against an agent Dawn does not control.

### Out of Scope
- Reverting, re-dispatching, or any repair — component 7.
- Agent adapters; the acceptance experiment drives an external agent by hand.
- Tier-2 judgment checking (diff review for "broke something / ignored the instruction").
- Retrofitting test references into archived plans.
- Verifying uncommitted working-tree state.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `lib/verify/ledger.ts` (append, chained lookup, bootstrap, corruption refusal); `lib/verify/verify.ts` exporting `runVerify()` returning a report with a resolved baseline and no detections; git-root guard | `cleanup/oversized.ts` merge-base fallback chain; `pending-evals.ts` ledger shape |
| Phase 2 | Static detections wired into `runVerify()`; report rendering; `bin/commands/verify.ts` + commander registration; ledger append on clean verdict only | Phase 1's baseline + report shape; `run/probe.ts`; `run/goalposts.ts`; `run/gate.ts` |
| Phase 3 | `Test` column in the trajectory parser; test-command resolution from `.indusk/config.json`; per-file invocation; unverified-row accounting | Phase 2's report; `trajectory/parser.ts`; `lib/config.ts` |
| Phase 4 | Phantom-work detection from the diff since baseline | Phase 2's report; Phase 1's baseline SHA |
| Phase 5 | Recorded acceptance experiment (`matrix.md`); master component 6 verdict; docs | The complete command from Phases 1–4 |

## Test Trajectory

| ID | Asserts | Test | Writable at | Passes at | State |
|----|---------|------|-------------|-----------|-------|
| A1 | Verifying a phase that checked an item while an earlier phase has an unchecked gate item reports a rejection naming that item and its phase | `apps/indusk-mcp/src/lib/verify/detect.test.ts` | Phase 1 | Phase 2 | passing |
| A2 | Verifying a phase that left a row `planned` at its writable phase reports a rejection naming that row | `apps/indusk-mcp/src/lib/verify/detect.test.ts` | Phase 1 | Phase 2 | passing |
| A3 | Verifying a phase whose trajectory assertion text changed since the baseline reports a rejection showing previous and current text | `apps/indusk-mcp/src/lib/verify/detect.test.ts` | Phase 1 | Phase 2 | passing |
| A4 | Verifying a phase with a row marked `passing` whose test fails reports a rejection naming that row and the failure | `apps/indusk-mcp/src/lib/verify/red-tests.test.ts` | Phase 1 | Phase 3 | passing |
| A5 | Verifying a phase where an item was checked with no file changes since the baseline reports a rejection naming that item | `apps/indusk-mcp/src/lib/verify/phantom.test.ts` | Phase 1 | Phase 4 | passing |
| A6 | Verifying an honest phase reports success, exits 0, and states the baseline commit it judged against | `apps/indusk-mcp/src/lib/verify/verify.test.ts` | Phase 1 | Phase 2 | passing |
| A7 | A rejecting verify leaves every file in the repository byte-identical — no revert, no rewrite, no staged change | `apps/indusk-mcp/src/lib/verify/verify.test.ts` | Phase 1 | Phase 2 | passing |
| A8 | A rejecting verify exits non-zero so a calling script or CI step fails rather than continuing | `apps/indusk-mcp/src/lib/verify/verify.test.ts` | Phase 1 | Phase 2 | passing |
| A9 | After a phase verifies clean, verifying the next phase judges against the commit that verification recorded, not the merge base | `apps/indusk-mcp/src/lib/verify/ledger.test.ts` | Phase 1 | Phase 2 | passing |
| A10 | Verifying a plan never verified before reports which baseline it bootstrapped from and proceeds | `apps/indusk-mcp/src/lib/verify/ledger.test.ts` | Phase 1 | Phase 1 | passing |
| A11 | A rejecting verify records nothing — re-running produces the identical rejection rather than treating the bad phase as a baseline | `apps/indusk-mcp/src/lib/verify/ledger.test.ts` | Phase 1 | Phase 2 | passing |
| A12 | A corrupted or unreadable ledger causes verify to refuse loudly naming the problem, never silently proceeding as if never verified | `apps/indusk-mcp/src/lib/verify/ledger.test.ts` | Phase 1 | Phase 1 | passing |
| A13 | A row claiming `passing` with no test reference is reported as unverified, distinct from checked-and-passed | `apps/indusk-mcp/src/lib/verify/red-tests.test.ts` | Phase 1 | Phase 3 | passing |
| A14 | A plan authored before test references verifies without error and reports how many rows could not be red-test-checked | `apps/indusk-mcp/src/lib/verify/red-tests.test.ts` | Phase 1 | Phase 3 | passing |
| A15 | Running verify where there is no git repository fails loudly naming the missing repository, never reporting a clean phase | `apps/indusk-mcp/src/lib/verify/verify.test.ts` | Phase 1 | Phase 1 | passing |
| A16 | A phase executed by an external agent Dawn does not control, with a violation planted in it, is caught — and the run is recorded with what was planted, caught, and missed | `manual: .indusk/planning/dawn-verify/matrix.md` | Phase 5 | Phase 5 | passing |
| A17 | A row whose referenced test file does not exist is reported as unverified naming the unresolvable path, never as a failing test | `apps/indusk-mcp/src/lib/verify/red-tests.test.ts` | Phase 0 | Phase 6 | passing |
| A18 | A row referencing a non-executable artifact (a manual record) is reported as unverified rather than run as a test | `apps/indusk-mcp/src/lib/verify/red-tests.test.ts` | Phase 0 | Phase 6 | passing |
| A19 | An item checked off with only NEW UNTRACKED files alongside it is not reported as phantom — untracked work is still work | `apps/indusk-mcp/src/lib/verify/phantom.test.ts` | Phase 0 | Phase 6 | passing |
| A20 | Phantom detection still fires when the only other changed paths are InDusk machine state (`.indusk/verify/`, `.indusk/eval/`) | `apps/indusk-mcp/src/lib/verify/phantom.test.ts` | Phase 0 | Phase 6 | passing |
| A21 | An item whose text was edited in the same commit that checked it off is still reported as phantom | `apps/indusk-mcp/src/lib/verify/phantom.test.ts` | Phase 0 | Phase 6 | passing |
| A22 | A baseline whose impl.md is unreachable (plan renamed/moved, blob absent) reports a finding rather than silently reporting no goalpost drift | `apps/indusk-mcp/src/lib/verify/detect.test.ts` | Phase 0 | Phase 6 | passing |
| A23 | A trajectory row with a malformed phase reference is reported as a finding rather than silently excluded from every detection | `apps/indusk-mcp/src/lib/verify/detect.test.ts` | Phase 0 | Phase 6 | passing |

### Deferred Verification

- **U1 — phase-boundary verification is sufficient enforcement for agents Dawn does not control**
  - reason: a universal claim over all agents, plans, and failure modes; no finite test proves it and a single counterexample disproves it, so it can only be sampled
  - would require: longitudinal dogfooding across many external-agent phases, plus a corpus of real (not planted) violations — neither exists and neither can be manufactured inside this plan
  - mitigation: the Phase 5 acceptance experiment samples it deliberately with a planted violation; the result, held or leaked, is written into the Dawn master's component 6 row and `matrix.md`, and component 7's plan branches on it explicitly rather than assuming it. Any miss found later in dogfooding reopens the question as a falsification hypothesis against this plan.

### Trajectory Rationale

*(Applies to the original sixteen rows. The falsification rows A17–A23 are `Writable at: Phase 0` — each is authorable today against current behavior and fails red until its fix lands, so none needs an entry here.)*

Every row is writable at Phase 1 rather than Phase 0 for one shared and legitimate reason: **the tests import `runVerify()` and the ledger module, which do not exist until Phase 1, so the test files' import lines are compile errors today.** This is the "subject is a symbol introduced in that phase" case, not a weak excuse — and it is deliberately the *only* phase-shifted boundary in the plan: once Phase 1 lands, all sixteen rows are authorable, and the twelve that pass in Phases 2–4 stay red across intermediate phases as live tripwires.

The alternative was authoring every test as a subprocess spawn of the `atdawn` binary, which would make them Phase 0-writable (an unknown-command error is real-red). Rejected on two grounds: sixteen subprocess spawns are slow enough to discourage running the suite, and every existing test in `src/lib/run/` tests the library function while the CLI stays a thin renderer. Matching that precedent keeps the tests fast and pointed at the logic rather than the shell.

- **A1** `Writable at: Phase 1` — imports `runVerify()` from the Phase 1 module; the import line does not compile today.
- **A2** `Writable at: Phase 1` — same import; asserts on the report shape Phase 1 introduces.
- **A3** `Writable at: Phase 1` — same import; needs the baseline-resolution result Phase 1 returns.
- **A4** `Writable at: Phase 1` — same import; the fixture asserts on report fields defined in Phase 1.
- **A5** `Writable at: Phase 1` — same import; needs Phase 1's resolved baseline SHA on the report.
- **A6** `Writable at: Phase 1` — same import.
- **A7** `Writable at: Phase 1` — same import; snapshots the tree around a `runVerify()` call.
- **A8** `Writable at: Phase 1` — same import; asserts the verdict field the CLI maps to an exit code.
- **A9** `Writable at: Phase 1` — imports the Phase 1 ledger module directly.
- **A10** `Writable at: Phase 1` — imports the Phase 1 ledger module directly.
- **A11** `Writable at: Phase 1` — imports both the ledger module and `runVerify()`.
- **A12** `Writable at: Phase 1` — imports the Phase 1 ledger module directly.
- **A13** `Writable at: Phase 1` — imports `runVerify()`; asserts on the unverified-row accounting field.
- **A14** `Writable at: Phase 1` — imports `runVerify()`.
- **A15** `Writable at: Phase 1` — imports `runVerify()`.
- **A16** `Writable at: Phase 5` — a manual recorded experiment, not a test file; it requires the complete working command from Phases 1–4 to have something to run an external agent against.

## Checklist

### Phase 1: Ledger, baseline resolution, and the verify entry point

- [x] Create/confirm this plan's worktree (`indusk worktree create dawn-verify`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
  - note: `indusk worktree create` still fails outside workbench mode (`_resolve_workbench_root`); used `git worktree add -b plan/dawn-verify`. Worktree needed `pnpm install` + mcp build + admin build + `bundle-admin.js` to reach test-env parity (gitignored-artifact lesson). Baseline: 857 passing, 3 known pre-existing failures (`agent-roles-phase4`, `daemon-identity` T22/T23).
- [x] Add `src/lib/verify/git.ts` — the read-only git surface verify reads through (`assertGitRepo`, `headSha`, `resolveMergeBase`, `showFileAt`, `changedPathsSince`) *(discovered: every later detection needs git, and one module keeps the "no write helper lives here" invariant enforceable by inspection)*
- [x] Add `src/lib/verify/ledger.ts` — append-only JSONL over `.indusk/verify/ledger.jsonl`
  ```typescript
  export interface VerifyRecord {
    plan: string; phase: number; sha: string; trajectory: string; timestamp: string;
  }
  /** Baseline = the record for the highest phase < N of this plan; null when none. */
  export function findBaselineRecord(records: VerifyRecord[], plan: string, phase: number): VerifyRecord | null
  export async function appendVerifyRecord(root: string, record: VerifyRecord): Promise<void>
  export async function readLedger(root: string): Promise<VerifyRecord[]>
  ```
- [x] Make `readLedger` refuse loudly on a malformed line rather than skipping it — a corrupt ledger must never degrade silently into bootstrap mode, because that failure is indistinguishable from success
- [x] Add merge-base bootstrap reusing the candidate-fallback chain from `cleanup/oversized.ts` (`baseRef` → `origin/main` → `main` → `origin/master` → `master`)
- [x] Add `src/lib/verify/verify.ts` with `runVerify()` returning a report carrying the resolved baseline and an empty findings list
  ```typescript
  export interface VerifyReport {
    plan: string; phase: number;
    baseline: { sha: string; source: "ledger" | "merge-base" };
    findings: VerifyFinding[];
    unverifiedRows: string[];
    verdict: "clean" | "rejected";
  }
  ```
- [x] Guard a non-git root: throw naming the missing repository, never return a clean report (the cleanup library's silent-`[]` bug on workbench roots is the precedent)
- [x] Register `.indusk/verify/ledger.jsonl` as `merge=union` in `.gitattributes`, matching the `current.md` precedent

#### Phase 1 Verification
- [x] A10, A12, A15 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] A1–A9, A11, A13, A14 authored and committed RED against the Phase 1 module (they fail because no detection exists yet — the intended tripwire state); States set to `written`
  - measured: 871 passed / 14 failed = 3 known pre-existing (`agent-roles-phase4`, `daemon-identity` T22/T23) + 11 intended reds. Every red now fails on an **assertion**, not an import — the tripwires are live rather than merely absent.

#### Phase 1 Context
- [x] Add to Known Gotchas: the verify ledger is append-only and refuses on malformed lines — the inverse of the pending-eval ledger's write-before-spawn pattern, because a bad phase silently becoming the next baseline is worse than a gap

#### Phase 1 Document
- [x] Create `apps/docs/src/reference/cli/verify.md` with the command's purpose, the ledger format, and the baseline-chain Mermaid diagram (bootstrap → phase records) — plus a sidebar entry beside `run`

### Phase 2: Static detections, report rendering, and the CLI

- [x] Add `src/lib/verify/detect.ts` — premature checkoff + skipped test-first duty by calling `probePhaseClose` against the current impl, mapping its block message into findings
- [x] Add goalpost-drift detection: read the baseline impl via `git show <baseline-sha>:<impl-path>`, parse with `snapshotTrajectory`, compare with `checkGoalposts` against the current table
- [x] Harden the bootstrap baseline against the degenerate on-trunk case *(discovered by A3: `merge-base(main, HEAD)` **is** HEAD when work is committed on the trunk, so the baseline became "now" and every comparison was vacuously clean — the same silent-nothing failure as reporting `[]` on a non-git root. Falls back to the parent of the earliest commit touching the plan dir; the root commit is the floor.)*
- [x] Install the package's canonical hooks into every test fixture *(discovered: `resolveGateScripts` walks up for `.claude/hooks` and throws when absent, so `/tmp` fixtures had no gate chain. Copying the real hooks in keeps `runVerify({root, plan, phase})` as the honest public API and makes the probe run the REAL check-gates rather than a stand-in.)*
- [x] Wire all three into `runVerify()`; set `verdict: "rejected"` when findings exist
- [x] Append the ledger record **only** on a clean verdict — a rejecting verify must record nothing
- [x] Add `src/bin/commands/verify.ts` rendering the report: one line per finding with its kind, the baseline SHA and its source, and a trailing summary
- [x] Register `verify <plan>` in `src/bin/cli.ts` with `--phase <n>` and `--full-suite`, lazily imported, mirroring the `run` registration; exit 0 clean, 1 rejected

#### Phase 2 Verification
- [x] A1, A2, A3, A6, A7, A8, A9, A11 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] A4, A5, A13, A14 still red (their detections land in Phases 3–4) — confirm they fail for their own reason, not an import error
  - measured: 877 passed / 8 failed = 3 known pre-existing + 5 intended reds, each failing on its own assertion. Dogfooded against this plan: `verify dawn-verify --phase 1` → clean, exit 0, record appended; `--phase 2` → rejected, exit 1, naming all four open Phase 2 gate items, baseline sourced from the ledger.

#### Phase 2 Context
- [x] Add to Architecture: `atdawn verify <plan> --phase N` as the tier-3 read-only counterpart to `atdawn run`, reusing the probe and goalpost machinery unchanged

#### Phase 2 Document
- [x] Extend `reference/cli/verify.md` with the five-detection decision-flow Mermaid diagram and the exit-code table

### Phase 3: Red-test detection

- [x] Add the optional `Test` column to `src/lib/trajectory/parser.ts` — a `test?: string[]` field parsed from a comma-separated cell; absent column stays `undefined` (the header alias map already passes unknown columns through, so old plans are unaffected)
- [x] Add test-command resolution from the `verify` block in `.indusk/config.json`, producing a runnable command plus a per-file argument — `verify.testCommand` is the explicit escape hatch and wins outright; the derived map covers common runners only, and an unknown runner with no explicit command is a refusal rather than a guess
- [x] Add `src/lib/verify/red-tests.ts` — deduplicate referenced files across in-scope rows, invoke the command once per file, and treat a non-zero exit as failure for every row referencing that file
- [x] Report a `passing` row with no test reference as unverified rather than passed, and count them in the report summary
- [x] Honor `--full-suite` by running the whole command once instead of per-file

#### Phase 3 Verification
- [x] A4, A13, A14 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] Existing trajectory parser tests still pass, proving the added column broke no prior plan (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
  - measured: 881 passed / 4 failed = 3 known pre-existing + A5 (Phase 4's). Every `trajectory/parser` and `validator` test green with the new column in place.

#### Phase 3 Context
- [x] Add to Conventions: trajectory rows may carry an optional `Test` column naming test files; verify runs them by exit code, never by parsing runner output — runner-specific parsing belongs in an extension, not core

#### Phase 3 Document
- [x] Update `apps/docs/src/guide/test-trajectory.md` with the `Test` column, what it unlocks, and the explicit note that an unreferenced row is reported unverified rather than passed

### Phase 4: Phantom-work detection

- [x] Add `src/lib/verify/phantom.ts` — compute the diff since the baseline SHA; if the phase has newly-checked implementation items and the diff contains no change outside the plan's own `impl.md`, report every checked implementation item in that phase as phantom
- [x] Keep the rule narrow: any real change outside `impl.md` silences the detection entirely, so a trivially-satisfied checkoff is deliberately not flagged
  - refinement while implementing: only **implementation** items count. Checking a Verification/Context/Document item legitimately changes nothing but the plan file, so counting gate items would fire on every honest phase close.
- [x] Wire into `runVerify()` and the report renderer

#### Phase 4 Verification
- [x] A5 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] Full suite run (`pnpm test`) — **not fully green, and not because of this plan**
  - indusk-mcp: 882 passed / 3 failed — exactly the known pre-existing set (`agent-roles-phase4`, `daemon-identity` T22/T23). All 15 machine-checkable rows green.
  - indusk-admin: 141 passed / 4 failed, all `Test timed out in 5000ms` in the `http-*` server-boot tests. **Verified pre-existing**: `http-smoke.test.ts` fails on the trunk too (4/4 there vs 1/4 here), so this reproduces without any of this plan's changes. Out of scope — recorded as a cross-plan finding rather than fixed here.

#### Phase 4 Context
- [x] Add to Known Gotchas: phantom-work detection is deliberately narrow — it fires only when a phase's diff touches nothing but `impl.md`; broadening it produces false positives that get the detector disabled

#### Phase 4 Document
- [x] Document the phantom-work rule and its explicit limit in `reference/cli/verify.md`

### Phase 5: Acceptance experiment and the keystone verdict

- [x] Author the experiment procedure: a fixture plan, a phase dispatched to a hookless `claude` session, and a specific planted violation
  - refinement: hook *files* installed but **not registered** in `.claude/settings.json` — nothing gates the agent's writes, while verify still has a real gate chain to probe. That is precisely the Cursor shape; without it the fixture would have tested a project with no hooks at all, which is a different and easier thing.
- [x] Run the experiment manually against the external agent and capture the raw output
- [x] Record `matrix.md` — what was planted, what verify caught, what it missed, and the resulting judgement on whether boundary verification held or leaked
  - 6 cells: 1 organic control + 5 planted classes. **5/5 caught, 0 misses, 0 false positives on the honest control.**
- [x] Update the Dawn master's component 6 row with the verdict and mark the component's status
- [x] Record the component 7 consequence: thin skin over a proven command if it held, per-agent seam work if it leaked
  - it held → component 7 is integration over a proven command. The seam question survives only in the narrower prevention-tier form, no longer load-bearing for correctness.

#### Phase 5 Verification
- [x] A16 passes — manual verification: the recorded experiment shows verify catching the planted violation, with the result written into `matrix.md`
  - 6 cells recorded in [matrix.md](matrix.md). 5/5 planted classes caught (premature-checkoff, goalpost, red-test, phantom, test-first), every one exiting 1; the organic control verified clean at exit 0. The three declared limits are named there and are **not** misses.
- [x] Full suite run and lint clean — indusk-mcp 882 passed / 3 failed (the known pre-existing set); `biome check` clean across all 13 verify files. `pnpm test` overall stays red on indusk-admin's pre-existing `http-*` timeouts, which reproduce on the trunk (recorded in Phase 4).

#### Phase 5 Context
- [x] Update Current State with a one-line dawn-verify entry and the keystone verdict, per the Current State one-line convention

#### Phase 5 Document
- [x] Cross-reference verify from `apps/docs/src/reference/cli/run.md` as the out-of-lane counterpart, and add the changelog entry

### Phase 6: Falsification — "could not check" silently reported as a verdict

**Goal**: the plan's sharpest claim is that a detector must never conflate *could not be checked* with *checked and passed* — it is why an unreferenced row reports `unverified` (A13) and why a corrupt ledger refuses loudly (A12). The hunt found that principle applied **inconsistently in five more places**, plus two ways to make a detection go silent that nobody had considered. Each row below is one specific failure with specific inputs.

The theme, stated plainly: **every remaining defect is verify lying in the confident direction** — either asserting a failure it never observed (A17, A18) or asserting cleanliness it never established (A19–A23).

- [x] Resolve each `Test` reference against the repo root and **stat it before running**. A path that does not resolve is reported `unverified` naming the unresolvable path — never `red-test`. Fixes the 16-false-positive result from running verify on this very plan.
- [x] Document the path convention in `reference/cli/verify.md` and the trajectory guide: `Test` paths are **repo-root-relative**. The monorepo case is what broke it — every fixture used a throwaway repo where root and package coincide, so the ambiguity could not appear.
- [x] Give a row a way to declare a **non-executable / manually-verified** artifact so an acceptance record (A16's `matrix.md`) is not shelled out to a test runner. Treat it as unverified-by-design, distinct from unverified-by-omission. *(`manual:` prefix.)*
- [x] **Discovered:** drop `--silent` from the derived vitest command. It is a BOOLEAN flag in vitest 4, so an appended file path is parsed as its value and the run dies with `Unexpected value "--silent=<path>"` — making every row report red for a CLI-parsing reason unrelated to the tests. Found only by running the real command against the real repo.
- [x] **Discovered:** apply the new convention to this plan's own trajectory — 22 references rewritten repo-root-relative, A16 marked `manual:`. Documenting a convention while leaving the authoring plan in violation would have left 15 rows permanently unverified.
- [x] Make `changedPathsSince` see **untracked files** (`git ls-files --others --exclude-standard`), or make the working-tree stance consistent. Today it reports tracked modifications but not new untracked files — so an agent that writes code without staging it looks like it wrote nothing.
- [x] Exclude InDusk machine state (`.indusk/verify/`, `.indusk/eval/`) from phantom's "something real changed" test — same exclusion the commit cadence already applies to `.indusk/eval` when staging.
- [x] Match checklist items across the baseline by a key that survives a text edit (index within its phase, or normalized prefix), so editing an item's wording while checking it off no longer evades phantom. *(Matched by position.)*
- [x] Report an unreachable baseline impl as a finding instead of returning `[]` — **scoped to a ledger baseline only**. When bootstrapping, an absent impl genuinely means the plan did not exist yet and silence is correct; when a previous verification demonstrably read the plan at that commit, unreachable means moved/renamed/missing and silence would erase the goalposts.
  - note: the ledger's stored `trajectory` hash is still written and never read. Left deliberately — the source-aware check above covers the failure without introducing a second, weaker comparison path. Flagged for `/cleanup` as dead-ish state.
- [x] Treat a malformed phase reference (`Writable at`/`Passes at` that does not parse) as a finding rather than letting the row fall out of every filter unnoticed. *(Also covers an unparseable `State`.)*

#### Phase 6 Verification
- [x] A17: a row whose `Test` path does not resolve reports `unverified` naming the path, not `red-test`
- [x] A18: a row referencing a non-executable artifact is not shelled to the test runner
- [x] A19: an item checked off alongside new **untracked** files is not phantom
- [x] A20: phantom still fires when the only other changed paths are `.indusk/verify/` or `.indusk/eval/`
- [x] A21: an item whose text changed in the checking commit is still phantom
- [x] A22: an unreachable baseline impl produces a finding, not silence
- [x] A23: a malformed phase reference produces a finding, not silent exclusion
- [x] End-to-end on the case that exposed the defects: `verify dawn-verify --phase 5` went from **16 false red-tests → 0**, with 15 rows now genuinely executed and green and A16 correctly reported unverified-by-design. 890 passed / 3 failed (the known pre-existing set).

#### Phase 6 Context
- [x] Add to Known Gotchas: verify's own success artifact (`.indusk/verify/ledger.jsonl`) is tracked, so once committed it appears in every later phase's diff — any detection keyed on "what else changed" must exclude InDusk machine state or it silently disables itself after the first clean run

#### Phase 6 Document
- [x] Update `reference/cli/verify.md`: state the repo-root-relative `Test` path convention, and document that an unresolvable or non-executable reference reports **unverified** rather than red — the distinction between "could not check" and "checked and failed" is the page's central promise *(also mirrored into the trajectory guide)*

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/verify/ledger.ts` | New — chained verify ledger, bootstrap, corruption refusal |
| `apps/indusk-mcp/src/lib/verify/verify.ts` | New — `runVerify()` orchestration and report shape |
| `apps/indusk-mcp/src/lib/verify/detect.ts` | New — premature checkoff, test-first duty, goalpost drift |
| `apps/indusk-mcp/src/lib/verify/red-tests.ts` | New — per-file test invocation and row attribution |
| `apps/indusk-mcp/src/lib/verify/phantom.ts` | New — phantom-work detection |
| `apps/indusk-mcp/src/bin/commands/verify.ts` | New — CLI rendering and exit codes |
| `apps/indusk-mcp/src/bin/cli.ts` | Register the `verify` command |
| `apps/indusk-mcp/src/lib/trajectory/parser.ts` | Optional `Test` column |
| `.gitattributes` | `merge=union` for the verify ledger |
| `apps/docs/src/reference/cli/verify.md` | New reference page with two Mermaid diagrams |
| `apps/docs/src/guide/test-trajectory.md` | Document the `Test` column |
| `apps/docs/src/reference/cli/run.md` | Cross-reference verify |
| `CLAUDE.md` | Architecture, Conventions, Known Gotchas, Current State entries |
| `.indusk/planning/indusk-v2-dawn/master.md` | Component 6 verdict |

## Dependencies

- `probePhaseClose` and `checkGoalposts` from the completed `dawn-external-orchestrator` work.
- The gate scripts' externalizable contract, proven by `dawn-hook-parity`.
- A git repository with a resolvable trunk for the bootstrap path.

## Notes

### Defects found by dogfooding after impl-complete — for `/falsify`

Running the finished command against **this plan** (`verify dawn-verify --phase 5`) produced **16 false `red-test` findings** while every referenced test actually passes. Two real defects, both in scope for the falsification phase:

1. **Verify cannot distinguish "the test file is missing or not runnable" from "the test ran and failed."** Both surface as a non-zero exit and are reported identically as a red test. This is the plan's own honesty principle — the one that made an unreferenced row report `unverified` rather than `passing` (A13) — applied inconsistently: a reference that *cannot be executed* is a gap in the evidence, not proof of failure. A missing file should report as unverified-or-error, never as red.
2. **`Test` path resolution is ambiguous in a monorepo.** The command runs with `cwd` = repo root, but this plan's own rows name paths relative to the package (`src/lib/verify/…`, which only resolves under `apps/indusk-mcp/`). Nothing states the convention and nothing warns when a path resolves to nothing — so the author's most natural choice silently produces a wall of false reds. A16 compounds it: its reference is `matrix.md`, a manual record rather than an executable test, and there is no way for a row to say "verified by hand."

This is the falsification ritual's exact purpose, arriving on schedule: happy-path authoring produced happy-path fixtures, every unit test used repo-root-relative paths inside a throwaway repo, and the monorepo case never appeared until the tool was pointed at itself. Impl status stays `completed`; `/falsify` reopens it with a fix phase.

### Other

- Phase 5 is a human gate by construction: its verification is manual, so an unattended run pauses there rather than self-approving. That is intended.
- The report renderer prints a finding's `item` text twice for phantom findings (once as the subject prefix, once inside the message) — cosmetic, a candidate for `/cleanup`.
- The `--full-suite` path may be *faster* than per-file invocation on runners with heavy startup; worth measuring during Phase 3 rather than assuming.
- If file-level attribution proves too coarse in practice, test-title tags return as an extension-owned capability — never as runner-specific parsing in core.
