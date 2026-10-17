---
name: a-mockup-is-approved-by-a-person
kind: state
lifetime: holds
state: enforced
domain: admin
owner: mockups-draw-components-as-stories
sites:
  - 'apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts'
  - 'apps/indusk-admin/src/app/api/looks/[app]/request.ts'
  - 'apps/indusk-admin/src/app/api/looks/[app]/unapprove/route.ts'
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-unapprove.test.tsx'
  - apps/indusk-admin/src/components/looks/ApproveMockup.tsx
  - apps/indusk-admin/src/components/looks/ApproveSelected.tsx
  - apps/indusk-admin/src/components/looks/SelectBox.tsx
  - apps/indusk-admin/src/components/looks/Unapprove.tsx
  - apps/indusk-admin/src/components/looks/shown.ts
  - apps/indusk-admin/src/components/looks/useLooksPost.ts
  - apps/indusk-mcp/hooks/looks-approval-guard.js
  - apps/indusk-mcp/src/__tests__/looks-component-content-approval.test.ts
  - apps/indusk-mcp/src/bin/commands/looks.ts
  - apps/indusk-mcp/src/lib/looks/approvals.ts
  - apps/indusk-mcp/src/lib/looks/approve.ts
tests:
  - apps/indusk-mcp/src/lib/looks/approvals.test.ts
  - apps/indusk-mcp/src/__tests__/looks-cli.test.ts
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-components.test.tsx'
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-approve-binding.test.tsx'
  - apps/indusk-mcp/src/lib/looks/stories.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx'
  - apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts
  - apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts
incidents: []
---

A mockup or a story, and the foundation and the app's element rules it is drawn under, becomes the reference only when a person approves it in the cockpit, and stops being one when a person takes the approval back there; an agent can draw and propose one and never approve it or take it back.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A1, row A2, row A3, row A4, row A28, row A29, row A30, row A33, row A35.
- 2026-10-12 — changed by storybook-components: stories are approved like mockups. It read: "A mockup, and the foundation it defines, becomes the reference only when a person approves it in the cockpit; an agent can draw and propose one and never approve it." Owned before by ui-promises; storybook-components takes it over.
- 2026-10-12 — changed by storybook-components: an approval made by mistake had no way back. It read: "A mockup or a story, and the foundation it is drawn on, becomes the reference only when a person approves it in the cockpit; an agent can draw and propose one and never approve it."
- 2026-10-12 — links updated, confirmed for storybook-components: tests apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks-components.test.tsx, apps/indusk-mcp/src/lib/looks/approvals.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks-approve-binding.test.tsx, apps/indusk-mcp/src/lib/looks/stories.test.ts, apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx, apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts, apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts; sites apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts, apps/indusk-admin/src/app/api/looks/[app]/request.ts, apps/indusk-admin/src/app/api/looks/[app]/unapprove/route.ts, apps/indusk-admin/src/app/p/[project]/looks/looks-unapprove.test.tsx, apps/indusk-admin/src/components/looks/ApproveMockup.tsx, apps/indusk-admin/src/components/looks/ApproveSelected.tsx, apps/indusk-admin/src/components/looks/SelectBox.tsx, apps/indusk-admin/src/components/looks/Unapprove.tsx, apps/indusk-admin/src/components/looks/shown.ts, apps/indusk-admin/src/components/looks/useLooksPost.ts, apps/indusk-mcp/hooks/looks-approval-guard.js, apps/indusk-mcp/src/bin/commands/looks.ts, apps/indusk-mcp/src/lib/looks/approvals.ts, apps/indusk-mcp/src/lib/looks/approve.ts.
- 2026-10-17 — changed by mockups-draw-components-as-stories: the cockpit now draws every look under the app's element rules, so a change to them changes what an approval shows. It read: "A mockup or a story, and the foundation it is drawn on, becomes the reference only when a person approves it in the cockpit, and stops being one when a person takes the approval back there; an agent can draw and propose one and never approve it or take it back." Owned before by storybook-components; mockups-draw-components-as-stories takes it over.
- 2026-10-17 — links updated, confirmed for mockups-draw-components-as-stories: tests apps/indusk-mcp/src/lib/looks/approvals.test.ts, apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks-components.test.tsx, apps/indusk-admin/src/app/p/[project]/looks/looks-approve-binding.test.tsx, apps/indusk-mcp/src/lib/looks/stories.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx, apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts, apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts; sites apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts, apps/indusk-admin/src/app/api/looks/[app]/request.ts, apps/indusk-admin/src/app/api/looks/[app]/unapprove/route.ts, apps/indusk-admin/src/app/p/[project]/looks/looks-unapprove.test.tsx, apps/indusk-admin/src/components/looks/ApproveMockup.tsx, apps/indusk-admin/src/components/looks/ApproveSelected.tsx, apps/indusk-admin/src/components/looks/SelectBox.tsx, apps/indusk-admin/src/components/looks/Unapprove.tsx, apps/indusk-admin/src/components/looks/shown.ts, apps/indusk-admin/src/components/looks/useLooksPost.ts, apps/indusk-mcp/hooks/looks-approval-guard.js, apps/indusk-mcp/src/__tests__/looks-component-content-approval.test.ts, apps/indusk-mcp/src/bin/commands/looks.ts, apps/indusk-mcp/src/lib/looks/approvals.ts, apps/indusk-mcp/src/lib/looks/approve.ts.
