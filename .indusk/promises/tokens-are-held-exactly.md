---
name: tokens-are-held-exactly
kind: state
lifetime: holds
state: enforced
domain: gates
owner: ui-promises
sites:
  - apps/indusk-mcp/src/lib/looks/check.ts
  - apps/indusk-mcp/src/lib/looks/verdict.ts
tests:
  - apps/indusk-mcp/src/lib/looks/verdict.test.ts
  - apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts
incidents: []
---

Every element in the running app that claims a token, including a duration or an easing, renders with the value the approved foundation gives it; a mismatch names the element, the token, and the approved and actual values.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A17, row A18, row A19, row A20, row A37.
