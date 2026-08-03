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
  __esModule: true,
  notFound: () => {
    throw new Error("not found");
  },
}));

// The same plan name exists in BOTH active and archive (a re-opened plan).
// The page's own lookup precedence is active-first (`active.find ??
// archived.find`); the subplan-card resolution must agree.
vi.mock("@/lib/planning-reader", () => ({
  __esModule: true,
  readActivePlans: async () => [
    { name: "parent", status: "unknown", archived: false },
    {
      name: "twin",
      status: "in-progress",
      archived: false,
      impl: { frontmatter: { status: "in-progress" }, content: "" },
    },
  ],
  readArchivedPlans: async () => [
    { name: "twin", status: "completed", archived: true },
  ],
  readPlanHierarchy: () => ({
    parents: ["parent"],
    roadmap: [],
    subplans: { parent: ["twin"] },
  }),
  readPlanMasterContent: async () => null,
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
describe("T11 — subplan cards resolve active over archived on a name collision", () => {
  it("shows the active copy's status on the card", async () => {
    const element = await PlanPage({
      params: Promise.resolve({ project: "fixture-proj", name: "parent" }),
    });
    const { container } = await render(element as React.ReactElement);

    const card = container.querySelector('[data-testid="subplan-card-twin"]');
    expect(card, "expected a card for the twin subplan").not.toBeNull();
    expect(card?.textContent).toContain("in-progress");
    expect(
      card?.textContent,
      "card must not show the archived copy's status",
    ).not.toContain("completed");
  });
});
