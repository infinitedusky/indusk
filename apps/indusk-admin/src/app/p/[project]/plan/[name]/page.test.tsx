import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// Mock next/link — see PlanList.test.tsx for the canonical reason.
vi.mock("next/link", () => {
  function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return { default: MockLink, __esModule: true };
});

vi.mock("next/navigation", () => ({
  // LiveRefresh (the plan page's live wrapper) reads the router.
  useRouter: () => ({ refresh: () => {} }),
  __esModule: true,
  notFound: () => {
    throw new Error("not found");
  },
}));

// The same plan name exists in BOTH active and archive (a re-opened plan).
// The page's own lookup precedence is active-first (`active.find ??
// archived.find`); the subplan row's resolution must agree.
vi.mock("@/lib/planning-reader", () => ({
  __esModule: true,
  readActivePlans: async () => [
    {
      name: "parent",
      title: "Parent",
      description: null,
      status: "unknown",
      archived: false,
    },
    {
      name: "twin",
      title: "Twin",
      description: null,
      status: "in-progress",
      archived: false,
      impl: { frontmatter: { status: "in-progress" }, content: "" },
    },
  ],
  readArchivedPlans: async () => [
    {
      name: "twin",
      title: "Twin",
      description: null,
      status: "completed",
      archived: true,
    },
  ],
  readPlanHierarchy: () => ({
    parents: ["parent"],
    roadmap: [],
    subplans: { parent: ["twin"] },
    declaredTitles: {},
  }),
}));

// The plan page reads "holding N" through the promises reader (day-promises);
// the registry read hits node:fs, so every export the page imports is mocked.
vi.mock("@/lib/promises-reader", () => ({
  __esModule: true,
  readProjectPromises: () => ({ ok: false, missing: "/mock/.indusk/promises" }),
  registryOf: () => null,
  holdingCount: () => 0,
  holdingCounts: () => new Map(),
}));

// The plan page reads the live-refresh interval from the project reader.
vi.mock("@/lib/project-reader", () => ({
  __esModule: true,
  readAdminRefreshMs: () => 5000,
}));

vi.mock("@/lib/trust-reader", () => ({ projectTrusted: () => true }));
// What plans wait on and their recorded decisions (plan-cockpit Build Phase 6):
// the reader reaches the session manager and the history file; nothing waits here.
vi.mock("@/lib/decisions-reader", () => ({
  __esModule: true,
  readWaiting: async () => [],
  readPlanHistory: () => [],
}));

// The plan page's brief parts are read by the package from disk (node:fs), which
// the browser project cannot import; these pages have no brief to show.
vi.mock("@infinitedusky/indusk-mcp/plans/parts", () => ({
  readPlanParts: async (_root: string, plan: string) => ({
    plan,
    hasBrief: false,
    hasBriefFile: true,
    promises: [],
    expectations: [],
    looks: [],
    noLooks: null,
    amendments: [],
    amendmentsUnreadable: null,
    description: null,
    briefStatus: null,
  }),
}));
vi.mock("@infinitedusky/indusk-mcp/promises/standing", () => ({
  __esModule: true,
  readStanding: async () => [],
}));
vi.mock("@infinitedusky/indusk-mcp/promises/display", () => ({
  __esModule: true,
  promiseWords: (name: string) => name,
  planTitle: (_title: unknown, handle: string) => handle,
  readHealthNames: () => ({ planTitles: {}, planDates: {}, words: {} }),
}));
vi.mock("@/lib/registry-client", () => ({
  __esModule: true,
  getProjectPath: (name: string) =>
    name === "fixture-proj" ? "/mock/project" : null,
  projectPathExists: () => true,
}));

import PlanPage from "./page";

/**
 * T11 (detail half) — falsification hypothesis (dawn-ui-plan-grouping
 * Phase 4): when a subplan name exists both active and archived, the card
 * must resolve the ACTIVE copy — matching the page's own plan lookup. Red
 * at authoring: the resolution map spreads `[...active, ...archived]`, so
 * the archived copy overwrites the active one.
 */
describe("T11 — subplan rows resolve active over archived on a name collision", () => {
  it("shows the active copy's stage on the row", async () => {
    const element = await PlanPage({
      params: Promise.resolve({ project: "fixture-proj", name: "parent" }),
    });
    const { container } = await render(element as React.ReactElement);

    const card = container.querySelector(
      '[data-component="subplan-row"][href$="/plan/twin"]',
    );
    expect(card, "expected a row for the twin subplan").not.toBeNull();
    expect(card?.textContent).toContain("Building");
    expect(
      card?.textContent,
      "row must not show the archived copy's status",
    ).not.toContain("completed");
  });
});
