---
name: the-deployed-demo-page-answers
kind: state
lifetime: holds
state: enforced
domain: seats
owner: seat-holds
sites:
  - Dockerfile
  - fly.toml
tests:
  - scripts/smoke-deployed.mjs
incidents: []
---

After the seat-holds example is deployed to Fly from its own config, its page answers at the deployed address.

## History
- 2026-10-07 — shipped with the seat-holds example (InDusk demo-app-template), enforced: `npm run smoke` against the deployed address proves it, at every deploy.
