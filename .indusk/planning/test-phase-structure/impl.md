---
title: "Test phases as structure"
date: 2026-08-11
status: in-progress
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
| A1 | Writing a new impl that has no test phase is refused, and the message names what is missing | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | written |
| A2 | Writing an impl whose second test phase has no justification in the first is refused, naming the unjustified phase | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | written |
| A3 | Writing an impl whose every additional test phase is justified in the first is accepted | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | written |
| A14 | An impl carrying no separate `Trajectory Rationale` section still validates when its deferrals live in Test Phase 1 | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | written |
| A8 | A row that passes the moment it is authored is accepted only when declared a regression guard; an undeclared one is refused, naming it | `apps/indusk-mcp/src/__tests__/test-phase-rules.test.ts` | Phase 0 | Phase 3 | written |
| A6 | Checking off build work while a test phase still has unauthored tests is refused, naming the unauthored test | `apps/indusk-mcp/src/lib/__tests__/gate-a.test.ts` | Phase 0 | Phase 4 | written |
| A7 | A test that should have been authored earlier and still isn't is caught when any later phase closes — not only at the phase it was due | `apps/indusk-mcp/src/lib/__tests__/gate-a.test.ts` | Phase 0 | Phase 4 | written |
| A9 | A test phase cannot close while any test it authors has not been written | `apps/indusk-mcp/src/lib/__tests__/gate-a.test.ts` | Phase 0 | Phase 4 | written |
| A10 | A plan containing test phases runs to completion under `atdawn run`, closing each phase in order | `apps/indusk-mcp/src/lib/run/test-phase-parity.test.ts` | Phase 0 | Phase 4 | written |
| A11 | The same violation is refused identically in both lanes, with the same message | `apps/indusk-mcp/src/lib/run/test-phase-parity.test.ts` | Phase 0 | Phase 4 | written |
| A15 | A test file whose import cannot be resolved fails to load **even when every test in it is skipped** | `apps/indusk-mcp/src/__tests__/skip-does-not-defer.test.ts` | Phase 0 | Phase 1 | passing |
| A12 | A plan created by `/planner` contains a test phase as its first phase | `apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts` | Phase 0 | Phase 5 | written |

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

- [ ] **Discovered — the rule needs an opt-in: `test_phases: required`.** A1 says an impl with no test phase is refused; A4 says every impl already in the repository still validates; every impl already in the repository has no test phase. Read literally the two contradict, and authoring them together is what surfaced it. The resolution is the one `trajectory: required` already established — the rule fires only when the frontmatter asks for it, `/planner` writes it into new impls, and existing impls are exempt by saying nothing. The rejected alternative is exempting `archive/` by path, which makes the rule a property of where a file lives rather than of what it claims about itself.
- [ ] Require a test phase in any impl carrying `test_phases: required` (A1) — the message names what is missing, not merely that something is
- [ ] Require every `### Test Phase N` where N > 1 to have a matching justification entry in Test Phase 1 (A2, A3) — the register's two subsections are `#### Deferred to Test Phase N` and `#### Regression Guards`, pinned by the tests. Structural, so the rule reads a heading rather than interpreting prose.
- [ ] Accept a deferral entry that carries the deferred test's body, without treating the code block as a checklist item or gate (A16 extends here)
- [ ] Accept an impl whose deferrals live in Test Phase 1 and which has no `Trajectory Rationale` section (A14); keep parsing the legacy section so existing impls validate
- [ ] Require a green-on-arrival row to be **declared a regression guard**, and refuse an undeclared one (A8)

#### Build Phase 3 Verification
- [ ] A1, A2, A3, A14, A8 pass
- [ ] A6, A7, A9, A10, A11 still red (Phase 4); A12 still red (Phase 5)
- [ ] `pnpm check` clean on touched files

#### Build Phase 3 Context
- [ ] Add to Conventions: Test Phase 1 is the register — every deferral justified there, optionally carrying the deferred test's body; a row green on arrival must declare itself a regression guard

#### Build Phase 3 Document
- [ ] (deferred to Phase 5 — same reason as Phase 1)

### Build Phase 4: Gate A, and both lanes

- [ ] Correct Gate A: authoring is enforced against test phases, and a row whose authoring phase has passed while still unwritten is caught when any later phase closes (A6, A7)
- [ ] A test phase cannot close while any row it authors is unwritten (A9)
- [ ] Prove the thin lane walks a plan with two numbering sequences (A10)
- [ ] Prove both lanes refuse the same violation with the same message (A11) — the gate scripts are shared, which makes this assumable and therefore worth asserting

#### Build Phase 4 Verification
- [ ] A6, A7, A9, A10, A11 pass
- [ ] A12 still red (Phase 5)
- [ ] Full suite green apart from the known-red cases; `pnpm check` clean

#### Build Phase 4 Context
- [ ] Add to Known Gotchas: Gate A enforces authoring at or before the advancing phase, so a row left unwritten surfaces at the next phase close rather than only at its own — and it is enforced identically in both lanes because the gate scripts are shared

#### Build Phase 4 Document
- [ ] (deferred to Phase 5 — same reason as Phase 1)

### Build Phase 5: The skills, and the guide

- [ ] `/planner` authors Test Phase 1 first, with the deferral shape and the register rule (A12); resync the installed copy
- [ ] `/work` executes a test phase — author, run, confirm red, review the deferrals before opening any build phase; resync
- [ ] **Correct `/work`'s `.skip()` advice.** It currently says to use `.skip()` when a test cannot run against a compiled symbol; A15 proves that does not work, because module resolution precedes test collection. `.skip()` is right when the symbol exists and the behavior does not; a commented body in the Test Phase 1 deferral is right when the symbol does not exist.
- [ ] Update `guide/test-trajectory.md`: the test phase, the register, the deferral shape, and the real-red/fake-red distinction with the boundary rule — a test reaching its subject over HTTP, a CLI, a query or the filesystem gives a real red on day one; one that `import`s its subject cannot
- [ ] Add the changelog entry

#### Build Phase 5 Verification
- [ ] A12 passes; `skill-sync-parity` green
- [ ] All 17 rows terminal
- [ ] Full suite green apart from the known-red cases; `pnpm check` clean; `pnpm --filter docs build` completes

#### Build Phase 5 Context
- [ ] Update Current State with a one-line entry naming the structure as shipped and the remaining lifecycle questions as follow-ons

#### Build Phase 5 Document
- [ ] The guide updates above, plus a Mermaid of the two sequences and a deferral's path — Test Phase 1 entry → later test phase → the build phase that turns it green

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
