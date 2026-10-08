---
name: a-stash-never-crosses-worktrees
kind: state
lifetime: holds
state: enforced
domain: gates
owner: small-fixes
sites:
  - apps/indusk-mcp/hooks/stash-guard.js
tests:
  - apps/indusk-mcp/src/__tests__/stash-guard.test.ts
incidents: []
---

A bare `git stash` or `git stash pop` in a worktree is refused, naming the safe way (a temporary commit, or a tagged push applied by its sha).

## History
- 2026-10-08 — declared (small-fixes), from its planning conversation.
- 2026-10-08 — enforced, confirmed for small-fixes: proven by row A9, row A10, row A20.
