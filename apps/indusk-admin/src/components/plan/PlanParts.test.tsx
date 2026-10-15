// promise: a-plan-page-shows-the-parts-of-its-brief
// promise: technical-detail-opens-on-request
import "@/app/globals.css";
import type { PlanParts as Parts } from "@infinitedusky/indusk-mcp/plans/parts";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { extractPhases } from "@/lib/phases";
import { PhasesPart, PlanParts } from "./PlanParts";

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

/**
 * story-first-phases A27 — a parsed impl's phase paragraph and task detail
 * reach the plan page whole: the page is drawn from `extractPhases` over impl
 * text, not from hand-built props, so a dropped field between the parser and
 * the page shows here. The paragraph is formatted (two paragraphs stay two,
 * code shows as code) and the detail sits in a closed Technical fold.
 */
describe("a phase drawn from a parsed impl", () => {
  const impl = [
    "### Build Phase 1: The save check holds the shape",
    "",
    "**Tier**: med — the work step's default",
    "",
    "The script that checks an impl file learns the new rule in `validate-impl-structure.js`.",
    "",
    "After this phase a plan can be written in the shape.",
    "",
    "- [ ] The save check refuses a phase with no summary",
    "  <details><summary>Technical</summary>",
    "",
    "  Runs `phaseSummaryProblems` over the body.",
    "",
    "  ```ts",
    "  phaseSummaryProblems(body, true);",
    "  ```",
    "",
    "  </details>",
    "",
  ].join("\n");

  const drawn = () =>
    render(<PhasesPart phases={extractPhases(impl)} activeKey={null} />);

  it("shows the paragraph formatted: two paragraphs, its code shown as a code element", async () => {
    const { container } = await drawn();
    const row = container.querySelector(
      '[data-testid="plan-phase"]',
    ) as HTMLElement;
    expect(row, "the phase row is not drawn").not.toBeNull();
    expect(row.textContent).toContain("learns the new rule in");
    expect(row.textContent).toContain("After this phase a plan can be written");
    expect(
      row.textContent,
      "a literal backtick reached the page",
    ).not.toContain("`validate-impl-structure.js`");
    const code = [...row.querySelectorAll("code")].map((c) => c.textContent);
    expect(code).toContain("validate-impl-structure.js");
    const paragraphs = [...row.querySelectorAll("p")].map((p) => p.textContent);
    expect(
      paragraphs.filter((t) => t?.includes("After this phase")),
      "the second paragraph runs into the first",
    ).toHaveLength(1);
    expect(
      paragraphs.some(
        (t) =>
          t?.includes("learns the new rule") && t.includes("After this phase"),
      ),
    ).toBe(false);
  });

  it("keeps the task's detail in a closed Technical fold, opened to code shown as code", async () => {
    const { container } = await drawn();
    const fold = container.querySelector(
      '[data-testid="plan-phase"] li details',
    ) as HTMLDetailsElement;
    expect(fold, "the task has no Technical fold").not.toBeNull();
    expect(fold.open).toBe(false);
    expect(fold.querySelector("pre code")?.textContent).toContain(
      "phaseSummaryProblems(body, true)",
    );
    expect(fold.textContent).not.toMatch(/<\/?(details|summary)/);
  });
});
