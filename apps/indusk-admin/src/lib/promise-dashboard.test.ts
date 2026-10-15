// promise: a-plan-reads-by-its-title
import type { StandingRow } from "@infinitedusky/indusk-mcp/promises/standing";
import { describe, expect, it } from "vitest";
import { buildRows, groupRows, type RowContext } from "@/lib/promise-dashboard";

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
