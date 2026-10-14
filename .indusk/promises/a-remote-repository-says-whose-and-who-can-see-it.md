---
name: a-remote-repository-says-whose-and-who-can-see-it
kind: state
lifetime: holds
state: enforced
domain: admin
owner: new-project-flow
sites:
  - apps/indusk-admin/src/components/new-project/GithubOffer.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectProposal.tsx
  - apps/indusk-mcp/src/lib/new-project/github.test.ts
  - apps/indusk-mcp/src/lib/new-project/github.ts
tests:
  - apps/indusk-admin/src/components/new-project/NewProjectProposal.test.tsx
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
incidents: []
---

The offer to create a GitHub repository names the account it will be made under, or says to sign in first and cannot be taken, and makes it private unless the person chooses public.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A43, row A44.
