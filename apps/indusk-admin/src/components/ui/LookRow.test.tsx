import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { LookRow } from "./LookRow";

// promise: a-look-says-whether-it-is-a-mockup-or-a-story

/**
 * new-project-flow A42: every row on the looks page says whether it is a
 * mockup or a story. The kind is its own line above the name, as the approved
 * `look-row.mockup` and `look-row.story` draw it, so a long name wraps without
 * running under the status chip.
 */
describe("A42 — a look row says whether it is a mockup or a story", () => {
  it("A42 a mockup row is labelled Mockup, above its name", async () => {
    const screen = await render(
      <LookRow kind="mockup" name="new-project.no-parent" approval="proposed" />,
    );
    await expect.element(screen.getByText("Mockup")).toBeVisible();
    const kind = screen.getByText("Mockup").element().getBoundingClientRect();
    const name = screen
      .getByText("new-project.no-parent")
      .element()
      .getBoundingClientRect();
    expect(kind.bottom).toBeLessThanOrEqual(name.top);
  });

  it("A42 a story row is labelled Story, and not Mockup", async () => {
    const screen = await render(
      <LookRow kind="story" name="message.agent-working" approval="proposed" />,
    );
    await expect.element(screen.getByText("Story")).toBeVisible();
    expect(screen.getByText("Mockup").elements()).toHaveLength(0);
  });

  it("A42 a long name wraps inside its column and never reaches the status chip", async () => {
    const long = "message.agent-working-with-a-very-long-state-name-that-keeps-going";
    const screen = await render(
      <div style={{ width: "320px" }}>
        <LookRow kind="story" name={long} approval="proposed" />
      </div>,
    );
    const name = screen.getByText(long).element().getBoundingClientRect();
    const chip = screen.getByText("proposed").element().getBoundingClientRect();
    expect(name.right).toBeLessThanOrEqual(chip.left);
  });
});
