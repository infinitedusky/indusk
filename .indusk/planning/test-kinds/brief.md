---
title: "Test kinds — each question answered by the smallest test, at its own moment"
date: 2026-10-05
status: draft
workflow: feature
---

# Test kinds — Brief

## Problem

Every phase waits about five minutes on `pnpm test`, and the wait is most of
what slows building InDusk down: a person walks away, and comes back half an
hour later. Measured ([research](research.md)):
- eight admin test files take 216 s of that;
- each boots `next dev` and real Jaeger servers to check a rule about what a
  chip or cell shows for a set of runs;
- because they starve under load, the root suite runs the two packages one
  after the other.

The tests are slow because our own rules sent every assertion through the
outermost door. "Assertions are behavioural" plus "prefer the boundary for a
real red" became "test the store by booting a web server". They are also
doing the wrong job. Watching a running system, and waiting for time to pass,
is monitoring, and monitoring is what promises are for. Tests are for
regressions.

## Proposed Direction

**1. Five kinds of test, each with its moment.** The test plan's mechanism
names a kind, and the kind says when it runs:

| Kind | The question | Runs |
|---|---|---|
| **unit** | Is this rule right? | the phase loop, in seconds |
| **contract** | Do we still fit something we don't own (Jaeger's API, npm, a browser, the OS, Claude Code)? | `test:system`: at landing, on release, when that thing changes |
| **live check** | Does the whole story work as a person sees it, against the real deployed system? | once, when a feature closes, recorded in the plan (like promise-timeline's A13 against Fly) |
| **smoke** | Is the deployed thing alive? | at deploy |
| **promise** | Is it still true in production? | continuously, by the watcher |

An assertion's wording stays behavioural. Its mechanism defaults to the
**smallest kind that can prove it**. A contract test is allowed only when the
question is about the thing we don't own.

**2. Code that decides takes its clock and its reads as inputs.** This is a
rule and a lesson, not a library. The fake clock is Vitest's (`vi.useFakeTimers`,
`vi.setSystemTime`). A fake source is a list of runs. Applied first to the
admin's store and health read, the reason those tests boot servers today.

**3. Convert the admin's eight promise files to unit tests** through those
seams, every assertion kept. One Promises-page test that renders against a
real Jaeger stays, moved to the system tier. With the server tests gone, the
root suite runs both packages in parallel again.

**4. Phase verification runs what the phase touched**: its own trajectory
rows, plus the tests related to the files it changed. The full `pnpm test`
runs at landing; `test:system` at release. The work skill, the verify skill
and the planner template say so, and the real-red rule narrows: a seam gives
an honest red without a boundary.

## Context

- The conversation that named it (2026-10-05), Sandy: *"regression is about
  testing, not monitoring"*; *"that's the reason we have promises"*;
  *"if we end up with five-minute tests every phase, it's insane"*; *"time
  budget isn't the solution. The solution is what style of tests are we
  running."*
- The mcp package already has the tier rule this plan generalises:
  `vitest.tiers.ts` keeps every file that starts a real system in
  `test:system`. The admin has no such tier.
- `.indusk/research/test-strategy/induskbrief.md` (April) set unit /
  integration / e2e as categories and homes. This plan adds the moment each
  runs and the smallest-kind default.
- promise-timeline's retrospective names the cost: the plan added three of
  the eight files.

## Scope

### In Scope

- The kinds vocabulary in the planner's test-plan rule and template, and the
  trajectory's `Kind` column. A kind outside the five is refused, the way an
  unknown workflow type is.
- The work skill: phase verification by rows and related tests; the real-red
  rule narrowed to seams.
- The verify skill and the planner's Verification template: no whole-suite
  command as a phase's default.
- Clock and reader inputs for `lib/promise-timeline.ts` and
  `lib/promise-health.ts`, and a shared in-memory source helper for tests.
- Converting the eight admin promise files; one page test to the system
  tier; the root suite back to parallel.
- A lesson carried by the converted tests.

### Out of Scope

- **Publishing from CI** (`release-ci`, trusted publishing): its own plan,
  because it needs Sandy's GitHub and npm setup. Together with this plan it
  takes the remaining wait off the person.
- **Splitting the watcher into its own package**: a later plan; moving code
  does not change how fast its tests are.
- **A promise InDusk holds about itself** ("a violation reaches the admin
  within N minutes"): a follow-up. It is product work, and the watcher
  heartbeat already covers whether the watcher can hear.
- **The mcp suite's slow files** (`workbench-split` 44 s, `monitor-mark`
  14 s…): audited against the kinds in a follow-up, using the rules this plan
  writes. At 49 s in parallel, mcp is not the bottleneck.
- A suite time budget. Rejected (Sandy): the cause is the kind of test, not
  the number.

## Success Criteria

- The root `pnpm test` finishes in **about a minute** (from about five), with
  both packages running in parallel.
- The admin's own suite runs in **under 60 s** (from 255 s).
- Every assertion the eight files made is still made, by a test that fails
  when its rule breaks. Checked by breaking each rule once.
- A typical phase's verification finishes in **seconds to tens of seconds**,
  because it runs the phase's rows and related tests, not the suite.
- A new test plan cannot name a mechanism outside the five kinds.
- The next plan that adds a store or reader gives it clock and reader inputs
  from its first phase. The rule reaches it from the planner and the lesson,
  not from memory.

## Depends On

- Nothing outstanding; promise-timeline (1.60.0) has landed.

## Blocks

- Nothing formally. Every plan after it runs faster, and `release-ci` pairs
  with it: this plan decides what runs at release, `release-ci` runs it
  without anyone waiting.
