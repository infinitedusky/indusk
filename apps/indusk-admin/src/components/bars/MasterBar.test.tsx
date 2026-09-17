import {
  PLAN_POSITIONS,
  type PlanPosition,
  type PlanPositionState,
  type SegmentState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { MasterBar } from "./MasterBar";

/**
 * admin-ui-phase-progress — A12.
 *
 * A parent's bar is the sum of its declared subplans: one segment each, in
 * declared order, closed ones full, in-flight ones partial, declared-but-
 * missing ones pending; the label is the count. Declaring a plan lengthens
 * the bar; archiving one fills a segment.
 */

function at(position: PlanPosition): PlanPositionState {
  const index = PLAN_POSITIONS.indexOf(position);
  const segments = {} as Record<PlanPosition, SegmentState>;
  for (const [i, key] of PLAN_POSITIONS.entries()) {
    segments[key] =
      i < index
        ? "done"
        : i === index
          ? position === "archived"
            ? "done"
            : "active"
          : "pending";
  }
  return { position, segments, awaiting: null };
}

describe("A12 — the master bar sums its subplans", () => {
  it("one segment per declared subplan; closed full, executing partial, missing pending; labelled with the count", async () => {
    const { container } = await render(
      <MasterBar
        subplans={[
          { name: "one", position: at("archived") },
          { name: "two", position: at("archived") },
          { name: "three", position: at("archived") },
          { name: "four", position: at("executing") },
          { name: "five", position: at("executing") },
          { name: "six", position: at("brief") },
          { name: "seven" },
          { name: "eight" },
          { name: "nine" },
          { name: "ten" },
        ]}
      />,
    );
    const segments = Array.from(
      container.querySelectorAll('[data-testid="master-bar"] [data-segment]'),
    );
    expect(segments.map((s) => s.getAttribute("data-segment"))).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
    ]);
    const state = (name: string) =>
      container
        .querySelector(`[data-segment="${name}"]`)
        ?.getAttribute("data-state");
    expect(state("one")).toBe("done");
    expect(state("four")).toBe("active");
    expect(state("seven")).toBe("pending");
    const width = (name: string) =>
      (
        container.querySelector(
          `[data-segment="${name}"] span`,
        ) as HTMLElement | null
      )?.style.width;
    expect(width("one")).toBe("100%");
    expect(width("seven")).toBe("0%");
    const executingWidth = Number.parseInt(width("four") ?? "0", 10);
    const briefWidth = Number.parseInt(width("six") ?? "0", 10);
    expect(executingWidth).toBeGreaterThan(briefWidth);
    expect(executingWidth).toBeLessThan(100);
    expect(
      container.querySelector('[data-testid="master-bar-active-label"]')
        ?.textContent,
    ).toBe("3 of 10 closed, 2 executing");
  });

  it("declaring another subplan lengthens the bar; archiving one fills a segment", async () => {
    const before = await render(
      <MasterBar subplans={[{ name: "a", position: at("executing") }]} />,
    );
    const after = await render(
      <MasterBar
        subplans={[{ name: "a", position: at("archived") }, { name: "b" }]}
      />,
    );
    expect(before.container.querySelectorAll("[data-segment]")).toHaveLength(1);
    expect(after.container.querySelectorAll("[data-segment]")).toHaveLength(2);
    expect(
      after.container
        .querySelector('[data-segment="a"]')
        ?.getAttribute("data-state"),
    ).toBe("done");
  });
});
