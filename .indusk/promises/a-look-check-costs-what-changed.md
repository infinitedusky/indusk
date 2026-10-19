---
name: a-look-check-costs-what-changed
kind: state
lifetime: holds
state: retired
domain: admin
owner: looks-check-speed
sites:
  - apps/indusk-mcp/src/lib/looks/dev-server.ts
  - apps/indusk-mcp/src/lib/looks/reuse.ts
tests:
  - apps/indusk-mcp/src/lib/looks/check-run.test.ts
  - apps/indusk-mcp/src/lib/looks/reuse.test.ts
  - apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts
  - apps/indusk-mcp/src/lib/looks/dev-server.test.ts
  - apps/indusk-mcp/src/__tests__/looks-check-timeout.test.ts
  - apps/indusk-mcp/src/lib/promises/look-standing.test.ts
incidents: []
---

A look check takes time in proportion to what changed, not to how many looks there are.

## History
- 2026-10-16 — declared (looks-check-speed), from its planning conversation.
- 2026-10-16 — enforced, confirmed for looks-check-speed: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A7, row A8, row A9, row A10, row A11, row A12, row A13, row A14, row A15, row A16, row A17, row A18, row A19, row A25, row A28, row A29, row A33, row A34, row A35, row A38, row A39.
- 2026-10-18 — retired, confirmed for tests-never-make-us-wait: replaced by `a-look-check-runs-what-changed`.
