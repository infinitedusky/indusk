---
name: every-commit-evaluated
kind: behaviour
lifetime: holds
state: enforced
domain: gates
owner: semantic-graph-eval
sites:
  - apps/indusk-mcp/src/lib/eval/otel.ts
tests:
  - apps/indusk-mcp/src/__tests__/monitor-mark.test.ts
incidents: []
---

Every commit the evaluator is asked to score is scored: the run ends with a scorecard, not an error. Each evaluation marks its root span with this promise (`indusk.promise`, `indusk.promise.outcome`, and on failure the `indusk.promise.violated` event carrying the reason), so a run that fails — a model that does not exist, a CLI that is not installed, output that does not parse — is visible in the local Jaeger and read by `indusk promises status` like any application's broken promise.

## History
- 2026-09-18 — registered (day-monitor, Build Phase 1). Owner: `semantic-graph-eval`, whose ADR added the commit-triggered evaluator that "scores every commit" (2026-04-09); `agent-roles` later described the evaluator's role but did not make commits evaluated.
