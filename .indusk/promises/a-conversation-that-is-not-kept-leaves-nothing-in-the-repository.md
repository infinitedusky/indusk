---
name: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
kind: state
lifetime: holds
state: enforced
domain: admin
owner: brief-as-the-contract
sites:
  - 'apps/indusk-admin/src/app/api/drafts/[id]/discard/route.ts'
  - 'apps/indusk-admin/src/app/api/drafts/[id]/talk/route.ts'
  - apps/indusk-admin/src/components/drafts/DraftList.test.tsx
  - apps/indusk-admin/src/components/drafts/DraftList.tsx
  - apps/indusk-mcp/src/lib/drafts/store.ts
  - apps/indusk-mcp/src/lib/session/draft.test.ts
  - apps/indusk-mcp/src/lib/session/draft.ts
tests:
  - apps/indusk-mcp/src/__tests__/drafts.test.ts
  - apps/indusk-mcp/src/lib/session/permissions.test.ts
  - apps/indusk-mcp/src/lib/session/protocol.test.ts
  - apps/indusk-mcp/src/__tests__/drafts-age.test.ts
incidents: []
---

A conversation that has not become a plan is held only outside the repository, as a draft a person can reopen or discard, and accepting its name makes it a plan — with a brief when it makes promises or looks, with research alone when it does not.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A20, row A21, row A26, row A36.
