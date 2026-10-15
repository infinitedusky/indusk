import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// PlanList names a queued plan by the package's title rule, whose module reads
// the filesystem; the browser project cannot import it, so the rule is stubbed.
vi.mock("@infinitedusky/indusk-mcp/promises/display", () => ({
  __esModule: true,
  planTitle: (_title: unknown, handle: string) => handle,
}));

// Promises.tsx and PlanList.tsx link to plans — stub next/link as everywhere.
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

import { HoldingBadge } from "@/components/HoldingBadge";
import { PlanList } from "@/components/PlanList";
import type { Plan } from "@/lib/planning-reader";

/**
 * day-promises A22: an archived plan shows "holding N"; one owning none shows
 * no count. The page's table those rows once shared a file with was replaced
 * by the dashboard (plan-cockpit), whose tests live in `dashboard.test.tsx`.
 */

describe("A22 — an archived plan shows holding N; one owning none shows no count", () => {
  it("HoldingBadge renders the count, and nothing for zero", async () => {
    const some = await render(<HoldingBadge count={3} plan="lab-v0" />);
    expect(some.container.textContent).toContain("holding 3");
    const none = await render(<HoldingBadge count={0} plan="empty" />);
    expect(none.container.textContent).not.toContain("holding");
  });

  it("the sidebar's archived items carry the badge from the holding map", async () => {
    const archived = [
      { name: "lab-v0", title: "Lab v0", status: "completed", archived: true },
      {
        name: "empty-plan",
        title: "Empty plan",
        status: "completed",
        archived: true,
      },
    ] as Plan[];
    const screen = await render(
      <PlanList
        active={[]}
        archived={archived}
        masterOrder={[]}
        holding={new Map([["lab-v0", 3]])}
      />,
    );
    // The archived section is collapsed by default and renders its items only
    // when opened — open it the way a reader would.
    await screen.getByRole("button", { name: /archived \(2\)/i }).click();
    const { container } = screen;
    const badge = container.querySelector('[data-testid="holding-lab-v0"]');
    expect(badge?.textContent).toContain("holding 3");
    expect(
      container.querySelector('[data-plan-name="empty-plan"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="holding-empty-plan"]'),
    ).toBeNull();
  });
});
