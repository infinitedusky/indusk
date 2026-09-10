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
 * A5 (writing-skill) — papers render under their plan.
 *
 * A plan that carries `papers` shows a Papers section with one entry per
 * paper, its title, and its status badge; the stale badge is the derived
 * `published (stale)` string. A papers-only plan (no lifecycle documents)
 * renders that section and nothing else, without an error.
 *
 * Authored red at Test Phase 1: `Plan` has no `papers` field and `PlanDetail`
 * renders no such section, so the cast below is the only way to hand it one
 * today. The cast goes away when Build Phase 4 lands the field.
 */

function papersOnlyPlan(): Plan {
  return {
    name: "essays",
    status: "unknown",
    archived: false,
    papers: [
      {
        file: "paper-1.md",
        title: "The Grift",
        status: "published",
        stale: true,
      },
      {
        file: "paper-2.md",
        title: "The Landscape",
        status: "draft",
        stale: false,
      },
    ],
  } as unknown as Plan;
}

describe("A5 — a plan's papers render with title and status", () => {
  it("shows a Papers section with one entry per paper and its badge", async () => {
    const { container } = await render(<PlanDetail plan={papersOnlyPlan()} />);

    const section = container.querySelector('[data-testid="papers-section"]');
    expect(
      section,
      "expected a papers-section for a plan carrying papers",
    ).not.toBeNull();
    expect(section?.textContent).toContain("The Grift");
    expect(section?.textContent).toContain("The Landscape");
    // The derived label, never a stored status.
    expect(section?.textContent).toContain("published (stale)");
    expect(section?.textContent).toContain("draft");
  });

  it("a papers-only plan renders without an error and without a malformed notice", async () => {
    const { container } = await render(<PlanDetail plan={papersOnlyPlan()} />);

    expect(
      container.querySelector('[data-testid="papers-section"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toMatch(/malformed/i);
  });

  it("a plan with no papers renders no Papers section", async () => {
    const plan: Plan = { name: "plain", status: "unknown", archived: false };
    const { container } = await render(<PlanDetail plan={plan} />);

    expect(
      container.querySelector('[data-testid="papers-section"]'),
    ).toBeNull();
  });
});
