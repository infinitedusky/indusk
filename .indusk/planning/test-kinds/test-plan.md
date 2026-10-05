---
title: "Test kinds — Test Plan"
date: 2026-10-05
status: accepted
---

# Test kinds — Test Plan

## Purpose

The behavioural assertions that, together, mean the tests are fast and still
catch what they caught. This plan's mechanisms use its own vocabulary: each
names one of the five kinds the brief defines (**unit**, **contract**, **live
check**, **smoke**, **promise**), and so when the test runs.

## Behavioral Assertions

### The waiting is gone

| ID | Assertion | Kind |
|----|-----------|------|
| A1 | The whole everyday suite (`pnpm test` at the root) finishes in about a minute, with both packages running at once. | live check, at Build close, recorded; then the `everyday-suite-stays-fast` promise (A16) |
| A2 | The admin's suite on its own finishes in under 60 seconds. | live check, at Build close, recorded |
| A3 | Verifying a typical phase of this plan takes seconds to tens of seconds, because it runs that phase's tests and the tests related to the files it changed, not the suite. | live check, at each of this plan's build phases, recorded |

### Nothing the slow tests caught is lost

Each row is a rule one of the admin's eight server-booting files checked
today. Each is now proved by a unit test with runs fed in from a list and
time moved by a fake clock, and **each is shown to fail when its rule is
broken** (the rule is broken once by hand, the test goes red, the break is
reverted).

| ID | Assertion | Kind |
|----|-----------|------|
| A4 | A production break reads red while its incident is open and purple once it is fixed. | unit |
| A5 | Local's chip, beside production, goes green once a newer local run holds, with no incident. | unit |
| A6 | A violation that reaches Jaeger minutes after it happened still turns its chip and its cell red. | unit |
| A7 | After the project is pointed at another server, nothing from the old server is drawn. | unit |
| A8 | A window too slow to read in one refresh is drawn within a few refreshes, saying how far back it has read. | unit |
| A9 | A refresh with nothing new asks the source only for the recent past, never the whole window again. | unit |
| A10 | When a source cannot be read, its chips are hollow and say *health unknown since*, never green, and the other source is still drawn. | unit |
| A11 | When a source's watcher is blind, the page says *watcher blind* for that source. | unit |
| A12 | A violated promise names the environment its newest violation came from. | unit |
| A13 | The Promises page, rendered against a real Jaeger, shows the chips and the strip a run produces. One test, in the system tier. | contract |

### The rules hold the line

| ID | Assertion | Kind |
|----|-----------|------|
| A14 | A test in the everyday tier of either package that starts a server, or waits on the wall clock, fails the guard, which names the file and the call. Red today: the admin's eight files and mcp's four clock-waiting files. | unit |
| A15 | A short-lived process that runs and exits (`git`, our own CLI) does not trip the guard. | unit |
| A16 | Every everyday run is recorded as held or broken with how long it took, and the result appears on the Promises page under `everyday-suite-stays-fast`. A slow run fails nothing. | unit (the mark from a duration) + live check (seen on the page at close) |
| A17 | A slow everyday run, past the agreed threshold, opens an incident that names this plan. | unit |
| A18 | A test plan or trajectory row whose kind is not one of the five is refused when written, naming the five. | unit |
| A19 | A new plan's template no longer offers the whole suite as a phase's default verification; it offers the phase's rows and related tests. | unit |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Plans after this one give anything that decides its clock and its reads as inputs, from the first phase. | It is about code not yet written, by agents following prose. | The rule is in the planner's test-plan section and carried by a lesson token in the converted tests; Shape reviews each phase against it; `everyday-tests-never-wait` (A14) catches the symptom the day a server-booting test is added. |
| U2 | The speed threshold is right: loose enough that a concurrent evaluator's run does not cry wolf, tight enough that real drift shows. | Only observable over weeks of real runs. | The ADR sets the threshold and how many slow runs count as a break; the retrospective reads the first runs' durations and records whether it fired falsely. |

## Notes

- A4–A12 replace the eight HTTP files assertion for assertion. A converted
  file is deleted only once every one of its assertions is a passing unit test
  shown to fail on its broken rule.
- A14 is the plan's real red from day one: it fails against today's tree,
  naming twelve files.
- The mcp suite's slow-without-waiting files (`workbench-split`) are not
  asserted on; A1 and the speed promise show whether they matter.
