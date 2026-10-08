---
name: indusk-leaves-main-clean
kind: state
lifetime: holds
state: enforced
domain: planning
owner: bookkeeping-lives-where-it-is-read
sites:
  - apps/indusk-mcp/hooks/_hook-paths.js
  - apps/indusk-mcp/src/__tests__/eval-home-command.test.ts
  - apps/indusk-mcp/src/lib/bookkeeping/migrate.ts
  - apps/indusk-mcp/src/lib/bookkeeping/notes.ts
  - apps/indusk-mcp/src/lib/bookkeeping/roots.ts
tests:
  - apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts
  - apps/indusk-mcp/src/lib/bookkeeping/home.test.ts
  - apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts
  - apps/indusk-mcp/src/__tests__/plans-land.test.ts
incidents: []
---

Nothing InDusk writes is left uncommitted in any checkout: notes people read, `current.md` and lessons, are committed to `main` when written, and machine state lives in one place per project, outside every checkout.

## History
- 2026-10-07 — declared (bookkeeping-lives-where-it-is-read), from its planning conversation.
- 2026-10-07 — enforced, confirmed for bookkeeping-lives-where-it-is-read: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A11.
- 2026-10-07 — links updated, confirmed for bookkeeping-lives-where-it-is-read: tests apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts, apps/indusk-mcp/src/lib/bookkeeping/home.test.ts, apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts, apps/indusk-mcp/src/__tests__/plans-land.test.ts; sites apps/indusk-mcp/hooks/_hook-paths.js, apps/indusk-mcp/src/lib/bookkeeping/migrate.ts, apps/indusk-mcp/src/lib/bookkeeping/notes.ts, apps/indusk-mcp/src/lib/bookkeeping/roots.ts.
- 2026-10-08 — links updated, confirmed for bookkeeping-lives-where-it-is-read: tests apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts, apps/indusk-mcp/src/lib/bookkeeping/home.test.ts, apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts, apps/indusk-mcp/src/__tests__/plans-land.test.ts; sites apps/indusk-mcp/hooks/_hook-paths.js, apps/indusk-mcp/src/__tests__/eval-home-command.test.ts, apps/indusk-mcp/src/lib/bookkeeping/migrate.ts, apps/indusk-mcp/src/lib/bookkeeping/notes.ts, apps/indusk-mcp/src/lib/bookkeeping/roots.ts.
