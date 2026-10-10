---
title: "evaluator-waits-out-limits"
date: 2026-10-10
status: draft
workflow: bugfix
---

# evaluator-waits-out-limits — Brief

`every-commit-evaluated` has been red since 2026-10-03, and every break has one of two causes, neither a fault in the commit:

- **The model refused the call for a limit.** The open incident `i-2026-10-05-every-commit-evaluated` holds 11 evaluations answered `api_error_status: 429 … Server is temporarily limiting requests`; two more on 2026-10-09 were `429 … You've hit your weekly limit · resets Oct 13`. The commit was never scored, and the run counted as a broken promise.
- **The model answered in prose.** On 2026-10-09 17:46 UTC the reply was `Noted — th…`: no JSON at all, so the scorecard extractor (which already tolerates prose around JSON) found nothing, and `JSON.parse` failed. The evaluator resumes a session, and a resumed session can answer conversationally.

## Expectations

1. **`every-commit-evaluated` stays green on days the model is reachable.**
   - Measure: its violations in `indusk promises status` over the week after landing; a violation that is a 429 or a prose reply is this plan failing.
   - Look: a week after landing.

## Promises

### This plan makes

1. **`a-limited-evaluation-waits`** (state). An evaluation the model refuses for a rate or usage limit is not counted as a broken promise: its commit waits and is evaluated by a later commit's trigger once the limit allows.

2. **`a-prose-reply-is-asked-again`** (state). When the evaluator answers without a scorecard, it is asked once more for the scorecard alone, and the run fails only if the second answer has none either.

### Existing promises

**Must not break**

- **`every-commit-evaluated`**. A commit that waited is still evaluated, and one that truly fails still marks the promise violated with its reason.

**Changes**

None.

**Replaces**

None.

### Not promised

- Predicting when a weekly limit resets: the next commit's trigger simply tries again; a refusal costs half a second.

## Depends On

- None.

## Blocks

- None.
