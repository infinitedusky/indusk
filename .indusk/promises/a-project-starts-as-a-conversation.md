---
name: a-project-starts-as-a-conversation
kind: state
lifetime: holds
state: enforced
domain: admin
owner: new-project-flow
sites:
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/talk/route.ts'
  - apps/indusk-admin/src/app/api/new-projects/route.ts
  - 'apps/indusk-admin/src/app/new/[id]/page.tsx'
  - apps/indusk-admin/src/app/new/page.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectConversation.test.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectConversation.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectProposal.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectProposalPanel.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectStart.tsx
  - apps/indusk-admin/src/lib/new-project-session.ts
  - apps/indusk-mcp/src/lib/new-project/knowledge.test.ts
tests:
  - apps/indusk-admin/src/components/new-project/NewProjectStart.test.tsx
  - apps/indusk-admin/src/__tests__/new-project-routes.test.ts
  - apps/indusk-admin/src/components/new-project/NewProjectProposal.test.tsx
incidents: []
---

A person starts a new project from the admin by describing it, and may add documents for the agent to write the brief from, with nothing asked of them first; the agent starts at once and proposes its name, location and shape for the person to accept.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — changed by new-project-flow: Start launches the agent; the person asked for it to begin without a second click (2026-10-14). It read: "A person starts a new project from the admin by describing it, and may add documents for the agent to write the brief from, with nothing asked of them first; the agent proposes its name, location and shape for the person to accept."
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A1, row A2, row A3, row A28.
