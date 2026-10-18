---
name: a-look-check-runs-what-changed
kind: state
lifetime: holds
state: enforced
domain: admin
owner: tests-never-make-us-wait
sites:
  - apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts
  - apps/indusk-mcp/src/__tests__/looks-check-timeout.test.ts
  - apps/indusk-mcp/src/bin/commands/looks.ts
  - apps/indusk-mcp/src/lib/looks/check-run.test.ts
  - apps/indusk-mcp/src/lib/looks/dev-server.test.ts
  - apps/indusk-mcp/src/lib/looks/dev-server.ts
  - apps/indusk-mcp/src/lib/looks/reuse-run.ts
  - apps/indusk-mcp/src/lib/looks/reuse.test.ts
  - apps/indusk-mcp/src/lib/looks/reuse.ts
  - apps/indusk-mcp/src/lib/looks/touched-closures.test.ts
  - apps/indusk-mcp/src/lib/looks/touched.ts
  - apps/indusk-mcp/src/lib/promises/look-standing.test.ts
tests:
  - apps/indusk-mcp/src/lib/looks/touched.test.ts
  - apps/indusk-mcp/src/lib/looks/reuse-run.test.ts
incidents: []
clauses:
  - name: the-changed-looks
    kind: split
    statement: "A change to an app's interface checks the looks drawn from the files it changed, on the devices those looks are drawn for."
  - name: no-other-look
    kind: limit
    statement: "A look the change did not touch is not checked while the plan is built."
supersedes: a-look-check-costs-what-changed
---

A visual test checks only the looks a change touched.

## History
- 2026-10-18 — declared (tests-never-make-us-wait), from its planning conversation.
- 2026-10-18 — recorded as replacing `a-look-check-costs-what-changed`, which is retired when tests-never-make-us-wait closes.
- 2026-10-18 — enforced, confirmed for tests-never-make-us-wait: proven by row T8, row T9, row T10, row T11, row T12, row T18.
