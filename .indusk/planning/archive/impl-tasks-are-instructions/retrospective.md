---
title: "Impl tasks are written as instructions"
date: 2026-10-17
---

# Impl tasks are written as instructions — Retrospective

## What We Set Out to Do

Make a task in a new impl read as work to do ("Make the prompt box's text area
use the app's font") and a verification item as what must hold, so a person
reading a phase can tell the work from the checks. Moved out of `mark-first`
the same day so it would land without waiting on it (Sandy). No new promise:
`an-impl-phase-explains-itself` gained the stronger sentence.

## What Actually Happened

27 files changed outside `.indusk/`, +302 / −76. Three phases instead of two:

- **Test Phase 1** wrote ten wording tests, red on their own assertions.
- **Build Phase 1** reworded the four files the impl named — the planner's
  phase-summary paragraph and impl template, the falsify and cleanup templates,
  the shipped planning rules — resynced the project copies, changed the promise
  and updated the planner reference and changelog. Green.
- **The cold audit** then found the old wording still taught in seven places the
  plan never listed: the bugfix, refactor and feature workflow templates (so
  every new bugfix impl — this plan's own kind — would still come out the old
  way), the gate tasks under each phase's OTel, Context and Document headings,
  the item the Shape step writes, the save check's refusal messages, and four
  docs pages.
- **Build Phase 2** (added after the audit) wrote a test that fails while any
  file outside the archives teaches a task as an outcome — red on 36 lines —
  then reworded every one. Green; the test stays as a guard.

Falsify and cleanup were skipped with reasons; the cleanup reason was revised
after the audit pointed out it contradicted the build's own note about a
duplicated test helper.

## Getting to Done

The plan was "done" after Build Phase 1 by every check it had. It was not: the
promise did not hold for bugfix and refactor plans. The audit was the only step
that read past the files the plan named.

## What We Learned

- A plan that retires wording must find the wording, not list the files the
  author remembers. The planner skill already names the tool — a
  grep-the-thing-is-gone test in Test Phase 1 — and this plan did not use it
  until the audit forced a second build phase.
- A test scoped to "a phase's own tasks" passed while gate tasks under the same
  phases still taught the old rule: a test narrower than the promise proves the
  narrower thing.
- The cold audit earned its cost on a plan small enough to tempt skipping it.

## What We'd Do Differently

- Grep the retired phrase across the repository while writing the impl, and put
  the gone test in Test Phase 1.
- Not write a skip reason ("no code path to break") before the audit has read
  the change.

## Insights Worth Carrying Forward

For wording, naming and vocabulary changes, the first row is a whole-repo gone
test; every other row is detail.

## Quality Ratchet

No Biome rule would have caught this: the defect was prose in markdown and
string literals. The ratchet for it is the gone test itself
(`task-wording-gone.test.ts`).

Shape findings: 1 raised (a duplicated test helper, recorded as left as is),
0 judged wrong by a human.

## Metrics

- Sessions spent: 1
- Files touched: 27 (outside `.indusk/`)
- Lines added/removed: +302 / −76
- Tests added: 1 file (`task-wording-gone.test.ts`) and 16 cases across two existing files

Landed on main at fb166688, 2026-10-17. Installed locally (`pnpm install:local`); nothing published — dusk publishes deliberately, not per plan.
