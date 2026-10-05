import type { TrajectoryRow } from "@infinitedusky/indusk-mcp/trajectory/parser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { TrajectoryRowsTable } from "./TrajectoryRowsTable";

/**
 * admin-ui-phase-progress — A34 (cleanup).
 *
 * The trajectory-rows table was written three times: the Falsification
 * section, the Cleanup section (a copy), and the Implementation Plan (five
 * columns). One component renders both forms.
 */

const rows: TrajectoryRow[] = [
  {
    id: "A1",
    asserts: "the first claim",
    writableAt: 1,
    passesAt: 2,
    writableAtKind: "test",
    passesAtKind: "build",
    state: "passing",
  },
  {
    id: "A2",
    asserts: "the second claim",
    writableAt: 2,
    passesAt: 2,
    writableAtKind: "build",
    passesAtKind: "build",
    state: "written",
  },
];

describe("A34 — one rows table, two forms", () => {
  it("three columns for a ritual section: ID, Asserts, State with the state badge", async () => {
    const { container } = await render(<TrajectoryRowsTable rows={rows} />);
    const heads = Array.from(container.querySelectorAll("th")).map(
      (th) => th.textContent,
    );
    expect(heads).toEqual(["ID", "Asserts", "State"]);
    expect(container.textContent).toContain("the first claim");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.textContent).toContain("passing");
    expect(container.textContent).toContain("written");
  });

  it("five columns for the Implementation Plan, phases spelled the admin's way", async () => {
    const { container } = await render(
      <TrajectoryRowsTable rows={rows} phaseColumns />,
    );
    const heads = Array.from(container.querySelectorAll("th")).map(
      (th) => th.textContent,
    );
    expect(heads).toEqual([
      "ID",
      "Asserts",
      "Writable at",
      "Passes at",
      "State",
    ]);
    const cells = Array.from(container.querySelectorAll("tbody td")).map(
      (td) => td.textContent,
    );
    expect(cells).toContain("Test Phase 1");
    expect(cells).toContain("Phase 2");
    expect(cells.some((c) => c?.startsWith("Build Phase"))).toBe(false);
  });

  it("renders nothing for no rows", async () => {
    const { container } = await render(<TrajectoryRowsTable rows={[]} />);
    expect(container.querySelector("table")).toBeNull();
  });
});

/**
 * promise: every-test-says-what-it-is-for — planner-promises A7.
 *
 * A row says what it is for (the promise it proves, the lesson it guards, or
 * why it needs neither) and at which level it is tested. The plan page shows
 * both when the impl has them, and a promise's name goes to the Promises page.
 */
describe("A7 — the rows table shows what each row is for", () => {
  const PROMISE = "seat-never-double-booked";
  const LESSON = "a-seat-is-held-in-one-statement";
  const purposeful: TrajectoryRow[] = [
    {
      ...rows[0],
      levelText: "unit",
      purposeText: `promise: ${PROMISE}`,
      purpose: { promises: [PROMISE], lessons: [], reason: null },
    },
    {
      ...rows[1],
      levelText: "contract",
      purposeText: `lesson: ${LESSON}`,
      purpose: { promises: [], lessons: [LESSON], reason: null },
    },
    {
      ...rows[1],
      id: "A3",
      levelText: "unit",
      purposeText: "a regression guard",
      purpose: { promises: [], lessons: [], reason: "a regression guard" },
    },
  ];

  it("adds Level and For when the rows have them, with each row's own", async () => {
    const { container } = await render(
      <TrajectoryRowsTable rows={purposeful} />,
    );
    const heads = Array.from(container.querySelectorAll("th")).map(
      (th) => th.textContent,
    );
    expect(heads).toEqual(["ID", "Asserts", "Level", "For", "State"]);
    const cells = Array.from(container.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent),
    );
    expect(cells[0]).toContain("unit");
    expect(cells[0].join(" ")).toContain(PROMISE);
    expect(cells[1]).toContain("contract");
    expect(cells[1].join(" ")).toContain(LESSON);
    expect(cells[2]).toContain("a regression guard");
  });

  it("a promise's name links to it on the Promises page", async () => {
    const { container } = await render(
      <TrajectoryRowsTable rows={purposeful} promisesHref="/p/demo/promises" />,
    );
    const link = container.querySelector(
      `a[href="/p/demo/promises#promise-${PROMISE}"]`,
    );
    expect(link?.textContent).toBe(PROMISE);
  });

  it("an impl written before rows said what they were for keeps its three columns", async () => {
    const { container } = await render(<TrajectoryRowsTable rows={rows} />);
    expect(container.querySelectorAll("th")).toHaveLength(3);
  });
});
