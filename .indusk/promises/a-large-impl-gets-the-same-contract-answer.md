---
name: a-large-impl-gets-the-same-contract-answer
kind: state
lifetime: holds
state: enforced
domain: planning
owner: main-suite-green
sites:
  - apps/indusk-mcp/src/bin/commands/promises.ts
tests:
  - apps/indusk-mcp/src/__tests__/contract-stdin.test.ts
incidents: []
---

The contract check gives the same answer for an impl of any size every time it runs, so a large impl is never refused at random when it is written.

## History
- 2026-10-15 — declared (main-suite-green), from its planning conversation.
- 2026-10-15 — enforced, confirmed for main-suite-green: proven by row A1, row A13.
