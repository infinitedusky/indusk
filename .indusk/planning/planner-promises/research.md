---
title: "The planner asks for promises — research"
date: 2026-10-05
status: complete
---

# Planner promises — Research

## Question

What exists today between a plan, its tests and the promise registry, and what
would have to change for promises to come out of planning, for every test row
to say what it is for, and for a closing plan to confirm what it promised?

## Findings

### 1. The registry already has the lifecycle. Nothing writes it.

A promise is one markdown file in `.indusk/promises/`. Its states are
`declared`, `enforced`, `known-violated` and `retired`
(`lib/promises/vocabulary.ts`). `declared` already means what this plan needs:
"stated in planning, not yet established; the owner is an open plan."

`indusk promises check` treats the states differently (`lib/promises/check.ts`):

| State | What the check requires |
|---|---|
| `declared` | An owner that is a plan folder, and a declared domain. No tests, no code sites. Refused once its owner is archived: "the plan closed without establishing it". |
| `enforced` | At least one file under `tests:` that exists and carries the token `promise: <name>`. For a behaviour or state promise, also one under `sites:`. No open incident. |

So moving a promise from `declared` to `enforced` means filling `tests:` and
`sites:` and changing one word. The parts exist: a scan that returns every
file carrying a promise's token (`citedNames`, `lib/promises/citations.ts`),
and a frontmatter editor (`setScalar`, `setList`), which `promises fix`
already uses to return a promise to `enforced`.

What does not exist:

- **No command or tool writes a promise.** The CLI has `check`, `status`,
  `fix` and `watch`. The MCP server has `list_promises` and `promise_health`.
  All six promises in this repository were written by hand.
- **No step confirms one.** The retrospective skill does not mention promises
  at all. The gate that decides whether a plan may close
  (`checkRetrospectiveReadiness`, `lib/cleanup/gate.ts`) reads rituals and
  trajectory rows, not the registry. The check's refusal fires only after the
  owner is archived, which is after the close.
- **The planner never asks.** The planner skill's only mentions of promises
  are the test kind named `promise`.

Every promise also needs a `domain` that the project's config declares
(`promises.domains`). A new project declares none, so the first promise a
planner writes there needs a domain declared with it.

### 2. A test already names its promise. A row does not.

The link between a test and a promise is a token in the test file and a path
in the promise file:

- the test file carries `promise: <name>` in a comment or a string;
- the promise lists that file under `tests:`;
- the check refuses either half without the other.

A lesson has the same shape with a different word: a test's failure message
carries `lesson: <name>`, and `list_lessons` reports a lesson *guarded* when a
test or hook names it. Both tokens share one grammar (`lib/tokens.ts`, kinds
`promise` and `lesson`), whose comment says a third kind is added there and
never as a second pattern.

A trajectory row has no such statement. It has an optional `Test` column
naming test files, which 20 of the 78 impls in this repository use. Only
through that column can a row be joined to a promise today: row, to file, to
token. Nothing reads that join.

In this repository's own tests, 32 of about 375 test files carry a lesson
token, and the six promises list 14 test files between them. Most tests name
neither.

### 3. The trajectory: who reads it and who writes it

A row's columns are `ID`, `Asserts`, `Writable at`, `Passes at`, `State`, and
optionally `Kind`, `Scope` and `Test`. Headers are matched by name, so a new
column needs a parser entry, not a position.

- **Two parsers.** `lib/trajectory/parser.ts`, and a JavaScript copy for the
  hooks (`hooks/_trajectory-parser.js`), pinned to each other by test.
- **18 files read rows**: eight in the library (`verify`, the retrospective
  gate, the audit, the goalpost guard and others), four hooks, and six in the
  admin (the plan page's row table among them, which shows ID, Asserts and
  State).
- **One function writes a row after an impl is authored**: `appendLateRow`
  (`lib/trajectory/append-row.ts`). Its one caller is the promise loop. When a
  promise breaks, `promises watch` appends a Maintenance phase and a row to
  the owning plan's impl.

### 4. A defect found on the way: a reopened plan gets a row with no kind

`appendLateRow` fills five cells: id, asserts, writable at, passes at, state.
Any other column in the table is left empty.

test-kinds (1.61.0) made an impl that sets `test_kinds: required` refuse a row
with no kind. Dry run, 2026-10-05, on the archived test-kinds impl:

```
appended:  | A24 | everyday-suite-stays-fast holds again after i-x | Build Phase 7 | Build Phase 7 | planned |  |
validator: Row A24 names no kind; a kind is one of: unit, contract, live check, smoke, promise.
```

Nothing prevents this today. If a behaviour promise owned by such a plan
breaks, `watch` appends the row, and the next edit to that impl is refused by
the hook. We have not seen it happen: one plan is exposed (test-kinds, which
owns `everyday-suite-stays-fast`), and that promise has not broken. The test
that guards reopening (`monitor-reopen-validator.test.ts`) runs against three
archived impls, none of which requires kinds.

A row that must also say what it is for has the same gap, and here the
answer is known to the writer: the row is for the promise that broke.

### 5. The close, and where the code is

Confirmation needs the tests to exist and pass, so it sits at or near the
close. Two facts constrain where:

- **The check resolves a code root** (`resolveExecutionRoots`). In a flat
  project the plan's worktree holds both the plan and the code, so a check run
  there sees the plan's own tests. In a workbench, the plan documents are at
  the workbench root and the code is in a repository's worktree. The numero
  smoke (2026-10-02) recorded that `sites:` and `tests:` resolve against the
  trunk checkout, so a plan in flight cannot link code that has not landed.
- **The retrospective lands the branch at its Step 10**, after archiving at
  Step 9. A promise still `declared` when its owner is archived is refused by
  the check from that moment.

### 6. What the incident and the reopened plan say today

When a promise breaks, the incident file records the symptom, the trace ids
and the environment. The Maintenance row's text is "`<promise>` holds again
after `<incident>`: the test that reproduces it, named by its root cause,
passes". Neither names the rows or tests that were vouching for the promise.
The numero smoke found this by hand: the promise `table-chat-keeps-line-breaks`
broke while its one test row stayed green, and only prose in the test plan
connected the two.

A `declared` promise has a second gap. `watch` moves `enforced` to
`known-violated`; a violation of a `declared` promise opens an incident and
changes no state.

### 7. The rename: test `Kind` to `Level`

Decided 2026-10-05 (Sandy): tests have a level, promises keep kind.

- **16 files** carry the test vocabulary's identifiers or keys: the
  definition (`lib/test-kinds.ts`) and its hook copy, the two parsers and the
  validator, the impl hook, the package's `./test-kinds` export, three tests,
  the planner skill, the planning rules template and its installed copy, the
  trajectory guide, the decisions page and the changelog. The guide page
  `guide/test-kinds.md` is about the vocabulary by name.
- **One impl** uses `test_kinds: required` and a `Kind` column: the archived
  test-kinds impl.
- **1.61.0 is published** with the `Kind` column, the key and the export.
- The same column name already had an older, optional meaning (`example`,
  `property`, `contract`, `approval`, `formal`), used by six impls and still
  parsed. One of its values, `contract`, is also a test level.

### 8. The opt-in keys

An impl opts in to each structural rule by a frontmatter key. There are four:
`trajectory`, `test_phases`, `rationale` and `test_kinds`, each `required`. Of
78 impls, 55 set the first, 23 the second and 1 the last. Every key was added
so that older impls keep validating unchanged.

The [promise-core](../promise-core/master.md) master says one rule cannot be
switched off in any workflow: every promise is named by a test that was seen
failing. It plans a `workflow-builder` that turns today's keys into steps a
person selects.

## Open Questions

- Does a row state its purpose in a new column, or is it derived from the
  token its test file carries? The first is written at planning time, before
  the test exists. The second cannot be wrong but exists only once the test
  does.
- Where does confirmation run in a workbench, where the plan's code is not on
  the trunk until landing?
- Is "every row says what it is for" one more opt-in key, or part of an
  existing one?
- When a plan makes no promise, what does the planner record?

## Sources

- `apps/indusk-mcp/src/lib/promises/{vocabulary,registry,check,citations,reopen,watch,incidents}.ts`
- `apps/indusk-mcp/src/lib/trajectory/{parser,validator,append-row}.ts`, `hooks/_trajectory-parser.js`
- `apps/indusk-mcp/src/lib/tokens.ts`, `src/lib/cleanup/gate.ts`
- `apps/indusk-mcp/skills/{planner,retrospective}.md`
- The numero smoke's findings: root `master.md`, "Next actions", item 3
- [Day master](../indusk-v4-day/master.md), component 4c;
  [promise-core](../promise-core/master.md)
