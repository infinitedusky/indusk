---
name: landing-installs-after-a-dependency-change
kind: state
lifetime: holds
state: enforced
domain: gates
owner: template-reload-on-cold-cache
sites:
  - package.json
tests:
  - apps/indusk-mcp/src/__tests__/install-local.test.ts
incidents: []
---

Landing's install step brings the checkout's dependencies to the lockfile before it builds, so it installs the landed build even when the merge changed dependencies.

## History
- 2026-10-15 — declared (template-reload-on-cold-cache), from its planning conversation.
- 2026-10-15 — enforced, confirmed for template-reload-on-cold-cache: proven by row A3.
