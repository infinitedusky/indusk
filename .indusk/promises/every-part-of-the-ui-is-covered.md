---
name: every-part-of-the-ui-is-covered
kind: state
lifetime: holds
state: enforced
domain: gates
owner: storybook-components
sites:
  - apps/indusk-mcp/src/lib/looks/coverage.ts
  - apps/indusk-mcp/src/lib/looks/markup.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
  - apps/indusk-mcp/src/__tests__/looks-cli.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx'
  - apps/indusk-mcp/src/lib/looks/coverage.test.ts
  - apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts
  - apps/indusk-mcp/src/lib/looks/approvals.test.ts
  - apps/indusk-mcp/src/lib/looks/check.test.ts
  - apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts
incidents: []
---

Every screen the app has, in each declared state, and every component it uses, in each state its mockups show, is covered by an approved mockup or an approved story; whatever is not is reported uncovered, never passed.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A10, row A11, row A12, row A13, row A34, row A35, row A36.
- 2026-10-12 — changed by storybook-components: components are covered by their stories. It read: "Every screen the app has, in each declared state, and every component it uses, is covered by an approved mockup; whatever is not is reported uncovered, never passed." Owned before by ui-promises; storybook-components takes it over.
- 2026-10-12 — links updated, confirmed for storybook-components: tests apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts, apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx, apps/indusk-mcp/src/lib/looks/coverage.test.ts, apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts, apps/indusk-mcp/src/lib/looks/approvals.test.ts, apps/indusk-mcp/src/lib/looks/check.test.ts, apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts; sites apps/indusk-mcp/src/lib/looks/coverage.ts, apps/indusk-mcp/src/lib/looks/markup.ts.
