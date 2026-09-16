import {
  PLAN_POSITIONS,
  type PlanPosition,
  type PlanPositionState,
  type SegmentState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PlanBar } from "./PlanBar";

/**
 * admin-ui-phase-progress — A8, A10, A11.
 *
 * The plan bar is made of positions (nouns). Every plan shows the same
 * segments whether or not it has reached them, skipped drawn as skipped, so
 * the bar's shape is constant; the active segment carries the message.
 */

function state(
  position: PlanPosition,
  overrides: Partial<Record<PlanPosition, SegmentState>> = {},
  awaiting: string | null = null,
): PlanPositionState {
  const index = PLAN_POSITIONS.indexOf(position);
  const segments = {} as Record<PlanPosition, SegmentState>;
  for (const [i, key] of PLAN_POSITIONS.entries()) {
    segments[key] = i < index ? "done" : i === index ? "active" : "pending";
  }
  return { position, segments: { ...segments, ...overrides }, awaiting };
}

const STATES: SegmentState[] = ["done", "active", "pending", "skipped"];

function segmentsOf(container: Element) {
  return Array.from(
    container.querySelectorAll('[data-testid="plan-bar"] [data-segment]'),
  );
}

describe("A8 — every segment is tri-state and the bar's shape is constant", () => {
  it("two plans at different positions render the same number of segments, each in one of the four states", async () => {
    const early = await render(
      <PlanBar
        position={state(
          "brief",
          { research: "skipped" },
          "brief draft, awaiting acceptance",
        )}
      />,
    );
    const late = await render(
      <PlanBar
        position={state("cleanup", {}, "falsified, awaiting /cleanup")}
      />,
    );
    const a = segmentsOf(early.container);
    const b = segmentsOf(late.container);
    expect(a).toHaveLength(PLAN_POSITIONS.length);
    expect(b).toHaveLength(PLAN_POSITIONS.length);
    for (const seg of [...a, ...b]) {
      expect(STATES).toContain(seg.getAttribute("data-state"));
    }
    expect(
      a.filter((s) => s.getAttribute("data-state") === "active"),
    ).toHaveLength(1);
    expect(
      b.filter((s) => s.getAttribute("data-state") === "active"),
    ).toHaveLength(1);
  });
});

describe("A10 — every position, the current one labelled, research skipped when absent", () => {
  it("renders research → archived in order, the active position labelled with what it awaits", async () => {
    const { container } = await render(
      <PlanBar
        position={state(
          "brief",
          { research: "skipped" },
          "brief draft, awaiting acceptance",
        )}
      />,
    );
    const keys = segmentsOf(container).map((s) =>
      s.getAttribute("data-segment"),
    );
    expect(keys).toEqual([...PLAN_POSITIONS]);
    expect(
      container
        .querySelector('[data-segment="research"]')
        ?.getAttribute("data-state"),
    ).toBe("skipped");
    expect(
      container
        .querySelector('[data-segment="brief"]')
        ?.getAttribute("data-state"),
    ).toBe("active");
    expect(
      container.querySelector('[data-testid="plan-bar-active-label"]')
        ?.textContent,
    ).toBe("brief draft, awaiting acceptance");
    expect(
      container.querySelector('[data-testid="plan-bar-caption"]')?.textContent,
    ).toContain("steps, not time");
  });
});

describe("A11 — executing pulls the activity up; archived has nothing active", () => {
  it("an executing plan's label is the active phase's activity and name", async () => {
    const { container } = await render(
      <PlanBar
        position={state("executing")}
        activity="verifying Build Phase 2"
      />,
    );
    expect(
      container.querySelector('[data-testid="plan-bar-active-label"]')
        ?.textContent,
    ).toBe("executing: verifying Build Phase 2");
  });

  it("an archived plan has no active segment and no active label", async () => {
    const archived = state("archived");
    archived.segments.archived = "done";
    const { container } = await render(<PlanBar position={archived} />);
    expect(
      container.querySelector('[data-testid="plan-bar"] [data-state="active"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="plan-bar-active-label"]'),
    ).toBeNull();
  });
});
