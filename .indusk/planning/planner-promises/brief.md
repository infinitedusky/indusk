---
title: "The planner asks for promises"
date: 2026-10-04
status: draft
workflow: feature
---

# Planner promises — Brief

*Re-scoped 2026-10-05 (Sandy), when the Day master and the
[promise-core](../promise-core/master.md) master were reconciled. This plan
is now component 4c of the [Day master plan](../indusk-v4-day/master.md), the
contract entering planning, as well as demo step 6. It is the next plan to
build. What 4c used to hold beyond this, the change rule, stays with
`day-contract` as 4c′.*

## Problem

A plan that should make promises gets them only if someone writes the registry
files by hand, and nothing connects a promise to the tests that prove it:

- **In the demo**, the first plan must make promises, and they should come out
  of planning.
- **In the smoke on numero** (2026-10-02), a promise broke in a running system
  and the incident could not say which test had vouched for the behaviour. The
  link from the promise to its test row was prose a person had typed.
- **A promise that is only `declared` shows no change when it is violated.**
  Only an `enforced` promise moves to `known-violated`, and nothing moves a
  promise to `enforced` when its tests pass.

## Proposed Direction

1. **The planner proposes, the person decides.** At brief time the planner
   proposes what this plan promises will stay true, each as one plain
   sentence. The person accepts, rewords or declines each. An accepted one is
   written as a promise in `.indusk/promises/`, owned by this plan,
   `state: declared`, before any code exists. The agent assigns its kind from
   the sentence and the person can correct it. A declined proposal is recorded
   in the brief and not raised again. A plan may make no promise; the brief
   then says so, with the reason.
2. **Every test says what it is for** (Sandy, 2026-10-02). A trajectory row
   names the promise it proves, or the lesson it guards (the `lesson: <name>`
   token), or says why it needs neither. A row that states none of the three is
   refused when the impl is written. This is softer than "a row naming no
   promise is refused", which would push authors into filler promises.
3. **A closing plan confirms.** A declared promise whose tests pass becomes
   `enforced` when its plan closes. A plan cannot close holding a promise that
   no passing row names.
4. **An incident arrives knowing its tests.** Because rows name promises,
   `promises watch` can write which rows prove the broken promise and whether
   they pass at head. The row it appends to the reopened plan names the
   promise that broke and carries its level. Today that row is appended with
   an empty level, which an impl that requires levels then refuses
   ([research](research.md), finding 4): a defect in 1.61.0 that nothing has
   triggered yet.
5. **Tests have a level, promises have a kind** (Sandy, 2026-10-05). The
   trajectory's `Kind` column, added by
   [test-kinds](../archive/test-kinds/brief.md), is renamed `Level`, and
   `test_kinds: required` becomes `test_levels: required`. The five values are
   unchanged. "Kind" stays the promise's word (behaviour, state, structure),
   because every project's registry files carry it. The rename rides here
   because this plan edits the same columns. The old spellings keep
   validating: one archived impl uses them.

## Context

- This is the first three clauses of what the Day master called
  `day-contract`: declared before code, named by every row, confirmed at
  close. The fourth, the change rule (a plan that changes a promise retires it
  and declares the replacement with `supersedes:`; a change that touches a
  promise's code without naming it is recorded "touched, unacknowledged"),
  stays in `day-contract`. The demo does not need it.
- [promise-core](../promise-core/master.md) makes "a test names a promise" a
  rule of the core, true whatever the workflow. This plan builds it for
  workflows that have a checklist. `promise-first-build`, promise-core's last
  plan, extends it to a promise with no plan, and makes `owner` optional;
  until then a promise this plan writes is owned by its plan.
- It edits the files test-kinds just changed: the planner skill's test-plan
  section and templates, the trajectory parser and validator, and the impl
  hook.
- The registry already has the `declared` state and the check already
  refuses a promise still `declared` after its owner is archived. What is
  missing is anything that writes a promise or confirms one
  ([research](research.md), finding 1).
- "Seen failing, recorded by the system" is not here. It is
  `day-claim-evidence`'s, component 5 in the Day master plan.

## Scope

### In Scope
- The planner skill and its templates: the question, the promise files, the
  row's "for" column
- The trajectory parser, validator and hook: a row names a promise, a lesson,
  or a reason; the names resolve against the registry and the lessons folder
- The retrospective's close: `declared` to `enforced`; the refusal when a
  held promise has no passing row
- `promises watch`: the rows that prove a broken promise, in the incident;
  the row it appends carries its level and its promise
- A new project's first promise: its domain is declared with it
- The `Kind` to `Level` rename, with the old spellings accepted
- The admin: a plan's page shows each row's promise

### Out of Scope
- The change rule (`day-contract`, 4c′)
- "Seen failing" recorded by the system (`day-claim-evidence`, 5)
- Promises with no owner, and the short path (`promise-first-build`)

## Success Criteria

- A plan written through the planner ends with its promises in the registry,
  and nobody typed a registry file.
- An impl with a row that names no promise, no lesson and no reason is
  refused, naming the row.
- Closing the plan moves its promises to `enforced`; breaking one in a running
  system opens an incident that names the rows that prove it.
- A new impl's trajectory says `Level`, and the test-kinds impl in the archive
  still validates.
- A plan that requires levels, reopened by a broken promise, still validates.

## Depends On

- [test-kinds](../archive/test-kinds/brief.md), closed 2026-10-05: the column
  this renames and the validator it extends.
- `day-promises` (4a), closed: the registry and its check.

## Blocks

- `day-contract` (4c′): the change rule needs rows that name promises.
- [indusk-demo](../indusk-demo/master.md) step 6, and `demo-rehearsal`.

## Part of

[indusk-demo](../indusk-demo/master.md), step 6, and the
[Day master plan](../indusk-v4-day/master.md), component 4c.
