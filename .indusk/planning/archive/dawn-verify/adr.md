---
title: "Dawn Verify — Phase-boundary verification for work Dawn didn't execute"
date: 2026-08-05
status: accepted
---

# Dawn Verify — Phase-boundary verification for work Dawn didn't execute

## Goal

**`atdawn verify <plan> --phase N` renders a machine verdict on a phase Dawn did not execute — and, for the first time anywhere in the system, actually runs the tests a trajectory row claims are passing.**

Today a phase done in Cursor, in a hookless `claude` session, or by hand is entirely unverified: the checkboxes are flipped, the State cells say `passing`, and nothing has ever checked either claim against the repository. Worse, the `passing` claim is unverified in *every* lane — including the two Dawn controls — because no gate in InDusk has ever executed a test. After this ships, a developer who hands a phase to any agent can ask one question at the boundary and get an evidence-backed answer: did the work that was claimed actually happen, and do the tests that are claimed green actually pass.

## Y-Statement

**In the context of:**
a developer dispatching a phase of an InDusk plan to an agent Dawn does not control — Cursor, a hookless `claude` session, or their own hands — and needing to know at the phase boundary whether the returned work is trustworthy, given that Dawn's entire existing enforcement lives in a write-path hook that never ran.

**Facing:**
the fact that by the time verification is possible the edits are applied, the checkboxes are `[x]`, and there is no `old_string`/`new_string` pair and no in-process snapshot to diff against — compounded by the discovery that the Test Trajectory's `passing` state, the system's core credibility artifact, has never once been checked against an actual test run in any lane.

**We decided for:**
a read-only detector, `atdawn verify <plan> --phase N`, that reconstructs the phase boundary from a chained verify ledger, reuses `probePhaseClose` and `checkGoalposts` unchanged for the three detections that already have machinery, adds red-test detection by running the project's own test command scoped to the test files named in a new optional trajectory `Test` column, adds phantom-work detection from the diff since baseline, and reports a verdict without mutating the working tree.

**And against:**
a verifier that also reverts or re-dispatches (couples the keystone to component 7 and to revert semantics already shown to be subtle); an explicit pre-dispatch `--snapshot` ceremony (fails silently exactly when forgotten, which is the case it exists for); baseline inference from git history (assumes sensible commit boundaries from an agent Dawn does not control); test attribution via tags in test titles (requires parsing runner-specific structured output, hardcoding tool knowledge into core); file-and-line references (brittle under refactor); and always running the full suite (friction that scales with project size rather than with the phase being verified).

**To achieve:**
an answer to the one assumption the whole integration strategy rests on — that phase-boundary verification is sufficient enforcement when Dawn doesn't control the agent — delivered as a command that is independently useful, independently testable, and closeable without any agent-integration plumbing existing yet.

**Accepting:**
that verify detects but never repairs, so a rejected phase still requires a human decision; that red-test detection only bites on rows carrying a `Test` reference, making every pre-existing plan's rows unverifiable until annotated; that scoping test execution to referenced files means verify does not catch regressions elsewhere in the suite; that a shared test file over-attributes its failure to every row referencing it; and that a single sampled acceptance run cannot prove the sufficiency claim it tests.

**Because:**
the enforcement ladder's third tier has no seam to hook, so detection at the boundary is the only enforcement available — and a detector that is honest about what it did not check is worth more than one that silently conflates "unverifiable" with "verified." Every rejected alternative either buys precision with hardcoded tool knowledge, buys completeness with friction that violates maxim 4, or buys automation by coupling the keystone to work that does not exist.

## Context

The Dawn master calls component 6 the keystone and orders it before components 7 and 8 for a specific reason: both assume boundary verification works, and neither is safe to plan until that assumption is tested. See [research.md](research.md) for the full survey and [brief.md](brief.md) for the accepted direction.

Three findings from research drive this ADR:

1. **Dawn's enforcement is structurally unavailable here.** `check-gates` is a `PreToolUse` hook operating on an old/new string pair before an edit applies. In tier 3 there is no hook, no pair, and no "before."
2. **`probePhaseClose` already solved the hard half.** It runs the edit-triggered hook against committed state by synthesizing a checkoff envelope against a temp copy — including the subtlety that rows writable at N+1 belong to the *next* phase's duty and must be neutralized before asking. This is reused, not reimplemented.
3. **Nothing has ever executed a test as a gate.** The goalpost guard blocks `→ skipped`/`blocked` but deliberately permits `planned → written → passing`. The word `passing` is a self-report everywhere.

## Decision

### 1. Verify detects and reports; it never repairs

`atdawn verify` exits non-zero with a report naming each violation and the baseline commit it judged against. It performs no revert, no re-dispatch, and no repair. The only write it ever makes is appending its own ledger record on success.

This is the accepted scope from the brief, and it inherits a hard-won constraint. During `dawn-hook-parity`'s falsification, hypothesis A11 was refuted mid-fix on exactly this ground: `git reset` unstages but cannot un-write a working tree. What has been written can only be *accounted for*, not unwritten. A detector that reports is honest about that; a reverter would have to relitigate it. Reverting and re-dispatch belong to component 7.

### 2. The baseline is a chained verify ledger

`.indusk/verify/ledger.jsonl`, append-only, one record per successful verification:

```json
{"plan":"dawn-verify","phase":2,"sha":"a1b2c3d","trajectory":"sha256:…","timestamp":"2026-08-05T…"}
```

The baseline for phase N is the record for the highest phase < N of that plan. With no such record, verify bootstraps from the merge base with the trunk, using the candidate-fallback chain already proven in `cleanup/oversized.ts` (`baseRef` → `origin/main` → `main` → `origin/master` → `master`) — that chain exists because `origin/main` alone silently yielded an empty diff against an unfetched remote, which is precisely the failure shape to avoid here.

The ledger is **tracked in git** with `merge=union` in `.gitattributes`, following `current.md`'s precedent. Maxim 6 makes files-in-the-repo the substrate; the ledger is the evidence trail, and positioning names evidence as Dawn's column. It is deliberately *not* treated like `.indusk/eval` state, which is excluded from work-product staging because it is machine bookkeeping — a verification record is a work product.

**Failure-safety is the inverse of the pending-eval ledger.** That one writes its done-marker *before* the risky operation so a crash leaves a gap rather than a double-eval. This one writes *only after* a clean verdict, so a bad phase can never silently become the yardstick for the next one (A11). A corrupt or unreadable ledger refuses loudly rather than falling back to bootstrap mode (A12) — that failure would otherwise look exactly like success, the worst shape a verification bug can take.

### 3. Red-test attribution: an optional `Test` column naming files, executed by the project's own command

The trajectory table gains an optional `Test` column naming one or more **test files** (not test names, not line numbers):

| ID | Asserts | Test | Writable at | Passes at | State |
|----|---------|------|-------------|-----------|-------|
| A4 | a row marked passing whose test fails is rejected | `src/lib/verify/red-tests.test.ts` | Phase 0 | Phase 3 | planned |

Verify resolves a runnable command from the existing `verify` block in `.indusk/config.json` — the first code in the system to actually consume a config surface that has been typed and written at init but read by nothing that executes — invokes it once per referenced file, and uses the **exit code** as the verdict for the rows referencing that file.

Files-plus-exit-codes is chosen over the more precise alternatives for one reason: it is runner-agnostic. Parsing vitest's JSON reporter to match `[T7]` tags in test titles would be more precise and would survive file moves, but it hardcodes tool knowledge into indusk-mcp core — against maxim 7 (*mechanism in Dawn, content in the project*) and against the standing convention that extensions own tool knowledge. Any runner that accepts a file argument and sets an exit code works under this design. File:line references were rejected as brittle under refactor.

Backward compatibility is free: the trajectory parser is header-keyed with pass-through for unrecognized columns (`aliases[normalized] ?? normalized`), so old plans parse unchanged and new columns are ignored by existing consumers (A14).

A row claiming `passing` with no `Test` reference is reported as **unverified** — never folded into "checked and passed" (A13). This is the honesty requirement that keeps the backward-compat concession from becoming a silent hole.

### 4. Test execution is scoped to referenced files by default

Verify runs only the test files referenced by the rows in scope for the phase being verified, not the whole suite. `--full-suite` opts into a complete run.

This settles the maxim-4 tension the brief flagged: verify's cost scales with the phase's trajectory rather than with the project's size. The accepted consequence is that **verify does not detect regressions in tests outside the referenced files.** That is deliberate, not an oversight — "did this phase break something unrelated" is the named Tier-2 judgment-checker horizon item, not component 6's job. Component 6 verifies *the claims the plan makes*.

### 5. Phantom-work detection is conservative by construction

Attributing a specific checklist item to a specific hunk is not reliably possible. Verify therefore uses a deliberately narrow rule: **if a phase has newly-checked implementation items but the diff since baseline contains no change outside the plan's own `impl.md`, every checked implementation item in that phase is reported as phantom.**

This catches the flipped-boxes-wrote-nothing case exactly, and stays silent when any real change exists. It does **not** catch a phase that wrote something trivial to satisfy the check. Narrow and correct beats broad and false-positive: a detector that cries wolf gets disabled.

### 6. The acceptance experiment uses a hookless `claude` session with a planted violation

A16 runs against a hookless `claude` CLI session rather than Cursor: it is scriptable, reproducible, and satisfies the actual variable under test — that Dawn does not control the executor and no PreToolUse hook fires. Cursor is recorded as an optional confirmation cell.

The violation is **planted deliberately** rather than hoped for organically, which also neutralizes the objection that a Claude-family model might be unusually well-behaved on InDusk conventions: the experiment tests whether verify catches a known-bad phase, not whether a given agent misbehaves at some rate. The result — held or leaked, and what was missed — is recorded in `matrix.md` and written into the master's component 6 row.

## Alternatives Considered

### Detect + revert in one command
Rejected. Couples the keystone to component 7 and to revert semantics that `dawn-hook-parity`'s A11 already showed are subtler than they look. Verify-as-detector is independently useful, composable, and closeable now; the `--revert` middle path was also declined to keep the boundary clean rather than shipping a half-wired mutation path.

### Explicit `--snapshot` before dispatch
Rejected. Requires a human to remember a ceremony *before* handing work to an agent Dawn doesn't control. A forgotten snapshot means no verification, silently — the failure lands exactly where the feature is supposed to help.

### Infer the baseline from git history
Rejected. Requires assuming the external agent committed at sensible boundaries, which is precisely what cannot be assumed about work Dawn didn't run. Squashed commits, one giant commit, or no commits at all all break it.

### Test-title tags (`it("[T7] …")`) parsed from the runner's JSON output
Rejected, though it is the most precise option and survives file moves automatically. It requires parsing runner-specific structured output, hardcoding tool knowledge into indusk-mcp core against maxim 7 and the extensions convention. Revisit only if file-level attribution proves too coarse in practice — and if so, as an extension-owned capability, not in core.

### File-and-line test references
Rejected as brittle: line numbers move on every refactor, producing false failures that would train the operator to ignore the tool.

### Always run the full suite
Rejected under maxim 4. Friction that scales with project size rather than with the phase being verified, at every boundary. Available behind `--full-suite` for the cases that want it.

## Consequences

### Positive
- The trajectory's `passing` state becomes checkable for the first time — in every lane, not just tier 3, since nothing prevents running verify after an `atdawn run` or a Claude Code phase.
- Three of five detections are reuse, not new code; blast radius is small (`probe` 1 non-test importer, `goalposts` 2, `trajectory/parser` 2).
- The `verify` config block gains its first executing consumer.
- The baseline is a byproduct of the previous verification, so the common path has no ceremony to forget.
- Component 7's shape gets a real input instead of an assumption, and a negative result is still a deliverable.

### Negative
- Verify never repairs; a rejected phase is a human decision.
- Red-test detection only bites on annotated rows; every existing plan is unverifiable on that axis until someone adds references.
- Regressions outside referenced files go undetected by design.
- A shared test file over-attributes its failure to every row referencing it — conservative in the safe direction, but noisy.
- Phantom-work detection misses trivially-satisfied checkoffs.

### Risks
- **The sufficiency claim can be sampled but not proven** (U1). Mitigation: A16 samples it deliberately with a planted violation; the result is written into the master's component 6 row; component 7 branches on it explicitly. Any later miss found in dogfooding reopens it as a falsification hypothesis.
- **Test annotation becomes busywork** and gets skipped, leaving detection toothless. Mitigation: A13's unverified-row reporting makes the gap visible in every report rather than silent, so the cost of skipping is felt.
- **Per-file invocation is slow** on a project whose runner has heavy startup. Mitigation: deduplicate files across rows before invoking; `--full-suite` may in fact be *faster* on such projects, which the flag makes available.
- **The ledger is a tracked file**, so a verify on a dirty tree adds a change the operator didn't expect. Mitigation: A7 constrains this to the success path only, and the report states what was appended.
- **Non-git roots** must fail loudly, not report clean (A15) — the cleanup library's silent-`[]` bug on workbench roots is the in-repo precedent for why.

## Documentation Plan

### Pages
- **New**: `apps/docs/src/reference/cli/verify.md` — command reference: invocation, the five detections, exit codes, the `Test` column, the ledger, `--full-suite`.
- **New**: `apps/docs/src/decisions/dawn-verify.md` — this ADR, published at close.
- **Update**: `apps/docs/src/guide/test-trajectory.md` — the optional `Test` column and what it unlocks.
- **Update**: `apps/docs/src/reference/cli/run.md` — cross-reference verify as the out-of-lane counterpart.

### Diagrams
- Mermaid in `reference/cli/verify.md`: the baseline chain — merge-base bootstrap → phase 1 record → phase 2 record — showing which commit range each verification judges.
- Mermaid in the same page: the five detections as a decision flow from "phase N claimed complete" to verdict.

### Changelog
- "Added `atdawn verify <plan> --phase N` — phase-boundary verification for work executed outside Dawn's controlled lanes, including the first test-execution-backed check of trajectory `passing` claims."

### ADR in Docs
- Yes — `decisions/dawn-verify.md`, with a sidebar entry alongside `dawn-hook-parity` and `dawn-external-orchestrator`.

## References
- [research.md](research.md) — the survey, including the never-runs-tests finding
- [brief.md](brief.md) — accepted direction and scope
- [test-plan.md](test-plan.md) — 16 assertions + U1
- [../indusk-v2-dawn/master.md](../indusk-v2-dawn/master.md) — component 6, the Order section, the enforcement ladder
- [../indusk-v2-dawn/maxims.md](../indusk-v2-dawn/maxims.md) — maxims 1, 4, 5, 6, 7, 8
- `.indusk/planning/archive/dawn-hook-parity/` — the A11 refutation; the pending-eval ledger's provisional-write pattern
- `.indusk/planning/archive/dawn-external-orchestrator/` — `probePhaseClose`, `checkGoalposts`, the CLI shape
