---
title: "Test phases as structure"
date: 2026-08-11
status: completed
trajectory: required
rationale: required
gate_policy: ask
---

# Test phases as structure

## Goal

Give test authoring a phase, so the system's central discipline has a moment and its deviations have a register — and so a reader can see that tests came first without reconstructing it from a column.

## Scope

### In Scope
- One definition of the phase heading, replacing seven copies across six files.
- `### Test Phase N` parsed and validated alongside build phases; `Build ` optional so all 52 existing impls are untouched.
- Test Phase 1 required for new impls; additional test phases justified in it; deferrals may carry the deferred test's body.
- The test phase's single Verification gate, closed by reviewing its deferrals.
- Gate A corrected — enforced against test phases, and catching drift from earlier phases.
- `Trajectory Rationale` absorbed into Test Phase 1 for new impls; legacy section still parsed.
- **Discovered:** zero-parsed-phases rejection in both hooks (see Notes).
- `/planner`, `/work`, the trajectory guide; both-lane parity asserted, not assumed.

### Out of Scope
- Migrating the 52 existing impls.
- Renaming the trajectory columns to `Written in`.
- Craft's missing home; the documentation capture/compose split; elegance as a check.
- Expectations, telemetry linkage, the `monitor` state — see `midnight` and `/guide/plan-lifecycle`.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `lib/impl-headings.ts` — one definition of every phase/gate heading pattern, plus a zero-phase guard | the seven existing copies |
| Phase 2 | Parser understanding of `Test Phase N` + optional `Build ` prefix; **this impl converted to the new shape** | Phase 1's single definition |
| Phase 3 | Validator rules: Test Phase 1 required, justify-in-TP1, deferral bodies, rationale absorbed | Phase 2's parse |
| Phase 4 | Gate A corrected; both-lane parity proven | Phases 2–3 |
| Phase 5 | `/planner`, `/work`, guide, changelog | Phases 1–4 |

## Test Trajectory

| ID | Asserts | Test | Writable at | Passes at | State |
|----|---------|------|-------------|-----------|-------|
| A13 | The phase heading has exactly one definition in the source — a second copy fails the build | `apps/indusk-mcp/src/__tests__/impl-headings.test.ts` | Phase 0 | Phase 1 | passing |
| A17 | An impl in which no phase parses is **refused**, not vacuously passed — in both the validator and the gate hook | `apps/indusk-mcp/src/__tests__/impl-headings.test.ts` | Phase 0 | Phase 1 | passing |
| A5 | A plan written `### Phase 1` and one written `### Build Phase 1` behave identically — same phases found, same gates enforced | `apps/indusk-mcp/src/lib/__tests__/phase-kinds.test.ts` | Phase 0 | Phase 2 | passing |
| A4 | **Every impl already in this repository still writes and validates with no edits** — regression guard, green today and must stay green | `apps/indusk-mcp/src/__tests__/impl-corpus.test.ts` | Phase 0 | Phase 2 | passing |
| A16 | A deferral entry carrying the deferred test's body is accepted, and the body is not mistaken for a checklist item or a gate | `apps/indusk-mcp/src/lib/__tests__/phase-kinds.test.ts` | Phase 0 | Phase 2 | passing |
| A1 | Writing a new impl that has no test phase is refused, and the message names what is missing | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | passing |
| A2 | Writing an impl whose second test phase has no justification in the first is refused, naming the unjustified phase | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | passing |
| A3 | Writing an impl whose every additional test phase is justified in the first is accepted | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | passing |
| A14 | An impl carrying no separate `Trajectory Rationale` section still validates when its deferrals live in Test Phase 1 | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | passing |
| A8 | A row that passes the moment it is authored is accepted only when declared a regression guard; an undeclared one is refused, naming it | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | passing |
| A6 | Checking off build work while a test phase still has unauthored tests is refused, naming the unauthored test | `apps/indusk-mcp/src/lib/__tests__/gate-a.test.ts` | Phase 0 | Phase 4 | passing |
| A7 | A test that should have been authored earlier and still isn't is caught when any later phase closes — not only at the phase it was due | `apps/indusk-mcp/src/lib/__tests__/gate-a.test.ts` | Phase 0 | Phase 4 | passing |
| A9 | A test phase cannot close while any test it authors has not been written | `apps/indusk-mcp/src/lib/__tests__/gate-a.test.ts` | Phase 0 | Phase 4 | passing |
| A10 | A plan containing test phases runs to completion under `atdawn run`, closing each phase in order | `apps/indusk-mcp/src/lib/run/test-phase-parity.test.ts` | Phase 0 | Phase 4 | passing |
| A11 | The same violation is refused identically in both lanes, with the same message | `apps/indusk-mcp/src/lib/run/test-phase-parity.test.ts` | Phase 0 | Phase 4 | passing |
| A15 | A test file whose import cannot be resolved fails to load **even when every test in it is skipped** | `apps/indusk-mcp/src/__tests__/skip-does-not-defer.test.ts` | Phase 0 | Phase 1 | passing |
| A12 | A plan created by `/planner` contains a test phase as its first phase | `apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts` | Phase 0 | Phase 5 | passing |
| A18 | An impl whose fenced block is never closed is **refused**, not silently stripped of every phase after it | `apps/indusk-mcp/src/lib/__tests__/fence-falsification.test.ts` | Phase 0 | Phase 6 | passing |
| A19 | A `~~~` line inside a backtick-fenced block does not end the block — a checklist item in a carried test body stays inert | `apps/indusk-mcp/src/lib/__tests__/fence-falsification.test.ts` | Phase 0 | Phase 6 | passing |
| A20 | `verify --phase N` judges the boundary at phase N even when the plan opens at `Phase 0` | `apps/indusk-mcp/src/lib/verify/probe-boundary.test.ts` | Phase 0 | Phase 6 | passing |
| A21 | A test phase with no Verification gate is refused — the deferral review must have somewhere to happen | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 6 | passing |
| A22 | A green-on-arrival row is not refused into a Test Phase 1 the document does not contain | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 6 | passing |
| A23 | Trajectory-row parsing has exactly one definition under `hooks/` — a second copy fails the build | `apps/indusk-mcp/src/__tests__/hook-shared-modules.test.ts` | Phase 0 | Phase 7 | passing |
| A24 | The TS validator and the JS hook reach the same verdict on every test-phase rule, across a shared fixture set | `apps/indusk-mcp/src/__tests__/test-phase-parity.test.ts` | Phase 0 | Phase 7 | passing |

### Deferred Verification

- **U1 — an authored test fails on its own assertion rather than on a missing import**
  - reason: distinguishing them requires reading and interpreting runner output. This project refuses runner-output parsing on principle — the refusal is what kept tool knowledge out of `atdawn verify`, which reads exit codes only.
  - would require: an extension owning failure classification, exposing "assertion vs load error" to core without core knowing any runner. A different capability and a different plan.
  - mitigation: **Test Phase 1 cannot close until its deferred test bodies have been reviewed** — each read against "will this compile at the phase it names, and does it assert what it claims?" The evidence is the code block in the impl, which persists and can be re-read, unlike terminal output. A human-judgment checkpoint before any build phase opens; a pause point under autopilot. A8 covers the mechanically-detectable half; `verify`'s red-test detection independently catches a row claiming `passing` that isn't.

- **U2 — the new structure makes plans easier to read and follow**
  - reason: legibility has no oracle, and one plan is an anecdote.
  - would require: several plans authored under the structure, with a consistent measure of whether a discipline was skipped silently.
  - mitigation: recorded as a **metric, not a claim** — the next three plans note in their retrospective whether any discipline was skipped without the document showing it. Trigger: if one was, the structure has not solved the problem it was built for.

### Trajectory Rationale

**Every row is `Writable at: Phase 0`, and that is the point.** Every assertion here drives a hook or a parser as a black box — write a fixture impl, run the validator, check the refusal. None imports a symbol this plan creates, so none is a compile error today. They fail because today's validator accepts what it should refuse, which is real red.

Two rows are **regression guards, green on arrival, and declared as such** per A8's own rule:

- **A4** — a **differential** guard: the assertion is that nothing which validates today stops validating. Authoring it corrected the premise — nine archived impls are refused by today's validator already, missing gate sections that became mandatory after they were archived. They are read-only history, so making them pass is not this plan's job and editing them would be editing the record. The nine are pinned by name rather than counted, so a change that broke one file and fixed another cannot net out to green. There is no red phase and there should not be one.
- **A15** — a fact about the runner, not about our code. It may pass immediately; its job is to prove the reasoning behind the deferral shape before that reasoning is baked into guidance.

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author all 17 rows before any build phase opens, and record the one test that could not honestly be authored. This phase is written after the fact — the work it describes was done first, but the structure to describe it in only exists as of Build Phase 2. Every later plan gets to write it first.

- [x] Author A13, A17, A15, A4, A5, A16, A1, A2, A3, A14, A8, A6, A7, A9, A10, A11, A12 against the hooks and parsers as black boxes
- [x] Confirm each fails on its own assertion rather than on a missing import

#### Deferred to Build Phase 1

- **A13's behavioural companion** — the count assertion is authorable today, but its companion ("the one definition accepts both spellings and rejects a test phase") imports `lib/impl-headings.js`, which Build Phase 1 creates. At Test Phase 1 it fails to *load*: the assertion never runs, so the red is about the module's absence rather than about the behaviour. That is an absent test wearing a failure's clothes, and this register exists so the honest answer is a first-class outcome instead of something to work around. Authored with the module, which is the legitimate `Writable at = Passes at` case. Body reviewed:

  ```typescript
  const { PHASE_HEADING, TEST_PHASE_HEADING } = await import("../lib/impl-headings.js");

  expect("### Phase 1: Thing").toMatch(PHASE_HEADING);
  expect("### Build Phase 1: Thing").toMatch(PHASE_HEADING);
  expect("### Test Phase 1: Thing").not.toMatch(PHASE_HEADING);
  expect("### Test Phase 1: Thing").toMatch(TEST_PHASE_HEADING);
  ```

#### Regression Guards

- **A4** — a differential guard over the real corpus. It has no red phase and must not be given one; authoring it corrected the premise it was written from (nine impls already fail).
- **A15** — asserts a fact about the runner, not about our code. It exists to prove the reasoning behind the deferral shape before that reasoning is baked into `/work`'s guidance.

#### Test Phase 1 Verification

- [x] A13, A17, A15, A4, A5, A16, A1, A2, A3, A14, A8, A6, A7, A9, A10, A11 and A12 are authored, and each red one fails on its own assertion — 20 assertions red, 7 green and each declared above or in the Trajectory Rationale
- [x] The deferred body above reviewed against both questions: it compiles at the phase it names (the module exists there), and it asserts what it claims (the two spellings agree, the third does not)

### Build Phase 1: One definition, and a floor under it

- [x] Create/confirm this plan's worktree (`indusk worktree create test-phase-structure`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] Add `src/lib/impl-headings.ts` — the single definition of every phase and gate heading pattern
  ```typescript
  export const PHASE_HEADING = /^###\s+(?:Build\s+)?Phase\s+(\d+)[:\s]+(.*)/;
  export const TEST_PHASE_HEADING = /^###\s+Test\s+Phase\s+(\d+)[:\s]+(.*)/;
  export function gateHeading(kind: "Verification" | "Context" | "Document"): RegExp
  export function isAnyHeading(line: string): boolean
  ```
  The `Build ` group is optional so every existing impl parses unchanged (A5, A4). `Test Phase` is a separate pattern, not a variant — the two must never be confusable by a regex that "helpfully" matches both.
- [x] Replace all seven copies with imports from it — `impl-parser.ts`, `check-gates.js`, `gate-reminder.js`, `validate-impl-structure.js` (×2), `trajectory/validator.ts`, `shape/impl-blocks.ts`
  - the JS hooks cannot import a `.ts` module; mirror the constant with the deliberate-port comment the trajectory hooks already use, and let A13 count definitions in `src/` only
  - **six reachable, not seven.** `shape/impl-blocks.ts` lives on `plan/lifecycle-rebalance`, which is pushed but unmerged, so it is not on this branch. A13 counts `src/` and will go **red at that merge** rather than silently accepting a seventh copy — which is the behaviour a structural single-definition test exists for, so this is caught rather than missed. Whoever merges consolidates that call site.
  - the JS mirror is **one** hook-local module (`hooks/_impl-headings.js`), not three: `check-gates`, `gate-reminder` and `validate-impl-structure` each carried their own copy, which is how the fan-out grew unnoticed. Installed copies in `.claude/hooks/` synced by hand — dusk has no `indusk update`.
  - `cleanup/gate.ts` was case-insensitive (`/i`) and is now case-sensitive via `parsePhaseHeading`. Deliberate: `### phase 1:` was never a shape this project writes, and the ritual-detection suite is green.
- [x] **Discovered — reject an impl in which zero phases parse** (A17), in both `validate-impl-structure.js` and `check-gates.js`. Two lessons name this and neither hook implements it: a file whose headings are all malformed currently sails through every structural rule. That is unacceptable generally and disqualifying here, because this plan changes what a heading looks like — a typo in the new syntax must fail loudly, not silently disable enforcement.

#### Build Phase 1 Verification
- [x] A13, A17, A15 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] All other rows still red, each failing on its own assertion rather than an import error — **except A5 and A4, which went green here rather than at Phase 2.** Consolidating onto one definition *is* what makes `### Build Phase 1` work, so A5 had nothing left to prove by Phase 2; A4 was a declared regression guard. Recorded rather than left to look like drift. Nothing else moved early.
- [x] Full suite green apart from **three** pre-existing groups, named so the next run can tell expected from new: this plan's own Phase 2–5 rows (A1–A3, A6–A12, A14, A16 — red by design); the `daemon-identity` PID-reuse pair (known-red); and `admin-cli-lifecycle` / `cli-bare-ui-cwd-aware` / `admin-bundle-pack`, which need a built admin app and a packed tarball that a fresh worktree does not have. The `prune` and `stray-state` failures in the first run were the same class and disappeared after `pnpm turbo build` — which is why the build was run rather than the failures reasoned about. `pnpm check` clean on all nine touched files.

#### Build Phase 1 Context
- [x] Add to Known Gotchas: the phase and gate heading patterns have one definition in `lib/impl-headings.ts`, pinned by A13; the JS hook mirrors are deliberate ports. A validator that parses zero phases must refuse — silence there disables every structural rule at once.

#### Build Phase 1 Document
- [x] (deferred to Phase 5 — the guide should describe the finished shape once, not be rewritten each phase, which is the measured churn `lifecycle-rebalance` found. Recorded here so the deferral is visible rather than silent.)

### Build Phase 2: Both heading kinds, and this impl converts itself

- [x] Teach `impl-parser.ts` both kinds — a parsed phase carries `kind: "build" | "test"` and its own number
- [x] Keep `Phase 0` legal as a build phase; the two sequences number independently
  - **The ordering decision, because it is the load-bearing one.** Two sequences cannot be ordered by number — Test Phase 1 and Build Phase 1 are different phases wearing the same digit — so ordering comes from document position (`phaseOrdinal`). It is written so that **a document with no test phase reduces to the phase number**, which makes backward compatibility a property of the function rather than a claim made about it, and keeps `Phase 0` ordering before `Phase 1` by arithmetic with no special case. `TrajectoryRow` keeps `writableAt`/`passesAt` as bare numbers and gains `*Kind` companions, so the twelve files that read those fields did not have to change.
- [x] **Discovered — the phase-close probe depended on a number collision.** `probePhaseClose` appended a synthetic `Phase N+1` and relied on `check-gates` stopping at the first phase whose *number* was not smaller, which silently required the real Phase N+1 to share that number. Ordering by position removed the coincidence and every unfinished next phase became a false "premature checkoff" — caught by `ledger.test.ts`, not by anything this plan wrote. Fixed by stating the contract directly: `truncateAfterPhase` drops everything after phase N, so "the phases before the probe" is exactly "phases up to N" under any ordering rule.
- [x] **Discovered — fenced code blocks had to become inert before the register could exist.** A deferral carrying the deferred test's body contains lines shaped exactly like checklist items and gate headings; without `fencedLineMask` a parser reads them as structure and invents a phantom phase. Applied in all three parsers.
- [x] **Convert this impl to the new shape** — `### Test Phase 1` + `### Build Phase N` — in the same commit that makes the parser understand it. This is the dogfood, and it is deliberately here rather than at authoring: writing the new headings before this phase would have made *zero* phases parse, and (until Phase 1) passed vacuously, so the plan that adds enforcement would have run with none.
  - `Writable at` cells stay `Phase 0`, deliberately. That column means *earliest authorable*, and these tests genuinely were authorable before any plan code existed — Test Phase 1 is where authoring *happened*, which is a different question. Keeping the two distinct is what stops the register from becoming a second, redundant spelling of the trajectory table.
- [x] Confirm A4 still green after the conversion — the corpus must be unaffected by a change to one file in it
  - Stronger than planned: A4 globs the whole planning tree, so it validated **this impl in its new shape** through the real validator. The dogfood is checked by the corpus guard rather than by inspection.

#### Build Phase 2 Verification
- [x] A5, A16, A4 pass
- [x] A1–A3, A6–A12, A14 still red, each on its own assertion — **except A11, green early**: it asserts that both lanes refuse a violation identically, and the gate-completeness ordering fix satisfied that at this phase. **A6 briefly looked green and was not**: its row-ID assertion was being satisfied by the gate-completeness message, which quotes an unchecked Verification item whose text happens to contain that same ID, rather than by Gate A firing. Tightened to require the phrase `test-first` so only Gate A can satisfy it, and it is correctly red again. A green for the wrong reason is worse than a red, because it retires the question.
- [x] `pnpm check` clean on touched files; `tsc --noEmit` clean; full suite has no unexpected red — 23 failures are 12 of this plan's Phase 3–5 rows, 9 admin/tarball tests needing a built app, and the known-red PID-reuse pair
- [x] **Three regressions found by the existing suite and fixed**: the trajectory parser test pinned the exact row shape (new `*Kind` fields), and the verify ledger tests caught the probe's number-collision dependency. Neither was found by anything this plan wrote — the trajectory covers the new structure, the old suite covered what the new structure disturbed.

#### Build Phase 2 Context
- [x] Add to Conventions: impls declare `### Test Phase N` and `### Build Phase N`; `### Phase N` remains valid and means a build phase, so no existing plan needs editing

#### Build Phase 2 Document
- [x] (deferred to Phase 5 — same reason as Phase 1)

### Build Phase 3: The rules that make Test Phase 1 a register

- [x] **Discovered — the rule needs an opt-in: `test_phases: required`.** A1 says an impl with no test phase is refused; A4 says every impl already in the repository still validates; every impl already in the repository has no test phase. Read literally the two contradict, and authoring them together is what surfaced it. The resolution is the one `trajectory: required` already established — the rule fires only when the frontmatter asks for it, `/planner` writes it into new impls, and existing impls are exempt by saying nothing. The rejected alternative is exempting `archive/` by path, which makes the rule a property of where a file lives rather than of what it claims about itself.
- [x] Require a test phase in any impl carrying `test_phases: required` (A1) — the message names what is missing, not merely that something is
- [x] Require every `### Test Phase N` where N > 1 to have a matching justification entry in Test Phase 1 (A2, A3) — the register's two subsections are `#### Deferred to Test Phase N` and `#### Regression Guards`, pinned by the tests. Structural, so the rule reads a heading rather than interpreting prose.
- [x] Accept a deferral entry that carries the deferred test's body, without treating the code block as a checklist item or gate (A16 extends here) — delivered by `fencedLineMask` in Build Phase 2; `parseRegister` skips fenced lines too, so a carried body cannot pose as a register entry
- [x] Accept an impl whose deferrals live in Test Phase 1 and which has no `Trajectory Rationale` section (A14); keep parsing the legacy section so existing impls validate — the rationale rule is skipped **when a test phase exists**, so absorption is a property of the document rather than of a second frontmatter flag
- [x] Require a green-on-arrival row to be **declared a regression guard**, and refuse an undeclared one (A8) — scoped to rows whose *both* ends name a test phase, so the ordinary unit-test-for-new-code shape (`Writable at` = `Passes at` on a build phase) is untouched and no existing impl is affected
- [x] **Discovered — the hook's new constants had to move above its top-level call.** The register regexes were declared beside the functions that use them; this hook runs validation at module top level, so they sat in the temporal dead zone and threw `ReferenceError` — exit 1, not the exit 2 that means "blocked". A validator that crashes is a validator that is not enforcing anything, which is the same failure class as the zero-phase silence Build Phase 1 closed.

#### Build Phase 3 Verification
- [x] A1, A2, A3, A14, A8 pass
- [x] A6, A7, A9, A10 still red (Phase 4); A12 still red (Phase 5). A11 went green in Build Phase 2 and stays green — recorded there.
- [x] `pnpm check` clean on touched files; `tsc --noEmit` clean; A4 still green, so none of the three new rules touches the existing corpus — which is the claim that matters, since all three are new refusals

#### Build Phase 3 Context
- [x] Add to Conventions: Test Phase 1 is the register — every deferral justified there, optionally carrying the deferred test's body; a row green on arrival must declare itself a regression guard

#### Build Phase 3 Document
- [x] (deferred to Phase 5 — same reason as Phase 1)

### Build Phase 4: Gate A, and both lanes

- [x] Correct Gate A: authoring is enforced against test phases, and a row whose authoring phase has passed while still unwritten is caught when any later phase closes (A6, A7) — `===` became `<=` on the document timeline, plus a `phaseExists` guard so a row naming a phase nobody has written yet is a forward reference rather than a missed obligation. `Phase 0` counts as present by definition, which is what finally makes the 260 unenforceable rows enforceable.
  - **Measured before shipping**: of the active plans in this repo, exactly **two** are now blocked on their next checkoff — `falsify-phase-authoring` (5 of 6 rows non-terminal) and `local-telemetry` (4 of 23). Both are legitimately blocked: those tests were never authored. That is the rule working rather than collateral damage, but it is a real operational consequence and belongs in the record rather than in a surprise.
- [x] A test phase cannot close while any row it authors is unwritten (A9) — a test phase's Verification gate now also advances the obligation, because a test phase's items *are* the authoring and one that can close with unwritten tests has nothing to review
- [x] Prove the thin lane walks a plan with two numbering sequences (A10)
- [x] Prove both lanes refuse the same violation with the same message (A11) — the gate scripts are shared, which makes this assumable and therefore worth asserting
- [x] **Discovered — an eighth copy of the phase-reference pattern, inside `check-gates.js` itself.** Its local `parseTrajectoryFromBody` had its own `/^\s*Phase\s+(\d+)\s*$/i`, so every `Test Phase N` cell parsed as `NaN` and Gate A matched nothing at all. Found only because the gate silently stopped firing — a duplicated pattern does not announce itself when it falls behind, it just stops enforcing. Routed through the shared parser. This is the plan's own thesis landing on the plan.
- [x] **Discovered — Gate B had to move to the timeline too.** It counted `for (closingPhase = 1; closingPhase < advancingPhase; closingPhase++)`, which has no meaning across two sequences. Now: every row whose `Passes at` sits earlier in the document than the advancing phase.
- [x] **Discovered — the loop identified phases by number.** `find(p => p.number === planned.number)` returns Test Phase 1 for both Test Phase 1 and Build Phase 1, so `atdawn run` re-ran the test phase instead of advancing. Now matched by `ordinal`, and the phase-close probe truncates by position rather than by phase number.

#### Build Phase 4 Verification
- [x] A6, A7, A9, A10, A11 pass
- [x] A12 still red (Phase 5)
- [x] Full suite green apart from the known-red cases; `pnpm check` clean — 13 failures: A12's two, 9 admin/tarball needing a built app, and the known-red PID-reuse pair
- [x] **A hole I opened and closed inside this phase**: moving the trajectory gates ahead of the gate-completeness loop put that loop *after* the terminal `process.exit(0)`, so gate completeness stopped running entirely. Exit code 0 with no message — the failure mode is indistinguishable from "everything passed", which is precisely the class of bug this plan exists to remove. Caught by A16's "the phases around it are really parsed" case, which asserts a refusal rather than an acceptance; an acceptance-only test would have gone green on a disabled validator.

#### Build Phase 4 Context
- [x] Add to Known Gotchas: Gate A enforces authoring at or before the advancing phase, so a row left unwritten surfaces at the next phase close rather than only at its own — and it is enforced identically in both lanes because the gate scripts are shared

#### Build Phase 4 Document
- [x] (deferred to Phase 5 — same reason as Phase 1)

### Build Phase 5: The skills, and the guide

- [x] `/planner` authors Test Phase 1 first, with the deferral shape and the register rule (A12); resync the installed copy — guidance section, the impl template's frontmatter (`test_phases: required`), and the template's own phases now spelled `### Test Phase 1` + `### Build Phase N`
- [x] `/work` executes a test phase — author, run, confirm red, review the deferrals before opening any build phase; resync
- [x] **Correct `/work`'s `.skip()` advice.** It currently says to use `.skip()` when a test cannot run against a compiled symbol; A15 proves that does not work, because module resolution precedes test collection. `.skip()` is right when the symbol exists and the behavior does not; a commented body in the Test Phase 1 deferral is right when the symbol does not exist.
- [x] Update `guide/test-trajectory.md`: the test phase, the register, the deferral shape, and the real-red/fake-red distinction with the boundary rule — a test reaching its subject over HTTP, a CLI, a query or the filesystem gives a real red on day one; one that `import`s its subject cannot
- [x] Add the changelog entry
- [x] **Discovered — `template.test.ts` anchored on `#### Phase 1 Verification`.** Renaming the template's gate headings broke it, and it broke *badly*: `indexOf` returned −1, `slice(-1)` yielded the template's last character, and the assertion reported `expected '}' to match /T\d+/` — a real break wearing a nonsense message. Now accepts either spelling and asserts the anchor was found, so the next rename fails legibly.

#### Build Phase 5 Verification
- [x] A12 passes; `skill-sync-parity` green
- [x] All 17 rows terminal
- [x] Full suite green apart from the known-red cases; `pnpm check` clean; `pnpm --filter docs build` completes — 11 remaining failures are 9 admin/tarball tests needing a built app and a packed tarball, plus the known-red PID-reuse pair; none belong to this plan

#### Build Phase 5 Context
- [x] Update Current State with a one-line entry naming the structure as shipped and the remaining lifecycle questions as follow-ons

#### Build Phase 5 Document
- [x] The guide updates above, plus a Mermaid of the two sequences and a deferral's path — Test Phase 1 entry → later test phase → the build phase that turns it green

### Build Phase 6: Falsification — the fence is load-bearing now, and two guards have holes

**Goal**: this plan made fenced code blocks structural — a deferral *carries the deferred test's body*, so impls now contain arbitrary code where before they contained prose. `fencedLineMask` became load-bearing in three parsers in one commit, and it is 12 lines that assume every fence is balanced and that all fence markers are interchangeable. Neither assumption survives contact with a real carried body. Alongside it: the phase-close probe's new ordinal defaulting is wrong for the seven impls that open at `Phase 0`, and two rules have gaps where they are unenforced or unsatisfiable.

Each hypothesis below was confirmed by running the shipped code against a fixture during the ritual, not predicted.

- [x] **A18 — an unterminated fence deletes every phase after it.** `fencedLineMask` toggles on each marker, so an unclosed block masks the rest of the file. Confirmed: an impl whose register carries a body missing its closing fence reports `[{test 1}]` from `phaseSequence` — Build Phases 1 and 2 simply vanish. The zero-phase rejection does not fire, because one phase parsed. Every downstream rule then reads a truncated document: gate completeness cannot see the missing phases, and Gate A's `phaseExists` reports their rows' phases absent and skips them. **A silent disable, reintroduced by the very feature that motivated the zero-phase guard.** Fix: track the opening marker's character and length, and **refuse an impl with an unterminated fence**, naming the opening line. Failing open would leak the body's checkboxes into structure; failing silent is what this plan exists to stop; refusing is the only outcome that is loud.
- [x] **A19 — a `~~~` inside a backtick block ends the block.** The mask treats ``` and `~~~` as interchangeable, so a carried body containing the other marker un-masks the remainder. Confirmed: a register entry carrying a markdown sample with a tilde fence leaks `- [x] not a real item` back into structure — precisely the thing A16 asserts cannot happen, which A16 misses because it only ever tested backticks. A carried test body is arbitrary text by design, and in this repo it is frequently markdown *about* markdown. Fix: a fence closes only on a marker of the **same character** and **at least the same length** (CommonMark's rule), which also makes nested examples expressible.
- [x] **A20 — `verify` probes the wrong boundary on a `Phase 0` plan.** `probePhaseClose` gained an `ordinal` parameter defaulting to `phase - 1`; `verify/detect.ts` does not pass one. In a plan opening at `### Phase 0`, Phase 1 sits at position 1, so verifying phase 1 truncates after **Phase 0** and asks whether *that* phase closed. Phase 1's own incomplete gates become invisible, and premature checkoff — verify's first detection — silently stops detecting at exactly the boundary it was asked about. Seven impls in this repo open at `Phase 0`. Fix: resolve the phase's ordinal from the parsed impl in `detect.ts` and pass it; the default stays for callers that genuinely have a single sequence.
- [x] **A21 — a test phase with no Verification gate is accepted.** Confirmed against the validator. The four-gate loop deliberately skips test phases (a test phase carries one gate, not four), and nothing then requires the one. But that gate *is* the U1 compensating control — "Test Phase 1 cannot close until its deferred bodies have been reviewed" — so an author who omits it removes the review entirely and the plan's own answer to its only Deferred Verification row evaporates. Fix: require a `#### Test Phase N Verification` on every test phase, refusing by name when absent.
- [x] **A22 — the regression-guard rule can demand an entry in a phase that does not exist.** `validateRegressionGuards` fires on any row whose two ends name the same test phase, without checking that the phase is in the document, and its message says to add an entry under `#### Regression Guards` in Test Phase 1. When Test Phase 1 is absent the instruction cannot be followed — reachable in the mid-conversion state this plan itself passed through in Build Phase 2, where the trajectory already used test-phase cells and the checklist still said `### Phase N`. Fix: skip the rule when the named test phase is absent, exactly as Gate A does; `test-phase-presence` is the rule that should complain, and it names the real problem.

#### Build Phase 6 Verification
- [x] A18: an unterminated fenced block is refused, and the message names the opening line rather than reporting a structural error elsewhere
- [x] A19: a `~~~` inside a backtick-fenced body leaves the body inert — the checklist item in it is not read as structure, and the enclosing phases still parse
- [x] A20: `verify --phase 1` on a plan opening at `Phase 0` reports Phase 1's premature checkoff; the same plan with an honest Phase 1 reports clean
- [x] A21: a test phase with no Verification gate is refused by name; one with a Verification gate is accepted
- [x] A22: a green-on-arrival row whose test phase is absent is not refused for a missing register entry; with the test phase present and no entry, it still is

#### Build Phase 6 Context
- [x] Add to Known Gotchas: `fencedLineMask` is load-bearing structure, not cosmetics — a carried test body is arbitrary text, so fences close on the same character at the same-or-greater length and an unterminated fence is a refusal, never a silent truncation of the document

#### Build Phase 6 Document
- [x] Update `guide/test-trajectory.md`'s carried-body section with the fence rule an author needs to know: nest by lengthening the marker, and an unclosed fence is refused

### Build Phase 7: Cleanup — one parser, one register, and a port you can check by looking

**Goal**: this plan added five validator rules to two implementations at once — ~276 lines of TypeScript and ~290 lines of hand-ported JavaScript saying the same things. The duplication is structural, not accidental: hooks are plain JS and cannot import a `.ts` module. What *is* accidental is that the port boundary has no shape — `validate-impl-structure.js` is now 952 lines in which hook plumbing, a trajectory parser, a register reader and eight rules are interleaved, and `check-gates.js` carries a **second, independent** copy of the trajectory-row parser. That second copy is not hypothetical debt: it silently stopped understanding `Test Phase N` in Build Phase 4, every row parsed as `NaN`, and Gate A matched nothing at all. The fix landed; the *class* did not.

Each item below is a concrete extraction or a reasoned leave-as-is. The theme is one definition per concern and a one-to-one file correspondence across the port, so "change the TS and every JS port together" becomes something you verify by looking at two filenames instead of hunting inside a thousand lines.

- [x] Extract `hooks/_trajectory-parser.js` — the trajectory-row parser, imported by **both** hooks. `check-gates.js` and `validate-impl-structure.js` each carry their own today; the eighth-copy bug this plan hit came from exactly that, and a shared module is the only fix that survives the next person adding a column. Hook-local `_`-prefixed module, the established pattern (`_hook-paths.js`, `_impl-headings.js`) — no settings entry, must live in `hooks/` or the importer dies at load.
- [x] Extract `src/lib/trajectory/register.ts` — `parseRegister` plus its three heading patterns. Reading Test Phase 1's register is a distinct concern from validating rows, it is used by two rules, and pulling it out is what makes the mirror correspondence one-to-one.
- [x] Extract `hooks/_register.js` as that module's port, and have `validate-impl-structure.js` import it — same reasoning, other side of the boundary.
- [x] Extend the TS↔JS parity test to the five test-phase rules (A24). `rationale-baseline-parity.test.ts` already pins this discipline for the rationale rule and was written *because* the port is a manual mirror; this plan added five rules to both sides and put none of them under it. Note that A24 is **green on arrival** — both implementations were written together, so it has no red phase. It earns its place as a regression guard, not as a discovery.
- [x] (reviewed `src/lib/trajectory/validator.ts`, 619 lines — left as-is once the register moves out: eight rule functions, each small, each independently exported and tested, all read and changed together. Splitting them across files would scatter a single cohesive responsibility and force every rule change to touch an import graph instead of a function.)
- [x] (reviewed Gates A and B in `check-gates.js` — left in place: ~90 lines tightly coupled to `newlyChecked`, `sequence` and the phase ordinals computed just above them. Lifting them into a module would mean threading all three through a new signature, and would separate the ordering rule from the ordering data it reads. The parser extraction already takes ~130 lines out of this file.)
- [x] (reviewed `skills/planner.md`, 607 lines — left as-is: a skill is one file by contract (`.claude/skills/{name}/SKILL.md`), and the sync-parity test pins byte-equality against exactly one source. Splitting it would break the installer.)
- [x] (reviewed `apps/docs/src/changelog.md`, 448 lines — left as-is: an append-only historical record, where length is the point.)

#### Build Phase 7 Verification
- [x] A23: a structural count over `hooks/` finds exactly one trajectory-row parser — the same shape as A13, and for the same reason: no behavioural test can catch a divergence that has not happened yet
- [x] A24: the TS validator and the JS hook agree on every test-phase rule across the shared fixture set, with the fixtures covering both the accept and the refuse side of each rule
- [x] Full suite green apart from the known-red admin/tarball and PID-reuse cases; `pnpm check` and `tsc --noEmit` clean

#### Build Phase 7 Context
- [x] Update the Known Gotchas entry on hook ports: each `_`-prefixed hook module mirrors exactly one `src/lib` module, one-to-one, and the trajectory parser has a single definition under `hooks/` pinned by A23 — the eighth-copy bug is the reason the correspondence is now a rule rather than a habit

#### Build Phase 7 Document
- [x] Update `reference/trajectory/parser.md` with the module layout after the split — which module owns row parsing, which owns the register, and which JS port mirrors each — so a contributor changing a rule knows every file they must touch

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/impl-headings.ts` | New — one definition of every phase/gate heading |
| `apps/indusk-mcp/src/lib/impl-parser.ts` | Import the definitions; parse both phase kinds |
| `apps/indusk-mcp/src/lib/trajectory/validator.ts` | Import; test-phase rules |
| `apps/indusk-mcp/src/lib/shape/impl-blocks.ts` | Import instead of defining |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | Register rules; zero-phase rejection; mirrored constants |
| `apps/indusk-mcp/hooks/check-gates.js` | Gate A correction; zero-phase rejection |
| `apps/indusk-mcp/hooks/gate-reminder.js` | Mirrored constants |
| `apps/indusk-mcp/skills/planner.md` + installed | Authors Test Phase 1 |
| `apps/indusk-mcp/skills/work.md` + installed | Executes a test phase; `.skip()` advice corrected |
| `apps/docs/src/guide/test-trajectory.md` | The test phase, the register, real vs fake red |
| `apps/docs/src/changelog.md` | Entry |
| `CLAUDE.md` | Conventions, Known Gotchas, Current State |

## Dependencies

- None. `lifecycle-rebalance` is closed and archived; this uses its research but none of its code.

## Notes

- **Authoring the tests found one contradiction and one wrong premise**, both recorded above rather than quietly resolved: A1 and A4 contradict without a frontmatter opt-in, and A4's "all 52 validate today" was false — nine already do not. Neither was visible from the ADR; both were visible within minutes of executing the assertions. That is the argument for the phase this plan adds, made by the plan on itself.
- **A4 is the stop condition.** If the 52 existing impls cannot validate unchanged, the optional-prefix approach has failed and this plan should reconsider rather than begin migrating. It is asserted over the real corpus, not a fixture, because a fixture would test the trick rather than the claim.
- **The zero-phase rejection is discovered scope, not gold-plating.** Two lessons already name it and neither hook implements it. A plan that changes what a heading looks like cannot also leave "no headings parsed" as a silent pass — a typo in the new syntax would disable every structural rule at once, which is the worst possible failure for exactly this change.
- **Document gates are deliberately deferred to Phase 5** and say so in each phase rather than being omitted. `lifecycle-rebalance` measured the alternative: `verify.md` rewritten across six commits, and a flag shipped undocumented after five per-phase Document gates passed. Writing the guide once against the finished shape is the correction, recorded here rather than practised silently.
- **This impl is written in today's heading shape and converts itself in Phase 2.** Writing the new shape at authoring time would have parsed zero phases and — until Phase 1's fix — passed vacuously, so the plan that adds enforcement would have executed without any.
