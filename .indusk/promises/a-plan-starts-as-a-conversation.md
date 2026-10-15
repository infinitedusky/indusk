---
name: a-plan-starts-as-a-conversation
kind: state
lifetime: holds
state: enforced
domain: admin
owner: brief-as-the-contract
sites:
  - 'apps/indusk-admin/src/app/api/drafts/[id]/accept/route.ts'
  - apps/indusk-admin/src/app/api/drafts/route.ts
  - 'apps/indusk-admin/src/app/p/[project]/draft/[id]/page.tsx'
  - apps/indusk-admin/src/components/drafts/DraftConversation.test.tsx
  - apps/indusk-admin/src/components/drafts/DraftConversation.tsx
  - apps/indusk-admin/src/components/drafts/DraftProposal.tsx
  - apps/indusk-admin/src/components/session/NewPlanForm.tsx
  - apps/indusk-mcp/src/__tests__/drafts-cli.test.ts
  - apps/indusk-mcp/src/__tests__/drafts-view.test.ts
  - apps/indusk-mcp/src/lib/drafts/start.ts
tests:
  - apps/indusk-admin/src/components/session/NewPlanForm.test.tsx
  - apps/indusk-mcp/src/__tests__/drafts.test.ts
  - apps/indusk-admin/src/components/drafts/DraftProposal.test.tsx
incidents: []
---

A person starts a plan by talking to the agent with nothing asked of them first, and the plan is named, once what it promises and how it looks are clear, by the agent's proposal and the person's acceptance.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A18, row A19, row A30.
