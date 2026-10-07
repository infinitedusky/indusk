---
name: a-highlight-becomes-a-lesson-once
kind: state
lifetime: holds
state: enforced
domain: planning
owner: bookkeeping-lives-where-it-is-read
sites:
  - apps/indusk-mcp/src/lib/highlights/highlights.ts
tests:
  - apps/indusk-mcp/src/lib/bookkeeping/home.test.ts
  - apps/indusk-mcp/e2e/eval-bookkeeping.e2e.test.ts
  - apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts
incidents: []
---

A highlight is turned into a lesson at most once per project, whichever checkout the evaluator runs in.

## History
- 2026-10-07 — declared (bookkeeping-lives-where-it-is-read), from its planning conversation.
- 2026-10-07 — enforced, confirmed for bookkeeping-lives-where-it-is-read: proven by row A7, row A8.
- 2026-10-07 — links updated, confirmed for bookkeeping-lives-where-it-is-read: tests apps/indusk-mcp/src/lib/bookkeeping/home.test.ts, apps/indusk-mcp/e2e/eval-bookkeeping.e2e.test.ts, apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts; sites apps/indusk-mcp/src/lib/highlights/highlights.ts.
