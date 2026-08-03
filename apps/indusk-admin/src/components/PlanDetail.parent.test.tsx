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

import { PlanDetail } from "./PlanDetail";

/**
 * T10 — the parent plan detail view.
 *
 * Opening a parent plan (one with declared subplans) shows a card per subplan
 * with its status and stage, instead of an empty page with a stray
 * Falsification heading. Declared-but-uncreated subplans render as distinct,
 * non-navigable placeholder cards; the parent's own master.md prose renders
 * above the cards.
 *
 * Authored red at Phase 3's start: `PlanDetail` has no `subplans` /
 * `masterContent` props yet, so the cards and prose are absent and the
 * doc-less parent still renders the unconditional Falsification section.
 */

function mockPlan(name: string, overrides: Partial<Plan> = {}): Plan {
  return {
    name,
    status: "unknown",
    archived: false,
    ...overrides,
  };
}

/** A parent plan carries master.md / maxims.md — none of the DOC_FILES. */
const parentPlan = mockPlan("indusk-v2-dawn");

const subplans = [
  {
    name: "dawn-ui-plan-grouping",
    plan: mockPlan("dawn-ui-plan-grouping", {
      status: "in-progress",
      impl: {
        frontmatter: { title: "Grouping — Impl", status: "in-progress" },
        content: "## Checklist\n\n### Phase 1: Things\n\n- [x] A thing\n",
      },
    }),
  },
  // Declared by the parent but no folder on disk yet.
  { name: "dawn-verify" },
];

describe("T10 — a parent plan renders subplan cards, not an empty page", () => {
  it("shows a card per existing subplan with status + stage, linking to the plan", async () => {
    const { container } = await render(
      <PlanDetail
        plan={parentPlan}
        subplans={subplans}
        planHrefPrefix="/p/dusk/plan/"
      />,
    );

    const card = container.querySelector(
      '[data-testid="subplan-card-dawn-ui-plan-grouping"]',
    );
    expect(card, "expected a card for the existing subplan").not.toBeNull();
    expect(card?.textContent).toContain("dawn-ui-plan-grouping");
    // Status badge from the child's own status.
    expect(card?.textContent).toContain("in-progress");
    // Stage derived from which documents the child carries (impl here).
    expect(card?.textContent).toContain("impl");
    // The card navigates to the subplan's page like any sidebar link.
    const link = card?.querySelector("a");
    expect(link, "expected the card to link to the plan").not.toBeNull();
    expect(link?.getAttribute("href")).toBe(
      "/p/dusk/plan/dawn-ui-plan-grouping",
    );
  });

  it("shows a declared-but-uncreated subplan as a distinct, non-navigable placeholder card", async () => {
    const { container } = await render(
      <PlanDetail
        plan={parentPlan}
        subplans={subplans}
        planHrefPrefix="/p/dusk/plan/"
      />,
    );

    const placeholder = container.querySelector(
      '[data-testid="subplan-placeholder-dawn-verify"]',
    );
    expect(
      placeholder,
      "expected a placeholder card for the uncreated subplan",
    ).not.toBeNull();
    expect(placeholder?.textContent).toContain("dawn-verify");
    // No folder → no page → no link.
    expect(placeholder?.querySelector("a")).toBeNull();
  });

  it("renders the parent's master.md prose above the cards", async () => {
    const { container } = await render(
      <PlanDetail
        plan={parentPlan}
        subplans={subplans}
        masterContent={"# Dawn — Master Plan\n\nThis file is the sequence."}
        planHrefPrefix="/p/dusk/plan/"
      />,
    );

    const text = container.textContent ?? "";
    expect(text).toContain("This file is the sequence.");
    // Prose comes before the first card in document order.
    const proseIdx = text.indexOf("This file is the sequence.");
    const cardIdx = text.indexOf("dawn-ui-plan-grouping");
    expect(cardIdx, "expected a subplan card to render").toBeGreaterThan(-1);
    expect(proseIdx).toBeLessThan(cardIdx);
  });

  it("does not render a stray empty Falsification section on a doc-less parent", async () => {
    const { container } = await render(
      <PlanDetail
        plan={parentPlan}
        subplans={subplans}
        planHrefPrefix="/p/dusk/plan/"
      />,
    );

    expect(
      container.querySelector('[data-testid="falsification-section"]'),
      "a doc-less parent must not render an empty Falsification section",
    ).toBeNull();
  });
});
