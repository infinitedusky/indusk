---
name: an-app-writes-its-signal-from-a-helper-it-owns
kind: state
lifetime: holds
state: declared
domain: scaffold
owner: a-new-project-starts-instrumented
sites: []
tests: []
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
