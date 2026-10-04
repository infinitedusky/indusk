---
name: every-commit-evaluated
kind: behaviour
lifetime: holds
state: enforced
domain: gates
owner: day-monitor
sites:
  - apps/indusk-mcp/src/lib/eval/otel.ts
tests:
  - apps/indusk-mcp/src/__tests__/monitor-mark.test.ts
incidents:
  - i-2026-10-03-every-commit-evaluated
expect_every: 1d
---

Every commit the evaluator is asked to score is scored: the run ends with a scorecard, not an error. Each evaluation marks its root span with this promise (`indusk.promise`, `indusk.promise.outcome`, and on failure the `indusk.promise.violated` event carrying the reason), so a run that fails — a model that does not exist, a CLI that is not installed, output that does not parse — is visible in the local Jaeger and read by `indusk promises status` like any application's broken promise.

## History
- 2026-09-18 — registered (day-monitor, Build Phase 1). Owner: `semantic-graph-eval`, whose ADR added the commit-triggered evaluator that "scores every commit" (2026-04-09); `agent-roles` later described the evaluator's role but did not make commits evaluated.
- 2026-10-03 — owner corrected to `day-monitor`. The promise was born in `day-monitor`, which registered it and wrote the marking its statement describes (`lib/eval/otel.ts`); `semantic-graph-eval` was only where scoring every commit was first decided, under a name for the retired semantic graph. Its first incident, `i-2026-10-03-every-commit-evaluated`, reopened that plan; the appended phase was undone and the incident reopens `day-monitor`. A correction of the record, not a supersession: nothing promised changed.
- 2026-10-03 — `i-2026-10-03-every-commit-evaluated` fixed (the scorecard extractor in 1.57.2, and the workspace trusted); seen upheld at 2026-10-03T05:56:48Z on the installed 1.57.2. Back to `enforced`.
- 2026-10-03 — `expect_every: 1d` (watcher-heartbeat): every commit marks this promise, so a day without a mark reads as needs attention — on a day with no commits too, which is the price of declaring it.
