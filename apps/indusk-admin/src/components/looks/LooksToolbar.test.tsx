// promise: a-plan-reads-by-its-title
import type { CountedCheckout } from "@infinitedusky/indusk-mcp/looks/overview";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { LooksToolbar } from "./LooksToolbar";

/**
 * plan-stories A26: the Looks page's checkout picker names a plan's worktree by
 * the plan's title, not by "plan <folder name>".
 */

const checkouts = [
  { plan: null, branch: "main", root: "/p", proposed: 0 },
  { plan: "cockpit-redraw", branch: "plan/cockpit-redraw", root: "/w", proposed: 2 },
] as unknown as CountedCheckout[];

describe("the Looks checkout picker names a plan by its title", () => {
  it("A26 reads a plan's worktree as the plan's title, in the reading line and the choices", async () => {
    // The page hands the titles it already reads; spread so the props compile
    // before the toolbar takes them.
    const titles = { planTitles: { "cockpit-redraw": "Cockpit redraw" } };
    const { container } = await render(
      <LooksToolbar
        path="/p/x/looks"
        show="all"
        view="list"
        checkout="cockpit-redraw"
        checkouts={checkouts}
        {...titles}
      />,
    );
    const reading = container.querySelector('[data-testid="looks-reading"]');
    expect(reading?.textContent).toContain("Cockpit redraw");
    const picker = container.querySelector('[data-testid="looks-checkouts"]');
    expect(picker?.textContent).toContain("Cockpit redraw");
    expect(container.textContent).not.toContain("plan cockpit-redraw");
  });
});
