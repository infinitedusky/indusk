---
title: "A plan says how long it took — Test Plan"
date: 2026-10-19
status: draft
---

# A plan says how long it took — Test Plan

## `a-plan-says-how-long-it-took`

Every phase, every unattended step and every run of a plan's tests records when it started and ended, and one command shows a plan's time by phase, by step and by test run.

### `phases-are-timed` — Each phase records when it opened and when it closed.

- Signal: the plan's phase record on machine state; upheld when every phase that opened has an opening time and every phase that closed has a closing time later than it; broken reports a closed phase with no closing time, or one that closes before it opens.
- Measure: of the phases in the next three landed plans, the share with both an opening and a closing time — expect all of them; the first three-plan reading is the brief's expectation.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Opening a phase records its opening time; the record that already existed for a phase's start still reads the same. | unit |
| A2 | Closing a phase records its closing time against the phase that was open, and a closing time is never earlier than its opening time. | unit |
| A3 | A phase that is closed twice, or closed without having been opened, keeps one honest record and does not invent a time. | unit |

### `steps-are-timed` — Each unattended planning or build step records when it started, when it ended and how it ended.

- Signal: the step's record, kept after the step ends; upheld when each step that ran has a start, an end and an outcome (finished, blocked, failed or stopped); broken reports a step with no record, no end time or no outcome.
- Measure: of the unattended steps in the next three landed plans, the share with a start, an end and an outcome — expect all of them, including steps that failed or were stopped.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A planning step that finishes leaves a record with its start, its end and the outcome "finished"; the record is still there after the step's session is gone. | unit |
| A5 | A build step that ends in a blocker, a failure or a stop leaves a record naming that outcome, not only the steps that succeeded. | unit |
| A6 | A step killed before it could write its end still shows up in the view as started and never ended, rather than missing. | unit |

### `test-runs-are-recorded` — Each run of a plan's tests records the plan, the phase or the landing, how many files it ran for each reason, how long it took and whether it passed.

- Signal: the test-run record written when `indusk plans tests` finishes; upheld when each run has the plan, the phase or "landing", the file counts by reason, a duration and a pass or fail; broken reports a run with no record or a record missing one of those.
- Measure: of the test runs in the next three landed plans, the share with a record carrying all five facts — expect all of them; the durations are what the later decision about which tests run per phase is made from.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A test run for a phase records the plan, that phase, the count of files run for each reason (the plan's own, reached by its changes, must-not-break), its duration and that it passed. | unit |
| A8 | A test run at landing records "landing" in place of a phase, and a run with a failing file records that it did not pass. | unit |
| A9 | Running a plan's tests twice records two runs, in order, not one overwritten by the other. | unit |

### `one-view` — One command prints a plan's phases, steps and test runs with their durations, and a plan's total from its brief's acceptance to its landing.

- Signal: the command's output for a plan; upheld when it lists each phase, step and test run with a duration and ends with a total from acceptance to landing; broken reports a recorded item missing from the output, or a total that does not span acceptance to landing.
- Measure: for each of the next three landed plans, the command lists every recorded phase, step and test run and prints a total — expect the sum of the parts to be no greater than the total, with the difference shown as time between steps, not hidden.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | The command prints each phase, each step and each test run of a plan with its duration, in the order they happened. | unit |
| A11 | The command's total runs from the brief's acceptance to the plan's landing, and for a plan not yet landed says so and shows the time so far. | unit |
| A12 | A plan recorded before this change, with phases but no ends, steps or test runs, prints what exists and says what has no record, and does not fail. | unit |
| A13 | Run against a real plan in the worktree, the command prints a readable table a person can use to say which phase took longest. | live check |

### `a-record-never-blocks` — A record that cannot be written never stops the phase, the step or the test run it records.

- Signal: the outcome of a phase, step or test run when its record cannot be written; upheld when the work finishes with the same result as without the failure and the lost record is reported as a warning; broken reports a phase that would not open, a step that failed, or a test run that did not run because of a record.
- Measure: with the record location made unwritable, the share of phase openings, phase closings, steps and test runs that still complete with their normal result — expect all of them.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A14 | With the phase record unwritable, opening and closing a phase still succeed, with a warning that the time was not recorded. | unit |
| A15 | With the step record unwritable, an unattended step still runs to its normal outcome and the build carries on. | unit |
| A16 | With the test-run record unwritable, the plan's tests still run and the command exits with the tests' own result, not a failure from the record. | unit |
| A17 | A record file that is corrupt, half-written or from an older shape is skipped by the view and by every writer, never thrown from. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A18 | Recording a test run runs exactly the same files for the same plan, phase and landing as before; only the record is new. | unit | the brief lists `a-plan-runs-its-tests-and-what-must-not-break` under Must not break, so the existing selection must be shown unchanged |
| A19 | The time a phase, step or test run records is read from the machine's clock when it happens, and the view shows a duration the same way across time zones and daylight-saving changes. | unit | durations come from timestamps; a zone-dependent reading would make the data the later decision rests on wrong |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | After three landed plans, the one command lets Sandy see where each plan's time went. | needs three real plans to land after this one | the brief's expectation, read after three plans have landed; `one-view`'s measure is the early reading |

## Notes

- **Decision: one measure per clause, written in its Signal block.** The brief states clauses with a signal-style reading but no numbers; each clause's `Measure:` line is a share of recorded items over the next three landed plans, matching the brief's own expectation, so the clause plan and the brief are read the same way. Reason: the brief's one expectation is already "the next three plans".
- **Decision: every clause's rows are `unit` except one `live check`.** The records and the command's output are files and text a unit test can write and read; only a real plan shows the table is usable by a person (A13). No `smoke`, `contract` or `promise` level row: nothing leaves the machine and the plan adds no external dependency. A `promise` row would watch production telemetry; this plan's records are machine state, not a telemetry signal (none needed — no production behavior to watch).
- **Decision: `a-record-never-blocks` is proved by making each record location unwritable**, once per writer (phase, step, test run) plus a corrupt-file row, because the limit is only real if every writer honours it.
- **Decision: A12 requires the view to tolerate plans recorded before this change.** The brief says nothing about old plans; the view will be run on every plan in the repo, and most have phase starts only.
- **Open:** `research.md` does not exist for this plan, so the sentence "the step's session record is deleted when it ends" (brief, opening paragraph) is taken as stated; the ADR should confirm where steps' records now live and where the phase and test-run records are kept before the impl names files. No assertion here depends on the location.
- **Open:** A19's time-zone row assumes timestamps are written in UTC ISO form like the existing `phase-boundary.jsonl`; the ADR should state the form.
