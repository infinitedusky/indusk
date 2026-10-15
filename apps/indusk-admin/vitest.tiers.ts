/**
 * The admin's two test tiers (test-kinds, ADR D4).
 *
 * `pnpm test` is the everyday suite: rules, in seconds, at every phase.
 * SYSTEM is every file that starts `next dev` or a real Jaeger — what the page
 * draws from a running server, a contract with Next and Jaeger. It runs in
 * `pnpm test:system`, at landing and on release, one file at a time (`next
 * dev` boots starve each other in parallel).
 *
 * A file that starts a server belongs here, or `everyday-tests-never-wait`
 * (apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts) fails it.
 */
export const SYSTEM = [
  // The Promises page against a real Jaeger: strips, bands, chips per source,
  // the sidebar's red, banners. Their rules are unit tests
  // (src/lib/__tests__/promise-store, promise-health); these check the page
  // draws what the rules decide.
  "src/__tests__/http-promise-health.test.ts",
  "src/__tests__/http-promise-remote.test.ts",
  "src/__tests__/http-promise-sources.test.ts",
  "src/__tests__/http-promise-timeline-sources.test.ts",
  "src/__tests__/http-promise-timeline.test.ts",
  "src/__tests__/http-watcher-blind.test.ts",
  // Pages over plan documents.
  "src/__tests__/http-plan-worktrees.test.ts",
  "src/__tests__/http-project-promises.test.ts",
  "src/__tests__/http-project-research.test.ts",
  "src/__tests__/http-project-scorecards.test.ts",
  "src/__tests__/http-smoke.test.ts",
  "src/__tests__/http-stale-project.test.ts",
  "src/__tests__/live-refresh.e2e.test.ts",
  // The Looks page's mockup frame in Chromium (ui-promises A15, A16).
  "src/app/p/[project]/looks/looks-browser.contract.test.ts",
  // Storybook in Chromium, and the catalog the render step writes
  // (storybook-components A5, A13).
  "src/__tests__/storybook.contract.test.ts",
  // Components in the cockpit (storybook-components A7, A18, A19): a composed
  // mockup and the stories framed from the served /storybook, and the value
  // check over the stories, in Chromium.
  "src/app/p/[project]/looks/looks-components.contract.test.ts",
  "src/__tests__/storybook-held.contract.test.ts",
  // A composed mockup draws each component as its story does (storybook-
  // components A30): computed values compared in Chromium, mockup against story.
  "src/__tests__/composition.contract.test.ts",
  // A look the agent draws appears on the open plan page, at each device
  // (brief-as-the-contract A16).
  "src/__tests__/plan-parts.contract.test.ts",
  // The screens cockpit-redraw names read approved and are held by value at
  // each reference device (cockpit-redraw A10).
  "src/__tests__/cockpit-redraw.contract.test.ts",
  // The master plan page, the retitled plan and nav screens and the
  // subplan-row stories read approved and are held by value (plan-stories A6).
  "src/__tests__/plan-stories.contract.test.ts",
];

/**
 * Vitest projects that belong to the system tier: they render in Chromium
 * against a built Storybook and are never part of `pnpm test`
 * (storybook-components A21; `everyday-tests-never-wait.test.ts` reads this
 * list and the everyday config). `vitest.system.config.ts` raises
 * `SYSTEM_TIER_ENV`, which is what lets `vitest.config.ts` define them for a
 * run the system tier started (A5 spawns `vitest run --project storybook`).
 */
export const SYSTEM_PROJECTS = ["storybook"];
export const SYSTEM_TIER_ENV = "INDUSK_ADMIN_SYSTEM_TIER";

/**
 * Page tests that run in the node project, not the browser one: they read and
 * write a real project through the package (the Looks page and its Approve,
 * ui-promises A1, A2, A13, A14, and A29, A30 in the approve route's own file), which a browser cannot reach.
 */
export const NODE_PAGES = [
  "src/app/p/[project]/looks/looks.test.tsx",
  "src/app/p/[project]/looks/looks-approve-binding.test.tsx",
  "src/app/p/[project]/looks/looks-components.test.tsx",
  "src/app/p/[project]/looks/looks-unapprove.test.tsx",
  // A plan's page over a real project (brief-as-the-contract A5, A15).
  "src/__tests__/plan-parts.test.tsx",
  // The approved layout of the plan page and its document route.
  "src/__tests__/plan-page-layout.test.tsx",
];

/**
 * A listed path as a glob: `[project]` is a route folder, not a character
 * class, so its brackets are escaped before vitest matches with them.
 */
export const asGlob = (file: string): string => file.replace(/[[\]]/g, "\\$&");
