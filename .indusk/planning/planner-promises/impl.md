---
title: "The planner asks for promises"
date: 2026-10-05
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
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
| Build Phase 8 | `withdrawPromise`; `promises withdraw`; the `withdraw_promise` tool | Build Phase 3's writer |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|------|-----|------|
| A1 | A promise written from a planning conversation is in the registry as `declared`, owned by its plan, with the sentence the person approved, and the check passes | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-declare.test.ts |
| A2 | In a project that has declared no domains, writing its first promise declares that promise's domain with it, and the check passes | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-declare.test.ts |
| A3 | A plan cannot start building while its brief names, among the promises it makes, one the registry does not hold or another plan owns; the refusal names the promise | Test Phase 1 | Build Phase 4 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A4 | A plan cannot start building while its brief lists, among the promises it must not break, changes or replaces, one that does not exist or is already retired; the refusal names it | Test Phase 1 | Build Phase 4 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A5 | An impl whose every test row names a promise, names a lesson, or gives a reason is accepted; one with a row that does none of these is refused, naming the row | Test Phase 1 | Build Phase 2 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/row-purpose.test.ts |
| A6 | A row that names a promise the registry does not hold, a retired promise, or a lesson that does not exist is refused, naming it | Test Phase 1 | Build Phase 4 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A7 | A plan's page in the admin shows, for each test row, what it is for | Build Phase 7 | Build Phase 7 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-admin/src/components/phases/TrajectoryRowsTable.test.tsx |
| A8 | A plan holding a declared promise that no passing row names cannot close; the refusal names the promise | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A9 | Closing a plan whose promises are each named by a passing row moves them to `enforced`, and the registry check then passes | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A10 | A plan that made no promise closes as it did before | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A11 | In a workbench, where a plan's tests exist only in a repository's worktree until it lands, the plan still closes with its promises confirmed | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A12 | When a promise breaks, its incident names every test row that proves it: the plan, the row, and whether the row is passing | Test Phase 1 | Build Phase 6 | passing | unit | promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts |
| A13 | The row added to a plan that an incident reopens names the promise that broke and has a level, and the plan's impl still validates | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/reopen-row-complete.test.ts |
| A14 | A plan cannot start building while an expectation in its brief has no measure or no time to look; the refusal names the expectation | Test Phase 1 | Build Phase 4 | passing | unit | promise: an-expectation-says-how-it-is-measured | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A15 | A brief that says it has no expectations, with the reason, is accepted | Test Phase 1 | Build Phase 4 | passing | unit | promise: an-expectation-says-how-it-is-measured | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A16 | The hooks' copy of the test levels equals the package's list, and the hooks' row parser reads the new column exactly as the package's does | Test Phase 1 | Build Phase 2 | passing | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/test-levels-parity.test.ts |
| A17 | With this plan's tests added, no everyday test starts a server or waits | Test Phase 1 | Test Phase 1 | passing | unit | promise: everyday-tests-never-wait, promise: everyday-suite-stays-fast | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A18 | Every impl and every brief written before this plan is accepted exactly as it was | Test Phase 1 | Build Phase 4 | passing | unit | a regression guard over the documents written before this plan | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A19 | A new impl names each test's level under `Level`; the archived test-kinds impl, which says `Kind`, still validates | Test Phase 1 | Build Phase 2 | passing | unit | a rename decided 2026-10-05; keeps the old spelling working | apps/indusk-mcp/src/__tests__/test-levels-validation.test.ts |
| A20 | The planner's brief template has Expectations and Promises, and no Problem, Proposed Direction or Success Criteria | Test Phase 1 | Build Phase 7 | passing | unit | pins the template every new plan is handed | apps/indusk-mcp/src/__tests__/planner-brief-template.test.ts |
| A21 | A bugfix or refactor plan may carry a research document, and is not marked incomplete without one | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the why left the brief, so those plans need somewhere to put it | apps/indusk-mcp/src/__tests__/research-optional.test.ts |
| A22 | This plan's own six promises go the whole way: `declared` before its first test, named by these rows, and `enforced` when it is confirmed | Build Phase 7 | Build Phase 7 | passing | live check | the live check of this plan's own close; it cannot be one of the rows that must pass before the close it checks | |
| A23 | In a new scratch project, a planning conversation ends with declared promises in the registry and a brief that names them, and nobody typed a registry file | Build Phase 7 | Build Phase 7 | passing | live check | promise: a-briefs-promises-are-in-the-registry | |
| A24 | A test row that names a promise another plan owns is refused unless the brief lists that promise under must not break, changes or replaces | Test Phase 1 | Build Phase 4 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A25 | When a plan that changes a promise closes, the promise has its new sentence and is owned by that plan, and its History shows the old sentence, the reason and the previous owner; its incidents and the marks that name it still resolve | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A26 | When a plan that replaces a promise closes, the old one is retired, the new one records which it replaced, and the check passes; a replacement naming a promise that does not exist is refused | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A27 | A changed promise that breaks later reopens the plan that changed it, and its incident lists the rows that name it in both plans | Test Phase 1 | Build Phase 6 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts |
| A28 | A promise a plan declared and then dropped, before it was ever in force, leaves the registry by a command; one that is in force, or another plan's, is refused, naming it, and nothing is removed | Build Phase 8 | Build Phase 8 | passing | unit | lets the planner drop or rename a promise without anyone deleting a registry file by hand (Sandy, 2026-10-05) | apps/indusk-mcp/src/__tests__/promises-withdraw.test.ts |
| A29 | A test row with no purpose, or a level that is not a level, is refused whatever wrote it: added by an edit that touches only the table, or by a script, the plan's contract still names the row | Build Phase 9 | Build Phase 9 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A30 | A purpose that tries to name a promise or a lesson and is not written as one (the name in backticks, words after it, "and" for a comma) is refused, naming the row, and so is one that is only a mark such as `-`, `n/a` or `TBD`; neither is read as a reason | Build Phase 9 | Build Phase 9 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/row-purpose.test.ts |
| A31 | A test row with a cell missing or a cell too many is refused, naming the row; it is never dropped, so the promise it names is never reported as named by no row | Build Phase 9 | Build Phase 9 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/row-purpose.test.ts |
| A32 | A promise written anywhere in a brief's Promises section is read or refused by name, never dropped: indented, bulleted where numbered is expected, or under a missing "Existing promises" heading; and a brief written in the new headings without `## Promises` is out of shape, not exempt | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A33 | A row naming a promise the registry does not hold, a retired promise or a missing lesson is refused in a plan whose brief has no Promises section, or that has no brief | Build Phase 9 | Build Phase 9 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A34 | An expectation whose measure or time to look is still the template's placeholder in braces is refused, naming the expectation | Build Phase 9 | Build Phase 9 | passing | unit | promise: an-expectation-says-how-it-is-measured | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A35 | An open plan whose impl cannot be read makes the registry check, the contract and the confirm refuse, naming that file; none of them crashes | Build Phase 9 | Build Phase 9 | passing | unit | lesson: detectors-must-distinguish-could-not-check-from-checked-and-failed | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A36 | The retrospective's gate names a plan's unproven promises when it is given the plan's folder as a relative path | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A37 | A promise is never written in a form the registry cannot read back: a domain that reads as a number or a boolean, or holds a colon, and a sentence that begins with `#`, are refused before the file is written, and the registry still reads | Build Phase 9 | Build Phase 9 | passing | unit | the registry's writer applies its reader's own rule, so one command cannot leave every other unable to run | apps/indusk-mcp/src/__tests__/promises-declare.test.ts |
| A38 | A replacement that was first declared as an ordinary new promise can still be recorded as replacing the old one, by the command the refusal at close names; the plan then closes and the old promise is retired | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A39 | A plan that is building is held by the registry check even while its brief still says draft | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/promises-contract.test.ts |
| A40 | A plan that changes a promise and moves or replaces its test closes without anyone editing the registry: the promise's tests and sites are the ones that exist when the plan is confirmed | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A41 | A promise about state or behaviour whose name appears only in test files is not confirmed, and a file any row names as a test is never recorded as the code that keeps a promise | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A42 | A confirm that stopped after enforcing a replacement and before retiring what it replaced is finished by running it again | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-changed-promise-keeps-its-history | apps/indusk-mcp/src/__tests__/promises-change.test.ts |
| A43 | A plan archived while a promise it declared is still declared is not a dead end: the same commands confirm the promise from the archived plan's rows, or withdraw it, and the registry check's refusal names them | Build Phase 9 | Build Phase 9 | passing | unit | promise: a-closed-plan-kept-its-promises | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A44 | The MCP server offers exactly the tools it offered before the promise tools moved to their own module, and each promise tool still answers as it did | Build Phase 10 | Build Phase 10 | written | unit | a refactor guard: the move changes where the tools live, not what the server offers | apps/indusk-mcp/src/__tests__/promise-tools.test.ts |
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

#### Deferred to Build Phase 8

- **A28** — not deferred from this phase but added after it: withdrawal was asked for on 2026-10-05, once the seven build phases had closed (Sandy: "Add withdrawal"). The gap was found writing the planner's steps: a promise declared and then dropped or renamed could only leave the registry by deleting its file by hand. Its test reaches the command over the CLI, so it is written before the command and is red on an unknown command.

#### Deferred to Build Phase 9

- **A29–A43** — the falsification's hypotheses, formed on 2026-10-05 by reading the finished code against what the rows above claim. None could have been written in this phase: each names a way a check passes without checking, and those ways were only visible once the checks existed. Each is written before its fix and must fail on its own assertion first.

#### Deferred to Build Phase 10

- **A44** — written by the cleanup ritual on 2026-10-05, after Build Phase 9 closed: it guards a move that did not exist to guard before. Its subject, the promise tools' own module, does not exist until that phase makes it, so the test loads it by a computed specifier and is red on its absence, not on a load error.

#### Regression Guards

- **A17** — the never-wait guard already exists and passes; the row holds it over the tests this plan adds, all of which run a short-lived process or none.
- **A21** — the lifecycle already shows a research document a bugfix or refactor plan carries and does not mark its absence; the row pins that, because the brief no longer holds the why.

#### Test Phase 1 Verification

- [x] Every row writable here is authored; each red one fails on its own assertion, not on a missing import (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/reopen-row-complete src/__tests__/row-purpose src/__tests__/test-levels-validation src/__tests__/test-levels-parity src/__tests__/promises-declare src/__tests__/promises-contract src/__tests__/promises-confirm src/__tests__/promises-change src/__tests__/incident-proven-by src/__tests__/planner-brief-template`); A17 and A21 pass — 10 files, 54 tests red, each on its assertion (an unknown command exits 1 where 0 or 2 is expected; the hook accepts what it should refuse; a parser returns no purpose), none on a missing import; the guards and the accept cases pass, 19 tests; 2.6 s
- [x] `indusk promises check` passes with the six declared promises, and `promises-cli.test.ts` passes — 12 promises, 6 declared. Found on the way: a token spelled out in a test source (and one in a comment, "the same promise: same name") read as a citation of a promise that does not exist; the tests build their tokens instead
- [x] The deferred body above reviewed: it compiles once the row type has `level` and `purpose`, and it asserts what A7 claims

### Build Phase 1: A reopened plan stays valid

- [x] `lib/trajectory/append-row.ts`: `appendLateRow(text, phase, row)` — `row` gains `cells?: Record<string, string>`, keyed by lower-cased header; every header the table has and the caller names is filled
- [x] `lib/promises/reopen.ts`: the Maintenance row passes `kind` and `level` as `unit`, the smallest, and `for` as `promise: <name>`, so whichever of those columns the owner's table has is filled

#### Build Phase 1 Verification

- [x] A13 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/reopen-row-complete src/__tests__/monitor-reopen-validator`), and the three impls the older reopen test covers still validate — with `src/lib/trajectory` and `src/lib/promises`: 88 tests, 1.2 s
- [x] Shape — `appendLateRow` gained one optional input and spreads it under the cells it owns, so a caller cannot overwrite the id or the phases; `reopenOwner` names both spellings of the level column in one place. Nothing to change

#### Build Phase 1 Context

- [x] guard: `reopen-row-complete.test.ts` carries `lesson: a-row-writer-fills-every-column-its-table-requires`; the lesson file is written with it

#### Build Phase 1 Document

- [x] `apps/docs/src/changelog.md` Unreleased, Fixed: a plan reopened by a broken promise no longer gets a row its own validator refuses

### Build Phase 2: The row has a level and a purpose

- [x] `lib/test-levels.ts` (`TEST_LEVELS`, `isTestLevel`, `levelsList`) and `hooks/_test-levels.js`, pinned equal; `lib/test-kinds.ts` re-exports them; the package exports `./test-levels` and keeps `./test-kinds`
- [x] Both parsers (`lib/trajectory/parser.ts`, `hooks/_trajectory-parser.js`): a `Level` header, or `Kind` when either key is set, gives the row's level; a `For` header gives `purpose: { promises, lessons, reason }`
- [x] The validator and the hook: `test_levels: required` means what `test_kinds: required` meant, and says "level"; `test_purpose: required` refuses a row whose `For` cell is empty, naming the row
- [x] Rename `test-kinds-validation.test.ts` and `test-kinds-parity.test.ts` to the `test-levels` names the rows cite, keeping every case
- [x] This impl: `Kind` becomes `Level`, `test_kinds` becomes `test_levels`, and `test_purpose: required` is set — the plan validated by its own rule
- [x] `indusk update` in this repository, so the installed hooks match — and the installed `_test-kinds.js`, which `update` does not remove, deleted by hand
- [x] (discovered) The hook runs top to bottom, so a module-level `const` declared below the validation call did not exist when the call ran (`Cannot access 'PURPOSE_FORMS' before initialization`); the text lives inside its function. Caught by A5 on its first run

#### Build Phase 2 Verification

- [x] A5, A16 and A19 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/row-purpose src/__tests__/test-levels-validation src/__tests__/test-levels-parity src/lib/trajectory src/__tests__/impl-corpus src/__tests__/hook-shared-modules`) — with the reopen tests: 116 tests, about 2 s
- [x] `apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts` still passes with the changed hook
- [x] Shape — the purpose reader is one small function with a pinned copy for the hooks, as the row parser already is; the two validators sit beside each other and say the same words in both places. Nothing to change

#### Build Phase 2 Context

- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the test-kinds entry becomes "a row's `Level` is one of five, and its `For` says what the test is for — a promise, a lesson, or why neither; `test_levels` and `test_purpose` make the hook refuse a row without them"

#### Build Phase 2 Document

- [x] `apps/docs/src/guide/test-kinds.md` moves to `guide/test-levels.md`, the old page left as a pointer; `guide/test-trajectory.md` gains `Level` and `For`; the sidebar follows

### Build Phase 3: Commands write the registry

- [x] `lib/promises/write.ts`: `declarePromise`, `changePromise`, `replacePromise` — the one writer. `declare` adds the domain to `promises.domains` when the project does not declare it; `change` keeps name, state, incidents and aliases, moves the owner, and adds a History line with the old sentence, the reason and the previous owner; `replace` declares the new promise with `supersedes: <old>`
- [x] `lib/promises/registry.ts` reads `supersedes`; `check.ts` refuses one that names a promise the registry does not hold
- [x] `bin/commands/promises.ts` and `bin/cli.ts`: `promises declare | change | replace`; `tools/plan-tools.ts`: `declare_promise`, `change_promise`, `replace_promise`

#### Build Phase 3 Verification

- [x] A1 and A2 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-declare src/__tests__/promises-check src/__tests__/promises-single-definition`) — 31 tests; `vitest related` over the changed files: 51 pass in 6 s, the only reds the incident rows that Build Phase 6 turns green
- [x] Shape — `write.ts` is the one writer and each function refuses before it writes; `check.ts` gained one rule function beside its siblings. One thing looked at and kept: `requireDomain` returns the config write to run later, so nothing is written to the config when the promise itself is refused

#### Build Phase 3 Context

- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the `.indusk/promises/` entry gains "written by `indusk promises declare | change | replace`, never by hand"

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/promises.md`: `declare`, `change`, `replace`, and the `supersedes` key

### Build Phase 4: The brief and the contract

- [x] `lib/promises/brief-contract.ts`: `parseBriefContract(text)` — the shape in ADR D1; a brief with no `## Promises` heading is `legacy`
- [x] (discovered) A line that looks like part of the contract and cannot be read as one is a `problem`, refused by name, never a list read as empty: a label with words after it, a promise named under none of the three lists, a list entry that names no promise, a `## Promises` with no `### This plan makes`. Found on this plan's own brief, whose "**Must not break**, for this plan:" would have hidden four promises from the check
- [x] `lib/promises/contract.ts`: `checkPlanContract(planRoot, plan)` — the five refusals in ADR D2, each naming the promise, expectation or row
- [x] (discovered) Three things ADR D2 did not say, decided here: a made promise whose **kind** in the registry is not the brief's is refused with the sentence (the same disagreement); a promise under Replaces that is retired *by this plan's own replacement* is the plan having closed, not an error; an **archived** plan is held only to what its own brief says (shape, expectations), because the registry is what later plans have made of its promises since
- [x] (discovered) `lib/promises/plan-folder.ts`: "is this name a plan folder, active or archived" was private to `check.ts` and half-copied in `write.ts`; the contract needed it too, so it is one module the three read
- [x] `promises contract <plan>`; `promises check` runs it for every active plan whose brief is in the new shape — plus `--all` (every plan folder, what A18 runs) and `--impl-stdin` (judge the impl given on stdin, what the hook passes)
- [x] `hooks/validate-impl-structure.js`: for an impl that sets `test_purpose: required` and is past `draft`, run `promises contract <plan>` through `INDUSK_BIN`, pass its refusal on, and refuse with the reason when it cannot be run
- [x] (discovered) No row reached the hook's call, so A3 gained seven cases through the hook itself, four of them seen red against the hook as it was. Two findings from writing them: the call sits *before* the hook's "this edit touches no phase structure" exit, because saving a draft as `approved` touches none and is the write the rule exists for; and the hook hands the command the impl as it would be written, since the one on disk is the previous version
- [x] (discovered) The `indusk` on this machine's PATH is 1.60.0, which has no `promises contract`: in this repository the hook refuses every write to an opted-in impl until the global CLI is upgraded or `INDUSK_BIN` names a build. That is the rule working ("a gate that cannot run is never a pass"), and the refusal says which command it ran, how it failed and both ways out. This session's hooks are the trunk's, so nothing changes here until the plan lands
- [x] This plan's own brief put in the exact shape the parser reads, and its contract passing — the three labels on their own lines, `None.` under Changes and Replaces, and `everyday-tests-never-wait` and `everyday-suite-stays-fast` one bullet each (sharing one had hidden the second from row A17's check)

#### Build Phase 4 Verification

- [x] A3, A4, A6, A14, A15, A18 and A24 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-contract src/__tests__/promises-check src/__tests__/hook-cwd-independence`) — with `promises-cli`: 69 tests. The wider set (every promise, hook, trajectory and Dawn-gate file) is green except the rows Build Phases 5 and 6 turn: confirm, and the incident's `Proven by`
- [x] `indusk promises contract planner-promises` exits 0, and a write to this impl is still accepted — "6 made, 4 kept, 0 changed, 0 replaced; 3 expectations", 86 ms; the changed hook, handed a Write of this impl, exits 0 with `INDUSK_BIN` on this build and refuses with the reason on the 1.60.0 CLI on PATH. `--all`: 110 plan folders, this one held to the contract, 109 written before it
- [x] Shape — the parser is five small readers under one entry (`section`, `items`, then one reader per part of the brief), all text in, data out, so a test can feed it a brief; the check is one function per class of refusal. Considered and left: `readExisting` (about sixty lines, two passes: split the section at its labels, then read each group's entries) — the passes share the label vocabulary and the `problems` list and mean nothing apart; and `promisesContract`, which serves both `<plan>` and `--all` in one function of forty lines. Nothing to change

#### Build Phase 4 Context

- [x] hooks (`apps/indusk-mcp/hooks/CLAUDE.md`): "a rule that needs the registry or a brief runs through `indusk promises contract`, never a second reader in a hook; a check that cannot be run refuses and says why" — and that refusal names `lesson: detectors-must-distinguish-could-not-check-from-checked-and-failed` on its own line, as the same file requires of a hook that refuses
- [x] (discovered, from reading that file) The impl hook predicted an Edit with `String.replace`, which the file's own rule forbids: it stops at the first match and reads `$&` in the new text as a substitution. Harmless while the result only fed structure checks; wrong once it is the impl handed to the contract — an edit replacing every occurrence was judged as if it replaced one, and refused. Now an index-splice, split/join under `replace_all`; one case in A3, seen red

#### Build Phase 4 Document

- [x] New `apps/docs/src/guide/briefs.md`: what a brief holds, the three lists for existing promises, what goes to research, with one Mermaid diagram from conversation to incident; `reference/cli/promises.md` gains `contract`; the sidebar follows — the docs site builds (25 s, no dead link). The guide describes closing and the incident's rows in the present tense; Build Phases 5 and 6 make those sentences true

### Build Phase 5: Closing confirms

- [x] `lib/promises/confirm.ts`: `confirmPlan({ planRoot, codeRoot, plan })` — refuses a declared promise no passing row names; fills `tests:` from those rows' `Test` files and `sites:` from the other files carrying the token; sets `enforced` with a History line; retires what a promise supersedes; then runs the check
- [x] (discovered) Everything that can refuse is decided before anything is written. Left to ADR D5's order (write, then run the check) three refusals would have arrived *after* the registry said `enforced`: a state or behaviour promise no code names, a test file without the token, and code still naming the promise being retired. Each is now its own refusal, by name, with nothing written; the check still runs last and its result says whether the registry was written
- [x] (discovered) A brief's **Changes** and **Replaces** lists were only sentences: nothing made a plan run `promises change`, and a replacement declared with plain `declare` would never retire the promise it replaced. Confirm refuses both, naming the promise and the command. It cannot be the contract's refusal, because the change is made while the plan builds; closing is when it must have been
- [x] (discovered) `lib/promises/rows.ts` came a phase early: "the rows of an impl that name a promise" is what closing reads and what Build Phase 6's incident reads, so it is one reader (`rowsNamingIn`, `rowProofs`) and that phase adds the walk over every plan
- [x] `promises confirm <plan> [--code-root <path>]` and the `confirm_promises` tool — `checkPromises` takes the code root too, so the check that follows a workbench confirm reads the same worktree the confirm did
- [x] `lib/cleanup/gate.ts`: `checkRetrospectiveReadiness` adds `promises` to what is missing, naming them, when the plan owns a declared promise that `confirmPlan` would refuse — it reads the rows only (`unprovenPromises`). The admin asks this gate for every plan on a page and it cannot know where a workbench plan's code is, so the files are `confirm`'s to read; `lib/lifecycle.ts` names the unproven promises in the plan bar, which may never say "cleaned" over a fact it does not hold
- [x] `skills/retrospective.md`: Step 0 names promises; a confirm step before archival, passing the plan's code worktree in a workbench — it is Step 8a, so Steps 10 and 11, which the root context and two tests cite by number, keep theirs; the installed skill is synced

#### Build Phase 5 Verification

- [x] A8, A9, A10, A11, A25 and A26 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-confirm src/__tests__/promises-change src/lib/cleanup`) — with every other promise, gate and lifecycle file: 23 files, 212 tests. Six cases were added for the refusals found while building (the tool, no test file, no code site, an unmade change, a replacement declared plainly, code still naming the replaced promise); each asserts nothing was written, which is what fails if its refusal is taken away
- [x] Shape — one finding, fixed in this phase: `confirmPlan` was 129 lines with two jobs inline, deciding whether each promise is proven against the code and writing the ones that are (rule: a block doing two jobs wants to be two named things). It is now `judge` (a proof, the code root and the token scan in; what to write or why not out — a test can hand it a scan) and `enforce` (the writes), and `confirmPlan` is the 66 lines that order them; same 63 tests green. The rest reviewed and left: `rows.ts` holds the two readers of a row's purpose and nothing else; the gate gained one function that answers from the impl alone

#### Build Phase 5 Context

- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the close-out entry gains "the retrospective confirms the plan's promises (`indusk promises confirm`) before it archives; a declared promise no passing row names blocks the close" — and the installed `.indusk/planning/CLAUDE.md`; every pointer resolves

#### Build Phase 5 Document

- [x] `apps/docs/src/guide/promises.md`: declared, confirmed, changed, replaced; `reference/cli/promises.md` gains `confirm`; `reference/skills/retrospective.md` gains the step — the guide's "How to write one" no longer tells anyone to type a registry file; the docs site builds

### Build Phase 6: An incident names its tests

- [x] `lib/promises/rows.ts`: `rowsNaming(planRoot, promise)` — every impl, active and archived, and the rows whose `For` names the promise: plan, row, state — and its test files; an impl that cannot be read is returned by name, so a broken file never reads as "no row names it"
- [x] `lib/promises/incidents.ts`: a recorded incident gains `## Proven by`, listing those rows or saying that no row names the promise; `registry.ts` reads an incident with that section — written once, when the incident opens, between Symptom and Root cause. `registry.ts` needed no change: it reads sections by heading, and the third A12 case holds it to that
- [x] (discovered) Every promise registered before this plan is named by no row, and "nothing was proving it" would have been false of them: their registry entries list tests. The no-row sentence now says no plan's row names it and gives the test files the registry lists. Seen by running the section over this repository's own registry: `every-commit-evaluated` has no row and one listed test

#### Build Phase 6 Verification

- [x] A12 and A27 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/incident-proven-by src/__tests__/promises-check src/__tests__/promises-fix`) — with every promise and watch file: 16 files, 141 tests; `vitest related` over the changed modules: 86 pass
- [x] Shape — `rowsNaming` is the walk over plan folders around the reader Build Phase 5 already had; `provenBy` turns its answer into the section's text and is exported, so the text can be read for any promise without recording a violation. The incident writer gained one field. Nothing to change

#### Build Phase 6 Context

- [x] guard: `incident-proven-by.test.ts` carries `lesson: an-incident-starts-from-the-tests-that-vouched`; the lesson file is written with it

#### Build Phase 6 Document

- [x] `apps/docs/src/guide/promises.md` and `reference/cli/promises.md`: what an incident records, with `Proven by` — the reference's example is the section as it reads for this repository's own `every-commit-evaluated`; the docs site builds

### Build Phase 7: The planner, the admin, and this plan's own promises

- [x] (discovered) The two live checks opened red. A22: `indusk promises confirm planner-promises`, run at the start of this phase, exits 2 with six refusals and writes nothing — two rows not yet passing, four promises no code names. A23: the planner skill as it stood never calls the tools (`declare_promise` appears nowhere in it), so a conversation following it cannot end with promises in the registry. That one is a reading of the skill, not a run; the run is the green one below
- [x] (discovered) A22's `For` cell named `a-closed-plan-kept-its-promises`, so the close waited on the row that checks the close. A row that is the act of closing cannot be one of the rows that must pass first; its `For` is now that reason, and A8–A11 prove the promise
- [x] (discovered) Each of this plan's six promises is named at the code that keeps it (a `promise:` comment at the site): confirm refuses a `state` promise no code names, and four of the six had none — the contract's three refusal functions, the row-purpose rule in the validator and the hook, `confirmPlan` and the gate, `provenBy` and the reopened row, `declare` / `change` / `replace`. Confirm now refuses for one reason only: row A23, the scratch-project live check, has not run
- [x] (discovered) A draft brief is not held by the sweep over every plan (`promises check`, `promises contract --all`). ADR D2 says "every active plan whose brief is in the new shape", and writing the planner's steps showed what that costs: the draft brief is the conversation read back, its promises are saved when the person accepts it, so for as long as a draft is being discussed the registry rightly lacks them and every `pnpm test` in the repository would be red. Asked about one plan by name, the command still checks a draft, because that question is "what does acceptance still need?". One case in A3, seen red
- [x] `skills/planner.md`: the conversation step (what is wanted; the existing promises sorted into kept, changed and replaced; the promises read back before the tools save them); the brief template of ADR D1; a research template with Background and Decisions; a test-plan template grouped by promise with a `Level` column; an impl template with `test_levels`, `test_purpose` and the `Level`, `For` and `Test` columns
- [x] (discovered) Three things the steps had to settle. The draft brief is the read-back on paper, and the tools run when the person accepts it, followed by `indusk promises contract`, which must pass before the status becomes `accepted`. A promise under **Changes** is not rewritten at acceptance but in the build phase that makes its new sentence true, so the registry never says what the code does not do; the impl carries an item for it and closing refuses if it was never made. And the template is pinned to the parser: A20 fills it in and reads it with `parseBriefContract`, so a template the check cannot read fails here and not in someone's first plan
- [x] `templates/workflows/{feature,bugfix,refactor}.md` take the same brief; `skills/work.md`: a row that names a promise names its test files by the time it passes — a bugfix's brief says which promise broke (under Must not break) or makes the one that was never made; what is broken and how it shows is research's, which a bugfix or refactor may carry without requiring
- [x] `apps/indusk-admin`: the row type carries `level` and `purpose`; `TrajectoryRowsTable.tsx` shows them when a row has them, a promise's name linking to the Promises page — the row type is the package's own, which has carried `levelText` and `purpose` since Build Phase 2, so the admin added no field; each promise row on the Promises page gained an anchor for the link to land on; the page's copy-as-markdown carries the two columns too, so what is copied is what is shown. A7 written first and seen red (the headers were the old three; the link was absent)
- [x] `indusk update` in this repository — nothing to sync: the hooks, skills and planning rules had been copied as each changed, and `update` rewrote only a timestamp, which was put back
- [x] A23, live: in a new scratch project, a headless planning conversation; then read the registry, the brief and the commit that wrote them. Recorded here — 2026-10-05, a git project of one file (a card club's seat booking), `indusk init` from this build, four turns of `claude -p` as a club owner who wants held seats to free themselves:
  1. The planner read the project, called `list_promises`, and asked three questions about what should be true (how long a hold lasts; whether a seat must free itself with nobody acting; what happens to the first person who comes back).
  2. Given the answers and the reason (about ten desk calls a week), it said back three promises, one sentence each with a name and kind, and one expectation with its measure and when to look, and asked what it had wrong.
  3. On "go ahead" it wrote the brief as a draft, in the exact shape, and saved nothing: the registry did not exist, and `promises contract`, asked by name, listed the three `declare` commands acceptance still needed.
  4. On "accepted" it called `declare_promise` three times, ran `indusk promises contract` (green: 3 made, 1 expectation), set the brief `accepted`, and flagged the highlight. The registry holds three `declared` promises owned by the plan, each History line reading "from its planning conversation"; the project's first domain (`booking`) was declared with them; no Write or Edit touched `.indusk/promises/`.
  
  There was no commit to read: nothing in the skill commits planning documents, and the files were left in the working tree. Cost about $2.44. Three things seen that the row does not assert: the planner argued an implementation approach in its first turn, before any promise existed; it gave all three promises the kind `behaviour`, which asks for marks in a running system this module does not have; and Step 0 tells it to read a `master.md` that a new project does not have (it read the planning rules instead).
- [x] (discovered, by A23) In that project the next `indusk promises check` failed: the installed `check-gates.js` and `validate-impl-structure.js` carry `promise:` tokens for promises of the repository that ships them, and the reverse scan read them as the project's own citations. The first of those tokens has shipped since day-promises, so any normal-mode project with a registry has had this; a workbench hid it, its hooks being outside the code root. The promise scan now leaves out the hook files the package installs, and only those: a hook the project wrote is still read, and the lesson scan still reads all of them, since an installed hook is what delivers its lesson. Two cases in `promises-check.test.ts`, the first seen red; the scratch project's check then passed
- [x] A22, live: `indusk promises confirm planner-promises` moves this plan's six promises to `enforced`, and `indusk promises check` passes. Recorded here — 2026-10-05, in this worktree: "6 promises confirmed; the registry check passes", each with the test files its rows name (one to three) and the code that carries its token (one to three sites); the check then reads "12 promises — declared 0, enforced 11, known-violated 1"; a second run says there is no promise left to confirm and changes nothing. Each promise's History now has two lines: declared by hand on the first day, enforced by the command with the rows that prove it. One wording fixed on the way: the History line said "when the plan closed", which is not true of a confirm run before the close, so it says "confirmed for" and names the rows
- [x] (noted for `/falsify`, nothing to do here) The retrospective's Step 8a will find nothing to confirm for this plan, since the live check did it here. If falsification adds a row that names one of the six, its test file is not added to that promise's `tests:` (confirm only writes a `declared` promise); the row is still read by an incident's Proven by

#### Build Phase 7 Verification

- [x] A7 and A20 pass (`cd apps/indusk-admin && pnpm exec vitest run src/components/phases`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/planner-brief-template src/__tests__/skill-sync-parity src/__tests__/workflow-types-parity`) — the admin's whole suite: 49 files, 321 tests, 5 s
- [x] A22 and A23 recorded with what was seen — both above, with the two defects A23 turned up
- [x] `pnpm test` green and marked held, ending with the leak guard's all-clear; `pnpm test:system` runs at landing — 278 files and 1,806 tests in the package, the admin's 321 beside it, 59 s; `promises:check` reads "12 promises — declared 0, enforced 11, known-violated 1"; "marked everyday-suite-stays-fast upheld (59 s)"; "no telemetry daemon left running from a temporary home"
- [x] Shape — the rows table gained one small component (`RowPurpose`) for what a cell shows, and the two columns appear only when a row has them; the markdown export builds its header and rows from one list of cells where it had two hand-written strings; the citation scan takes what to skip as an argument, so the rule about installed hooks sits with the promise scan that needs it. Considered and left: the Promises link is passed down four components as a prop; a React context would hide one string behind machinery, and these are server components. Nothing to change

#### Build Phase 7 Context

- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the Documents entry says a brief holds expectations and promises and everything else is research — see `/guide/briefs`; admin (`apps/indusk-admin/CLAUDE.md`): the row table shows `Level` and `For` from the package's parser, never its own — the planning entry also says a draft is not held to the registry and an accepted brief is; every pointer resolves

#### Build Phase 7 Document

- [x] `apps/docs/src/reference/skills/plan.md` and `reference/admin-ui/overview.md`; `apps/docs/src/changelog.md` Unreleased: Added (the brief's expectations and promises, `test_purpose` and `For`, the five commands, `Proven by`), Changed (`Kind` is `Level`) — the reference page gained the conversation with a Mermaid diagram and its walkthrough's brief is in the new shape; the changelog also says the hook now needs an `indusk` on PATH that has `promises contract`, and lists the two fixes found on the way; the docs site builds

### Build Phase 8: A declared promise can be withdrawn

**Goal**: a promise a plan declared and then drops or renames, before it is in force, leaves the registry by a command, so the planner never deletes a registry file by hand. Added 2026-10-05 at Sandy's request, after the seven phases above closed.

- [x] A28 written first: `promises-withdraw.test.ts`, through the CLI and the tool. RED: `promises withdraw` is not a command — eight cases, all red: seven on "unknown command 'withdraw'" (exit 1 where 0 or 2 is asserted), the tool's on no tool of that name
- [x] `lib/promises/write.ts`: `withdrawPromise(planRoot, { name, plan })` — removes the file of a promise that is `declared` and owned by that open plan; refuses, naming the promise, one the registry does not hold, one in any other state, one another plan owns, and one that lists an incident — and one more, found writing it: a promise another promise records replacing (`supersedes`), which would leave that record pointing at nothing; the replacement is withdrawn first. It does not scan the code: a promise still named by code after it is withdrawn is `promises check`'s refusal, which the command's message says to run
- [x] `promises withdraw <name> --plan <plan>` and the `withdraw_promise` tool
- [x] `skills/planner.md`: a promise dropped or renamed after acceptance is withdrawn with the tool (a rename is a withdrawal and a declaration), and the brief is edited with it — a dropped promise that was seriously considered goes under Not promised; the installed skill is synced
- [x] ADR D4 gains the command, dated — a row in the commands table marked as added after acceptance, and a paragraph saying why

#### Build Phase 8 Verification

- [x] A28 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises-withdraw src/__tests__/promises-declare src/__tests__/promises-check src/__tests__/planner-brief-template src/__tests__/skill-sync-parity`) — nine cases; with every promise, tool and context file: 26 files, 246 tests; `vitest related` over the three changed modules: 68 pass
- [x] Shape — `withdrawPromise` is thirty-three lines beside its three siblings in the one writer, refusing before it removes anything, as they refuse before they write. Nothing to change

#### Build Phase 8 Context

- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): the `.indusk/promises/` entry names `withdraw` beside `declare | change | replace` — and the installed copy; every pointer resolves

#### Build Phase 8 Document

- [x] `apps/docs/src/reference/cli/promises.md`: `withdraw`; `guide/promises.md`: the row in "A promise's life in plans"; `changelog.md`: the commands entry names it — also `guide/briefs.md`, which now says promises are declared when the brief is accepted (it said "as it writes the brief", which Build Phase 7 made untrue); the docs site builds

### Build Phase 9: Falsification — what the checks pass without checking

**Goal**: verify whether the attested state holds against the ways each check can pass having checked nothing, and the ways a plan following the commands can reach a dead end. Fifteen hypotheses, each read out of the finished code: A29–A35 are checks that are silent where they should refuse, A36–A37 and A39 are checks that depend on how they are called or what they are given, and A38 and A40–A43 are plans that cannot close, or close wrongly, without someone editing the registry by hand. Each row is one hypothesis; each item is the fix if it confirms.

- [x] A29–A43 written first, each red on its own assertion — 36 cases across six files. Two first drafts were caught passing for the wrong reason and sharpened before being counted: A31's one-cell-short row was refused only because the Verification block named the dropped row (a row no Verification line names would pass), so the case now requires the refusal to be about the cells; A36's relative path was relative to the test's directory, which still contains `/.indusk/planning/`, so the case now runs from the project root, the form the hypothesis names. Each red now: the check passes (A29, A32–A34, A39), the hook accepts (A29, A30, A31), a YAML stack trace (A35), a file written that the registry cannot read (A37), `replace` refusing the name (A38), the old test path kept (A40), the old promise still enforced (A42), a test taken for a site (A41), the gate reporting nothing (A36), the check naming no command (A43)
- [x] The row rules run in the contract (A29). `lib/promises/contract.ts`: for an impl past `draft` that sets `test_purpose` or `test_levels`, run the package's own row rules (shape, purpose, level) and refuse naming the row. Today they run only in the hook, and only on an edit whose new text holds a phase heading or an unchecked item: an Edit that adds or changes a row alone, a check-off, and any file written by a script are never judged. The hook already hands every write to the contract, and `promises check` runs it, so one place closes all three — `rowRuleRefusals` in `contract.ts` calls the validator's `validateRowPurpose` and `validateTestLevels`; the cell-count rule joins it with A31. The hook's table-only Edit case passes through the hook's existing call to the contract, so no hook change
- [x] A purpose is a token or a reason, never something between (A30). `lib/trajectory/parser.ts` and the hooks' copy, pinned equal: a cell that holds `promise:` or `lesson:` and is not tokens only is `malformed`, and `validateRowPurpose` (package and hook) refuses it with the form to use; so is a cell with no two words in it. Today `` promise: `seat-held` `` reads as the reason the row needs no promise — `RowPurpose.malformed` says why, and the refusal quotes the cell; the admin's table shows a malformed cell as written. The parity row (A16) still passes with both parsers changed together
- [x] A row the table cannot hold is refused (A31). `lib/trajectory/validator.ts` and the hook: under `test_purpose: required`, a table line whose cell count is not the header's is an error naming its first cell. Today the parser drops it, so every rule above the parser passes it. Gated on the key, so every impl written before this plan is still accepted as it was (A18) — `findMisshapenRows` in both parsers (pinned equal), `validateRowShape` in both validators and in the contract's row rules, rule `row-shape`. The parser still does not turn a misshapen line into a row: its cells cannot be matched to columns, so a guess would be worse than the refusal. Every archived impl still validates (the corpus test), and `promises contract --all` still passes over 110 plan folders
- [x] The brief's parser reads or refuses everything written in its words (A32). `lib/promises/brief-contract.ts`: list entries with up to three spaces of indent and either marker; any line in the Promises section that starts with a promise's name and that no list read is a problem; a label outside `### Existing promises` is a problem; a brief with `## Expectations` or `### This plan makes` and no `## Promises` is out of shape, not legacy — `unreadLines` names any line in the Promises section (outside Not promised) that starts with a promise's name and that no list read, and any label outside Existing promises. Every one of the 109 earlier briefs still reads as legacy
- [x] Rows are checked whatever the brief's shape (A33). `contract.ts`: a legacy brief, or none, is a contract with empty lists for the row checks, in an open plan — the existence rules only: a brief without a Promises section cannot list another plan's promise, so the ownership rule (A24) applies only to a brief in the new shape. The registry is read only if a row names a promise, so a malformed registry does not fill `--all` with one refusal per legacy plan
- [x] A placeholder is not a measure (A34). `brief-contract.ts`: a `Measure` or `Look` that is only `{…}` reads as absent — A20, which parses the filled-in brief template, had counted the template's own `{how we would know: …}` as a measure; it now fills that in first, as the planner does
- [x] An impl that cannot be read is a refusal naming it (A35). `contract.ts` and `rows.ts`: the trajectory read catches a frontmatter it cannot parse; `promises check`, `contract` and `confirm` name the file where today they end in a stack trace — one reader, `readImpl` in `contract.ts`, which never throws; the contract (and so `promises check`) and `confirm` both use it. `rows.ts` already caught it for the incident's Proven by
- [x] The gate resolves the folder it is given (A36). `lib/cleanup/gate.ts`: `resolve(planDir)` before looking for the planning root; a relative path today finds none and reports no unproven promise
- [x] The writer applies the reader's rule (A37). `lib/promises/write.ts`: `declare` and `change` read back the text they are about to write with `promiseProblem` and refuse on a problem, with nothing written — `requireReadable` parses the composed text and runs `promiseProblem` on it; the project's first domain is declared in config only after it passes, so a refused promise leaves the config untouched too
- [x] `replace` records the link on a replacement the plan already declared (A38). `write.ts`: when `--by` names a promise this plan declared with no `supersedes`, set it there. Today `replace` refuses because the name exists, and that is the command confirm's refusal tells the reader to run. `skills/planner.md`: a promise that is some entry's replacement is saved with `replace_promise` only — with a History line; the promise keeps the sentence it was declared with. Refused when the existing promise is another plan's, not `declared`, or already replaces something else; run twice, it changes nothing
- [x] A building plan is held whatever its brief's status says (A39). `contract.ts`: the sweep leaves a draft brief unchecked only while the plan has no impl past `draft`
- [x] Confirm keeps an in-force promise's links true (A40, A41). `lib/promises/confirm.ts`: for every promise the plan owns that its rows name, in force or declared, `tests:` are the listed tests that still exist and carry the token plus the rows' test files, and `sites:` the other files that carry it; a file any row of the plan names as a test is never a site; a History line only when something changed — `confirm` now takes every promise the plan owns that is declared, or enforced and named by one of its rows; `rowProofs` takes the promises to judge, and the gate passes it the declared ones. The in-force refresh writes only when the links change, so a second run still changes nothing (A9)
- [x] Confirm run again finishes what it started (A42). `confirm.ts`: the replaced promise is retired before the replacement is enforced, and an in-force promise of the plan whose `supersedes` is still in force is retired on the next run
- [x] An archived plan's declared promise can still be confirmed or withdrawn (A43). `confirm.ts` and `write.ts` accept the plan's archived folder; `check.ts`'s "declared, but its owner is archived" names both commands in place of "mark it enforced" by hand. `skills/planner.md`: a bugfix or refactor that skips the retrospective still runs `indusk promises confirm` — `declare`, `change` and `replace` still require an open plan; only confirming and withdrawing reach into the archive
- [x] From the live check's own observations, in `skills/planner.md`: Step 0 reads `.indusk/planning/CLAUDE.md` when the project has no `master.md`; the conversation settles what will be true and does not propose how to build it; a promise a test with chosen inputs can prove is `state`, and `behaviour` is for what only the running system shows; "every `pnpm test`" becomes "the project's test run, where it runs `indusk promises check`". And the comment my insertion mangled above `validateRowPurpose` in `validator.ts` — all four made; the comment was fixed with A30, where the same function changed

#### Build Phase 9 Verification

- [x] A29: a row with an empty `For`, or a level that is not one, reaches an in-progress impl by an edit of the table alone and by a direct file write; the contract refuses both, naming the row
- [x] A30: a purpose written as a promise in backticks, one with words after the name, and one that is only a mark are each refused, naming the row; a plain reason still passes
- [x] A31: a row one cell short and a row one cell long are each refused by name; the archived impls still validate
- [x] A32: each of four briefs (an indented entry, a bulleted "makes", labels with no "Existing promises" heading, the new headings without `## Promises`) is refused naming the promise or the heading; none passes as empty
- [x] A33: a row naming a promise the registry does not hold is refused in a plan with a legacy brief and in one with no brief
- [x] A34: an expectation whose measure is `{how we would know}` is refused, naming it
- [x] A35: with one open plan's impl frontmatter broken, `promises check`, `promises contract` and `promises confirm` each exit 2 naming the file
- [x] A36: the gate, given `.indusk/planning/<plan>` from the project root, names the unproven promise
- [x] A37: `declare` with the domain `2026`, the domain `true`, a domain holding `: `, and a sentence beginning `#` is refused each time, and `promises check` still runs
- [x] A38: declare the replacement, then `replace <old> --by <it>`: the link is recorded; confirm retires the old promise
- [x] A39: an in-progress impl beside a brief marked `draft`, with a made promise the registry lacks: `promises check` refuses
- [x] A40: a changed promise whose test file moved is confirmed with the new file listed and the missing one gone
- [x] A41: a state promise named by its row's test and by one other test file, and by no code, is refused; with a code site added, the second test is not listed as a site when a row names it
- [x] A42: a replacement already `enforced` beside an old promise still in force, owned by the plan: confirm retires the old one
- [x] A43: a promise still `declared` in an archived plan is confirmed from the archived rows; another is withdrawn; `promises check`'s refusal names both commands
- [x] Every earlier row still passes, and every plan folder in this repository still passes `promises contract --all` (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promises- src/__tests__/row-purpose src/__tests__/test-levels src/__tests__/incident-proven-by src/__tests__/planner-brief-template src/lib/trajectory src/lib/cleanup src/__tests__/impl-corpus`, then `vitest related` over the files changed) — 26 files, 289 tests; `vitest related` over the eleven changed modules: 353 tests, one red, the Dawn loop's full-run test (`lib/run/loop.test.ts`, a scripted run of a plan through the real hooks), which timed out at 5.1 s under the load of 44 files run together and passes alone. Not this phase: it takes 3.4–4.0 s on trunk and 3.4–3.9 s on this branch, against vitest's 5 s default. Recorded, not changed here. The admin's 321 pass; `promises contract --all` passes over 110 folders; `promises check` passes
- [x] Shape — nothing to change. Confirm's rework for A40–A43 kept deciding in `judge` (now handed every file the plan's rows name as tests) and writing in `enforce` (now retiring first, and writing nothing when nothing changed), with `confirmPlan` ordering them. Reviewed and left: `checkFolder` in `contract.ts` is long because it holds the order of the contract's checks, and each check is a named function beside it; `unreadLines`, `requireReadable` and `recordReplacement` are new single-purpose functions

#### Build Phase 9 Context

- [x] guard: `row-purpose.test.ts` carries `lesson: a-reader-that-drops-what-it-cannot-read-passes-every-rule-above-it`; the lesson file is written with it (the dropped row, the entry no list read, the token read as a reason are one mistake three times) — `list_lessons` reads it as guarded by that test
- [x] hooks (`apps/indusk-mcp/hooks/CLAUDE.md`): the row rules are the contract's, so they hold for a file any tool wrote; the hook's own run of them is the early word on a draft
- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): a plan that skips the retrospective still confirms its promises; an archived plan's declared promise is confirmed or withdrawn, never edited by hand

#### Build Phase 9 Document

- [x] `apps/docs/src/reference/cli/promises.md`: the contract's new refusals (a row out of shape, a purpose that is neither token nor reason, a brief entry no list read, a placeholder measure, an impl that cannot be read), `replace` on an already-declared replacement, `confirm` and `withdraw` on an archived plan, and that confirm refreshes an in-force promise's links; `guide/briefs.md` and `guide/promises.md` where they describe the same; `changelog.md` Unreleased — the docs site builds

### Build Phase 10: Cleanup — one home for each thing the promise modules repeat

**Goal**: decompose what this plan grew across files, per the rule of three and settled module boundaries (no domain extension applies: `indusk-mcp` is a library and CLI, so the move is extract a function or module). The promise modules each grew their own copy of three small things, and the promise tools grew inside the plan tools. Each item below is an extraction, or a file reviewed and left with its reason.

- [x] A44 written first, red: the promise tools' module does not exist — red on its assertion (the plan tools register all eleven), not on a load error; its second case, that the two modules together offer the same eleven, passes before the move and must after
- [x] One frontmatter reader: export `parseFrontmatter` from `lib/promises/registry.ts` (it already holds the guard against gray-matter returning no fields inside vitest) and use it in `readImpl` and in `write.ts`'s `requireReadable`, which each re-implemented the try/catch, and the second without the guard
- [x] `readImpl` moves from `lib/promises/contract.ts` to `lib/promises/rows.ts`, the module that reads an impl's rows; `confirm.ts` stops importing an impl reader from the contract — `rowsNamingIn` keeps its throwing read: `rowsNaming` catches it to list an unreadable impl by name, which a reader that answered "no rows" would hide
- [ ] One sentence comparison: `sameSentence(a, b)` exported from `lib/promises/brief-contract.ts`, replacing the three whitespace-collapsing helpers (`oneLine` in `brief-contract.ts` and `contract.ts`, `one` in `confirm.ts`) that compare a brief's sentence with the registry's. (`incidents.ts`'s `oneLine` stays: it collapses line breaks in text from a span, a different job)
- [ ] One plan-relative path: `planFileRel(folder, file)` in `lib/promises/plan-folder.ts`, replacing `contract.ts`'s `relPlanFile` and `confirm.ts`'s two `slice(lastIndexOf(".indusk"))` spellings; confirm works from a `PlanFolder`
- [ ] Extract the seven promise tools (`list_promises`, `declare_promise`, `change_promise`, `replace_promise`, `withdraw_promise`, `confirm_promises`, `promise_health`) from `src/tools/plan-tools.ts` into `src/tools/promise-tools.ts` (`registerPromiseTools`), the tools' one-file-per-domain convention (`lesson-tools`, `highlight-tools`); `server/index.ts` registers both; the seven tests that reach a promise tool call the new function
- [ ] (reviewed `src/bin/cli.ts`, 998 lines — left as-is: every command group is registered in this one file; moving the promises group alone would give the CLI two ways of registering a command)
- [ ] (reviewed `hooks/validate-impl-structure.js`, 917 lines — left as-is: its `_`-prefixed modules each mirror exactly one `src/lib` module, pinned by count; the contract call mirrors none, and it is one function)
- [ ] (reviewed `src/__tests__/promises-contract.test.ts`, 669 lines — left as-is: one subject, the contract, through its three callers; split, the hook cases and the command cases would each lose the fixture they share)
- [ ] (reviewed `lib/trajectory/validator.ts` 647, `parser.ts` 467, `lib/lifecycle.ts` 530, `lib/promises/check.ts` 423, `registry.ts` 434, `__tests__/promises-check.test.ts` 424, `indusk-admin/.../Promises.tsx` 500 — left as-is: each over the cap before this plan; it added one rule, field or case beside its siblings)
- [ ] (reviewed the skills, the docs pages and the changelog over the cap — left as-is: prose, outside the code cap's intent)

#### Build Phase 10 Verification

- [ ] A44 passes, and every promise, tool and row test still does (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promise-tools src/__tests__/promises- src/__tests__/watcher- src/__tests__/always-on-health-tool src/__tests__/promise-sources src/__tests__/monitor-plans src/__tests__/plan-worktrees src/__tests__/advance-plan-workflow src/__tests__/incident-proven-by src/lib/promises`, then `vitest related` over the files changed)

#### Build Phase 10 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`): the promise tools live in `tools/promise-tools.ts`, beside the plan tools, and read and write only through `lib/promises/`

#### Build Phase 10 Document

- [ ] `apps/docs/src/reference/tools/indusk-mcp.md`: rows for `declare_promise`, `change_promise`, `replace_promise`, `withdraw_promise` and `confirm_promises`, beside `list_promises` and `promise_health` — the page lists every tool and was never given the five this plan added (found by this ritual)

## Files Affected

| File | Change |
|------|--------|
| `.indusk/promises/*.md` | six new promises |
| `apps/indusk-mcp/src/lib/trajectory/{append-row,parser,validator}.ts`, `hooks/_trajectory-parser.js` | the row's cells, level and purpose |
| `apps/indusk-mcp/src/lib/test-levels.ts`, `hooks/_test-levels.js` | the levels, renamed |
| `apps/indusk-mcp/src/lib/promises/{write,brief-contract,contract,confirm,rows}.ts` | new |
| `apps/indusk-mcp/src/lib/promises/{registry,check,incidents,reopen}.ts` | `supersedes`, `Proven by`, the reopened row |
| `apps/indusk-mcp/src/bin/{cli.ts,commands/promises.ts}`, `src/tools/plan-tools.ts` | six commands, five tools |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | purpose, levels, the contract call |
| `apps/indusk-mcp/src/lib/cleanup/gate.ts` | `promises` at close |
| `apps/indusk-mcp/skills/{planner,work,retrospective}.md`, `templates/workflows/*.md`, `templates/planning/CLAUDE.md` | the conversation, the templates, the confirm step |
| `apps/indusk-admin/src/lib/phases.ts`, `src/components/phases/TrajectoryRowsTable.tsx` | the row's level and purpose |
| ten new test files under `apps/indusk-mcp/src/__tests__/`, and `promises-cli.test.ts` | the rows above |

## Dependencies

- test-kinds landed (1.61.0): the column this plan renames and the validator it extends.

## Notes

- The impl was written with `Kind` and `test_kinds: required`, which is what the hook validated then. Build Phase 2 renamed both here and set `test_purpose: required`.
- Skill text here will be rewritten again by `house-rules-out`, the first plan in the promise-core master; whichever lands second carries the other's edits.
