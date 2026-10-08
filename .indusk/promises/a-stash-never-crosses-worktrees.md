---
name: a-stash-never-crosses-worktrees
kind: state
lifetime: holds
state: declared
domain: gates
owner: small-fixes
sites: []
tests: []
incidents: []
---

A bare `git stash` or `git stash pop` in a worktree is refused, naming the safe way (a temporary commit, or a tagged push applied by its sha).

## History
- 2026-10-08 — declared (small-fixes), from its planning conversation.
