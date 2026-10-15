---
title: "Tests and landing work from a cold machine — Test Plan"
date: 2026-10-15
status: accepted
---

# Tests and landing work from a cold machine — Test Plan

## Purpose

The assertions that, together, mean the browser template tests pass from a cold Vite cache and landing installs the landed build after a dependency change. Each names the smallest level of test that proves it.

## Behavioral Assertions

### `a-browser-test-passes-on-a-cold-cache` — The browser template tests pass on the first run after Vite's dependency cache is cleared, with no page reload partway through the run.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Every package the browser template imports is bundled for its test page before the page loads, so none is discovered while a test runs. | unit |
| A2 | The template tests, run three times, each from a deleted Vite cache, pass every time, and Vite never reports that it reloaded a test. | live check |

### `landing-installs-after-a-dependency-change` — Landing's install step brings the checkout's dependencies to the lockfile before it builds, so it installs the landed build even when the merge changed dependencies.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A3 | Landing's install step syncs the checkout's dependencies to the lockfile, refusing a lockfile that does not match, before it builds anything. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A4 | An evaluator run with a model that does not exist is recorded as a failure naming that model, and the promise status shows the violation, with the Claude Code installed today. | contract | keeps the day-monitor end-to-end test about the monitor, not about Claude Code's wording |

## Notes

- A1 reads the configuration the browser test project actually gets, not the root's: the root's list existed all along and was never seen by the project.
- A2 is the only way to show the reload is gone, since the reload depends on the cache's state. It is recorded once in the impl with its result.
