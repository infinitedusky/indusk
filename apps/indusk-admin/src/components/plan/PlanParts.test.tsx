// promise: a-plan-page-shows-the-parts-of-its-brief
import "@/app/globals.css";
import type { PlanParts as Parts } from "@infinitedusky/indusk-mcp/plans/parts";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PlanParts } from "./PlanParts";

/**
 * cockpit-redraw, `brief.empty` — a plan with no brief file shows the three
 * parts of its brief at 0, as plain rows with nothing to open; a brief outside
 * the contract shape (a file) still shows nothing, so it never reads "0
 * promises"; and a part with nothing in it is a plain row in any brief.
 */

const parts = (over: Partial<Parts>): Parts => ({
  plan: "p",
  hasBrief: false,
  hasBriefFile: false,
  promises: [],
  expectations: [],
  looks: [],
  noLooks: null,
  amendments: [],
  amendmentsUnreadable: null,
  description: null,
  briefStatus: null,
  ...over,
});

const show = (p: Parts, zero = true) =>
  render(<PlanParts parts={p} looksHref="/looks?" zeroWithoutBrief={zero} />);

const part = (el: Element, name: string) =>
  el.querySelector(`[data-part="${name}"]`);

describe("a plan with no brief file", () => {
  it("shows Promises, Expectations and Looks each saying 0, as rows that do not open", async () => {
    const { container } = await show(parts({}));
    expect(container.textContent).toContain("0 · 0 enforced");
    for (const name of ["promises", "expectations", "looks"]) {
      const row = part(container, name);
      expect(row, `${name} is not drawn`).not.toBeNull();
      expect(row?.tagName, `${name} is a disclosure`).not.toBe("DETAILS");
      expect(row?.getAttribute("data-empty")).toBe("true");
    }
    expect(container.textContent).not.toMatch(/[▸▾]/);
  });

  it("shows nothing where the page did not ask for the zero state (the plan page)", async () => {
    const { container } = await show(parts({}), false);
    expect(container.querySelector("[data-part]")).toBeNull();
  });
});

describe("a brief that is a file outside the contract shape", () => {
  it("still hides the parts: it must not read as a brief with 0 promises", async () => {
    const { container } = await show(parts({ hasBriefFile: true }));
    expect(container.querySelector("[data-part]")).toBeNull();
    expect(container.textContent ?? "").not.toContain("0 · 0 enforced");
  });
});

describe("a contract brief with a part that has nothing in it", () => {
  it("draws that part as a plain row and the others as disclosures", async () => {
    const { container } = await show(
      parts({
        hasBrief: true,
        hasBriefFile: true,
        promises: [
          { name: "a-promise", sentence: "It holds.", state: "declared" },
        ],
      }),
    );
    expect(part(container, "promises")?.tagName).toBe("DETAILS");
    expect(part(container, "expectations")?.getAttribute("data-empty")).toBe(
      "true",
    );
    expect(part(container, "looks")?.getAttribute("data-empty")).toBe("true");
  });
});
