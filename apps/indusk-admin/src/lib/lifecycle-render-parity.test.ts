import {
  GATE_STAGES,
  PHASE_ACTIVITIES,
  PLAN_POSITIONS,
} from "@infinitedusky/indusk-mcp/lifecycle";
import {
  PROMISE_KINDS,
  PROMISE_STATES,
} from "@infinitedusky/indusk-mcp/promises/registry";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bar } from "@/components/bars/Bar";
import {
  ACTIVITY_LABELS,
  POSITION_LABELS,
  PROMISE_KIND_LABELS,
  PROMISE_STATE_CHIP,
  STAGE_LABELS,
} from "@/components/bars/labels";

/**
 * day-promises — A21: the same pin over the promise unions. A promise state
 * or kind added to `lib/promises/vocabulary.ts` without a chip or a label is
 * a type error in `labels.ts` and a NAMED failure here.
 */
describe("A21 — every promise state and kind has a chip and a label", () => {
  it("every promise state has a chip with a label, an accessible name and a class", () => {
    const missing = PROMISE_STATES.filter((s) => {
      const chip = (
        PROMISE_STATE_CHIP as Record<
          string,
          { label?: string; aria?: string; className?: string }
        >
      )[s];
      return (
        !chip?.label?.trim() || !chip.aria?.trim() || !chip.className?.trim()
      );
    });
    expect(
      missing,
      `promise states without a chip: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every promise kind has a non-empty label", () => {
    const missing = PROMISE_KINDS.filter(
      (k) => !(PROMISE_KIND_LABELS as Record<string, string>)[k]?.trim(),
    );
    expect(
      missing,
      `promise kinds without a label: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});

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
