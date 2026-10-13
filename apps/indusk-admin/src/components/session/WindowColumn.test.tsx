import "@/app/globals.css";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { WindowColumn } from "./WindowColumn";

/**
 * brief-as-the-contract A31 — a regression guard: the agent column is fitted
 * only beside the brief. On a phone the brief page is one column, and a
 * window-fitted height would clip the column as it scrolls into view.
 */

afterEach(() => page.viewport(414, 896));

const heightOf = async () => {
  const screen = await render(
    <WindowColumn data-testid="col">
      <p>agent</p>
    </WindowColumn>,
  );
  const el = screen.getByTestId("col").element() as HTMLElement;
  return el.style.height;
};

describe("A31 — the column is fitted to the window only in two columns", () => {
  it("beside the brief (wide), it is given a height", async () => {
    await page.viewport(1200, 800);
    expect(await heightOf()).toMatch(/px$/);
  });

  it("on a phone (one column), it is given none", async () => {
    await page.viewport(500, 800);
    expect(await heightOf()).toBe("");
  });
});
