---
title: "Demo app template — Test Plan"
date: 2026-10-07
status: accepted
---

# Demo app template — Test Plan

## Purpose

The assertions that, together, mean the seat-holds example shows the promise
loop: a promise held, broken on cue, and seen broken. Each names the smallest
level of test that proves it. They are grouped by the promise in the brief
that they prove, and become the impl's Test Trajectory rows.

## Behavioral Assertions

### `the-demo-app-starts-with-its-promise-holding` — Copying the seat-holds example and running its start command gives a project that runs locally: a page for holding and booking seats, one promise already marked and tested, and that promise shown holding in the admin.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A seat that is held and not booked comes free when its hold window passes; a booked seat never comes free; a seat someone holds cannot be held by anyone else. | unit |
| A2 | Every time a held seat is released, the release is marked against the promise: held when the seat came free within its window, broken when it did not, with a symptom naming the seat and how late it was. | unit |
| A3 | A fresh copy of the example carries its one promise, and InDusk's registry check passes in it. | unit |
| A4 | Started with its start command, the example's marks reach the local telemetry daemon, and InDusk reports its promise holding. | contract |
| A5 | From a fresh copy: one command, the seat page opens, a seat is held, booked and released, and the admin shows the promise holding. | live check |

### `the-demo-break-is-caught-locally` — Turning on the seat-holds example's fault switch makes its promise show broken in the admin within seconds, with the span that broke it, and it stays broken after the switch is off, until the break is recorded and fixed.

Changed in the live check (Sandy, 2026-10-07): a promise that says "never" is broken by one violation however many held checks follow; it holds again only once the break is recorded and fixed.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | With the fault switch on, a held seat comes free late and its release is marked broken; with the switch off, releases are on time and marked held. | unit |
| A7 | With the switch on, InDusk reports the promise broken within ten seconds of the late release, naming the span; with it off again and releases on time, InDusk still reports the violation. | contract |
| A8 | The whole break in the admin, from opening the example to the promise showing broken with its span, in under two minutes; with the switch off, still broken. | live check |

### `everyday-tests-never-wait` — kept

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | The everyday suite still never starts the example, the telemetry daemon or a browser; tests that do are in the system tier. | unit |

### `the-deployed-demo-page-answers` — After the seat-holds example is deployed to Fly from its own config, its page answers at the deployed address.

A broad promise on purpose (Sandy, 2026-10-07): it covers an outcome that can break many ways. It is split into narrower promises only when a break shows it covers two outcomes. Moved to the example's own registry at Build Phase 4: the code that keeps it is the example's Dockerfile and `fly.toml`.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | Deployed to Fly from the example's own config, its page answers at the deployed address. | smoke |

## Notes

- The hold window is short in the demo (a few seconds, set by the example's configuration), so the break appears inside the two-minute expectation; the promise's sentence says "within its window", not a fixed 30 seconds.
- A1, A2 and A6 take the clock as an input (`lesson: code-that-decides-takes-its-clock-and-its-reads`), so the example's own rules are unit tests that never wait.
- A4 and A7 start the daemon, so they run in the system tier at landing and release.
