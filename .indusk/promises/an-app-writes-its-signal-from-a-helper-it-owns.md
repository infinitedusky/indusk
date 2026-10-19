---
name: an-app-writes-its-signal-from-a-helper-it-owns
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: a-new-project-starts-instrumented
sites:
  - apps/indusk-mcp/src/lib/promises/vocabulary.ts
tests:
  - apps/indusk-mcp/src/__tests__/signal-vocabulary-pin.test.ts
  - apps/indusk-mcp/src/__tests__/signal-helper.test.ts
  - apps/indusk-mcp/src/__tests__/signal-helper-daemon.contract.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-settings.test.ts
incidents: []
clauses:
  - name: one-vocabulary
    kind: limit
    statement: "The keys a signal carries are defined once, in the package's vocabulary; the helper is pinned to it, and a key changed in one and not the other is refused."
  - name: a-signal-names-its-promise-and-clause
    kind: split
    statement: "The helper writes a promise, an optional clause, upheld or broken, a symptom when broken, an optional measured value and bound, and, when given, the plan and phase that added it."
  - name: a-test-run-says-so
    kind: split
    statement: "Every span a project's test run makes carries the test-run marker."
---

A scaffolded project carries a small signal helper it owns, with no InDusk dependency, that writes a promise's or a clause's signal in the one vocabulary every InDusk reader reads.

## History
- 2026-10-16 — declared (a-new-project-starts-instrumented), from its planning conversation.
- 2026-10-17 — enforced, confirmed for a-new-project-starts-instrumented: proven by row T12, row T13, row T14, row T15.
