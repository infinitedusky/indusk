import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PhaseRow } from "./PhaseRow";

/** The approved `phase-row` mockups: closed to a name, count and state; open to its items. */
describe("PhaseRow", () => {
  it("is closed by default, with its name, items done of total and state", async () => {
    const { container } = await render(
      <PhaseRow name="Phase 4" count="8 of 12" state="in progress" tone="doing">
        <p>the items</p>
      </PhaseRow>,
    );
    const row = container.querySelector("details") as HTMLDetailsElement;
    expect(row.open).toBe(false);
    const head = row.querySelector("summary")?.textContent ?? "";
    expect(head).toContain("Phase 4");
    expect(head).toContain("8 of 12");
    expect(head).toContain("in progress");
  });

  it("opens to show its items", async () => {
    const { container } = await render(
      <PhaseRow name="Phase 4" count="8 of 12" state="in progress" tone="doing">
        <p>the items</p>
      </PhaseRow>,
    );
    const row = container.querySelector("details") as HTMLDetailsElement;
    row.querySelector("summary")?.click();
    expect(row.open).toBe(true);
    expect(row.textContent).toContain("the items");
  });

  it("with a destination it is a link to its own page and does not unfold", async () => {
    const { container } = await render(
      <PhaseRow
        name="Brief"
        state="accepted"
        tone="done"
        href="/p/x/doc/brief"
      />,
    );
    expect(container.querySelector("details")).toBeNull();
    const link = container.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/p/x/doc/brief");
    expect(link.textContent).toContain("accepted");
  });

  // promise: technical-detail-opens-on-request
  it("an open row shows the phase's paragraph above its items", async () => {
    const { container } = await render(
      <PhaseRow
        name="Phase 4"
        count="8 of 12"
        state="in progress"
        tone="doing"
        open
        summary="This phase makes the plan page show each phase's paragraph."
      >
        <p>the items</p>
      </PhaseRow>,
    );
    const row = container.querySelector("details") as HTMLDetailsElement;
    const text = row.textContent ?? "";
    expect(text).toContain("This phase makes the plan page show");
    expect(text.indexOf("This phase makes")).toBeLessThan(
      text.indexOf("the items"),
    );
  });
});
