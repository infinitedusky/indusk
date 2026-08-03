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
 * T1–T5 — the grouped sidebar.
 *
 * A parent plan renders as a group with its subplans beneath, in the order the
 * parent declares. Subplans the parent names but which do not exist yet render
 * as greyed placeholders, so the sidebar shows the sequence ahead. Plans no
 * parent claims are untouched.
 *
 * Authored red at Phase 1: `PlanList` has no `grouping` prop yet, so every
 * assertion fails against the current flat render. They stay red through
 * Phase 1 as tripwires — one turning green early would mean grouping leaked
 * into the wrong layer.
 */

function mockPlan(name: string, overrides: Partial<Plan> = {}): Plan {
  return {
    name,
    status: "draft",
    archived: false,
    ...overrides,
  };
}

/** The declarations the sidebar consumes: parent → ordered child names. */
const dawnGrouping = {
  parents: ["indusk-v2-dawn"],
  roadmap: ["indusk-v2-dawn", "local-telemetry"],
  subplans: {
    "indusk-v2-dawn": [
      "dawn-ui-plan-grouping",
      "dawn-external-orchestrator",
      "dawn-verify",
    ],
  },
};

const dawnPlans = [
  mockPlan("indusk-v2-dawn"),
  mockPlan("dawn-external-orchestrator"),
  mockPlan("dawn-ui-plan-grouping"),
  mockPlan("local-telemetry"),
];

describe("T1 — a parent shows its subplans beneath it", () => {
  it("renders the parent as a group containing its declared children", async () => {
    const { container } = await render(
      <PlanList
        active={dawnPlans}
        archived={[]}
        masterOrder={[]}
        grouping={dawnGrouping}
      />,
    );

    const group = container.querySelector(
      '[data-testid="plan-group-indusk-v2-dawn"]',
    );
    expect(group, "expected a group element for the parent plan").not.toBeNull();
    expect(group?.textContent).toContain("dawn-external-orchestrator");
    expect(group?.textContent).toContain("dawn-ui-plan-grouping");
  });
});

describe("T2 — subplans appear in declared order", () => {
  it("orders children by the parent's declaration, not alphabetically", async () => {
    const { container } = await render(
      <PlanList
        active={dawnPlans}
        archived={[]}
        masterOrder={[]}
        grouping={dawnGrouping}
      />,
    );

    const group = container.querySelector(
      '[data-testid="plan-group-indusk-v2-dawn"]',
    );
    const text = group?.textContent ?? "";
    const grouping = text.indexOf("dawn-ui-plan-grouping");
    const orchestrator = text.indexOf("dawn-external-orchestrator");

    // Declared order puts grouping first; alphabetical would invert this.
    expect(grouping, "grouping child missing").toBeGreaterThan(-1);
    expect(orchestrator, "orchestrator child missing").toBeGreaterThan(-1);
    expect(grouping).toBeLessThan(orchestrator);
  });
});

describe("T3 — unparented plans are untouched", () => {
  it("renders a plan no parent claims at the top level, outside the group", async () => {
    const { container } = await render(
      <PlanList
        active={dawnPlans}
        archived={[]}
        masterOrder={[]}
        grouping={dawnGrouping}
      />,
    );

    const link = container.querySelector('a[data-plan-name="local-telemetry"]');
    expect(link, "expected local-telemetry to still be listed").not.toBeNull();

    const group = container.querySelector(
      '[data-testid="plan-group-indusk-v2-dawn"]',
    );
    expect(group?.textContent ?? "").not.toContain("local-telemetry");
  });
});

describe("T4 — declared-but-uncreated subplans render as placeholders", () => {
  it("shows a named subplan absent from disk as a non-navigable placeholder", async () => {
    const { container } = await render(
      <PlanList
        active={dawnPlans}
        archived={[]}
        masterOrder={[]}
        grouping={dawnGrouping}
      />,
    );

    // `dawn-verify` is declared by the parent but absent from `active`.
    const placeholder = container.querySelector(
      '[data-testid="plan-placeholder-dawn-verify"]',
    );
    expect(placeholder, "expected a placeholder for the uncreated subplan").not.toBeNull();
    expect(placeholder?.textContent).toContain("dawn-verify");
    // A placeholder is not a link — there is no plan page to open yet.
    expect(placeholder?.querySelector("a")).toBeNull();
  });
});

describe("T5 — subplan navigation still works", () => {
  it("links a real subplan to its plan page like any other plan", async () => {
    const { container } = await render(
      <PlanList
        active={dawnPlans}
        archived={[]}
        masterOrder={[]}
        grouping={dawnGrouping}
        planHrefPrefix="/p/dusk/plan/"
      />,
    );

    const link = container.querySelector(
      'a[data-plan-name="dawn-external-orchestrator"]',
    );
    expect(link, "expected the subplan to be a link").not.toBeNull();
    expect(link?.getAttribute("href")).toBe(
      "/p/dusk/plan/dawn-external-orchestrator",
    );
  });
});
