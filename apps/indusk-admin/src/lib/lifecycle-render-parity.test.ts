import {
  GATE_STAGES,
  PHASE_ACTIVITIES,
  PLAN_POSITIONS,
} from "@infinitedusky/indusk-mcp/lifecycle";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bar } from "@/components/bars/Bar";
import {
  ACTIVITY_LABELS,
  POSITION_LABELS,
  STAGE_LABELS,
} from "@/components/bars/labels";

/**
 * admin-ui-phase-progress — A17: the convention's pin.
 *
 * A plan that adds a lifecycle position, activity or gate kind also adds its
 * rendering in the same plan. The label maps are typed `satisfies
 * Record<Union, string>`, so a new member is a type error; this test makes
 * it a NAMED failure — it walks the lifecycle's own lists and asserts each
 * member has a label and renders as a bar segment. The lists come from the
 * package, never restated here, so this cannot agree with a stale copy.
 */

describe("A17 — every lifecycle member has a label and a renderer", () => {
  it("every plan position has a non-empty label", () => {
    const missing = PLAN_POSITIONS.filter(
      (p) => !(POSITION_LABELS as Record<string, string>)[p]?.trim(),
    );
    expect(missing, `positions without a label: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("every phase activity has a non-empty label", () => {
    const missing = PHASE_ACTIVITIES.filter(
      (a) => !(ACTIVITY_LABELS as Record<string, string>)[a]?.trim(),
    );
    expect(
      missing,
      `activities without a label: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every gate stage (plus implementation) has a non-empty label", () => {
    const missing = ["implementation", ...GATE_STAGES].filter(
      (s) => !(STAGE_LABELS as Record<string, string>)[s]?.trim(),
    );
    expect(missing, `stages without a label: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("every plan position renders as a bar segment", () => {
    const html = renderToStaticMarkup(
      createElement(Bar, {
        testId: "parity",
        segments: PLAN_POSITIONS.map((key) => ({
          key,
          state: "pending" as const,
          label: POSITION_LABELS[key],
        })),
      }),
    );
    const missing = PLAN_POSITIONS.filter(
      (p) => !html.includes(`data-segment="${p}"`),
    );
    expect(missing, `positions with no segment: ${missing.join(", ")}`).toEqual(
      [],
    );
  });
});
