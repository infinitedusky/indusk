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
