---
name: mockups-render-in-the-cockpit
kind: state
lifetime: holds
state: known-broken
domain: admin
owner: storybook-components
sites:
  - 'apps/indusk-admin/src/app/p/[project]/looks/page.tsx'
  - apps/indusk-admin/src/components/looks/Cascade.tsx
  - apps/indusk-admin/src/components/looks/Looks.tsx
  - apps/indusk-admin/src/components/looks/Stories.tsx
  - apps/indusk-mcp/src/lib/looks/component-styles.test.ts
  - apps/indusk-mcp/src/lib/looks/component-styles.ts
  - apps/indusk-mcp/src/lib/looks/overview.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts'
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
  - apps/indusk-admin/src/__tests__/composition.contract.test.ts
  - apps/indusk-mcp/src/lib/looks/stories.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx'
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts'
incidents:
  - i-2026-10-16-mockups-render-in-the-cockpit
---

Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens and, where it names components, with those components' own styles, with nothing to run beside the cockpit.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A14, row A15, row A16.
- 2026-10-12 — changed by storybook-components: stories render in the cockpit from the Storybook it serves. It read: "Each mockup opens in the cockpit at each reference device, drawn with the foundation's tokens." Owned before by ui-promises; storybook-components takes it over.
- 2026-10-12 — changed by storybook-components: composed mockups drew their components unstyled. It read: "Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens, with nothing to run beside the cockpit."
- 2026-10-12 — links updated, confirmed for storybook-components: tests apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts, apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts, apps/indusk-admin/src/__tests__/composition.contract.test.ts, apps/indusk-mcp/src/lib/looks/stories.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx, apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts; sites apps/indusk-admin/src/app/p/[project]/looks/page.tsx, apps/indusk-admin/src/components/looks/Cascade.tsx, apps/indusk-admin/src/components/looks/Looks.tsx, apps/indusk-admin/src/components/looks/Stories.tsx, apps/indusk-mcp/src/lib/looks/component-styles.test.ts, apps/indusk-mcp/src/lib/looks/component-styles.ts, apps/indusk-mcp/src/lib/looks/overview.ts.
