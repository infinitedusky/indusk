---
title: "The planner asks for promises"
date: 2026-10-05
status: accepted
---

# The planner asks for promises

## Goal

**A plan's brief is what the planning conversation produced — its expectations
and its promises — and the system holds the plan to it: every test says what
it is for, and a plan closes only with its promises proven.**

Today a promise exists only if someone types a registry file, nothing connects
it to the tests that prove it, and a plan can close without having kept one.
When a promise broke on numero on 2026-10-02, the incident could not say which
test had vouched for the behaviour.

## Y-Statement

**In the context of:**
a plan written through the planner, in any project, by a person who says what
they want and agents that do the rest, with a promise registry that already
has a `declared` state and a check that already refuses an unproven promise
once its plan is archived.

**Facing:**
a registry nothing writes and nothing confirms, test rows that do not say what
they are for, a brief that states what should be true in prose a second time,
no place for why the work is being done in a form that can be checked later,
and one shipped defect: a plan reopened by a broken promise gets a row its own
validator refuses.

**We decided for:**
a brief with two parts, expectations and promises, read by one parser; one
contract check behind the CLI, the impl hook and the suite; a `For` cell on
every test row; commands that declare, change, replace and confirm a promise,
so that no one edits the registry by hand; confirmation at the plan's close;
incidents that list the rows proving the broken promise; and the test `Kind`
column renamed `Level`.

**And against:**
deriving a row's purpose from the token in its test file, which cannot be
written before the test exists; porting the registry and brief readers to
JavaScript for the hooks, which would make a second definition of each;
retiring and replacing a promise on every change, which cuts its history for
a one-line improvement; treating an expectation as a kind of promise; and
keeping the promise's sentence only in the brief.

**To achieve:**
a person who only says what they want, promises that reach the registry from
that conversation, tests that name what they prove, a close that cannot leave
a promise unproven, and an incident that starts from the tests that were
vouching.

**Accepting:**
that the impl hook starts a CLI process on every write to an opted-in impl
that is past draft; that the brief becomes a document with a fixed shape a
parser reads; that noticing which existing promises a plan affects stays the
agent's judgment until `day-contract` adds a check at change time; and that
this plan touches six areas at once.

**Because:**
the registry, its states and its check were built for exactly this and only
lack writers; every rule here reads the same few columns and files, so
splitting the work would edit them twice; and a rule that lives in one check
with three callers cannot drift the way three copies would.

## Context

[Research](research.md) has the findings and the decisions made in
conversation; the [brief](brief.md) has the six promises this plan makes; the
[test plan](test-plan.md) has the 27 assertions that prove them. This is
component 4c of the [Day master plan](../indusk-v4-day/master.md) and step 6
of the [demo](../indusk-demo/master.md).

## Decision

**D1 — The brief has a shape, and one parser reads it.** A brief in the new
shape has `## Expectations` and `## Promises`; a brief with no `## Promises`
heading is *legacy* and nothing below applies to it.

```markdown
## Expectations
1. **{what we expect to follow}**
   - Measure: {how we would know}
   - Look: {when to check}
(or: None — {reason})

## Promises
### This plan makes
1. **`{name}`** ({kind}). {the sentence}
### Existing promises
**Must not break**
- **`{name}`**. {why it is touched}
**Changes**
- **`{name}`**. {the new sentence} (or: None.)
**Replaces**
- **`{old-name}`**, by **`{new-name}`**. (or: None.)
### Not promised
- {what was chosen not to promise}
```

`lib/promises/brief-contract.ts` exports `parseBriefContract(text)`, the one
reader. `Depends On` and `Blocks` stay where `/work` reads them.

**D2 — One contract check, three callers.** `checkPlanContract(planRoot,
plan)` in `lib/promises/contract.ts` returns refusals, each naming the promise,
expectation or row:

- a promise the brief makes is not in the registry, is owned by another plan,
  or its sentence differs from the registry's (A1, A3);
- a promise the brief keeps, changes or replaces does not exist or is already
  retired (A4);
- an expectation has no measure or no time to look (A14);
- a row names a promise the registry does not hold, a retired promise, or a
  lesson with no file (A6);
- a row names a promise another plan owns that the brief does not list (A24).

Its callers:

1. `indusk promises contract <plan>`, the command.
2. `validate-impl-structure.js`, on every write to an impl that sets
   `test_purpose: required` and whose status is past `draft`. It runs the
   command through `INDUSK_BIN`, as `workbench-sync.js` already does. If the
   command cannot be run, the write is refused and the reason is said: a gate
   that cannot run is never a pass.
3. `indusk promises check`, for every active plan whose brief is in the new
   shape, so every `pnpm test` runs it.

So "cannot start building" means: an impl cannot be saved as `approved` or
`in-progress` while its plan's contract is broken.

**D3 — A row says what it is for.** The trajectory gains a `For` column. An
impl opts in with `test_purpose: required`; the planner template sets it. A
cell holds one or more of `promise: <name>` and `lesson: <name>`, separated by
commas, or any other text, which is the reason it needs neither. The package's
parser and the hooks' copy both read it, pinned equal (A16). The hook itself
refuses an opted-in impl with an empty `For` cell, naming the row (A5); what
needs the registry goes through D2.

A row that names a promise names its test files in the existing `Test` column
by the time it is `passing`. That is how confirmation knows which files prove
the promise.

**D4 — Commands write the registry.** `lib/promises/write.ts` is the one
writer. Each command has an MCP tool of the same name for the planner to call.

| Command | Does |
|---|---|
| `promises declare <name> --plan --kind --domain --statement` | Writes the file as `declared`, owned by the plan, with a History line. Adds the domain to `promises.domains` when the project does not declare it (A2). |
| `promises change <name> --plan --statement --reason` | Replaces the sentence; the owner becomes the plan; History gains the date, the old sentence, the reason and the previous owner (A25). Name, state, incidents and aliases are untouched. |
| `promises replace <old> --by <new> …` | Declares the new promise with `supersedes: <old>`. The old one is untouched until the plan closes (A26). |
| `promises confirm <plan>` | D5. |

`supersedes` is a new frontmatter key on the new promise. `superseded_by`
stays readable for the promises that carry it.

**D5 — Closing confirms.** `promises confirm <plan>`, for each promise the
plan owns that is `declared`:

- refuses when no row of the plan's impl names it, or a row naming it is not
  `passing`, naming the promise (A8);
- sets `tests:` to those rows' `Test` files, each of which must exist and
  carry the promise's token, and `sites:` to the other files under the code
  root that carry it;
- sets `state: enforced`, adds a History line, and retires any promise this
  one supersedes;
- then runs the registry check and fails if it refuses anything (A9).

It takes the code root to scan, defaulting to `resolveExecutionRoots`. In a
workbench the retrospective passes the plan's own code worktree, so a plan
whose tests are not yet on the trunk still confirms (A11).

The retrospective's gate (`checkRetrospectiveReadiness`) adds `promises` to
what is missing when the plan owns a `declared` promise that `confirm` would
refuse. The retrospective skill runs `confirm` before it archives. A plan that
owns no promise is unaffected (A10).

**D6 — An incident names its tests; a reopened plan stays valid.**
`rowsNaming(planRoot, promise)` reads every impl, active and archived, and
returns the rows whose `For` names the promise: plan, row and state. The
incident file gains a `## Proven by` section listing them, or saying that no
row names the promise (A12, A27). `appendLateRow` takes values for the extra
columns; the promise loop passes `For: promise: <name>` and `Level: unit`, the
smallest level, which the Maintenance phase's author may raise (A13).

**D7 — Tests have a level.** `lib/test-levels.ts` and `hooks/_test-levels.js`
replace the `test-kinds` pair, pinned equal as before. An impl opts in with
`test_levels: required`; `test_kinds: required` means the same. The column is
`Level`; `Kind` is read as the level when either key is set (A19). The
package's `./test-kinds` export stays, re-exporting, because 1.61.0 published
it.

**D8 — Skills and templates.** The planner skill gains the conversation step
(what is wanted; the existing promises sorted into kept, changed and replaced;
the promises read back before they are saved), the brief template of D1, a
research template with Background and Decisions, a test-plan template grouped
by promise with a `Level` column, and an impl template that sets
`test_levels` and `test_purpose` and has `Level`, `For` and `Test` columns.
The bugfix and refactor templates take the same brief. A plan of those types
may already carry a research document without being marked for it, so nothing
in `workflow-types` changes (A21 is a guard, not a change). The retrospective
skill gains the confirm step.

**D9 — The admin.** The plan page's row table shows `Level` and `For` when a
row has them, and a promise's name links to the Promises page (A7).

**D10 — This repository.** `promises-cli.test.ts` counts a promise as held
when it is `enforced`, `known-violated`, or `declared` by a plan that is still
open. This plan's six promises are written with that change, in its first
phase.

## Alternatives Considered

### Derive a row's purpose from its test file's token
It cannot be wrong, but it exists only once the test does. The point of the
row is to say, at planning time, what the test will be for. Confirmation
still cross-checks the two: a row's `Test` file must carry the token.

### Port the registry and brief readers to JavaScript for the hooks
That is how the trajectory parser reaches the hooks, pinned by a parity test.
It would add two more copies to keep equal, of the two readers most likely to
change. One CLI call keeps one definition, at the cost of a process per write.

### Retire and replace on every change
The rule of 2026-10-03. It gives each sentence its own record, and it cuts
the promise's incidents, marks and timeline off from it for a one-line
improvement. Kept for a promise whose name no longer describes it.

### Expectations as a fourth kind of promise
Ruled out by the promise-core master: when an expectation fails, that is
information, not a defect. As a promise it would gate closes and reopen
plans, and people would write expectations they are sure of.

### Keep the sentence in the brief only, and write the registry at close
The registry is where every reader looks: the check, the admin, the watcher.
A promise that exists only in a brief until close is invisible to all three
while its plan is being built, which is when it is most likely to be broken.

### One opt-in key for levels and purpose together
They are separate rules with separate refusals. The promise-core master's
`workflow-builder` is where the keys become one choice.

## Consequences

### Positive
- A person states what they want; the registry, the rows and the close follow
  from it.
- A promise's proof is findable from its name: its rows in every plan, their
  test files, its incidents, its History.
- The brief stops saying what should be true a second time. Success Criteria
  and the test plan's ungrouped assertions give way to promises and the
  assertions under each.
- The 1.61.0 defect is fixed where its cause is.

### Negative
- Every write to an opted-in impl past draft starts a CLI process: about
  0.13 s here (`indusk promises check`, measured 2026-10-05).
- The brief's shape is now load-bearing. A brief that drifts from it is
  refused until it is put right.
- Trajectory tables grow two columns.
- Four commands and four MCP tools are added.

### Risks
- **The hook's CLI call fails in a project where `indusk` is not on the
  path.** It refuses and says why, so the failure is loud. Mitigation: the
  same resolution `workbench-sync.js` uses, and a test for the refusal.
- **The agent misses an existing promise the plan affects.** Mitigation: that
  promise's own tests; a row that names it forces the brief to address it;
  `day-contract` later.
- **Six areas in one plan.** Mitigation: phases ordered so each closes green
  on its own, with the defect fix first.
- **A sentence edited by hand in one place.** Mitigation: the contract check
  compares the brief's sentence with the registry's.

## Documentation Plan

### Pages
- New: `guide/briefs.md` — what a brief holds: expectations, promises, the
  three lists for existing promises; what goes to research.
- Rename: `guide/test-kinds.md` to `guide/test-levels.md`, the old page left
  as a pointer.
- Update: `guide/promises.md` (declared, confirmed, changed, replaced);
  `guide/test-trajectory.md` (`Level`, `For`, `Test`);
  `reference/cli/promises.md` (`declare`, `change`, `replace`, `confirm`,
  `contract`); `reference/skills/planner`, `reference/skills/retrospective`;
  `reference/admin-ui/overview.md`.

### Diagrams
- One Mermaid diagram in `guide/briefs.md`: conversation → brief → registry
  (`declared`) → rows → close (`enforced`) → incident names rows.

### Changelog
- Added: the brief's expectations and promises; `test_purpose: required` and
  the `For` column; `promises declare | change | replace | confirm |
  contract`; incidents list the rows that prove a promise. Changed: the test
  `Kind` column is `Level`. Fixed: a plan reopened by a broken promise no
  longer gets a row its validator refuses.

### ADR in Docs
- `decisions/planner-promises.md` at close.

## References
- [research](research.md), [brief](brief.md), [test plan](test-plan.md)
- [Day master](../indusk-v4-day/master.md), component 4c;
  [promise-core](../promise-core/master.md)
- `apps/indusk-mcp/src/lib/promises/`, `src/lib/trajectory/`,
  `hooks/validate-impl-structure.js`, `hooks/workbench-sync.js`
