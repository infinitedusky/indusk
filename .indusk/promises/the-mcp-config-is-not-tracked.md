---
name: the-mcp-config-is-not-tracked
kind: structure
lifetime: holds
state: enforced
domain: scaffold
owner: untrack-mcp-json
sites: []
tests:
  - apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts
incidents: []
---

`.mcp.json` is not tracked in this repository, and the ignore rule that says so holds.

## History
- 2026-10-11 — declared (untrack-mcp-json), from its planning conversation.
- 2026-10-12 — enforced, confirmed for untrack-mcp-json: proven by row T1, row T2.
