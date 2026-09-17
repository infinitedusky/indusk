import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

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

import { PlanList } from "./PlanList";

/**
 * admin-ui-phase-progress — A20.
 *
 * The sidebar draws no root node: the root master is read only for order, so
 * the parents sit at the top of the tree and unclaimed plans read as their
 * peers rather than as the root's leftover bucket. Authored RED in Test
 * Phase 1; Build Phase 6 adds one layer — a root node with the parents and
 * the unclaimed plans beneath it. A sub-plan declared under two parents
 * (Dawn's are declared under both the Dawn master and the Day master) renders
 * under both — two links, not a drift.
 */

function mockPlan(name: string, overrides: Partial<Plan> = {}): Plan {
  return { name, status: "draft", archived: false, ...overrides };
}

// `root` lands with Build Phase 6 (the reader returns the root master's
// declaration); widened through `unknown` so the type-check gate (A25) stays
// green while this row is red on its assertion, not on a compile error.
const grouping = {
  root: { name: "master", title: "InDusk Roadmap" },
  parents: ["dawn", "day"],
  roadmap: ["dawn", "day"],
  subplans: {
    dawn: ["dawn-verify", "dawn-workbench-execution"],
    day: ["dawn-workbench-execution", "admin-ui-phase-progress"],
  },
} as unknown as Parameters<typeof PlanList>[0]["grouping"];

const plans = [
  mockPlan("dawn"),
  mockPlan("day"),
  mockPlan("dawn-verify"),
  mockPlan("dawn-workbench-execution"),
  mockPlan("admin-ui-phase-progress"),
  mockPlan("midnight"),
];

describe("A20 — the sidebar draws the root", () => {
  it("one root node titled from the root master, with the parent groups and the unclaimed plans beneath it", async () => {
    const { container } = await render(
      <PlanList
        active={plans}
        archived={[]}
        masterOrder={[]}
        grouping={grouping}
      />,
    );
    const root = container.querySelector('[data-testid="plan-tree-root"]');
    expect(root, "no root node rendered").not.toBeNull();
    expect(root?.textContent).toContain("InDusk Roadmap");
    // Both parent groups sit inside the root, not beside it.
    const groups = root?.querySelectorAll('[data-testid^="plan-group-"]') ?? [];
    expect(
      Array.from(groups).map((g) => g.getAttribute("data-parent")),
    ).toEqual(["dawn", "day"]);
    // The unclaimed plan is the root's leftover bucket, inside the root.
    expect(root?.textContent).toContain("midnight");
  });

  it("a sub-plan declared under two parents appears under both", async () => {
    const { container } = await render(
      <PlanList
        active={plans}
        archived={[]}
        masterOrder={[]}
        grouping={grouping}
      />,
    );
    const links = container.querySelectorAll(
      'a[href$="/plan/dawn-workbench-execution"]',
    );
    expect(links).toHaveLength(2);
  });
});
