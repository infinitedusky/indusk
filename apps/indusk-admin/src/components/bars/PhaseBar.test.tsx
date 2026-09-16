import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { Phase } from "@/lib/phases";
import { PhaseBar } from "./PhaseBar";

/**
 * admin-ui-phase-progress — A9.
 *
 * The phase bar is made of activities (verbs). The active stage is partially
 * filled by its own n of m and labelled with the verb; done stages are full,
 * later stages empty.
 */

const phase: Phase = {
  kind: "build",
  number: 2,
  ordinal: 2,
  title: "Second",
  activity: "verifying",
  itemCount: 9,
  content: "",
  trajectoryRows: [],
  stages: [
    { kind: "implementation", state: "done", checked: 3, total: 3, items: [] },
    { kind: "Verification", state: "active", checked: 2, total: 5, items: [] },
    { kind: "Context", state: "pending", checked: 0, total: 1, items: [] },
    { kind: "Document", state: "pending", checked: 0, total: 1, items: [] },
  ],
};

describe("A9 — the active stage is partially filled and labelled with its verb", () => {
  it("done full, active partial with 'verifying: 2 of 5', later empty", async () => {
    const { container } = await render(<PhaseBar phase={phase} />);
    const fill = (stage: string) =>
      (
        container.querySelector(
          `[data-testid="phase-bar"] [data-segment="${stage}"] span`,
        ) as HTMLElement | null
      )?.style.width;
    expect(fill("implementation")).toBe("100%");
    expect(fill("Verification")).toBe("40%");
    expect(fill("Context")).toBe("0%");
    expect(fill("Document")).toBe("0%");
    expect(
      container
        .querySelector(
          '[data-testid="phase-bar"] [data-segment="Verification"]',
        )
        ?.getAttribute("data-state"),
    ).toBe("active");
    expect(
      container.querySelector('[data-testid="phase-bar-active-label"]')
        ?.textContent,
    ).toBe("verifying: 2 of 5");
  });
});
