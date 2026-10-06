---
name: nothing-ships-until-accepted
kind: state
lifetime: holds
state: enforced
domain: planning
owner: admin-plan-authoring
sites:
  - apps/indusk-mcp/src/lib/build/release-config.test.ts
  - apps/indusk-mcp/src/lib/build/step-env.ts
  - apps/indusk-mcp/src/lib/plans/land.ts
  - apps/indusk-mcp/src/lib/session/hosts.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-land.test.ts
  - apps/indusk-mcp/src/lib/build/runner.test.ts
  - apps/indusk-mcp/src/__tests__/plans-approve.test.ts
  - apps/indusk-admin/src/lib/admin-hosts.test.ts
  - apps/indusk-mcp/src/lib/build/build-session.test.ts
incidents: []
---

A plan's build does not merge to `main`, publish or deploy until it is accepted, by the person or by a workflow set to accept automatically; then the release workflow runs the retrospective, the merge and the rest of the release.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A18, row A19, row A20.
- 2026-10-06 — links updated, confirmed for admin-plan-authoring: tests apps/indusk-mcp/src/__tests__/plans-land.test.ts, apps/indusk-mcp/src/lib/build/runner.test.ts, apps/indusk-mcp/src/__tests__/plans-approve.test.ts, apps/indusk-admin/src/lib/admin-hosts.test.ts, apps/indusk-mcp/src/lib/build/build-session.test.ts; sites apps/indusk-mcp/src/lib/build/release-config.test.ts, apps/indusk-mcp/src/lib/build/step-env.ts, apps/indusk-mcp/src/lib/plans/land.ts, apps/indusk-mcp/src/lib/session/hosts.ts.
