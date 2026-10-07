---
name: a-project-has-one-contract
kind: state
lifetime: holds
state: enforced
domain: planning
owner: workbench-plan-authoring
sites:
  - apps/indusk-mcp/src/lib/promises/registry.ts
tests:
  - apps/indusk-mcp/src/__tests__/contract-resolver.test.ts
  - apps/indusk-mcp/src/__tests__/plans-workbench.test.ts
incidents: []
---

A repo's promises are read and written in one place: the repo's own `.indusk/promises/` once it holds one, otherwise the workbench's shadow contract. Every reader goes through the same resolver: the plan commands, the registry check, the watcher and the admin. A promise is never read from both.

## History
- 2026-10-06 — declared (workbench-plan-authoring), from its planning conversation.
- 2026-10-07 — enforced, confirmed for workbench-plan-authoring: proven by row A4, row A5, row A6, row A7, row A8.
