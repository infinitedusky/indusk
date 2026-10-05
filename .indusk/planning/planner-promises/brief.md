---
title: "The planner asks for promises"
date: 2026-10-04
status: accepted
workflow: feature
---

# Planner promises — Brief

*Written in the shape this plan proposes (Sandy, 2026-10-05). A brief is what
the conversation produced: the expectations and the promises. Why now, what
exists today and what was decided on the way are in [research](research.md).
What gets built to keep these promises is the ADR's.*

*This plan is component 4c of the [Day master plan](../indusk-v4-day/master.md),
the contract entering planning, and step 6 of the
[demo](../indusk-demo/master.md).*

## Expectations

Why we are doing this. Each says what we expect to follow, how we would know,
and when to look. An expectation that does not happen is information, not a
defect. It blocks nothing and reopens nothing.

1. **A person starting a plan only has to say what they want.** The promises
   reach the registry from the conversation, and nobody writes a registry file
   by hand.
   - Measure: of the next five plans closed, how many hold a promise the
     planner wrote, or say why they hold none.
   - Look: when the fifth closes.
2. **A broken promise is fixed sooner, because its incident starts from the
   tests that were vouching for it.**
   - Measure: the time from an incident opening to its being fixed, for the
     next three incidents against the last three, from the incident files.
   - Look: when the third is fixed.
3. **The demo's first plan makes its promises on camera.**
   - Measure: the rehearsal runs script step 6 and nobody types a registry
     file.
   - Look: at `demo-rehearsal`, the demo's last plan.

## Promises

### This plan makes

Each will be a file in `.indusk/promises/`, owned by this plan, `declared`
until this plan's tests prove it. They are written in the plan's first phase
([research](research.md), finding 9). The kind in brackets is the agent's reading
and can be corrected.

1. **`a-briefs-promises-are-in-the-registry`** (state). Every promise a plan's
   brief names is in the registry and owned by that plan. A plan cannot start
   building while its brief names one the registry does not hold.
2. **`every-test-says-what-it-is-for`** (state). Every test row in a plan says
   what it is for: the promise it proves, the lesson it guards, or why it needs
   neither. A plan with a row that says none of these is refused.
3. **`a-closed-plan-kept-its-promises`** (state). A plan cannot close while a
   promise it made has no passing test that names it. When it closes, its
   promises are enforced.
4. **`an-incident-names-its-tests`** (state). When a promise breaks, its
   incident names the tests that were proving it, and the plan it reopens can
   still be edited.
5. **`an-expectation-says-how-it-is-measured`** (state). Every expectation in
   a brief says how it will be measured and when to look.
6. **`a-changed-promise-keeps-its-history`** (state). A plan that changes or
   replaces an existing promise says so in its brief. A changed promise keeps
   its name, and its file records the old sentence, the reason and the plan
   that owned it before. A replaced one is retired, and the new one records
   which it replaced.

### Existing promises

Before a plan's promises are saved, the agent reads every promise in force
and goes through the related ones with the person. Each lands in one of three
lists (Sandy, 2026-10-05):

- **Must not break**: still true as written.
- **Changes**: the same commitment, its sentence improved. It keeps its name;
  this plan takes it over.
- **Replaces**: its name no longer describes it. It is retired and a new one
  is declared.

**Must not break**, for this plan:

- **`one-definition-per-shared-rule`**. The row parser has a copy for the
  hooks. The new column and the rename land in both, pinned equal.
- **`gates-ran-at-every-checkoff`**. The hook that validates an impl changes.
- **`everyday-tests-never-wait`** and **`everyday-suite-stays-fast`**. Every
  test this plan adds is a unit test, and `pnpm test` stays about a minute.

And one guard that is not yet a promise: every impl written before this plan
validates exactly as it did.

**Changes**: none. **Replaces**: none.

### Not promised

- **The check at change time**: code that touches a promise's site, in a plan
  that does not name that promise, is flagged. `day-contract`, component 4c′
  in the Day master plan. Until it exists, noticing which existing promises a
  plan affects is the agent's judgment, backed by those promises' own tests.
- **"Seen failing", recorded by the system.** `day-claim-evidence`, component
  5 in the Day master plan.
- **A promise with no plan to own it**, and building from a promise alone.
  `promise-first-build`, the last of the three plans in the
  [promise-core](../promise-core/master.md) master.
- **Building the telemetry an expectation names, keeping it and reading it
  back.** A later plan, not created. What was decided about it is in
  [research](research.md).
- **Scoring an expectation against the project's aim.**
  [plan-premises](../plan-premises/brief.md).
- **Making any document optional.** `workflow-builder`, the second plan in the
  promise-core master.

## Depends On

- [test-kinds](../archive/test-kinds/brief.md), closed 2026-10-05: the column
  this plan renames and the validator it extends.
- `day-promises`, component 4a in the Day master plan, closed: the registry
  and its check.

## Blocks

- `day-contract`: its check needs briefs and rows that name promises.
- [indusk-demo](../indusk-demo/master.md) step 6, and `demo-rehearsal`.
