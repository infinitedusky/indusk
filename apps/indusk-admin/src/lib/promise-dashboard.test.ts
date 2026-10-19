// promise: a-plan-reads-by-its-title
// clause: a-clause-is-proved-twice/no-signal-is-not-holding
import type { StandingRow } from "@infinitedusky/indusk-mcp/promises/standing";
import { describe, expect, it } from "vitest";
import {
  buildRows,
  groupRows,
  type RowContext,
  readsNoSignal,
} from "@/lib/promise-dashboard";

/**
 * plan-stories A26: the Promises page names each plan by its title, a Path
 * group by its master's title, and a plan with no title as its handle in
 * words, never as a bare folder name. (The incidents table's and the Looks
 * picker's names are held beside their components.)
 */

const standingRow = (name: string, owner: string): StandingRow =>
  ({
    entry: { name, owner },
    standing: "declared",
    tests: { passing: 0, total: 0 },
    thirtyDays: { held: null, broke: 0 },
    lastActivity: null,
    lastBreak: null,
    health: {},
    rows: [],
  }) as unknown as StandingRow;

/** The words fallback the page hands in: the package's `promiseWords`, stood in for. */
const sentenceOf = (handle: string) => {
  const spoken = handle.replace(/-/g, " ");
  return spoken.charAt(0).toUpperCase() + spoken.slice(1);
};

const context = (
  planTitles: Record<string, string>,
  subplans: Record<string, string[]> = {},
): RowContext => ({
  planTitles,
  sentenceOf,
  declarations: { subplans },
});

describe("the Promises page names a plan by its title", () => {
  it("A26 a promise's plan reads by the title written, and a plan with no title in words", () => {
    const rows = buildRows(
      [standingRow("one", "known-plan"), standingRow("two", "gone-plan")],
      context({ "known-plan": "Known plan, retitled" }),
    );
    expect(rows.map((r) => r.planTitle)).toEqual([
      "Known plan, retitled",
      "Gone plan",
    ]);
  });

  it("A26 a title that is only the plan's handle reads as the handle in words", () => {
    const rows = buildRows(
      [standingRow("one", "cockpit-redraw")],
      context({ "cockpit-redraw": "cockpit-redraw" }),
    );
    expect(rows[0]?.planTitle).toBe("Cockpit redraw");
  });

  it("A26 a Path group's heading is its master's title, or the master's handle in words", () => {
    const rows = buildRows(
      [standingRow("one", "day-one"), standingRow("two", "dawn-one")],
      context(
        { "day-one": "Day one", "indusk-v4-day": "InDusk v4: Day" },
        { "indusk-v4-day": ["day-one"], "indusk-v5-dawn": ["dawn-one"] },
      ),
    );
    const headings = groupRows(rows, { group: "path", sort: "name" }).map(
      (g) => g.heading,
    );
    expect(headings.sort()).toEqual(
      ["Indusk v5 dawn", "InDusk v4: Day"].sort(),
    );
  });
});

/**
 * mark-first A38 (Build Phase 7, falsification): an enforced promise whose
 * package signal reads no signal (one clause holding and another silent, or a
 * blind watcher) gets the grey no-signal dot, never the green enforced one,
 * however many past days were held.
 */
describe("a promise with a silent clause is drawn as no signal", () => {
  const enforced = (signal: string | null): StandingRow =>
    ({
      ...standingRow("seats-held", "seat-holds"),
      standing: "enforced",
      thirtyDays: { held: 12, broke: 0 },
      signal,
    }) as unknown as StandingRow;

  it("A38 an enforced promise with held days whose signal reads no signal gets the grey dot", () => {
    const [row] = buildRows([enforced("no-signal")], context({}));
    expect(row && readsNoSignal(row)).toBe(true);
  });

  it("A38 an enforced promise whose every clause holds keeps the enforced dot", () => {
    const [row] = buildRows([enforced("holding")], context({}));
    expect(row && readsNoSignal(row)).toBe(false);
  });

  it("A38 a promise stated before clauses keeps today's reading", () => {
    const [row] = buildRows([enforced(null)], context({}));
    expect(row && readsNoSignal(row)).toBe(false);
  });
});
