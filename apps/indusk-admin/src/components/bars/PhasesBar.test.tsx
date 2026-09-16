import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { Phase, Stage } from "@/lib/phases";
import { PhasesBar } from "./PhasesBar";

/**
 * admin-ui-phase-progress — A26 (added at the U1 review, Sandy 2026-09-16:
 * "a phase line under the active one, so you see what phase you are in").
 *
 * One segment per phase in document order, closed phases full, the active
 * one partially filled by its own items and named, later phases empty — the
 * middle line of the zoom from plan position to phase to stage.
 */

function stage(checked: number, total: number): Stage {
  return {
    kind: "implementation",
    state: checked === total ? "done" : checked > 0 ? "active" : "pending",
    checked,
    total,
    items: [],
  };
}

function phase(
  kind: "test" | "build",
  number: number,
  title: string,
  checked: number,
  total: number,
): Phase {
  return {
    kind,
    number,
    ordinal: number,
    title,
    stages: [stage(checked, total)],
    activity: checked === total ? "closed" : "implementing",
    itemCount: total,
    content: "",
    trajectoryRows: [],
  };
}

const phases = [
  phase("test", 1, "Author red", 4, 4),
  phase("build", 1, "Foundations", 6, 6),
  phase("build", 2, "The middle", 2, 5),
  phase("build", 3, "Later", 0, 3),
];

describe("A26 — the phase line", () => {
  it("one segment per phase in order; closed full, active partial and named, later empty", async () => {
    const { container } = await render(
      <PhasesBar phases={phases} activeKey="build-2" />,
    );
    const segments = Array.from(
      container.querySelectorAll('[data-testid="phases-bar"] [data-segment]'),
    );
    expect(segments.map((s) => s.getAttribute("data-segment"))).toEqual([
      "test-1",
      "build-1",
      "build-2",
      "build-3",
    ]);
    expect(segments.map((s) => s.getAttribute("data-state"))).toEqual([
      "done",
      "done",
      "active",
      "pending",
    ]);
    const width = (key: string) =>
      (
        container.querySelector(
          `[data-segment="${key}"] span`,
        ) as HTMLElement | null
      )?.style.width;
    expect(width("build-1")).toBe("100%");
    expect(width("build-2")).toBe("40%");
    expect(width("build-3")).toBe("0%");
    expect(
      container.querySelector('[data-testid="phases-bar-active-label"]')
        ?.textContent,
    ).toBe("Phase 2: implementation");
    expect(container.textContent).toContain("Test Phase 1");
  });

  it("with nothing active, no phase is marked and no label is shown", async () => {
    const closed = phases.map((p) => ({
      ...p,
      stages: [stage(3, 3)],
      activity: "closed" as const,
    }));
    const { container } = await render(
      <PhasesBar phases={closed} activeKey={null} />,
    );
    expect(
      container.querySelector(
        '[data-testid="phases-bar"] [data-state="active"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="phases-bar-active-label"]'),
    ).toBeNull();
  });
});
