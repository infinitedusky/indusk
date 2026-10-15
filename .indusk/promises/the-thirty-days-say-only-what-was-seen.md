---
name: the-thirty-days-say-only-what-was-seen
kind: state
lifetime: holds
state: enforced
domain: admin
owner: cockpit-audit-fixes
sites:
  - apps/indusk-mcp/src/lib/promises/standing.ts
tests:
  - apps/indusk-mcp/src/lib/promises/standing.test.ts
  - apps/indusk-mcp/src/lib/promises/proof.test.ts
incidents: []
---

A promise's thirty days count a day as held only when the promise was seen upheld that day and not broken, as broken when a violation was heard that day (under its current or any earlier name), and as neither when nobody was watching — and the dashboard and the promise page show the same days for the same promise, over the same thirty.

## History
- 2026-10-11 — declared (cockpit-audit-fixes), from its planning conversation.
- 2026-10-15 — enforced, confirmed for cockpit-audit-fixes: proven by row A1, row A2, row A3, row A4, row A5, row A6.
