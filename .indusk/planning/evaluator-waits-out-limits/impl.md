---
title: "evaluator-waits-out-limits"
date: 2026-10-10
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
falsification: skipped
falsification_reason: "A narrow bugfix in the evaluator's failure handling (Sandy, 2026-10-10: two small bugfix plans); its five rows cover both new paths and the unchanged one."
cleanup: skipped
cleanup_reason: "Changes stay inside evaluator-runner.ts and the eval-trigger hook's existing queue."
audit: skipped
audit_reason: "Its promises are narrow and each row tests one directly; the week-after expectation measures it in use."
---

# evaluator-waits-out-limits

## Goal

A limit refusal waits and is retried instead of breaking `every-commit-evaluated`; a prose reply is asked once more; the open incident is closed with its root cause.

## Scope

### In Scope
- `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts`: classify a limit refusal; the one retry for a reply with no scorecard.
- `apps/indusk-mcp/hooks/eval-trigger.js` and the queue it already drains (`eval/pending.jsonl`, `_pending-drain.js`): waiting commits, retried first by each commit's trigger.
- Closing `i-2026-10-05-every-commit-evaluated`.

### Out of Scope
- Predicting a limit's reset time.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A5 red | `runEvaluatorSync` with a fake `claude` command; the eval-trigger hook |
| Build Phase 1 | limit refusals wait; waiting commits retried first; one retry for prose | Test Phase 1's rows |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A run whose model answers `api_error_status: 429` (rate limiting, or a weekly limit) marks no violation and leaves its commit waiting, recorded in the eval log as waiting, not as an error | Test Phase 1 | Build Phase 1 | written | unit | promise: a-limited-evaluation-waits | apps/indusk-mcp/src/lib/eval/evaluator-limits.test.ts |
| A2 | The next commit's trigger first evaluates every waiting commit; one that now scores leaves the queue, one refused again stays, and none is evaluated twice | Test Phase 1 | Build Phase 1 | written | unit | promise: a-limited-evaluation-waits | apps/indusk-mcp/src/__tests__/eval-trigger-waiting.test.ts |
| A3 | A first answer of prose with no JSON, followed by a scorecard, ends with that scorecard and no violation | Test Phase 1 | Build Phase 1 | written | unit | promise: a-prose-reply-is-asked-again | apps/indusk-mcp/src/lib/eval/evaluator-limits.test.ts |
| A4 | Two answers with no scorecard end the run failed, the promise marked violated with the second answer as the reason | Test Phase 1 | Build Phase 1 | written | unit | promise: a-prose-reply-is-asked-again | apps/indusk-mcp/src/lib/eval/evaluator-limits.test.ts |
| A5 | A run that fails for any other reason (a CLI that is not installed, a model that does not exist) still marks the promise violated with its reason | Test Phase 1 | Test Phase 1 | passing | unit | promise: every-commit-evaluated | apps/indusk-mcp/src/lib/eval/evaluator-limits.test.ts |

## Checklist

### Test Phase 1: The five rows

**Tier**: med

- [x] Confirm this plan's worktree (`git worktree list` shows `plan/evaluator-waits-out-limits`)
- [x] A1, A3, A4, A5 in `src/lib/eval/evaluator-limits.test.ts`, driving `runEvaluatorSync` with a fake `claude` (a script on `PATH` or the runner's command seam — read `evaluator-runner.test.ts` for the existing pattern) that answers as each row needs, and reading the eval log and the promise mark (`otel.test.ts` shows how marks are observed)
- [x] A2 in `src/__tests__/eval-trigger-waiting.test.ts`, through the hook as `eval-trigger.test`s already run it, with `INDUSK_EVAL_CMD` standing in for the evaluator
- [x] Each red row fails on its own assertion, never a load error; A5 passes today (a regression guard); rows set `written`, A5 `passing`
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Regression Guards

- **A5** — today's behaviour for every other failure, which must not change; it passes the moment it is written.

#### Test Phase 1 Verification

- [x] A1, A2, A3, A4 are `written` and red on their assertions, A5 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/eval/evaluator-limits.test.ts src/__tests__/eval-trigger-waiting.test.ts`)

### Build Phase 1: Wait out limits, ask prose once more

**Tier**: med

- [ ] `evaluator-runner.ts`: a claude result with `api_error_status: 429`, or a limit message, is a **waiting** outcome — no violation mark, a `waiting` entry in the eval log, and the commit appended to the queue the hook drains, marked waiting
- [ ] `eval-trigger.js` (commit mode): before evaluating the new commit, retry the waiting commits once each; a scored one leaves the queue, a refused one stays; the drained-ledger rule (written before each spawn) keeps any commit from being evaluated twice
- [ ] `evaluator-runner.ts`: an answer with no scorecard is asked once more, in the same session, for "the scorecard JSON only"; a second answer without one fails the run with that answer as the reason
- [ ] After the fix is installed: `indusk promises fix i-2026-10-05-every-commit-evaluated`, its root cause written ("the model refused for rate limiting; a refusal now waits and is retried, evaluator-waits-out-limits"), and the promise back to `enforced`

#### Build Phase 1 Verification

- [ ] A1–A5 pass (the command above), plus `pnpm exec vitest related src/lib/eval/evaluator-runner.ts --run` and the hook tests; tsc and biome clean; `indusk promises check` passes after the incident is fixed

#### Build Phase 1 Context

- [ ] `apps/indusk-mcp/CLAUDE.md` (eval agent entry) or `hooks/CLAUDE.md`: a limit refusal is waiting, not failed, and is retried by the next commit's trigger; a reply with no scorecard is asked once more

#### Build Phase 1 Document

- [ ] The eval page under `apps/docs/src/` (find it: `grep -rl "evaluator" apps/docs/src/guide apps/docs/src/reference`): waiting commits and the one retry; changelog `### Fixed` under `## [Unreleased]`

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` | waiting outcome; one retry for prose |
| `apps/indusk-mcp/hooks/eval-trigger.js` (+ `_pending-drain.js`) | waiting commits retried first |
| `.indusk/promises/incidents/i-2026-10-05-every-commit-evaluated.md` | fixed, with its root cause |

## Dependencies

- None.

## Notes

- A refusal returns in about half a second, so retrying waiting commits on every commit is cheap; no reset-time parsing.
