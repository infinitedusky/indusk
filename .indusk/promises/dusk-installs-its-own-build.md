---
name: dusk-installs-its-own-build
kind: state
lifetime: holds
state: enforced
domain: gates
owner: small-fixes
sites:
  - apps/indusk-mcp/src/lib/checks/steps.ts
  - apps/indusk-mcp/src/lib/plans/land.ts
tests:
  - apps/indusk-mcp/src/__tests__/checks-show.test.ts
  - apps/indusk-mcp/src/__tests__/release-script.test.ts
  - apps/indusk-mcp/src/lib/plans/land-own-worktree.test.ts
incidents: []
---

After a plan lands, this machine's `indusk` is the landed build, installed from the checkout without a publish; publishing is a deliberate act that runs the full slow tests first.

## History
- 2026-10-08 — declared (small-fixes), from its planning conversation.
- 2026-10-08 — enforced, confirmed for small-fixes: proven by row A2, row A3, row A21.
