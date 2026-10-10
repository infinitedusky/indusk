---
title: "evaluator-waits-out-limits — Test Plan"
date: 2026-10-10
status: accepted
---

# evaluator-waits-out-limits — Test Plan

## Behavioral Assertions

### `a-limited-evaluation-waits` — an evaluation the model refuses for a rate or usage limit is not counted as a broken promise: its commit waits and is evaluated by a later commit's trigger once the limit allows.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A run whose model answers `api_error_status: 429` (rate limiting, or a weekly limit) marks no violation and leaves its commit waiting, recorded in the eval log as waiting, not as an error | unit |
| A2 | The next commit's trigger first evaluates every waiting commit; one that now scores leaves the queue, one refused again stays, and none is evaluated twice | unit |

### `a-prose-reply-is-asked-again` — when the evaluator answers without a scorecard, it is asked once more for the scorecard alone, and the run fails only if the second answer has none either.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A3 | A first answer of prose with no JSON, followed by a scorecard, ends with that scorecard and no violation | unit |
| A4 | Two answers with no scorecard end the run failed, the promise marked violated with the second answer as the reason | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A5 | A run that fails for any other reason (a CLI that is not installed, a model that does not exist) still marks the promise violated with its reason | unit | a regression guard over `every-commit-evaluated`: only limits and prose change |
