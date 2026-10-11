---
name: a-propagation-entry-covers-what-it-names
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: browser-template-claims
sites:
  - apps/indusk-mcp/templates/instrumentation.web.ts
tests:
  - apps/indusk-mcp/templates/instrumentation.web.test.ts
incidents: []
---

An entry in the browser template's propagation setting sends the click's trace to the requests it names and to no others: an entry with a path covers that path and what is under it, an entry with a default port matches a request whose URL leaves the port off, and an exact entry and a pattern entry treat both the same way.

## History
- 2026-10-11 — declared (browser-template-claims), from its planning conversation.
- 2026-10-11 — enforced, confirmed for browser-template-claims: proven by row T1, row T2, row T3, row T6, row T8.
