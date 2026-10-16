---
title: "Plans are promises"
date: 2026-10-16
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "fe936485f782398ef751f5d38fb59ede90f0f38bf607e502aae9a8efaa8ecd88"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-16T16:27:41.051Z"
---

# Plans are promises

## Goal

A plan that opts in states each promise as clauses in its brief; the registry
keeps the clauses with the promise; the clause plan (`test-plan.md`, one
section per promise and per clause, each clause with its signal) is checked;
test rows name the clause they prove; and closing refuses a clause nothing
proves. Plans that do not opt in validate and close exactly as before. See
[adr.md](adr.md).

## Scope

### In Scope
- `clauses: required` in a brief's frontmatter; clauses as sub-entries under each promise the brief makes.
- A `clauses` list in a promise's registry file, written by `indusk promises declare --clause`, validated by the reader.
- The contract check holding brief, registry, clause plan and rows to the clauses.
- A `clause: <promise>/<clause>` token in a row's `For` cell, in the library's reader and the hook's.
- Closing (confirm and the cleanup gate) per clause; a resting clause proved by its promise in force.
- The planner skill, its brief and test-plan templates, and the planning context file.

### Out of Scope
- Proving a clause by its signal in use — `mark-first`.
- Phases as a graph, branches per phase, plan priority — `run-the-master`.
- Showing clauses on their own in the cockpit, or renaming the "test plan" document — `cockpit-around-promises`.
- `change` and `replace` taking clauses: a promise's clauses are set at declaration in this cut; changing them is a follow-on once a plan needs it.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `promise-clauses.test.ts`; cases in `promises-declare.test.ts`, `row-purpose.test.ts`, `hook-shared-modules.test.ts`, `promises-confirm.test.ts`, `planner-brief-template.test.ts`; the register | the test plan; `checkPlanContract`, `parseBriefContract`, `parsePurpose`, `confirmPlan`, the `declare` command as they are today |
| Build Phase 1 | `BriefMade.clauses`; `PromiseEntry.clauses` and its validation; `declare --clause`; the contract's brief-vs-registry and at-least-one-clause rules | `brief-contract.ts`, `registry.ts`, `write.ts`, `contract.ts` |
| Build Phase 2 | `lib/promises/clause-plan.ts`; `RowPurpose.clauses` in both readers; the contract's clause-plan, row-clause and every-clause-named rules; the save hook's clause refusal | Build Phase 1's clauses |
| Build Phase 3 | per-clause `rowProofs`; confirm and the cleanup gate per clause; the planner skill, templates and planning context; the live check | Build Phases 1–2 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | An opted-in brief stating two promises with split and limit clauses passes the contract check once both are declared with those clauses | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A2 | An opted-in brief stating a promise with no clause is refused, naming the promise | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A3 | Declaring with clauses writes each clause's name, kind and sentence to the registry file; a kind other than split, limit or rests-on is refused, naming it, with nothing written | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promises-declare.test.ts |
| A4 | An opted-in brief whose clauses differ from the registry's (missing, extra, reworded) is refused, naming the clause | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A5 | An opted-in plan's clause plan missing a section for a promise or a clause is refused, naming which | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A6 | A clause in the clause plan with no signal line is refused, naming the clause | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A7 | A row naming a clause the promise does not have is refused, naming it, by the contract check and when the impl is saved | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A8 | An opted-in plan with an impl where no row names one of its clauses is refused, naming the clause | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A9 | Closing confirms a promise with clauses only when every clause has a passing row with a test file; with one unproved it stays declared and the refusal names the clause | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A10 | The planner's instructions describe the clause plan per promise, with a signal and tests per clause, before the ADR; its brief template states clauses and passes the contract check | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/planner-brief-template.test.ts |
| A11 | A resting clause on a promise that does not exist is refused at declaration; at close a resting clause is proved by its promise being in force, with no row | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promises-declare.test.ts, apps/indusk-mcp/src/__tests__/promises-confirm.test.ts |
| A12 | The planner's instructions say promises sharing code are one plan, promises sharing none are separate plans under a master, the planner suggests and the person decides | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/planner-brief-template.test.ts |
| A13 | A plan that has not opted in validates, passes the contract check and closes as before, rows naming its promises being enough | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A14 | The save hook and the library read every row's purpose the same way, the clause form included | Test Phase 1 | Build Phase 2 | passing | unit | a regression guard over the two copies of the row-purpose reader, the library's and the hook's, which must not drift | apps/indusk-mcp/src/__tests__/hook-shared-modules.test.ts |
| A15 | A row naming a clause counts as naming its promise in the promise's proof, incidents and standing | Test Phase 1 | Build Phase 2 | passing | unit | promise: every-test-says-what-it-is-for | apps/indusk-mcp/src/__tests__/row-purpose.test.ts |
| A16 | In a project made for the check, a plan written with the commands — two promises with clauses, a clause plan, rows naming clauses — passes the contract check, is refused at close while a clause has no passing row, and closes once it does | Build Phase 3 | Build Phase 3 | passing | live check | promise: a-plan-holds-the-promises-it-lands | manual: indusk promises contract demo && indusk promises confirm demo, in a temporary project |
| A17 | A plan that makes two promises, the second with a clause resting on the first, both otherwise proved, closes in one confirm and passes the cleanup gate; a resting cycle inside one plan is refused, naming both promises | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promises-confirm.test.ts, apps/indusk-mcp/src/__tests__/cleanup-gate.test.ts |
| A18 | A brief with no `clauses: required`, whose promises are bullets indented two or three spaces beneath a first entry, still reads every one of them as a promise it makes | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promise-clauses.test.ts |
| A19 | A promise file whose clause rests on the promise itself is refused by the registry check, and a resting clause naming a promise the registry no longer holds is refused by it, naming the clause | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-holds-the-promises-it-lands | apps/indusk-mcp/src/__tests__/promises-check.test.ts |

## Checklist

### Test Phase 1: Write every clause test first, failing where clauses do not exist yet

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before anything about clauses is built, this phase writes the tests that say what a plan with clauses must do, each through a command or function that exists today, so each fails on its own assertion rather than on a missing file: a brief that states clauses is accepted only when the registry holds the same clauses, a brief that opts in with a promise that has none is refused, declaring a promise records its clauses, the clause plan must cover every clause with its signal, a test row can say which clause it proves and is refused for one that does not exist, a plan closes only when every clause is proved, and the planner's instructions describe all of this. One test passes from the start and must keep passing: a plan that has not opted in behaves exactly as today. The next phase teaches the brief and the registry to hold clauses.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  `indusk worktree assign plans-are-promises /Users/the_dusky/code/sandbox/dusk-worktrees/plans-are-promises` for the one `plans start` made (or confirm with `indusk worktree list`) — worktree-per-plan default.

  </details>
- [x] Write the tests that the contract check holds a brief's clauses to the registry, to the clause plan and to the test rows, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/promise-clauses.test.ts`, docblock `promise: a-plan-holds-the-promises-it-lands`. Each case builds a temp project (the fixture pattern in `promises-contract.test.ts`: a `.indusk/promises/` registry, `.indusk/planning/demo/brief.md` with `clauses: required`, optionally `test-plan.md` and `impl.md`) and calls `checkPlanContract` (imported at the top of the file).
  A1: two promises, each with `- **\`fast\`** (split). …` and `- **\`never-lost\`** (limit). …` sub-entries, registry files carrying the same `clauses:` → no refusal. The contract alone passes today, since the sub-entries are discarded; the case also asserts `parseBriefContract(brief).makes[0].clauses` has two entries, which is what fails today.
  A2: one promise with no sub-entries → a refusal naming it. Red: no refusal.
  A4: registry missing one clause / with an extra / with a reworded sentence → three refusals naming each clause. Red: none.
  A5: clause plan with no `## \`second-promise\`` section, and one with no `### \`never-lost\`` → refusals naming each. Red.
  A6: a clause section with no `- Signal:` line → refusal naming the clause. Red.
  A7: an impl row `For` = `clause: first-promise/no-such` → refusal naming `no-such`. Red: the cell reads as malformed or as a reason, not a clause refusal — assert the refusal text names the clause.
  A8: an impl whose rows name `clause: first-promise/fast` only → refusal naming `never-lost`. Red.
  A13: the same project without `clauses: required`, no sub-entries, rows naming `promise: first-promise` → no refusal. Passes today (regression guard).

  </details>
- [x] Write the tests that declaring a promise records its clauses and refuses a bad clause, failing today.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/promises-declare.test.ts` (add `promise: a-plan-holds-the-promises-it-lands` to its docblock): run `indusk promises declare demo-promise --plan demo --kind state --domain planning --statement "…" --clause "fast (split). Answers in under a second." --clause "never-lost (limit). No write is lost."` through the file's existing CLI helper.
  A3: the written file's frontmatter has `clauses` with both names, kinds and sentences; a `--clause "odd (sometimes). …"` exits 2 naming `odd`, and no file is written. Red: `--clause` is an unknown option.
  A11 (first half): `--clause "base (rests on no-such-promise)"` exits 2 naming `no-such-promise`. Red.

  </details>
- [x] Write the tests that a row may name a clause and still counts for its promise, and that both readers of a row agree, failing today.
  <details><summary>Technical</summary>

  `row-purpose.test.ts` A15: `parsePurpose("clause: first-promise/fast")` gives `clauses: [{ promise: "first-promise", clause: "fast" }]` and `promises: ["first-promise"]`; `rowsNamingIn(impl, entry)` for `first-promise` lists the row. Red: the cell is malformed.
  `hook-shared-modules.test.ts` A14: for a table of cells — `promise: a`, `lesson: b`, `clause: a/c`, `promise: a, clause: a/c`, `clause: a`, `clause: a/`, free text — the library's `parsePurpose` and the hook port's (`hooks/_trajectory-parser.js`) return equal values, and `clause: a/c` yields a clause in both. Red: both read the clause cells as malformed today, so the equality alone would pass; the clause assertion is what fails.

  </details>
- [x] Write the tests that closing a plan wants every clause proved, failing today.
  <details><summary>Technical</summary>

  `promises-confirm.test.ts` (docblock `promise: a-plan-holds-the-promises-it-lands`): a registry promise owned by `demo` with `clauses: [fast (split), never-lost (limit), base (rests-on, rests_on: other)]`, `other` enforced; an impl with a passing row `clause: demo-promise/fast` with a test file carrying the token, and no row for `never-lost`.
  A9: `confirmPlan` refuses, naming `never-lost`, and the promise stays `declared`; adding a passing row for `never-lost` confirms it. Red: the clause row reads as malformed today, so confirm refuses for "no row names it" — the assertion that the refusal names `never-lost` fails.
  A11 (second half): with `other` declared rather than enforced, the refusal names `base`; with `other` enforced and both other clauses proved, it confirms. Red.

  </details>
- [x] Write the tests that the planner's instructions describe clauses, failing today.
  <details><summary>Technical</summary>

  `planner-brief-template.test.ts` (docblock `promise: a-plan-holds-the-promises-it-lands`): A10 — the skill's `### brief.md` template contains a sub-entry `(split)` and `(limit)` under a made promise and `clauses: required` in its frontmatter, and the parsed template's `makes[0].clauses` is non-empty; the `### test-plan.md` template contains a `- Signal:` line under a `### \`{clause-name}\`` heading; Step 5's text says the clause plan is written before the ADR. A12 — Step 3's text says promises whose work shares code are one plan and that the person decides a split. Red: none of it is there.

  </details>
- [x] Confirm no new test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every test imports existing modules (`checkPlanContract`, `parseBriefContract`, `parsePurpose`, `rowsNamingIn`, `confirmPlan`) or runs the CLI. `clause-plan.ts` is not imported by a test; it is reached through `checkPlanContract`.

  </details>

#### Deferred to Build Phase 3

- **A16** — a live check run once against the finished commands in a temporary project; there is nothing to run until declaring with clauses, the clause plan and closing per clause all exist. Its record is the commands and their output, pasted into Build Phase 3's Verification.

#### Regression Guards

- **A13** — passes from the start and must: it is the promise that plans written before clauses stand. Its red window would be a defect in this plan.

#### Test Phase 1 Verification

- [x] The tests this phase writes exist and each red one fails on its own assertion.
  <details><summary>Technical</summary>

  A1–A12, A14, A15 (write red) and A13 (passes): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promise-clauses.test.ts src/__tests__/promises-declare.test.ts src/__tests__/row-purpose.test.ts src/__tests__/hook-shared-modules.test.ts src/__tests__/promises-confirm.test.ts src/__tests__/planner-brief-template.test.ts` — the new cases fail on their assertions, A13 and every pre-existing case pass. Paste the counts.

  </details>
- [x] Every deferred test above has been read and judged.
  <details><summary>Technical</summary>

  A16's commands reviewed: will they exist at Build Phase 3, and does the run show what A16 claims?

  </details>

### Build Phase 1: The brief and the registry hold clauses

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase gives a promise its parts. A brief that opts in states each promise's clauses beneath it; declaring a promise records its clauses in the registry, refusing a clause of an unknown kind or one resting on a promise that does not exist; and the contract check refuses a brief whose promises have no clauses or whose clauses differ from the registry's. Nothing yet reads the clause plan or test rows for clauses; the next phase does.

- [x] The brief reader returns each promise's clauses.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/brief-contract.ts`: `BriefMade` gains `clauses: BriefClause[]` (`{ name, kind: "split" | "limit" | "rests-on", sentence, restsOn? }`); `readMakes` reads an entry's sub-bullets `- **\`name\`** (split|limit). sentence` and `- **\`name\`** (rests on \`promise\`).` instead of discarding them; a sub-bullet that names a clause and does not parse is a `problem`. `BriefContract` gains `clausesRequired: boolean` from frontmatter `clauses: required`.

  </details>
- [x] A promise's registry file can carry its clauses, and a malformed list is reported.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/registry.ts`: `PromiseEntry.clauses?: PromiseClause[]`; `promiseProblem` reports a non-list, a duplicate name, a kind outside `PROMISE_CLAUSE_KINDS` (new in `vocabulary.ts`: `split | limit | rests-on`), a `rests-on` with no `rests_on`.

  </details>
- [x] Declaring a promise takes its clauses and refuses a bad one.
  <details><summary>Technical</summary>

  `bin/commands/promises.ts` `declare`: repeatable `--clause <spec>`; `lib/promises/write.ts` `declarePromise` gains `clauses`, parses each spec with the brief's sub-entry grammar (one function, exported from `brief-contract.ts`, used by both), refuses a bad kind or a `rests on` promise absent from the registry with exit 2 and nothing written, and writes `clauses:` in frontmatter. The MCP `declare_promise` tool gains an optional `clauses: string[]`.

  </details>
- [x] The contract check refuses an opted-in brief whose promises lack clauses or disagree with the registry.
  <details><summary>Technical</summary>

  `lib/promises/contract.ts`: a `clauseRefusals` beside `madeRefusals`, active only when `clausesRequired`: a made promise with no clause; a clause in the brief not in the registry, in the registry not in the brief, or with a different kind, sentence or `rests_on`.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] The tests for clauses in the brief and the registry pass.
  <details><summary>Technical</summary>

  A1, A2, A3, A4 (goes green), A13 still passing: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promise-clauses.test.ts src/__tests__/promises-declare.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/brief-contract.ts src/lib/promises/registry.ts src/lib/promises/write.ts src/lib/promises/contract.ts --run`; `pnpm promises:check` passes over the whole registry.

  </details>
- [x] The first half of the resting-clause test passes.
  <details><summary>Technical</summary>

  A11's declaration half goes green; its closing half stays red until Build Phase 3.

  </details>

#### Build Phase 1 Context

- [x] The rule that a brief may state its promises as clauses is written where plans are written.
  <details><summary>Technical</summary>

  planning: `apps/indusk-mcp/templates/planning/CLAUDE.md` — under Documents, "**A brief may state its promises as clauses** (`clauses: required`): each made promise lists its splits, limits and the promises it rests on beneath it, declared with `--clause`; the contract check holds brief and registry equal. — see `/decisions/plans-are-promises`". Copy to `.indusk/planning/CLAUDE.md` via `indusk update`-equivalent sync, never by hand; the template-sync test pins it.

  </details>
- [x] The root's Key Decisions names this plan's decision.
  <details><summary>Technical</summary>

  root (Key Decisions): "- Plans are promises: a plan holds the promises it lands, each stated as clauses with a clause plan before the ADR; opt-in `clauses: required` — see `/decisions/plans-are-promises`" — always-on because every planning session decides how many promises a plan holds before any planning file is read. Run `context-tiers-register` in this phase's verification.

  </details>

#### Build Phase 1 Document

- [x] A reader can find how to state a promise as clauses in the brief guide and the command reference.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/briefs.md` — a "Promises as clauses" section with the brief shape and the opt-in; `apps/docs/src/reference/cli/promises.md` — `declare --clause` and its grammar.

  </details>

### Build Phase 2: The clause plan and the test rows name clauses

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase makes the clause plan and the test rows answer to the clauses. A test row may say it proves one clause of a promise, and still counts as naming the promise everywhere rows are read; both the library and the save hook read that the same way, and refuse a clause the promise does not have. The contract check reads the clause plan — one section per promise, one per clause, each with its signal — and refuses a missing section or signal, and, once an impl exists, refuses a clause no row names. The next phase makes closing a plan ask for every clause.

- [x] A test row can name a clause, in both readers, and counts for its promise.
  <details><summary>Technical</summary>

  `lib/trajectory/parser.ts` `parsePurpose`: a third token `clause: <promise>/<clause>` (both kebab-case); `RowPurpose.clauses: { promise: string; clause: string }[]`; the promise is also pushed to `promises` (deduplicated). The same change in `hooks/_trajectory-parser.js`, then sync to `.claude/hooks/` and run `hook-sync-parity.test.ts`. The malformed message names the clause form.

  </details>
- [x] The clause plan is read.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/promises/clause-plan.ts`: `parseClausePlan(text): { promises: { name, clauses: { name, signal: string | null }[] }[], problems: string[] }` over `## \`promise\`` / `### \`clause\`` headings and `- Signal:` lines, fences skipped (`fencedLineMask`).

  </details>
- [x] The contract check holds the clause plan and the rows to the clauses.
  <details><summary>Technical</summary>

  `contract.ts`, when `clausesRequired`: if `test-plan.md` exists, a missing promise or clause section, or a clause with no signal, is refused naming it; every row clause must exist on its promise (all plans, opted in or not, since a clause token is new); if `impl.md` exists, every `split`/`limit` clause must be named by a row. The save hook's existing contract call (`validate-impl-structure.js` → `indusk promises contract --impl-stdin`) carries the row-clause refusal to save time.

  </details>

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification

- [x] The tests for the clause plan and for rows naming clauses pass.
  <details><summary>Technical</summary>

  A5, A6, A7, A8, A14, A15 (goes green): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promise-clauses.test.ts src/__tests__/row-purpose.test.ts src/__tests__/hook-shared-modules.test.ts src/__tests__/hook-sync-parity.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/trajectory/parser.ts src/lib/promises/clause-plan.ts src/lib/promises/contract.ts --run`; `pnpm promises:check` passes.

  </details>

#### Build Phase 2 Context

- [x] The rule for naming a clause in a test row is written where impls are written.
  <details><summary>Technical</summary>

  planning: `templates/planning/CLAUDE.md`, the `Level` and `For` rule — add "`clause: <promise>/<clause>` names one clause and counts for its promise; an opted-in plan names every split and limit clause in some row." Synced as in Build Phase 1.

  </details>

#### Build Phase 2 Document

- [x] A reader can find the clause token and the clause plan's shape.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/test-trajectory.md` — the `clause:` token; `apps/docs/src/reference/skills/plan.md` — the clause plan's shape (pinned by `workflow-types-parity.test.ts`, so its document list is unchanged).

  </details>

### Build Phase 3: A plan closes only when every clause is proved, and the planner plans this way

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase finishes the promise. Closing a plan — both the check that a plan is ready for its retrospective and the command that confirms its promises — now wants, for a promise with clauses, a passing test row with a test file for each split and limit clause, and for each clause resting on another promise, that promise in force; the refusal names the clause. The planner's instructions are rewritten so a planner groups promises that share code into one plan, writes the brief with clauses, and writes one clause plan section per promise, with each clause's signal and tests, before the ADR. Last, the whole story is run once with the real commands in a temporary project and its output recorded here.

- [x] Closing a plan wants every clause proved.
  <details><summary>Technical</summary>

  `lib/promises/rows.ts` `rowProofs`: for a promise with `clauses`, the rows naming each clause (via `purpose.clauses`); refusal per unproved `split`/`limit` clause (no row, a row not passing, or no test file), and per `rests-on` clause whose `rests_on` promise is not `enforced` (read from the registry passed in). `confirm.ts` and `cleanup/gate.ts` pass the registry through; their refusal text names the clause.

  </details>
- [x] The planner's instructions plan promises as clauses.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md`: Step 3 — promises whose work shares code are one plan; promises sharing none are separate plans under a master; suggest, the person decides. Step 4 and the `### brief.md` template — `clauses: required`, clause sub-entries, declaring with `--clause`. Step 5 and the `### test-plan.md` template — the clause plan: `## \`{promise}\`` → `### \`{clause}\` — {sentence}` → `- Signal: {where it is read; upheld when …; broken reports …}` → its assertion table; written before the ADR. Step 7 — rows' `For` names `clause: <promise>/<clause>`. Sync `.claude/skills/planner/SKILL.md`; run `skill-sync-parity.test.ts`. Also `apps/indusk-mcp/templates/workflows/feature.md` names the clause plan.

  </details>
- [x] The whole story is run once with the real commands and its output recorded.
  <details><summary>Technical</summary>

  A16, after `pnpm --filter @infinitedusky/indusk-mcp build`, in `mktemp -d` with `git init` and `indusk init --local`: `indusk plans start feature demo`; a brief with `clauses: required` and two promises with clauses; `indusk promises declare … --clause …` for each; a clause plan; an impl whose rows name each clause, one left `planned`; `indusk promises contract demo` (passes) and `indusk promises confirm demo` (refused naming the clause); mark it passing; confirm again (closes). Paste the commands and outputs here.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 3 Verification

- [x] The closing and planner tests pass, and the live check is recorded.
  <details><summary>Technical</summary>

  A9, A10, A11, A12 (goes green), A16 (recorded): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-confirm.test.ts src/__tests__/planner-brief-template.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/workflow-types-parity.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/rows.ts src/lib/promises/confirm.ts src/lib/cleanup/gate.ts --run`; `pnpm promises:check` passes.

  **A16 record** (2026-10-16, built CLI `apps/indusk-mcp/dist/bin/cli.js`, in `mktemp -d` + `git init`). Deviation from the item's text: `indusk init --no-index` was used, not `--local`, because `--local` git-ignores `.indusk/` and `indusk plans start` then fails at `git add` of the brief (a defect in `plans start` under local init, outside this plan). Plan `demo` in worktree `plan/demo`: brief with `clauses: required` and two promises with two clauses each (`seat-held-once`: fast split, never-lost limit; `seat-map-accurate`: shows-holds split, never-stale limit), a clause plan with a signal per clause, an impl whose four rows say `clause: <promise>/<clause>`, row A4 left `planned`.

  ```
  $ indusk plans start feature demo
  Started demo (feature) in …/a16.hr8x-worktrees/demo on plan/demo; …
  $ indusk promises declare seat-held-once --plan demo --kind state --domain demo --statement "A seat is held by one person at a time." --clause "fast (split). A hold is placed in under a second." --clause "never-lost (limit). No hold is ever lost."
  seat-held-once declared by demo. Run `indusk promises check` before committing.      (exit 0)
  $ indusk promises declare seat-map-accurate … --clause "shows-holds (split). …" --clause "never-stale (limit). …"
  seat-map-accurate declared by demo. Run `indusk promises check` before committing.   (exit 0)
  $ indusk promises contract demo
  demo: its brief, its rows and the registry agree — 2 made, 0 kept, 0 changed, 0 replaced; 1 expectation   (exit 0)
  $ indusk promises confirm demo
  .indusk/promises/seat-map-accurate.md: seat-map-accurate: clause never-stale: row A4 is planned
  demo cannot close: 1 refusal, nothing written.                                       (exit 2)
  # row A4 marked passing
  $ indusk promises confirm demo
  seat-held-once: enforced — 1 test file, 1 code site
  seat-map-accurate: enforced — 1 test file, 1 code site
  demo: 2 promises confirmed; the registry check passes.                               (exit 0)
  $ indusk promises check
  2 promises — declared 0, enforced 2, known-broken 0, retired 0 — behaviour 0, state 2, structure 0 — 0 incidents   (exit 0)
  ```

  </details>

#### Build Phase 3 Context

- [x] The planning rules say a plan closes per clause.
  <details><summary>Technical</summary>

  planning: `templates/planning/CLAUDE.md`, the close-out rule — "a promise stated as clauses is confirmed only when each split and limit clause has a passing row and each promise it rests on is in force." Synced as before.

  </details>

#### Build Phase 3 Document

- [x] A reader can find how a plan with clauses closes, and the changelog says what shipped.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/plan.md` — closing per clause; `apps/docs/src/changelog.md` Unreleased — "Added: promises stated as clauses — `clauses: required` in a brief, `declare --clause`, the clause plan, `clause:` rows, closing per clause."

  </details>

### Build Phase 4: Falsification — a plan that cannot close, and a plan that silently loses a promise

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase tests three places where the finished plan may fail its own promise. A plan that makes two promises where one rests on the other may be unable to close, because closing looks only at what is already in force. A brief written before clauses may have lost a promise, because the reader now treats an indented bullet as part of the entry above it. And a promise can be written to rest on itself or on one that is gone, and the registry check says nothing. When it closes, a plan with promises resting on each other closes, an older brief reads as before, and a clause that cannot be satisfied is refused where it is written.

- [x] A promise resting on a sibling promise of the same plan counts as in force once that sibling is itself proved, and a cycle is refused.
  <details><summary>Technical</summary>

  `lib/promises/rows.ts` `clauseRefusal`/`rowProofs`: a `rests-on` target owned by `plan`, in `promises`, whose own clauses and rows raise no refusal, counts as in force; a cycle among such siblings is a refusal naming both. `confirm.ts` and `cleanup/gate.ts` already pass the registry; check `build/review.ts`. Hypothesis: today the sibling is `declared` in the registry read before anything is written, so the dependent is refused and, since one refusal blocks the whole confirm, neither is ever enforced.

  </details>
- [x] A brief that has not opted in reads an indented bullet as it did before clauses.
  <details><summary>Technical</summary>

  `lib/promises/brief-contract.ts` `items`: the nested-bullet rule applies only when the caller reads clauses (`readMakes` with `clausesRequired`); every other section and a brief without the opt-in keep the old top-level reading (`ENTRY` allows up to three leading spaces). Hypothesis: `   - **\`b\`** [state]. …` under `1. **\`a\`** …` was a promise and is now a sub-bullet `parseClauseSpec` rejects without a problem, so `b` drops out of `makes`.

  </details>
- [x] The registry check refuses a clause that rests on its own promise or on a promise it does not hold.
  <details><summary>Technical</summary>

  `lib/promises/registry.ts` `clausesProblem` takes the promise's name and refuses `rests_on` equal to it; `lib/promises/check.ts` refuses a `rests_on` naming no promise in the registry, naming the clause. Hypothesis: both pass `promises:check` today and surface only as a close that can never succeed.

  </details>
- [x] Shape — reviewed a file this phase changed and left it as it is
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/rows.ts`: rowProofs now holds the memoised proofOf closure; it has one reason to change (how a promise is proved) and the cycle chain needs the closure state, so extracting it would only thread that state through arguments

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 4 Verification

- [x] The three hypotheses hold: each test fails today on its own assertion and passes after the fixes.
  <details><summary>Technical</summary>

  A17, A18, A19: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-confirm.test.ts src/__tests__/cleanup-gate.test.ts src/__tests__/promise-clauses.test.ts src/__tests__/promises-check.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/rows.ts src/lib/promises/brief-contract.ts src/lib/promises/registry.ts src/lib/promises/check.ts --run`; `pnpm promises:check` passes. A13 and every other clause row still passing.

  </details>

#### Build Phase 4 Context

- [x] The planning rules say a promise may rest on a sibling of the same plan.
  <details><summary>Technical</summary>

  planning: `templates/planning/CLAUDE.md`, the per-clause close-out rule — add "a clause may rest on a promise the same plan makes; it counts once that promise is proved in the same close." Synced by the package.

  </details>

#### Build Phase 4 Document

- [x] The planning guide says a resting clause may name a sibling promise.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/briefs.md` "Promises as clauses": one sentence and the cycle refusal.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/brief-contract.ts` | clauses under made promises; `clausesRequired`; shared clause-spec parser |
| `apps/indusk-mcp/src/lib/promises/registry.ts`, `vocabulary.ts` | `clauses` on a promise; clause kinds |
| `apps/indusk-mcp/src/lib/promises/write.ts`, `src/bin/commands/promises.ts`, `src/tools/promise-tools.ts` | `declare --clause` |
| `apps/indusk-mcp/src/lib/promises/contract.ts` | clause rules |
| `apps/indusk-mcp/src/lib/promises/clause-plan.ts` | new: the clause plan reader |
| `apps/indusk-mcp/src/lib/trajectory/parser.ts`, `hooks/_trajectory-parser.js`, `.claude/hooks/_trajectory-parser.js` | the `clause:` token |
| `apps/indusk-mcp/src/lib/promises/rows.ts`, `confirm.ts`, `src/lib/cleanup/gate.ts` | closing per clause |
| `apps/indusk-mcp/skills/planner.md`, `.claude/skills/planner/SKILL.md`, `templates/workflows/feature.md`, `templates/planning/CLAUDE.md` | the planner and the planning rules |
| `apps/indusk-mcp/src/__tests__/*` (six files above) | the rows |
| `apps/docs/src/guide/briefs.md`, `guide/test-trajectory.md`, `reference/cli/promises.md`, `reference/skills/plan.md`, `changelog.md` | docs |
| `CLAUDE.md` | Key Decisions line |

## Dependencies
- `one-promise-language` (archived) — the words.

## Notes
- No admin file changes: the plan page reads the brief and the clause plan as documents, and a clause row lists its promise as today. Showing clauses on their own is `cockpit-around-promises`'.
