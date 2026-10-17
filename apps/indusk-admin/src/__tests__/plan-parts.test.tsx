// promise: a-plan-page-shows-the-parts-of-its-brief
// promise: a-look-has-the-plan-that-owns-it
// promise: a-promise-reads-the-same-on-its-plan-page
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attrOf,
  PROJECT,
  root,
  setUpProject,
  tearDownProject,
} from "@/__tests__/helpers/looks-page";
import PlanPage from "@/app/p/[project]/plan/[name]/page";
import { PlanParts } from "@/components/plan/PlanParts";

// LiveRefresh, drawn on the plan page, reads the app router, which a markup render has not mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  notFound: () => {
    throw new Error("not found");
  },
}));

/**
 * brief-as-the-contract A5, A15: the plan's page over a real project — a git
 * copy of the looks fixture registered in a temporary InDusk home, holding a
 * plan whose brief lists a promise, an expectation and a look — rendered to
 * markup. Node, not the browser project: the page reads the plan, the
 * registry and the mockups through the package. The look at each device is a
 * browser's to measure (A16, `plan-parts.contract.test.ts`).
 *
 * What the page marks:
 *   - a part:  `[data-part="promises|expectations|looks"]`
 *   - a look:  `[data-testid="plan-look"][data-look="<name>"]` with `data-approval`
 *   - the brief: a link to `/p/<project>/plan/<plan>/brief`
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

const MOCKUP = `<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="../tokens.css"></head>
<body><p style="color: var(--color-ink)">working</p></body></html>
`;

beforeEach(() => {
  setUpProject();
  const dir = join(root, ".indusk", "planning", PLAN);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.md"), BRIEF);
  writeFileSync(
    join(dir, "impl.md"),
    "---\nstatus: in-progress\n---\n# impl\n",
  );
  const demo = join(root, ".indusk", "mockups", "demo");
  writeFileSync(join(demo, "screens", "plan.working.html"), MOCKUP);
  const screens = JSON.parse(readFileSync(join(demo, "screens.json"), "utf-8"));
  screens.screens.push({ name: "plan", states: ["working"] });
  writeFileSync(join(demo, "screens.json"), JSON.stringify(screens, null, 2));
});
afterEach(tearDownProject);

async function planPage({ plan }: { plan: string }): Promise<string> {
  const element = await PlanPage({
    params: Promise.resolve({ project: PROJECT, name: plan }),
  });
  return renderToStaticMarkup(element as React.ReactElement);
}

/** The opening tag of the look's row on the plan's page. */
function lookRow(html: string, look: string): string {
  const start = html.indexOf(`data-look="${look}"`);
  expect(start, `no row for ${look}`).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<", start), html.indexOf(">", start) + 1);
}

describe("A15 — a plan's page shows the parts of its brief", () => {
  it("A15 the plan page shows its promises, expectations and looks", async () => {
    const html = await planPage({ plan: "brief-as-the-contract" });
    for (const part of ["promises", "expectations", "looks"])
      expect(html).toContain(`data-part="${part}"`);
    expect(html).toContain(
      `href="/p/${PROJECT}/plan/brief-as-the-contract/brief"`,
    );
  });
});

describe("A5 — a plan's looks are listed beside its promises", () => {
  it("A5 a plan's looks are listed beside its promises with their approval", async () => {
    const html = await planPage({ plan: "brief-as-the-contract" });
    expect(attrOf(lookRow(html, "plan.working"), "data-approval")).toBe(
      "proposed",
    );
  });
});

/**
 * A plan's promise chips take the colour the Promises page gives each health
 * (`PROMISE_HEALTH_CHIP`): red bg-bad, fixed bg-ink-soft, green bg-ok,
 * unverified and grey bg-idle, amber bg-warn. A promise telemetry says
 * nothing about keeps the colour of its registry state. `PartPromise.health`
 * arrives with the build phase, so the parts are built through a cast.
 */
type Health = "red" | "fixed" | "green" | "unverified" | "amber" | "grey";
interface DrawnPromise {
  name: string;
  state: string;
  health?: Health;
}

function chipsOf(promises: DrawnPromise[]): string {
  const parts = {
    plan: "p",
    hasBrief: true,
    hasBriefFile: true,
    promises: promises.map((p) => ({ ...p, sentence: `${p.name} holds.` })),
    expectations: [],
    looks: [],
    noLooks: null,
    amendments: [],
    amendmentsUnreadable: null,
    description: null,
    briefStatus: "accepted",
  };
  return renderToStaticMarkup(
    <PlanParts
      parts={parts as unknown as Parameters<typeof PlanParts>[0]["parts"]}
      looksHref="/p/x/looks?"
    />,
  );
}

/** The foundation colour class on the dot inside the promise's chip. */
function dotOf(html: string, promise: string): string {
  const start = html.indexOf(`data-promise="${promise}"`);
  expect(start, `no chip for ${promise}`).toBeGreaterThan(-1);
  const dot = html.slice(start).match(/size-dot rounded-pill (bg-[a-z-]+)/);
  return dot?.[1] ?? "no dot";
}

describe("A1 — a broken promise is the broken colour on its plan's page", () => {
  // clause: a-promise-reads-the-same-on-its-plan-page/broken-reads-broken
  it("A1 an enforced behaviour promise with health red draws bg-bad, not bg-ok", () => {
    const html = chipsOf([
      { name: "seats-held", state: "enforced", health: "red" },
    ]);
    expect(dotOf(html, "seats-held")).toBe("bg-bad");
  });
});

describe("A2 — each health reads on the plan's page as on the Promises page", () => {
  // clause: a-promise-reads-the-same-on-its-plan-page/each-health-alike
  it("A2 fixed, green, unverified, amber and grey each take the Promises page's colour; a state promise its registry colour", () => {
    const html = chipsOf([
      { name: "broke-and-fixed", state: "enforced", health: "fixed" },
      { name: "seen-holding", state: "enforced", health: "green" },
      { name: "no-signal", state: "enforced", health: "unverified" },
      { name: "known-broken-one", state: "known-broken", health: "amber" },
      { name: "retired-one", state: "retired", health: "grey" },
      { name: "a-state-promise", state: "enforced" },
    ]);
    expect(dotOf(html, "broke-and-fixed"), "broke and fixed").toBe(
      "bg-ink-soft",
    );
    expect(dotOf(html, "seen-holding"), "seen holding").toBe("bg-ok");
    expect(dotOf(html, "no-signal"), "no signal is never green").toBe(
      "bg-idle",
    );
    expect(dotOf(html, "known-broken-one"), "known broken").toBe("bg-warn");
    expect(dotOf(html, "retired-one"), "retired").toBe("bg-idle");
    expect(dotOf(html, "a-state-promise"), "a state promise").toBe("bg-ok");
  });
});
