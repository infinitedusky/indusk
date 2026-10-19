---
title: "A plan says how long it took"
date: 2026-10-19
status: draft
workflow: feature
clauses: required
description: "Every phase, every unattended step and every run of a plan's tests records when it started and ended, and one command shows a plan's time by phase, by step and by test run, so where the time goes can be read rather than guessed."
---

# A plan says how long it took — Brief

Speed item 3 of `current.md`'s next run (Sandy, 2026-10-18). Today a phase's start is
recorded (`.indusk/phase-boundary.jsonl`) but not its end; an unattended step's session
record is deleted when it ends and the build's events carry no time; a run of
`indusk plans tests` records nothing. So "this is taking a while" (Sandy, 2026-10-19)
could only be answered by reading commit times by hand, and whether to run the
Must-not-break tests every phase and the reached ones at landing is to be decided from
data (Sandy, 2026-10-18), which does not exist yet.

## Expectations

1. **Where a plan's time goes can be read.**
   - Measure: for the next three plans, the share of each plan's time spent in each phase, each unattended step and its test runs, read from the one command; expect every phase and step to have a duration.
   - Look: after three plans have landed.

## Promises

### This plan makes

1. **`a-plan-says-how-long-it-took`** (state). Every phase, every unattended step and every run of a plan's tests records when it started and ended, and one command shows a plan's time by phase, by step and by test run.
   - **`phases-are-timed`** (split). Each phase records when it opened and when it closed.
   - **`steps-are-timed`** (split). Each unattended planning or build step records when it started, when it ended and how it ended.
   - **`test-runs-are-recorded`** (split). Each run of a plan's tests records the plan, the phase or the landing, how many files it ran for each reason, how long it took and whether it passed.
   - **`one-view`** (split). One command prints a plan's phases, steps and test runs with their durations, and a plan's total from its brief's acceptance to its landing.
   - **`a-record-never-blocks`** (limit). A record that cannot be written never stops the phase, the step or the test run it records.

### Existing promises

**Must not break**

- **`a-plan-runs-its-tests-and-what-must-not-break`**. Recording a test run changes nothing about what runs.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Showing it in the admin** — the activity page's (`activity-and-graph`).
- **Deciding what runs per phase from the data** — later, from what this records.

## Looks

None — a command's output and machine-state records; the admin shows them later, on the activity page.

## Depends On

- `.indusk/planning/archive/a-brief-is-planned-unasked/` — landed; this plan is planned by it.

## Blocks

- None.
