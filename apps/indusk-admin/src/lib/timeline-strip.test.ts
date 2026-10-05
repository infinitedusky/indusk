import { describe, expect, it } from "vitest";
import { buildStrip, WINDOWS } from "./timeline-strip";

/**
 * promise-timeline A14 — cells are fixed to the clock.
 *
 * A strip measured back from "now" moves every boundary with every request,
 * so a run sits in a different cell, with a different `data-from`, one
 * refresh to the next (A13 against the Fly server: the 13:41 break moved from
 * the last cell to the one before). Cells fixed to the clock give a run the
 * same cell until the window has moved past it.
 */

const RUN_AT = Date.parse("2026-10-05T13:41:05Z");

function cellOf(now: number) {
  const strip = buildStrip({
    promise: "checkout-never-charges-twice",
    marks: [
      {
        at: new Date(RUN_AT).toISOString(),
        outcome: "upheld",
        traceId: "0123456789abcdef0123456789abcdef",
        environment: null,
      },
    ],
    atLeast: [],
    incidents: [],
    window: "24h",
    now,
  });
  return strip.cells.find((c) => c.runs > 0);
}

describe("A14 — cells are fixed to the clock", () => {
  it("the same run sits in a cell with the same start a minute later", () => {
    const first = cellOf(RUN_AT + 2 * 60_000);
    const later = cellOf(RUN_AT + 3 * 60_000);
    expect(first?.from, "the run is drawn").toBeDefined();
    expect(later?.from).toBe(first?.from);
  });

  it("every cell starts on a multiple of the cell width", () => {
    const strip = buildStrip({
      promise: "p",
      marks: [],
      atLeast: [],
      incidents: [],
      window: "24h",
      now: RUN_AT + 7 * 60_000 + 13_000,
    });
    const cellMs = WINDOWS["24h"].ms / WINDOWS["24h"].cells;
    for (const c of strip.cells) expect(Date.parse(c.from) % cellMs).toBe(0);
  });
});
