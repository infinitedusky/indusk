import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PartSection } from "./PartSection";

/** The approved `part-section` mockups: a closed row of name and one line, opening to the part. */
describe("PartSection", () => {
  it("is closed by default, showing its name and its one line", async () => {
    const { container } = await render(
      <PartSection title="Promises" summary="4 · 1 enforced">
        <p>the pills</p>
      </PartSection>,
    );
    const part = container.querySelector("details") as HTMLDetailsElement;
    expect(part.open).toBe(false);
    const row = part.querySelector("summary")?.textContent ?? "";
    expect(row).toContain("Promises");
    expect(row).toContain("4 · 1 enforced");
  });

  it("opens to show what it holds", async () => {
    const { container } = await render(
      <PartSection title="Promises" summary="4 · 1 enforced">
        <p>the pills</p>
      </PartSection>,
    );
    const part = container.querySelector("details") as HTMLDetailsElement;
    part.querySelector("summary")?.click();
    expect(part.open).toBe(true);
    expect(part.textContent).toContain("the pills");
  });

  it("is drawn open when asked", async () => {
    const { container } = await render(
      <PartSection title="Looks" summary="3 of 3 approved" open>
        <p>rows</p>
      </PartSection>,
    );
    expect(
      (container.querySelector("details") as HTMLDetailsElement).open,
    ).toBe(true);
  });

  it("an empty part is a plain row: its name and one line, no disclosure to open", async () => {
    const { container } = await render(
      <PartSection title="Promises" summary="0 · 0 enforced" empty />,
    );
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
    expect(container.textContent).toContain("Promises");
    expect(container.textContent).toContain("0 · 0 enforced");
    expect(container.textContent).not.toMatch(/[▸▾]/);
  });
});
