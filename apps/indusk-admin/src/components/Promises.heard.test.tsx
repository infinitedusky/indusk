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

import { PromisesTable } from "@/components/Promises";

/**
 * incident-recording A21, A22 — promise: the-admin-keeps-what-it-heard.
 *
 * The promise page counts each promise's production breaks from the admin's
 * own record of what it heard (`heard.jsonl` in the project's home), not
 * from what the source still holds: a break heard while no page was open,
 * and one older than the source keeps, are both counted (A21). While the
 * production source cannot be read, the count is still shown, marked as of
 * when the admin last heard, and never as zero (A22).
 *
 * Red today: the table takes no record and shows no count.
 */

const PROMISE = "seat-released";
const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

const PROMISES: PromiseEntry[] = [
  {
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
  },
];

const row = (at: string, trace: string) => ({
  at,
  promise: PROMISE,
  trace,
  incident: "i-2026-10-08-seat-released",
  source: "production",
});

// Two in the last day, one twenty days ago — older than a Jaeger keeps.
const HEARD = [
  row(hoursAgo(1), "t1"),
  row(hoursAgo(2), "t2"),
  row(hoursAgo(20 * 24), "t3"),
];
const LAST_HEARD = hoursAgo(1);

const heardCell = (container: Element) =>
  container.querySelector(
    `[data-testid="promise-heard"][data-promise="${PROMISE}"]`,
  );

describe("A21 — the page counts breaks from what the admin heard", () => {
  it("counts every break in the record over thirty days, including one older than the source keeps", async () => {
    const props = {
      promises: PROMISES,
      incidents: [],
      heard: { rows: HEARD, lastHeard: LAST_HEARD },
    } as unknown as Parameters<typeof PromisesTable>[0];
    const { container } = await render(<PromisesTable {...props} />);
    const cell = heardCell(container);
    expect(cell, container.innerHTML.slice(0, 400)).not.toBeNull();
    expect(cell?.textContent).toMatch(/\b3\b/);
  });
});

describe("A22 — with production unreadable, the record is still shown, as of when it was heard", () => {
  it("shows the count marked as of the last time the admin heard, and never zero", async () => {
    const props = {
      promises: PROMISES,
      incidents: [],
      heard: { rows: HEARD, lastHeard: LAST_HEARD },
      observed: [{ name: "production", rows: {}, unknownSince: hoursAgo(1) }],
    } as unknown as Parameters<typeof PromisesTable>[0];
    const { container } = await render(<PromisesTable {...props} />);
    const cell = heardCell(container);
    expect(cell?.textContent).toMatch(/\b3\b/);
    expect(cell?.textContent).toMatch(/as of/);
    expect(cell?.textContent).not.toMatch(/\b0\b/);
  });
});
