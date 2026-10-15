---
title: "Browser template claims — Test Plan"
date: 2026-10-11
status: accepted
---

# Browser template claims — Test Plan

## Purpose

The behavioral assertions that, together, mean a propagation entry sends the
click's trace to the requests it names and to no others, and that the
documentation says only what the template does. Grouped by the promise in the
[brief](brief.md) they prove; each names the smallest level that proves it.

## Behavioral Assertions

### `a-propagation-entry-covers-what-it-names` — an entry sends the click's trace to the requests it names and to no others.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T1 | With an entry that names a path (`https://api.example.com/v1`), a request to `/v1/seats` carries the click's trace; a request to `/v2/seats` on the same origin, and one to `/v10/seats`, carry none. | unit |
| T2 | With a pattern entry that names a path (`https://*.dev.example.com/v1`), a request under `/v1` on a matching host carries the trace; a request under `/v2` on the same host carries none. | unit |
| T3 | With a pattern entry that spells out a default port (`https://*.dev.example.com:443`), a request to `https://plan-a.dev.example.com/api` carries the trace; with `:8443` named, a request to the `:8443` port carries it and one to the default port does not. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| T4 | A request made from a `.then()` callback, or a timer, in a click handler is not in the click's trace. | unit | a regression guard pinning the documented limit: the template has no async-aware context manager, so the documentation must not claim otherwise |
| T5 | The OpenTelemetry reference page and the otel skill do not say that a `.then()` chain, a timer or compiled-down async code follows the click. | unit | the falsified claim itself: the line in the reference page that said a `.then()` chain compiled below ES2017 follows the click |

## Untestable Assertions

None.

## Notes

- T1–T4 run in the templates' browser project (headless Chromium), beside the existing cases; T5 reads two files and runs in the everyday suite.
