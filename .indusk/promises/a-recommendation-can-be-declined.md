---
name: a-recommendation-can-be-declined
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: new-project-flow
sites:
  - apps/indusk-mcp/src/lib/new-project/create.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
incidents: []
---

Every practice the agent recommends — a docs site, telemetry, deployment, a remote repository — can be declined, and a declined one is recorded in the project's config with the person's reason.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A10, row A41.
