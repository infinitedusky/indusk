// promise: a-plan-shows-two-workflows
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  changeOnDisk,
  LONG_SKIP_REASON,
  PROJECT,
  resetFixture,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit, Test Phase 1: the plan page as its two workflows, rendered
 * for the fixture's plans (a bugfix, one mid-build, one at review, one with a
 * skipped ritual, one whose ADR is about to be accepted).
 *
 * The DOM these rows read is the contract Build Phase 5 builds to:
 *   - the lists:  `[data-testid="workflow-planning"]` and
 *                 `[data-testid="workflow-release"]`
 *   - a step:     `[data-step="<name>"][data-state="<state>"]` inside its list,
 *                 in order, state one of done | current | needs-you |
 *                 not-yet | skipped (the package's `StepState`)
 *   - a count:    `[data-testid="workflow-count"]` inside each list, as
 *                 `<done> of <total>` (or `<done>/<total>`)
 *
 * Steps are read-only: no control inside a list sets a state.
 */

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ refresh: () => {} }),
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/planning-reader", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).planningReaderMock(),
);
vi.mock("@/lib/promises-reader", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).promisesReaderMock(),
);
// The plan page's brief parts are read by the package from disk (node:fs), which
// the browser project cannot import; these pages have no brief to show.
// The plan page reads each promise's health through the package (node:fs); these pages show none.
vi.mock("@/lib/plan-health", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).planHealthMock(),
);
vi.mock("@infinitedusky/indusk-mcp/plans/parts", () => ({
  readPlanParts: async (_root: string, plan: string) => ({
    plan,
    hasBrief: false,
    hasBriefFile: true,
    promises: [],
    expectations: [],
    looks: [],
    noLooks: null,
    amendments: [],
    amendmentsUnreadable: null,
    description: null,
    briefStatus: null,
  }),
}));
vi.mock("@infinitedusky/indusk-mcp/promises/standing", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).standingMock(),
);
vi.mock("@infinitedusky/indusk-mcp/promises/display", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).displayMock(),
);
vi.mock("@/lib/registry-client", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).registryClientMock(),
);
vi.mock("@/lib/project-reader", () => ({
  __esModule: true,
  readAdminRefreshMs: () => 5000,
}));
vi.mock("@/lib/trust-reader", () => ({ projectTrusted: () => true }));
// What plans wait on and their recorded decisions (plan-cockpit Build Phase 6):
// the reader reaches the session manager and the history file, so it is mocked.
vi.mock("@/lib/decisions-reader", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).decisionsReaderMock(),
);

import PlanPage from "./page";

async function pageFor(name: string) {
  const element = await PlanPage({
    params: Promise.resolve({ project: PROJECT, name }),
  });
  const screen = await render(element as React.ReactElement);
  return { screen, root: screen.container as HTMLElement };
}

type Step = { name: string | null; state: string | null };

function listOf(root: HTMLElement, which: "planning" | "release") {
  return root.querySelector(`[data-testid="workflow-${which}"]`);
}
function stepsOf(root: HTMLElement, which: "planning" | "release"): Step[] {
  return [...(listOf(root, which)?.querySelectorAll("[data-step]") ?? [])].map(
    (el) => ({
      name: el.getAttribute("data-step"),
      state: el.getAttribute("data-state"),
    }),
  );
}
function countOf(root: HTMLElement, which: "planning" | "release") {
  const text = listOf(root, which)
    ?.querySelector('[data-testid="workflow-count"]')
    ?.textContent?.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
  return text ? [Number(text[1]), Number(text[2])] : null;
}
const stateOf = (steps: Step[], name: string) =>
  steps.find((s) => s.name === name)?.state;

beforeEach(() => resetFixture());

describe("A9 — Planning and Release are two lists, each with its own count of steps done", () => {
  it("A9 shows both lists for a plan mid-build, Planning five of five and Release none of six", async () => {
    const { root } = await pageFor("mid-build");
    expect(listOf(root, "planning"), "no Planning list").not.toBeNull();
    expect(listOf(root, "release"), "no Release list").not.toBeNull();
    expect(listOf(root, "planning")).not.toBe(listOf(root, "release"));
    expect(countOf(root, "planning")).toEqual([5, 5]);
    expect(countOf(root, "release")).toEqual([0, 6]);
    expect(stepsOf(root, "planning").map((s) => s.name)).toEqual([
      "Research",
      "Brief",
      "Test plan",
      "Decision",
      "Impl",
    ]);
    expect(stepsOf(root, "release").map((s) => s.name)).toEqual([
      "Build",
      "Falsify",
      "Cleanup",
      "Audit",
      "Review",
      "Release",
    ]);
  });
});

describe("A10 — a plan's steps follow its type, and a skipped ritual reads as skipped", () => {
  it("A10 shows a bugfix no Research or Decision step", async () => {
    const { root } = await pageFor("fix-double-booking");
    const names = stepsOf(root, "planning").map((s) => s.name);
    expect(names.length, "the bugfix has no Planning list").toBeGreaterThan(0);
    expect(names).toEqual(["Brief", "Test plan", "Impl"]);
    expect(names).not.toContain("Research");
    expect(names).not.toContain("Decision");
  });

  it("A10 shows falsification skipped with a reason as skipped, not missing", async () => {
    const { root } = await pageFor("skipped-ritual");
    const release = stepsOf(root, "release");
    expect(release.length, "no Release list").toBeGreaterThan(0);
    expect(stateOf(release, "Falsify")).toBe("skipped");
    expect(stateOf(release, "Falsify")).not.toBe("not-yet");
  });
});

describe("A11 — the steps say where the plan is", () => {
  it("A11 mid-build: Planning complete, Release in progress at Build", async () => {
    const { root } = await pageFor("mid-build");
    const planning = stepsOf(root, "planning");
    expect(planning.length, "no Planning list").toBeGreaterThan(0);
    expect(planning.every((s) => s.state === "done")).toBe(true);
    const release = stepsOf(root, "release");
    expect(stateOf(release, "Build")).toBe("current");
    expect(stateOf(release, "Falsify")).toBe("not-yet");
  });

  it("A11 at review: Build, Falsify, Cleanup and Audit done, Review current", async () => {
    const { root } = await pageFor("at-review");
    const release = stepsOf(root, "release");
    expect(release.length, "no Release list").toBeGreaterThan(0);
    for (const done of ["Build", "Falsify", "Cleanup", "Audit"]) {
      expect(stateOf(release, done), done).toBe("done");
    }
    expect(stateOf(release, "Review")).toBe("current");
    expect(stateOf(release, "Release")).toBe("not-yet");
  });
});

describe("A12 — a step is read from the documents, never set on the page", () => {
  it("A12 changes the Decision step when the ADR's status changes on disk, and the lists hold no controls", async () => {
    const before = await pageFor("adr-flip");
    const planning = stepsOf(before.root, "planning");
    expect(planning.length, "no Planning list").toBeGreaterThan(0);
    expect(["current", "needs-you"]).toContain(stateOf(planning, "Decision"));
    expect(
      before.root.querySelectorAll(
        // The rail's Step is drawn as a button by its approved mockup; here it
        // carries no handler, so it is the one button a list may hold.
        '[data-testid^="workflow-"] :is(button:not([data-component="step"]), input, select, textarea, [role="button"])',
      ),
      "a step has a control that could set it",
    ).toHaveLength(0);
    await before.screen.unmount();

    changeOnDisk("adr-flip", { adrStatus: "accepted", at: "impl-approved" });

    const after = await pageFor("adr-flip");
    expect(stateOf(stepsOf(after.root, "planning"), "Decision")).toBe("done");
  });
});

// promise: a-skipped-step-shows-why-on-request
describe('skip-reason-why — a skipped step reads "skipped" with a "why?" that opens its reason', () => {
  const statusOf = (root: HTMLElement, step: string) =>
    root
      .querySelector(
        `[data-step="${step}"] [data-component="step"] span:last-of-type`,
      )
      ?.textContent?.trim();
  const whyOf = (root: HTMLElement, step: string) =>
    [...root.querySelectorAll(`[data-step="${step}"] button`)].find(
      (b) => b.textContent?.trim() === "why?",
    ) as HTMLElement | undefined;
  // Clicks "why?" and waits for React to render the toggle (aria-expanded flips).
  const click = async (el: HTMLElement) => {
    const was = el.getAttribute("aria-expanded");
    el.click();
    await vi.waitFor(() =>
      expect(el.getAttribute("aria-expanded")).not.toBe(was),
    );
  };

  it('A1 reads "skipped" with a "why?" and keeps the reason off the page', async () => {
    const { root } = await pageFor("skipped-ritual");
    expect(statusOf(root, "Falsify")).toBe("skipped");
    const why = whyOf(root, "Falsify");
    expect(why, 'no "why?" button in the Falsify step').toBeDefined();
    expect(why?.getAttribute("aria-expanded")).toBe("false");
    expect(root.textContent).not.toContain("a docs-only plan");
  });

  it('A2 shows the reason beneath the step when "why?" is opened, and hides it when opened again', async () => {
    const { root } = await pageFor("skipped-ritual");
    const why = whyOf(root, "Falsify");
    expect(why, 'no "why?" button in the Falsify step').toBeDefined();
    await click(why as HTMLElement);
    expect(why?.getAttribute("aria-expanded")).toBe("true");
    expect(root.textContent).toContain("a docs-only plan");
    await click(why as HTMLElement);
    expect(why?.getAttribute("aria-expanded")).toBe("false");
    expect(root.textContent).not.toContain("a docs-only plan");
  });

  it('A3 leaves the status exactly "skipped" for a 950-character reason until "why?" is opened', async () => {
    expect(LONG_SKIP_REASON).toHaveLength(950);
    const { root } = await pageFor("skipped-ritual-long");
    expect(statusOf(root, "Falsify")).toBe("skipped");
    expect(root.textContent).not.toContain(LONG_SKIP_REASON.slice(0, 80));
    const why = whyOf(root, "Falsify");
    expect(why, 'no "why?" button in the Falsify step').toBeDefined();
    await click(why as HTMLElement);
    expect(root.textContent).toContain(LONG_SKIP_REASON.slice(0, 80));
  });

  it('A10 reads "skipped" with a "why?" that opens the reason for a skipped audit', async () => {
    const { root } = await pageFor("skipped-audit");
    expect(statusOf(root, "Audit")).toBe("skipped");
    const why = whyOf(root, "Audit");
    expect(why, 'no "why?" button in the Audit step').toBeDefined();
    expect(root.textContent).not.toContain(
      "a docs-only plan, nothing to audit",
    );
    await click(why as HTMLElement);
    expect(root.textContent).toContain("a docs-only plan, nothing to audit");
  });
});

describe('skip-reason-why A8 — a step with no reason draws with no "why?" (regression guard)', () => {
  it('A8 gives no step of a mid-build plan a "why?" button', async () => {
    const { root } = await pageFor("mid-build");
    expect(stepsOf(root, "release").length).toBeGreaterThan(0);
    const whys = [...root.querySelectorAll("[data-step] button")].filter(
      (b) => b.textContent?.trim() === "why?",
    );
    expect(whys).toHaveLength(0);
  });
});
