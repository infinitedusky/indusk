---
name: landing-and-release-name-the-projects-commands
kind: structure
lifetime: holds
state: enforced
domain: planning
owner: release-checks-run-once
sites:
  - apps/indusk-mcp/src/bin/commands/checks.ts
  - apps/indusk-mcp/src/lib/checks/steps.ts
tests:
  - apps/indusk-mcp/src/__tests__/steps-name-project-commands.test.ts
  - apps/indusk-mcp/src/__tests__/checks-show.test.ts
incidents: []
---

The landing and release steps name the commands a project declares in its config, never dusk's own paths.

## History
- 2026-10-08 — declared (release-checks-run-once), from its planning conversation.
- 2026-10-08 — enforced, confirmed for release-checks-run-once: proven by row A7, row A8, row A9.
