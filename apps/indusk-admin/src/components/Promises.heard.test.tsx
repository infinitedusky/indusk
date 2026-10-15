import type { PromiseEntry } from "@infinitedusky/indusk-mcp/promises/registry";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

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

import { PromisesDashboard } from "@/components/Promises";
import { type DashboardRow, parseQuery } from "@/lib/promise-dashboard";

/**
 * incident-recording A21, A22 — promise: the-admin-keeps-what-it-heard.
 *
 * The promise page counts each promise's breaks from the admin's own record
 * of what it heard (`heard.jsonl` in the project's home), not from what the
 * source still holds: a break heard while no page was open, and one older than
 * the source keeps, are both counted (A21). While the production source cannot
 * be read, the count is still shown beside the banner that says so, and never
 * as zero (A22). Since plan-cockpit the count is the package's `standingOf`
 * thirty days — days with a break heard — and this draws it on the
 * dashboard's row; `standing.test.ts` pins the counting itself.
 */

const PROMISE = "seat-released";

const ENTRY: PromiseEntry = {
  name: PROMISE,
  kind: "behaviour",
  lifetime: "holds",
  state: "known-violated",
  domain: "seating",
  owner: "seat-holds",
  statement: "A held seat is released after its timeout.",
  sites: [],
  tests: [],
  incidents: ["i-2026-10-08-seat-released"],
  aliases: [],
  file: `${PROMISE}.md`,
};

// Two breaks on the last day and one twenty days ago, older than a Jaeger
// keeps: two days with a break, twenty-eight without.
const ROW: DashboardRow = {
  name: PROMISE,
  sentence: PROMISE,
  plan: "seat-holds",
  planTitle: "Seat holds",
  path: null,
  pathTitle: null,
  standing: "broken",
  tests: { passing: 0, total: 0 },
  held: 28,
  broke: 2,
  lastActivity: "2026-10-10T11:00:00.000Z",
  lastBreak: "2026-10-10T11:00:00.000Z",
};

function dashboard(observed: unknown[] = []) {
  return (
    <PromisesDashboard
      rows={[ROW]}
      query={parseQuery({})}
      pathOrder={[]}
      incidents={[]}
      promises={[ENTRY]}
      path="/p/demo/promises"
      planHrefPrefix="/p/demo/plan/"
      promiseHrefPrefix="/p/demo/promises/"
      observed={observed as never}
    />
  );
}

const thirty = (container: Element) =>
  container.querySelector('[data-testid="promise-thirty"]');

describe("A21 — the page counts breaks from what the admin heard", () => {
  it("counts every day with a break in the record over thirty days, including one older than the source keeps", async () => {
    const { container } = await render(dashboard());
    expect(thirty(container)?.textContent).toBe("held 28 · broke 2 of 30 days");
  });
});

describe("A22 — with production unreadable, the record is still shown beside the banner", () => {
  it("shows the count, and the banner that production could not be read, and never zero", async () => {
    const { container } = await render(
      dashboard([
        { name: "production", rows: {}, unknownSince: "2026-10-10T11:00:00Z" },
      ]),
    );
    expect(thirty(container)?.textContent).toBe("held 28 · broke 2 of 30 days");
    expect(
      container.querySelector('[data-testid="health-unknown"]'),
    ).not.toBeNull();
  });
});
