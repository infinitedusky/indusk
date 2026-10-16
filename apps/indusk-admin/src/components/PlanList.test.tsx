// promise: the-nav-says-where-a-plan-is
import { derivePlanPosition } from "@infinitedusky/indusk-mcp/lifecycle";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

// PlanList names a queued plan by the package's title rule, whose module reads
// the filesystem; the browser project cannot import it, so the rule is stubbed.
vi.mock("@infinitedusky/indusk-mcp/promises/display", () => ({
  __esModule: true,
  planTitle: (_title: unknown, handle: string) => handle,
}));

// `next/link` pulls in Node-only globals (`process`) that aren't present in
// the browser test runtime. Stub it with a plain anchor — semantically
// identical for the props PlanList passes (href + className + children).
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
 * Trajectory tests for PlanList behavior.
 *
 *   - T2 (Phase 3): sidebar lists every active plan in this project
 *   - T3 (Phase 3): sidebar plan list appears in the order defined by master.md
 *   - T4 (Phase 3): archive section is visually distinct + collapsed by default
 *   - T5 (Phase 4): clicking a plan in the sidebar shows the plan's content
 *
 * T5 stays `.skip()` until Phase 4 wires the `/plan/[name]` route.
 */

function mockPlan(name: string, overrides: Partial<Plan> = {}): Plan {
  return {
    name,
    title: name,
    description: null,
    status: "draft",
    archived: false,
    ...overrides,
  };
}

describe("PlanList — sidebar list of plans (T2)", () => {
  it("T2 — renders every active plan from props as a clickable list item", async () => {
    const active = [
      mockPlan("alpha-feature", { status: "in-progress" }),
      mockPlan("beta-bugfix"),
      mockPlan("gamma"),
    ];
    const { container } = await render(
      <PlanList
        active={active}
        archived={[]}
        masterOrder={["alpha-feature", "beta-bugfix", "gamma"]}
      />,
    );

    for (const p of active) {
      const link = container.querySelector(`a[data-plan-name="${p.name}"]`);
      expect(link, `expected link for ${p.name}`).not.toBeNull();
      expect(link?.getAttribute("href")).toBe(`/plan/${p.name}`);
      expect(link?.textContent).toContain(p.name);
    }
  });

  it("T2 — falls back to EmptyPlansSidebarSlot when no plans at all", async () => {
    const { container } = await render(
      <PlanList active={[]} archived={[]} masterOrder={[]} />,
    );
    expect(
      container.querySelector('[data-testid="sidebar-empty-state"]'),
    ).not.toBeNull();
  });
});

describe("PlanList — master.md ordering (T3)", () => {
  it("T3 — renders active plans in master.md order, regardless of input order", async () => {
    const active = [
      mockPlan("gamma"),
      mockPlan("alpha-feature"),
      mockPlan("beta-bugfix"),
    ];
    const masterOrder = ["alpha-feature", "beta-bugfix", "gamma"];
    const { container } = await render(
      <PlanList active={active} archived={[]} masterOrder={masterOrder} />,
    );

    const items = Array.from(
      container.querySelectorAll(
        '[data-testid="active-plans"] a[data-plan-name]',
      ),
    ).map((a) => a.getAttribute("data-plan-name"));
    expect(items).toEqual(masterOrder);
  });

  it("T3 — plans not in master.md appear in an Unordered group below the master-ordered list", async () => {
    const active = [
      mockPlan("alpha-feature"),
      mockPlan("orphan-plan"),
      mockPlan("beta-bugfix"),
    ];
    const masterOrder = ["alpha-feature", "beta-bugfix"];
    const { container } = await render(
      <PlanList active={active} archived={[]} masterOrder={masterOrder} />,
    );

    const ordered = Array.from(
      container.querySelectorAll(
        '[data-testid="active-plans"] a[data-plan-name]',
      ),
    ).map((a) => a.getAttribute("data-plan-name"));
    expect(ordered).toEqual(["alpha-feature", "beta-bugfix"]);

    const unordered = Array.from(
      container.querySelectorAll(
        '[data-testid="unordered-plans"] a[data-plan-name]',
      ),
    ).map((a) => a.getAttribute("data-plan-name"));
    expect(unordered).toEqual(["orphan-plan"]);
  });
});

describe("PlanList — archived section (T4)", () => {
  it("T4 — archived plans render in a separate section that is collapsed by default", async () => {
    const archived = [
      mockPlan("zeta-archived", { archived: true, status: "completed" }),
      mockPlan("eta-archived", { archived: true, status: "completed" }),
    ];
    const { container } = await render(
      <PlanList
        active={[mockPlan("alpha-feature")]}
        archived={archived}
        masterOrder={["alpha-feature"]}
      />,
    );

    const header = container.querySelector("[aria-expanded]");
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain("Archived");
    expect(header?.textContent).toContain("2");

    expect(header?.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[data-testid="archived-plans"]'),
    ).toBeNull();
  });

  it("T4 — archived section omitted entirely when there are no archived plans", async () => {
    const { container } = await render(
      <PlanList
        active={[mockPlan("alpha-feature")]}
        archived={[]}
        masterOrder={["alpha-feature"]}
      />,
    );
    expect(container.querySelector("[aria-expanded]")).toBeNull();
  });
});

describe("PlanList — malformed plan indicator (T13 prep)", () => {
  it("renders a 'malformed' badge on plans whose frontmatter failed to parse", async () => {
    const active = [
      mockPlan("delta-malformed", { malformed: true, status: "unknown" }),
    ];
    const { container } = await render(
      <PlanList
        active={active}
        archived={[]}
        masterOrder={["delta-malformed"]}
      />,
    );
    expect(
      container.querySelector('[data-testid="malformed-delta-malformed"]'),
    ).not.toBeNull();
  });
});

/** A plan's position from the real reader, as the plan page gets it. */
function positionOf(over: {
  stageStatus: string;
  missing?: string[];
  archived?: boolean;
}) {
  return derivePlanPosition({
    summary: {
      name: "p",
      stage: "impl",
      stageStatus: over.stageStatus,
      nextStep: "",
      dependencies: [],
      documents: ["brief.md", "test-plan.md", "impl.md"],
      workflow: "bugfix",
    },
    impl: null,
    readiness: {
      missing: over.missing ?? [],
      nonTerminalRows: [],
      unprovenPromises: [],
      longSkipReasons: [],
    } as never,
    archived: over.archived ?? false,
  });
}

describe("PlanList — the finished mark is a release's (A2, A4, A6)", () => {
  const grouping = {
    parents: ["parent"],
    roadmap: ["parent"],
    subplans: {
      parent: ["built-child", "closed-child", "shipped-child", "waiting-child"],
    },
    declaredTitles: {},
  };
  const built = (name: string, over: Partial<Plan> = {}) =>
    mockPlan(name, {
      status: "completed",
      position: positionOf({
        stageStatus: "completed",
        missing: ["falsification", "cleanup", "audit"],
      }),
      ...over,
    });

  const renderRows = (
    dates: Record<string, { released: string | null }>,
    waiting = {},
  ) =>
    render(
      <PlanList
        active={[
          mockPlan("parent"),
          built("built-child"),
          built("shipped-child"),
          built("waiting-child"),
        ]}
        archived={[
          mockPlan("closed-child", {
            archived: true,
            status: "completed",
            position: positionOf({ stageStatus: "completed", archived: true }),
          }),
        ]}
        masterOrder={[]}
        grouping={grouping}
        dates={dates as never}
        waiting={waiting}
      />,
    );

  const row = (container: Element, name: string) => {
    const link = container.querySelector(`a[data-plan-name="${name}"]`);
    expect(link, `expected a row for ${name}`).not.toBeNull();
    return {
      state: link
        ?.querySelector('[data-component="badge"]')
        ?.getAttribute("data-state"),
      text: link?.textContent ?? "",
    };
  };

  it("A2 — a built plan no release shipped carries the in-progress mark and names its step", async () => {
    const { container } = await renderRows({});
    const built = row(container, "built-child");
    expect(built.state).toBe("working");
    expect(built.text).toContain("Falsify");
  });

  it("A2 — an archived plan with no release found reads Closed with the finished mark", async () => {
    const { container } = await renderRows({});
    const closed = row(container, "closed-child");
    expect(closed.state).toBe("released");
    expect(closed.text).toContain("Closed");
    expect(closed.text).not.toContain("completed");
  });

  it("A6 — a plan a release shipped reads Released with the finished mark", async () => {
    const { container } = await renderRows({
      "shipped-child": { released: "2026-10-01" },
    });
    const shipped = row(container, "shipped-child");
    expect(shipped.state).toBe("released");
    expect(shipped.text).toContain("Released");
  });

  it("A4 — a plan waiting on the person reads what it waits at, ahead of Released", async () => {
    const { container } = await renderRows(
      { "waiting-child": { released: "2026-10-01" } },
      { "waiting-child": "Review" },
    );
    const waiting = row(container, "waiting-child");
    expect(waiting.state).toBe("needs");
    expect(waiting.text).toContain("Review");
    expect(waiting.text).not.toContain("Released");
  });
});

// T5 (clicking a plan navigates to /plan/[name]) is satisfied by PlanList's
// link href + PlanDetail.test.tsx asserting the rendered detail. End-to-end
// click→navigate testing is deferred to Phase 6's CLI smoke (running the real
// Next.js server).
