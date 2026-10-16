---
title: "Plans are promises — Research"
date: 2026-10-16
status: complete
workflow: feature
---

# Plans are promises — Research

## Question

What does it take for a plan to hold promises stated as clauses — each clause
with its signal and its tests — and to close only when every clause is proved,
without disturbing the plans written before clauses existed?

## Background

`promise-core`'s master (`.indusk/planning/promise-core/master.md`, "Settled
2026-10-14/15") makes the promise the primitive: a promise is made of clauses —
*splits*, progress against a budget on the way to its goal, and *limits*, bounds
that always hold — and every clause has a signal (telemetry that reports it
upheld or broken) and may have tests. This plan's 2026-10-15 brief made a plan
one promise. On 2026-10-16 Sandy found that a promise and a plan describe
different things: a promise is permanent and outlives the plan; a plan is a unit
of work that ends. Closely related promises that touch the same code belong in
one plan, or each pays a full lifecycle and two plans collide on one set of
files. The master was revised the same day (*A plan holds the promises it
lands*), and this brief with it.

Today a brief already lists several promises, and the test plan already groups
its assertions under each promise — so "more than one promise per plan" exists.
What does not exist is the clause: in code, a promise is a sentence with no
parts.

## Findings

Measured on `plan/plans-are-promises` after merging `main` (364043bc2),
2026-10-16.

### The brief

`apps/indusk-mcp/src/lib/promises/brief-contract.ts` `parseBriefContract()`
(:374) is the one parser. An entry under **This plan makes** matches
`**\`name\`** (kind). sentence` (:229); sub-bullets under an entry are collected
and discarded. Nine library modules call it (contract, confirm, cleanup gate,
build review, plan parts, approved-brief, amendments, accept, drafts view), and
the admin reads it through `plans/parts`. A clause written as a sub-bullet today
is read and thrown away — the cheapest place to add one.

### The test plan

About sixty sites know the document `test-plan` by name: the lifecycle
(`lib/lifecycle.ts`, 7), the workflow types and core-document list
(`lib/workflow-types.ts`, 6, with `CORE_DOCUMENTS = ["brief","test-plan"]`), the
plan parser's stage derivation, the audit's inputs, the review's evidence, the
`documents_off` refusal, the admin's planning reader, labels, plan page and
stories, and around thirty tests and fixtures, several of them parity pins
(`workflow-types-parity.test.ts`, `lifecycle-parity.test.ts` and its snapshot,
`lifecycle-single-definition.test.ts`). **No code reads the test plan's
contents**: its assertion tables are prose.

So a clause plan that keeps the document's name and place changes one new
reader and no existing one; a clause plan as a new file per promise, or a
renamed lifecycle position, changes the sixty.

### The `For` cell

`lib/trajectory/parser.ts` `parsePurpose()` (:79) splits on commas and accepts
only `promise: <name>` and `lesson: <name>`; anything else is a reason, or
malformed if it looks like a token. A hand port lives in
`hooks/_trajectory-parser.js` (:108), installed to `.claude/hooks/`, held equal
by `hook-shared-modules.test.ts`. A dot or slash fails the name pattern, so no
clause form exists. `purpose.promises` is read by `promises/rows.ts`
(`rowsNamingIn`, `rowProofs`) and from there by confirm, the cleanup gate, build
review, proof, incidents, standing and release routing, and by the admin's
`TrajectoryRowsTable`. A clause form that also counts as naming its promise
keeps every one of those readers working unchanged.

### The registry

`lib/promises/registry.ts` reads `.indusk/promises/*.md`: required `name`,
`kind`, `state`, `domain`, `owner`; optional `lifetime`, `sites`, `tests`,
`incidents`, `aliases`, `superseded_by`, `supersedes`, `expect_every`. Unknown
keys are not refused. Nothing has sub-parts. `indusk promises declare` and
`change` write it.

### Closing

`lib/promises/confirm.ts` `confirmPlan()` (:239) takes the plan's declared
promises, and `rowProofs` refuses one no passing row names; `judge` then wants
each test file to exist and carry `promise: <name>`. The cleanup gate's
`unprovenPromisesOf` (:208) does the rows half. Both work per promise; a clause
needs one more level.

### Where the plan is described

`apps/indusk-mcp/skills/planner.md` (21 test-plan mentions; Step 5 and the
`test-plan.md` template group assertions by promise), the workflow templates,
and `templates/planning/CLAUDE.md`, whose one clause line (:37) is vocabulary
only. The skill is byte-pinned to `.claude/skills/planner/SKILL.md`.

## Decisions

- **A plan holds the promises it lands** (Sandy, 2026-10-16): one or more
  promises; promises that share code share a plan, and the planner suggests
  separate plans when they share none; the person decides.
- **A clause plan per promise, before the ADR** (Sandy, 2026-10-16): done is
  fixed before how to build is decided. The lifecycle already puts the test plan
  before the ADR.
- **Phases, branches and the graph are `run-the-master`'s** (Sandy, 2026-10-16).
  This plan only lets a test row name the clause it proves.
- **`a-plan-is-one-promise` withdrawn** (2026-10-16), never in force;
  `a-plan-holds-the-promises-it-lands` declared in its place.

## Open Questions

- Whether the plan page should show clauses on their own (a look, and the
  cockpit's — `cockpit-around-promises`), or keep reading the clause plan as a
  document, as this cut leaves it.
- Whether a structure promise's clause signal is a build-time check (left open
  in the master).

## Sources

- `.indusk/planning/promise-core/master.md` — the primitive and the 2026-10-16 revision.
- The conversation of 2026-10-16 (Sandy): plan vs promise, phases as units of work, branches per phase.
