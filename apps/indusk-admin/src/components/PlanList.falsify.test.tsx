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
 * T11 + T13 — falsification hypotheses against the grouped sidebar
 * (dawn-ui-plan-grouping Phase 4).
 *
 * T11: a subplan whose folder lives in archive/ is a real, finished plan —
 * it must render as a navigable item with its real status, never as a
 * "queued" placeholder. Red at authoring: buildGroups resolves children
 * against active plans only, so an archived child falls through to the
 * placeholder branch.
 *
 * T13: with two or more parents, groups must follow the roadmap's declared
 * order. Red at authoring: buildGroups iterates the subplans object in
 * parser-insertion order.
 */

function mockPlan(name: string, overrides: Partial<Plan> = {}): Plan {
  return {
    name,
    status: "draft",
    archived: false,
    ...overrides,
  };
}

describe("T11 — an archived subplan is not a placeholder", () => {
  it("renders a child whose folder lives in archive/ as a navigable item with its real status", async () => {
    const grouping = {
      parents: ["parent"],
      roadmap: ["parent"],
      subplans: { parent: ["done-child"] },
    };
    const { container } = await render(
      <PlanList
        active={[mockPlan("parent")]}
        archived={[
          mockPlan("done-child", { status: "completed", archived: true }),
        ]}
        masterOrder={[]}
        grouping={grouping}
      />,
    );

    const group = container.querySelector('[data-testid="plan-group-parent"]');
    expect(group, "expected the parent group to render").not.toBeNull();

    const link = group?.querySelector('a[data-plan-name="done-child"]');
    expect(
      link,
      "archived subplan must render as a link in the group",
    ).not.toBeNull();
    expect(link?.textContent).toContain("completed");

    expect(
      group?.querySelector('[data-testid="plan-placeholder-done-child"]'),
      "archived subplan must not render as a queued placeholder",
    ).toBeNull();
  });
});

describe("T13 — sidebar groups follow roadmap order", () => {
  it("renders groups in the roadmap's declared order, not declaration-iteration order", async () => {
    const grouping = {
      // Iteration order puts parent-b first; the roadmap declares parent-a first.
      parents: ["parent-b", "parent-a"],
      roadmap: ["parent-a", "parent-b"],
      subplans: { "parent-b": ["child-b"], "parent-a": ["child-a"] },
    };
    const { container } = await render(
      <PlanList
        active={[
          mockPlan("parent-a"),
          mockPlan("parent-b"),
          mockPlan("child-a"),
          mockPlan("child-b"),
        ]}
        archived={[]}
        masterOrder={grouping.roadmap}
        grouping={grouping}
      />,
    );

    const groups = Array.from(
      container.querySelectorAll('[data-testid^="plan-group-"]'),
    ).map((el) => el.getAttribute("data-testid"));
    expect(groups).toEqual(["plan-group-parent-a", "plan-group-parent-b"]);
  });
});
