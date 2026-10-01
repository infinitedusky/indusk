import * as lifecycle from "@infinitedusky/indusk-mcp/lifecycle";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bar } from "@/components/bars/Bar";
import * as labels from "@/components/bars/labels";

/**
 * admin-plan-type — A11. The render-parity convention, over segment states.
 *
 * A plan that adds a lifecycle member adds its rendering in the same plan.
 * `lifecycle-render-parity.test.ts` pins that for positions, activities and
 * gate stages, each of which the lifecycle exports as a runtime list. Segment
 * states were a type only, so nothing could walk them — and this plan adds
 * two (`missing`, `unknown`).
 *
 * The lifecycle is imported as a namespace and the list read off it: a named
 * import of an export that does not exist yet is a link error, which would
 * fail this file to load rather than fail this row.
 */

const states = (): string[] | undefined =>
  (lifecycle as Record<string, unknown>).SEGMENT_STATES as string[] | undefined;

const mapOf = (name: string): Record<string, string> | undefined =>
  (labels as Record<string, unknown>)[name] as
    | Record<string, string>
    | undefined;

describe("A11 — every segment state has a drawing and a label", () => {
  it("the lifecycle exports its segment states as a list, including missing and unknown", () => {
    expect(states(), "lifecycle exports no SEGMENT_STATES list").toBeDefined();
    expect(states()).toEqual(
      expect.arrayContaining([
        "done",
        "active",
        "pending",
        "skipped",
        "missing",
        "unknown",
      ]),
    );
  });

  it("every state has a segment class, a chip class and a word", () => {
    const missing = (states() ?? ["missing", "unknown"]).filter(
      (state) =>
        !mapOf("SEGMENT_CLASS")?.[state]?.trim() ||
        !mapOf("CHIP_CLASS")?.[state]?.trim() ||
        !mapOf("SEGMENT_STATE_LABELS")?.[state]?.trim(),
    );
    expect(
      missing,
      `segment states without a class or a word: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("skipped, missing and unknown are each drawn differently in the bar", () => {
    const drawn = (state: string) => {
      const html = renderToStaticMarkup(
        createElement(Bar, {
          segments: [{ key: "research", state, label: "research" }],
          activeLabel: null,
          caption: "",
          testId: "bar",
          labels: true,
        } as unknown as Parameters<typeof Bar>[0]),
      );
      // Everything that distinguishes a state to the eye: the classes on the
      // segment and on its label, with the state attribute itself removed.
      return html.replace(/data-state="[^"]*"/g, "");
    };
    const skipped = drawn("skipped");
    const missing = drawn("missing");
    const unknown = drawn("unknown");
    expect(missing, "missing is drawn exactly like skipped").not.toBe(skipped);
    expect(unknown, "unknown is drawn exactly like skipped").not.toBe(skipped);
    expect(unknown, "unknown is drawn exactly like missing").not.toBe(missing);
  });

  it("a segment's title says its state in words, not only its name", () => {
    const html = renderToStaticMarkup(
      createElement(Bar, {
        segments: [{ key: "test-plan", state: "missing", label: "test plan" }],
        activeLabel: null,
        caption: "",
        testId: "bar",
      } as unknown as Parameters<typeof Bar>[0]),
    );
    expect(html).toMatch(/title="[^"]*test plan[^"]*missing[^"]*"/);
  });
});
