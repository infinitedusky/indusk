---
name: the-everyday-suite-passes-on-main
kind: state
lifetime: holds
state: enforced
domain: gates
owner: main-suite-green
sites:
  - apps/indusk-mcp/vitest.config.ts
  - apps/indusk-mcp/vitest.templates.config.ts
tests:
  - apps/indusk-mcp/src/__tests__/impl-corpus.test.ts
  - apps/indusk-mcp/src/__tests__/always-on-cleanup.test.ts
  - apps/indusk-mcp/src/__tests__/plan-worktrees-cli.test.ts
  - apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts
  - apps/indusk-mcp/src/lib/promises/inbox.test.ts
  - apps/indusk-admin/src/__tests__/new-project-accept.test.ts
  - apps/indusk-admin/src/__tests__/new-project-accept-route.test.ts
  - apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts
  - apps/indusk-mcp/src/__tests__/contract-stdin.test.ts
incidents: []
---

pnpm test, run from the root of a clean main with every package at once, passes.

## History
- 2026-10-15 — declared (main-suite-green), from its planning conversation.
- 2026-10-15 — enforced, confirmed for main-suite-green: proven by row A2, row A3, row A4, row A5, row A6, row A7, row A8, row A13.
