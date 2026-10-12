import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Badge, type BadgeVariant } from "./Badge";

/**
 * T9: each trajectory state's Badge variant renders with a recognizable
 * color class so pass/fail status is visually legible at a glance.
 *
 * We assert the className contains a known foundation colour token per
 * variant — not the exact RGB. The point is that "passing" carries the `ok`
 * tokens and "blocked" the `bad` ones, distinct from each other.
 */
describe("Badge — color-coded trajectory states (T9)", () => {
  const cases: Array<[BadgeVariant, RegExp]> = [
    ["passing", /ok/],
    ["blocked", /bad/],
    ["skipped", /warn/],
    ["planned", /idle/],
    ["writable", /idle/],
    ["written", /dusk/],
    ["unknown", /ground/],
    ["neutral", /idle/],
  ];

  for (const [variant, colorPattern] of cases) {
    it(`renders ${variant} with ${colorPattern.source} color tokens`, async () => {
      const { container } = await render(
        <Badge variant={variant}>{variant}</Badge>,
      );
      const span = container.querySelector("span");
      expect(span).not.toBeNull();
      expect(span?.className).toMatch(colorPattern);
    });
  }

  it("passing and blocked are visually distinct", async () => {
    const { container: pContainer } = await render(
      <Badge variant="passing">ok</Badge>,
    );
    const { container: bContainer } = await render(
      <Badge variant="blocked">err</Badge>,
    );
    const pClass = pContainer.querySelector("span")?.className ?? "";
    const bClass = bContainer.querySelector("span")?.className ?? "";
    // Passing and blocked must carry DIFFERENT primary color tokens.
    expect(pClass).toMatch(/ok/);
    expect(bClass).toMatch(/bad/);
    expect(pClass).not.toBe(bClass);
  });
});
