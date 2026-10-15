// promise: a-plan-page-shows-the-parts-of-its-brief
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROJECT,
  root,
  setUpProject,
  tearDownProject,
} from "@/__tests__/helpers/looks-page";
import PlanBriefPage from "@/app/p/[project]/plan/[name]/brief/page";
import PlanDocumentPage from "@/app/p/[project]/plan/[name]/doc/[doc]/page";
import PlanPage from "@/app/p/[project]/plan/[name]/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  notFound: () => {
    throw new Error("not found");
  },
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

/**
 * The approved plan page (`plan.working`, `plan.phases`, `plan.documents`):
 * the status first and open, every other part a closed row in the mockups'
 * order, Phases listing each phase with its items and their notes, Documents a
 * row for each document the plan has, closed until opened, then showing the document in place.
 */

const PLAN = "brief-as-the-contract";

const BRIEF = `---
title: "Brief as the contract"
status: accepted
workflow: feature
---

# Brief as the contract

## Expectations

1. **A person approves a plan from its brief alone.**
   - Measure: whether the approval was given without opening the ADR
   - Look: at the close of the first plan built under the rule

## Promises

### This plan makes

1. **\`a-plan-page-shows-the-parts-of-its-brief\`** (state). A plan's page shows its promises, expectations and looks.

### Existing promises

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

## Looks

### This plan makes

1. **\`plan.working\`**. The plan page while it is built.

### Existing looks

**Must not break**

None.

**Changes**

None.

**Replaces**

None.
`;

const IMPL = `---
status: in-progress
---
# impl

### Build Phase 1: First

- [x] Draw it
  - Note: drawn with care
- [x] Build it

### Build Phase 2: Second

- [x] Start it
  - Note: started
- [ ] Finish it

### Build Phase 3: Third

- [ ] Not yet
`;

beforeEach(() => {
  setUpProject();
  const dir = join(root, ".indusk", "planning", PLAN);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.md"), BRIEF);
  writeFileSync(join(dir, "impl.md"), IMPL);
  writeFileSync(
    join(dir, "test-plan.md"),
    "---\nstatus: written\n---\n# Test plan\n\nThe test plan text.\n",
  );
});
afterEach(tearDownProject);

const params = (doc = "") =>
  Promise.resolve({ project: PROJECT, name: PLAN, doc });

async function planPage(): Promise<string> {
  const element = await PlanPage({ params: params() });
  return renderToStaticMarkup(element as React.ReactElement);
}

/** The part's `<details>` opening tag and its closed-row text. */
function part(html: string, name: string): { tag: string; row: string } {
  const at = html.indexOf(`data-part="${name}"`);
  expect(at, `no ${name} part`).toBeGreaterThan(-1);
  const tag = html.slice(
    html.lastIndexOf("<details", at),
    html.indexOf(">", at) + 1,
  );
  const summary = html.slice(at, html.indexOf("</summary>", at));
  return {
    tag,
    row: summary
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

describe("the plan page draws the approved layout", () => {
  it("puts the status first and folds every other part, in the mockups' order", async () => {
    const html = await planPage();
    const order = [
      "plan-status",
      'data-part="promises"',
      'data-part="expectations"',
      'data-part="looks"',
      'data-part="phases"',
      'data-part="documents"',
      'data-component="history-panel"',
    ].map((m) => html.indexOf(m));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const name of [
      "promises",
      "expectations",
      "looks",
      "phases",
      "documents",
    ])
      expect(part(html, name).tag).not.toMatch(/\sopen(=|\s|>)/);
    expect(html).not.toContain("Read the brief");
  });

  it("says on each closed row one line computed from the plan's data", async () => {
    const html = await planPage();
    expect(part(html, "promises").row).toContain("1 · 0 enforced");
    expect(part(html, "expectations").row).toContain("· 1");
    expect(part(html, "looks").row).toContain("0 of 1 approved");
    expect(part(html, "phases").row).toContain("Phase 2 of 3 · 3 of 5 done");
    expect(part(html, "documents").row).toContain("3 documents");
  });

  it("lists each phase with items done of total and its state, and its items with their notes", async () => {
    const html = await planPage();
    const phase = (n: number) => {
      const at = html.indexOf(`data-phase="build-${n}"`);
      expect(at, `no phase ${n}`).toBeGreaterThan(-1);
      return html.slice(at, html.indexOf("</details>", at));
    };
    expect(phase(1)).toContain("2 of 2");
    expect(phase(1)).toContain("done ✓");
    expect(phase(2)).toContain("1 of 2");
    expect(phase(2)).toContain("in progress");
    expect(phase(3)).toContain("not started");
    expect(phase(1)).toContain("☑");
    expect(phase(1)).toContain("Note: drawn with care");
    expect(phase(2)).toContain("☐");
  });

  it("lists each document the plan has as a row, closed by default, that opens in place to the document", async () => {
    const html = await planPage();
    const row = (slug: string) => {
      const at = html.indexOf(`data-document="${slug}"`);
      expect(at, `no ${slug} row`).toBeGreaterThan(-1);
      const start = html.lastIndexOf("<details", at);
      return {
        tag: html.slice(start, html.indexOf(">", at) + 1),
        whole: html.slice(start, html.indexOf("</details>", at)),
      };
    };
    for (const slug of ["test-plan", "impl", "brief"]) {
      expect(row(slug).tag).not.toMatch(/\sopen(=|\s|>)/);
    }
    expect(row("test-plan").whole).toContain(
      `href="/p/${PROJECT}/plan/${PLAN}/doc/test-plan"`,
    );
    expect(row("test-plan").whole).toContain("Test plan");
    expect(row("test-plan").whole).toContain("written");
    expect(row("test-plan").whole).toContain("The test plan text.");
    expect(row("impl").whole).toContain("in-progress, 3 of 5");
    expect(row("brief").whole).toContain("A person approves a plan");
    expect(html).not.toContain('data-document="research"');
    expect(html).not.toContain('data-document="audit"');
  });
});

describe("a plan's document on its own page", () => {
  it("renders a document the plan has", async () => {
    const html = renderToStaticMarkup(
      (await PlanDocumentPage({
        params: params("test-plan"),
      })) as React.ReactElement,
    );
    expect(html).toContain("The test plan text.");
  });

  it("is a 404 for a document the plan does not have", async () => {
    await expect(PlanDocumentPage({ params: params("audit") })).rejects.toThrow(
      "not found",
    );
    await expect(
      PlanDocumentPage({ params: params("nonsense") }),
    ).rejects.toThrow("not found");
  });

  it("/brief is where the plan is written: the brief's parts and the brief beside the agent's column", async () => {
    const html = renderToStaticMarkup(
      (await PlanBriefPage({ params: params() })) as React.ReactElement,
    );
    expect(html).toContain('data-testid="plan-parts"');
    expect(html).toContain('data-testid="brief-agent"');
    expect(html).toContain("A person approves a plan");
  });
});
