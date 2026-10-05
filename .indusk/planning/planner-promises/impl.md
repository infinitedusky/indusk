---
title: "The planner asks for promises"
date: 2026-10-05
status: in-progress
trajectory: required
test_phases: required
test_kinds: required
rationale: required
gate_policy: ask
---

# The planner asks for promises

## Goal

A plan's brief is its expectations and its promises, written from the planning
conversation; every test row says what it is for; a plan closes only with its
promises proven; and an incident starts from the tests that were vouching
([ADR](adr.md)).

## Scope

### In Scope
- The row: a level and a purpose (ADR D3, D7), and the row a reopened plan
  gets (D6)
- Commands that write the registry (D4) and the contract check with its three
  callers (D1, D2)
- Confirmation at close (D5) and incidents that list their rows (D6)
- The planner and retrospective skills, the templates, the admin's row table
  (D8, D9)

### Out of Scope
- The check at change time (`day-contract`); "seen failing" recorded by the
  system (`day-claim-evidence`); promises with no owner
  (`promise-first-build`); building and reading expectation telemetry (a
  later plan); scoring expectations (`plan-premises`)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | this plan's six promises, `declared`; every test that can be written, red | today's tree |
| Build Phase 1 | `appendLateRow` filling the columns its table has | — |
| Build Phase 2 | `lib/test-levels.ts`; the `Level` and `For` columns in both parsers; `test_levels` and `test_purpose` keys | Build Phase 1's row writer |
| Build Phase 3 | `lib/promises/write.ts`; `promises declare / change / replace`; the `supersedes` key | the registry reader |
| Build Phase 4 | `parseBriefContract`; `checkPlanContract`; `promises contract`; the hook's call to it | Build Phase 2's rows, Build Phase 3's registry |
| Build Phase 5 | `confirmPlan`; `promises confirm`; the retrospective gate's `promises` | Build Phase 4's contract |
| Build Phase 6 | `rowsNaming`; the incident's `Proven by` | Build Phase 2's rows |
| Build Phase 7 | the planner and retrospective skills and templates; the admin's row columns; this plan's promises confirmed | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Kind | For | Test |
|----|---------|-------------|-----------|-------|------|-----|------|
| A1 | A promise written from a planning conversation is in the registry as `declared`, owned by its plan, with the sentence the person approved, and the check passes | Test Phase 1 | Build Phase 3 | written | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-declare.test.ts |
| A2 | In a project that has declared no domains, writing its first promise declares that promise's domain with it, and the check passes | Test Phase 1 | Build Phase 3 | written | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-declare.test.ts |
| A3 | A plan cannot start building while its brief names, among the promises it makes, one the registry does not hold or another plan owns; the refusal names the promise | Test Phase 1 | Build Phase 4 | written | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A4 | A plan cannot start building while its brief lists, among the promises it must not break, changes or replaces, one that does not exist or is already retired; the refusal names it | Test Phase 1 | Build Phase 4 | written | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A5 | An impl whose every test row names a promise, names a lesson, or gives a reason is accepted; one with a row that does none of these is refused, naming the row | Test Phase 1 | Build Phase 2 | written | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/row-purpose.test.ts |
| A6 | A row that names a promise the registry does not hold, a retired promise, or a lesson that does not exist is refused, naming it | Test Phase 1 | Build Phase 4 | written | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A7 | A plan's page in the admin shows, for each test row, what it is for | Build Phase 7 | Build Phase 7 | planned | unit | promise: every-test-says-what-it-is-for | apps/indusk-admin/src/components/phases/TrajectoryRowsTable.test.tsx |
| A8 | A plan holding a declared promise that no passing row names cannot close; the refusal names the promise | Test Phase 1 | Build Phase 5 | written | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A9 | Closing a plan whose promises are each named by a passing row moves them to `enforced`, and the registry check then passes | Test Phase 1 | Build Phase 5 | written | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A10 | A plan that made no promise closes as it did before | Test Phase 1 | Build Phase 5 | written | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A11 | In a workbench, where a plan's tests exist only in a repository's worktree until it lands, the plan still closes with its promises confirmed | Test Phase 1 | Build Phase 5 | written | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A12 | When a promise breaks, its incident names every test row that proves it: the plan, the row, and whether the row is passing | Test Phase 1 | Build Phase 6 | written | unit | promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts |
| A13 | The row added to a plan that an incident reopens names the promise that broke and has a level, and the plan's impl still validates | Test Phase 1 | Build Phase 1 | written | unit | promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/reopen-row-complete.test.ts |
| A14 | A plan cannot start building while an expectation in its brief has no measure or no time to look; the refusal names the expectation | Test Phase 1 | Build Phase 4 | written | unit | promise: an-expectation-says-how-it-is-measured | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A15 | A brief that says it has no expectations, with the reason, is accepted | Test Phase 1 | Build Phase 4 | written | unit | promise: an-expectation-says-how-it-is-measured | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A16 | The hooks' copy of the test levels equals the package's list, and the hooks' row parser reads the new column exactly as the package's does | Test Phase 1 | Build Phase 2 | written | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/test-levels-parity.test.ts |
| A17 | With this plan's tests added, no everyday test starts a server or waits | Test Phase 1 | Test Phase 1 | passing | unit | promise: everyday-tests-never-wait, promise: everyday-suite-stays-fast | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A18 | Every impl and every brief written before this plan is accepted exactly as it was | Test Phase 1 | Build Phase 4 | written | unit | a regression guard over the documents written before this plan | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A19 | A new impl names each test's level under `Level`; the archived test-kinds impl, which says `Kind`, still validates | Test Phase 1 | Build Phase 2 | written | unit | a rename decided 2026-10-05; keeps the old spelling working | apps/indusk-mcp/src/__tests__/test-levels-validation.test.ts |
| A20 | The planner's brief template has Expectations and Promises, and no Problem, Proposed Direction or Success Criteria | Test Phase 1 | Build Phase 7 | written | unit | pins the template every new plan is handed | apps/indusk-mcp/src/__tests__/planner-brief-template.test.ts |
| A21 | A bugfix or refactor plan may carry a research document, and is not marked incomplete without one | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the why left the brief, so those plans need somewhere to put it | apps/indusk-mcp/src/__tests__/research-optional.test.ts |
| A22 | This plan's own six promises go the whole way: `declared` before its first test, named by these rows, and `enforced` when it is confirmed | Build Phase 7 | Build Phase 7 | planned | live check | promise: a-closed-plan-kept-its-promises | |
| A23 | In a new scratch project, a planning conversation ends with declared promises in the registry and a brief that names them, and nobody typed a registry file | Build Phase 7 | Build Phase 7 | planned | live check | promise: a-briefs-promises-are-in-the-registry | |
| A24 | A test row that names a promise another plan owns is refused unless the brief lists that promise under must not break, changes or replaces | Test Phase 1 | Build Phase 4 | written | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A25 | When a plan that changes a promise closes, the promise has its new sentence and is owned by that plan, and its History shows the old sentence, the reason and the previous owner; its incidents and the marks that name it still resolve | Test Phase 1 | Build Phase 5 | written | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A26 | When a plan that replaces a promise closes, the old one is retired, the new one records which it replaced, and the check passes; a replacement naming a promise that does not exist is refused | Test Phase 1 | Build Phase 5 | written | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A27 | A changed promise that breaks later reopens the plan that changed it, and its incident lists the rows that name it in both plans | Test Phase 1 | Build Phase 6 | written | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts |

### Deferred Verification

- **The planner holds the conversation well (U1)**
  - reason: it is an agent following prose; whether it draws out what the person wants, reads the promises back and takes corrections cannot be asserted by a test
  - would require: many real planning conversations, judged by the people in them
  - mitigation: the scratch-project live check in Build Phase 7 checks the outcome once; the brief's first expectation measures it over the next five plans; the downstream plan `demo-rehearsal` runs it on camera
- **The agent notices every existing promise a plan affects (U2)**
  - reason: at planning time no code exists to check against; it is a reading of sentences
  - would require: the check at change time, which reads the code a plan touched
  - mitigation: the affected promise's own tests fail if it is broken, so the plan cannot close green; a row that names it forces the brief to address it; the downstream plan `day-contract` flags code that touches a promise's site unnamed

## Checklist

### Test Phase 1: The promises declared; every test that can be written, red

**Goal**: put this plan's promises in the registry before its first test, write every test that can honestly be written now, and record the ones that cannot.

- [x] Create/confirm this plan's worktree (`indusk worktree create planner-promises`, which records the assignment so the admin and plan tools read the plan from it) — worktree-per-plan default
- [x] Write this plan's six promises to `.indusk/promises/`, `declared`, kind `state`, domain `planning`, owner `planner-promises`, each with the brief's sentence — by hand this once, because the command that writes them is Build Phase 3's. In the same commit, `promises-cli.test.ts` counts a promise as held when it is `enforced`, `known-violated`, or `declared` by a plan that is still open (ADR D10)
- [x] A13: `reopen-row-complete.test.ts` — `reopenOwner` against a copy of the archived test-kinds impl (requires kinds) and against a fixture impl with a `For` column; the appended row has a level and names the promise, and the real hook accepts the impl. RED: the row's cells are empty and the hook refuses
- [x] A5, A19: `row-purpose.test.ts` and `test-levels-validation.test.ts`, through the real hook — `test_purpose: required` with an empty `For` cell is refused naming the row; `test_levels: required` with a `Level` column is accepted and a word that is not a level refused; the archived test-kinds impl still validates. RED: both keys are unknown, so nothing is refused
- [x] A16: `test-levels-parity.test.ts` — the package's parser and the hooks' copy return the same purpose and level for the same table. RED: neither returns a purpose
- [x] A1, A2: `promises-declare.test.ts`, through the CLI in a fixture project. RED: `promises declare` is not a command
- [x] A3, A4, A6, A14, A15, A18, A24: `promises-contract.test.ts`, through the CLI in fixture projects, and over every plan folder in this repository for A18. RED: `promises contract` is not a command
- [x] A8, A9, A10, A11: `promises-confirm.test.ts`, through the CLI; A11 with the fixture's plan root and code root apart. RED: `promises confirm` is not a command
- [x] A25, A26: `promises-change.test.ts`, through the CLI. RED: `promises change` and `promises replace` are not commands
- [x] A12, A27: `incident-proven-by.test.ts` — `recordViolations` with given marks in a fixture whose impls name the promise. RED: the incident has no `Proven by` section
- [x] A20: `planner-brief-template.test.ts` reads `skills/planner.md`. RED: the template still has Problem, Proposed Direction and Success Criteria
- [x] A17, A21: the never-wait guard run over this plan's new tests, and `research-optional.test.ts` over the lifecycle's document states

#### Deferred to Build Phase 7

- **A7** — the admin's row type has no purpose field until Build Phase 7 adds it, and the admin's own type-check test refuses a test that passes a field the type does not have. The shape:

  ```tsx
  it("shows what each row is for", async () => {
    const { container } = await render(
      <TrajectoryRowsTable rows={[{ ...row, level: "unit", purpose: { promises: ["seat-never-double-booked"], lessons: [], reason: null } }]} />,
    );
    expect(container.textContent).toContain("seat-never-double-booked");
  });
  ```
- **A22** — a live check of this plan's own promises being confirmed; there is nothing to confirm until its rows pass.
- **A23** — a live check in a scratch project, run once the planner skill and the commands exist.

#### Regression Guards

- **A17** — the never-wait guard already exists and passes; the row holds it over the tests this plan adds, all of which run a short-lived process or none.
- **A21** — the lifecycle already shows a research document a bugfix or refactor plan carries and does not mark its absence; the row pins that, because the brief no longer holds the why.

#### Test Phase 1 Verification

- [x] Every row writable here is authored; each red one fails on its own assertion, not on a missing import (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/reopen-row-complete src/__tests__/row-purpose src/__tests__/test-levels-validation src/__tests__/test-levels-parity src/__tests__/promises-declare src/__tests__/promises-contract src/__tests__/promises-confirm src/__tests__/promises-change src/__tests__/incident-proven-by src/__tests__/planner-brief-template`); A17 and A21 pass — 10 files, 54 tests red, each on its assertion (an unknown command exits 1 where 0 or 2 is expected; the hook accepts what it should refuse; a parser returns no purpose), none on a missing import; the guards and the accept cases pass, 19 tests; 2.6 s
- [x] `indusk promises check` passes with the six declared promises, and `promises-cli.test.ts` passes — 12 promises, 6 declared. Found on the way: a token spelled out in a test source (and one in a comment, "the same promise: same name") read as a citation of a promise that does not exist; the tests build their tokens instead
- [x] The deferred body above reviewed: it compiles once the row type has `level` and `purpose`, and it asserts what A7 claims

### Build Phase 1: A reopened plan stays valid

- [ ] `lib/trajectory/append-row.ts`: `appendLateRow(text, phase, row)` — `row` gains `cells?: Record<string, string>`, keyed by lower-cased header; every header the table has and the caller names is filled
- [ ] `lib/promises/reopen.ts`: the Maintenance row passes `kind` and `level` as `unit`, the smallest, and `for` as `promise: <name>`, so whichever of those columns the owner's table has is filled

#### Build Phase 1 Verification

- [ ] A13 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/reopen-row-complete src/__tests__/monitor-reopen-validator`), and the three impls the older reopen test covers still validate

#### Build Phase 1 Context

- [ ] guard: `reopen-row-complete.test.ts` carries `lesson: a-row-writer-fills-every-column-its-table-requires`; the lesson file is written with it

#### Build Phase 1 Document

- [ ] `apps/docs/src/changelog.md` Unreleased, Fixed: a plan reopened by a broken promise no longer gets a row its own validator refuses

### Build Phase 2: The row has a level and a purpose

- [ ] `lib/test-levels.ts` (`TEST_LEVELS`, `isTestLevel`, `levelsList`) and `hooks/_test-levels.js`, pinned equal; `lib/test-kinds.ts` re-exports them; the package exports `./test-levels` and keeps `./test-kinds`
- [ ] Both parsers (`lib/trajectory/parser.ts`, `hooks/_trajectory-parser.js`): a `Level` header, or `Kind` when either key is set, gives the row's level; a `For` header gives `purpose: { promises, lessons, reason }`
- [ ] The validator and the hook: `test_levels: required` means what `test_kinds: required` meant, and says "level"; `test_purpose: required` refuses a row whose `For` cell is empty, naming the row
- [ ] Rename `test-kinds-validation.test.ts` and `test-kinds-parity.test.ts` to the `test-levels` names the rows cite, keeping every case
- [ ] This impl: `Kind` becomes `Level`, `test_kinds` becomes `test_levels`, and `test_purpose: required` is set — the plan validated by its own rule
- [ ] `indusk update` in this repository, so the installed hooks match

#### Build Phase 2 Verification

- [ ] A5, A16 and A19 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/row-purpose src/__tests__/test-levels-validation src/__tests__/test-levels-parity src/lib/trajectory src/__tests__/impl-corpus src/__tests__/hook-shared-modules`)
- [ ] `apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts` still passes with the changed hook

#### Build Phase 2 Context

- [ ] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the test-kinds entry becomes "a row's `Level` is one of five, and its `For` says what the test is for — a promise, a lesson, or why neither; `test_levels` and `test_purpose` make the hook refuse a row without them"

#### Build Phase 2 Document

- [ ] `apps/docs/src/guide/test-kinds.md` moves to `guide/test-levels.md`, the old page left as a pointer; `guide/test-trajectory.md` gains `Level` and `For`; the sidebar follows

### Build Phase 3: Commands write the registry

- [ ] `lib/promises/write.ts`: `declarePromise`, `changePromise`, `replacePromise` — the one writer. `declare` adds the domain to `promises.domains` when the project does not declare it; `change` keeps name, state, incidents and aliases, moves the owner, and adds a History line with the old sentence, the reason and the previous owner; `replace` declares the new promise with `supersedes: <old>`
- [ ] `lib/promises/registry.ts` reads `supersedes`; `check.ts` refuses one that names a promise the registry does not hold
- [ ] `bin/commands/promises.ts` and `bin/cli.ts`: `promises declare | change | replace`; `tools/plan-tools.ts`: `declare_promise`, `change_promise`, `replace_promise`

#### Build Phase 3 Verification

- [ ] A1 and A2 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-declare src/__tests__/promises-check src/__tests__/promises-single-definition`)

#### Build Phase 3 Context

- [ ] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the `.indusk/promises/` entry gains "written by `indusk promises declare | change | replace`, never by hand"

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: `declare`, `change`, `replace`, and the `supersedes` key

### Build Phase 4: The brief and the contract

- [ ] `lib/promises/brief-contract.ts`: `parseBriefContract(text)` — the shape in ADR D1; a brief with no `## Promises` heading is `legacy`
- [ ] `lib/promises/contract.ts`: `checkPlanContract(planRoot, plan)` — the five refusals in ADR D2, each naming the promise, expectation or row
- [ ] `promises contract <plan>`; `promises check` runs it for every active plan whose brief is in the new shape
- [ ] `hooks/validate-impl-structure.js`: for an impl that sets `test_purpose: required` and is past `draft`, run `promises contract <plan>` through `INDUSK_BIN`, pass its refusal on, and refuse with the reason when it cannot be run
- [ ] This plan's own brief put in the exact shape the parser reads, and its contract passing

#### Build Phase 4 Verification

- [ ] A3, A4, A6, A14, A15, A18 and A24 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-contract src/__tests__/promises-check src/__tests__/hook-cwd-independence`)
- [ ] `indusk promises contract planner-promises` exits 0, and a write to this impl is still accepted

#### Build Phase 4 Context

- [ ] hooks (`apps/indusk-mcp/hooks/CLAUDE.md`): "a rule that needs the registry or a brief runs through `indusk promises contract`, never a second reader in a hook; a check that cannot be run refuses and says why"

#### Build Phase 4 Document

- [ ] New `apps/docs/src/guide/briefs.md`: what a brief holds, the three lists for existing promises, what goes to research, with one Mermaid diagram from conversation to incident; `reference/cli/promises.md` gains `contract`; the sidebar follows

### Build Phase 5: Closing confirms

- [ ] `lib/promises/confirm.ts`: `confirmPlan({ planRoot, codeRoot, plan })` — refuses a declared promise no passing row names; fills `tests:` from those rows' `Test` files and `sites:` from the other files carrying the token; sets `enforced` with a History line; retires what a promise supersedes; then runs the check
- [ ] `promises confirm <plan> [--code-root <path>]` and the `confirm_promises` tool
- [ ] `lib/cleanup/gate.ts`: `checkRetrospectiveReadiness` adds `promises` to what is missing, naming them, when the plan owns a declared promise that `confirmPlan` would refuse
- [ ] `skills/retrospective.md`: Step 0 names promises; a confirm step before archival, passing the plan's code worktree in a workbench

#### Build Phase 5 Verification

- [ ] A8, A9, A10, A11, A25 and A26 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-confirm src/__tests__/promises-change src/lib/cleanup`)

#### Build Phase 5 Context

- [ ] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the close-out entry gains "the retrospective confirms the plan's promises (`indusk promises confirm`) before it archives; a declared promise no passing row names blocks the close"

#### Build Phase 5 Document

- [ ] `apps/docs/src/guide/promises.md`: declared, confirmed, changed, replaced; `reference/cli/promises.md` gains `confirm`; `reference/skills/retrospective.md` gains the step

### Build Phase 6: An incident names its tests

- [ ] `lib/promises/rows.ts`: `rowsNaming(planRoot, promise)` — every impl, active and archived, and the rows whose `For` names the promise: plan, row, state
- [ ] `lib/promises/incidents.ts`: a recorded incident gains `## Proven by`, listing those rows or saying that no row names the promise; `registry.ts` reads an incident with that section

#### Build Phase 6 Verification

- [ ] A12 and A27 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/incident-proven-by src/__tests__/promises-check src/__tests__/promises-fix`)

#### Build Phase 6 Context

- [ ] guard: `incident-proven-by.test.ts` carries `lesson: an-incident-starts-from-the-tests-that-vouched`; the lesson file is written with it

#### Build Phase 6 Document

- [ ] `apps/docs/src/guide/promises.md` and `reference/cli/promises.md`: what an incident records, with `Proven by`

### Build Phase 7: The planner, the admin, and this plan's own promises

- [ ] `skills/planner.md`: the conversation step (what is wanted; the existing promises sorted into kept, changed and replaced; the promises read back before the tools save them); the brief template of ADR D1; a research template with Background and Decisions; a test-plan template grouped by promise with a `Level` column; an impl template with `test_levels`, `test_purpose` and the `Level`, `For` and `Test` columns
- [ ] `templates/workflows/{feature,bugfix,refactor}.md` take the same brief; `skills/work.md`: a row that names a promise names its test files by the time it passes
- [ ] `apps/indusk-admin`: the row type carries `level` and `purpose`; `TrajectoryRowsTable.tsx` shows them when a row has them, a promise's name linking to the Promises page
- [ ] `indusk update` in this repository
- [ ] A23, live: in a new scratch project, a headless planning conversation; then read the registry, the brief and the commit that wrote them. Recorded here
- [ ] A22, live: `indusk promises confirm planner-promises` moves this plan's six promises to `enforced`, and `indusk promises check` passes. Recorded here

#### Build Phase 7 Verification

- [ ] A7 and A20 pass (`cd apps/indusk-admin && pnpm exec vitest run src/components/phases`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/planner-brief-template src/__tests__/skill-sync-parity src/__tests__/workflow-types-parity`)
- [ ] A22 and A23 recorded with what was seen
- [ ] `pnpm test` green and marked held, ending with the leak guard's all-clear; `pnpm test:system` runs at landing

#### Build Phase 7 Context

- [ ] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the Documents entry says a brief holds expectations and promises and everything else is research — see `/guide/briefs`; admin (`apps/indusk-admin/CLAUDE.md`): the row table shows `Level` and `For` from the package's parser, never its own

#### Build Phase 7 Document

- [ ] `apps/docs/src/reference/skills/plan.md` and `reference/admin-ui/overview.md`; `apps/docs/src/changelog.md` Unreleased: Added (the brief's expectations and promises, `test_purpose` and `For`, the five commands, `Proven by`), Changed (`Kind` is `Level`)

## Files Affected

| File | Change |
|------|--------|
| `.indusk/promises/*.md` | six new promises |
| `apps/indusk-mcp/src/lib/trajectory/{append-row,parser,validator}.ts`, `hooks/_trajectory-parser.js` | the row's cells, level and purpose |
| `apps/indusk-mcp/src/lib/test-levels.ts`, `hooks/_test-levels.js` | the levels, renamed |
| `apps/indusk-mcp/src/lib/promises/{write,brief-contract,contract,confirm,rows}.ts` | new |
| `apps/indusk-mcp/src/lib/promises/{registry,check,incidents,reopen}.ts` | `supersedes`, `Proven by`, the reopened row |
| `apps/indusk-mcp/src/bin/{cli.ts,commands/promises.ts}`, `src/tools/plan-tools.ts` | five commands, four tools |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | purpose, levels, the contract call |
| `apps/indusk-mcp/src/lib/cleanup/gate.ts` | `promises` at close |
| `apps/indusk-mcp/skills/{planner,work,retrospective}.md`, `templates/workflows/*.md`, `templates/planning/CLAUDE.md` | the conversation, the templates, the confirm step |
| `apps/indusk-admin/src/lib/phases.ts`, `src/components/phases/TrajectoryRowsTable.tsx` | the row's level and purpose |
| ten new test files under `apps/indusk-mcp/src/__tests__/`, and `promises-cli.test.ts` | the rows above |

## Dependencies

- test-kinds landed (1.61.0): the column this plan renames and the validator it extends.

## Notes

- The impl is written with `Kind` and `test_kinds: required` because that is what today's hook validates. Build Phase 2 renames both here.
- Skill text here will be rewritten again by `house-rules-out`, the first plan in the promise-core master; whichever lands second carries the other's edits.
