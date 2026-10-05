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
];
