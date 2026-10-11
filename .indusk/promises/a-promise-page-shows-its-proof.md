---
name: a-promise-page-shows-its-proof
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-cockpit
sites:
  - 'apps/indusk-admin/src/app/p/[project]/promises/[name]/page.tsx'
  - apps/indusk-admin/src/components/promise/PromiseProof.tsx
  - apps/indusk-mcp/src/lib/promises/proof.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx'
  - apps/indusk-mcp/src/lib/promises/proof.test.ts
incidents: []
---

Each promise has a page showing the tests that name it with their state, the marks it is watched by and how each was last seen, thirty days held and broken per source, and its dated history; when it is broken while every test passes, the page says the tests miss the case.

## History
- 2026-10-10 — declared (plan-cockpit), from its planning conversation.
- 2026-10-11 — enforced, confirmed for plan-cockpit: proven by row A24, row A25, row A26, row A27, row A28, row A29, row A42.
