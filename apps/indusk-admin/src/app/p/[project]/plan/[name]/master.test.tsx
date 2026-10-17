// promise: a-master-plan-tells-its-story
// promise: decisions-wait-in-one-place
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  DESCRIPTIONS,
  HISTORY,
  PROJECT,
  resetFixture,
  SESSIONS,
  titleOf,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-stories A1-A3: a master plan's page tells its story. The cockpit
 * fixture's `path-beta` is the master: `beta-one` released, `beta-two` being
 * built, and `beta-three` declared with a title and description but no folder.
 * The row's number slot is a node the page passes in carrying
 * `data-testid="subplan-number"`, as the nav passes `PlanNumber`, so the
 * component's own markup holds no test hook.
 */

// What a test changes about the master it opens: whether the project is trusted
// and which amendments the package reads for the plan (plan-stories A25).
const state = vi.hoisted(() => ({
  trusted: true,
  worktree: false,
  amendments: [] as unknown[],
}));

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
// A master worked in its own worktree is one a session can be started in: the
// mock hands `path-beta` a worktree when a test says so.
vi.mock("@/lib/planning-reader", async () => {
  const mock = (
    await import("@/__tests__/helpers/cockpit-fixture")
  ).planningReaderMock();
  return {
    ...mock,
    readActivePlans: async () =>
      (await mock.readActivePlans()).map((p) =>
        state.worktree && p.name === "path-beta"
          ? {
              ...p,
              worktree: {
                path: "/mock/wt/path-beta",
                branch: "plan/path-beta",
              },
            }
          : p,
      ),
  };
});
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
    amendments: state.amendments,
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
vi.mock("@/lib/trust-reader", () => ({
  projectTrusted: () => state.trusted,
}));
// What plans wait on and their recorded decisions (plan-cockpit Build Phase 6):
// the reader reaches the session manager and the history file, so it is mocked.
vi.mock("@/lib/decisions-reader", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).decisionsReaderMock(),
);

import PlanPage from "./page";

beforeEach(() => {
  resetFixture();
  state.trusted = true;
  state.worktree = false;
  state.amendments = [];
});

const open = async (name: string) =>
  render(
    (await PlanPage({
      params: Promise.resolve({ project: PROJECT, name }),
    })) as React.ReactElement,
  );

describe("a master plan's page tells its story", () => {
  it("A1 opens with the master's title, what it is for, and its counts", async () => {
    const screen = await open("path-beta");
    await expect
      .element(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent(titleOf("path-beta"));
    await expect
      .element(screen.getByTestId("master-purpose"))
      .toHaveTextContent(DESCRIPTIONS["path-beta"]);
    await expect
      .element(screen.getByTestId("master-counts"))
      .toHaveTextContent("1 of 3 released");
    await expect
      .element(screen.getByTestId("master-counts"))
      .toHaveTextContent("1 in draft");
    await expect
      .element(screen.getByTestId("master-counts"))
      .toHaveTextContent("1 queued");
  });

  it("A2 lists every declared plan in order, numbered, by title with its description", async () => {
    const screen = await open("path-beta");
    const rows = [
      ...screen.container.querySelectorAll('[data-component="subplan-row"]'),
    ];
    expect(
      rows.map(
        (r) => r.querySelector("[data-testid=subplan-number]")?.textContent,
      ),
    ).toEqual(["1", "2", "3"]);
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual([
      titleOf("beta-one"),
      titleOf("beta-two"),
      "Beta three, queued",
    ]);
    expect(rows[0]?.textContent).toContain(DESCRIPTIONS["beta-one"]);
  });

  it("A3 a released row opens its plan, a draft says its stage, a queued one opens nothing", async () => {
    const screen = await open("path-beta");
    const row = (s: string) =>
      screen.container.querySelector(
        `[data-component="subplan-row"][data-state="${s}"]`,
      );
    expect(row("released")?.getAttribute("href")).toBe(
      `/p/${PROJECT}/plan/beta-one`,
    );
    expect(row("released")?.textContent).toContain("Released");
    expect(row("draft")?.getAttribute("href")).toBe(
      `/p/${PROJECT}/plan/beta-two`,
    );
    expect(row("draft")?.textContent).toContain("Research");
    expect(row("queued")?.tagName).not.toBe("A");
    expect(row("queued")?.textContent).toContain("Queued");
    expect(row("queued")?.textContent).toContain("The third, not started.");
  });
});

describe("a master plan's page keeps what any plan page shows around its story", () => {
  const asking = {
    plan: "path-beta",
    kind: "planning" as const,
    question: {
      requestId: "req-master",
      questions: [
        {
          question: "Which beta plan goes first?",
          options: [{ label: "beta-one" }, { label: "beta-two" }],
        },
      ],
    },
  };

  afterEach(() => {
    SESSIONS.splice(SESSIONS.indexOf(asking), 1);
    delete HISTORY["path-beta"];
  });

  it("A25 a master that waits on a question shows the decision card with its question", async () => {
    SESSIONS.push(asking);
    const screen = await open("path-beta");
    const card = screen.container.querySelector(
      '[data-testid="decision-card"]',
    );
    expect(card?.getAttribute("data-on")).toBe("question");
    expect(card?.textContent).toContain("Which beta plan goes first?");
  });

  it("A25 a master with a waiting amendment shows it, with the way to approve it", async () => {
    state.amendments = [
      {
        part: "promise",
        name: "a-master-plan-tells-its-story",
        was: "old",
        now: "new",
      },
    ];
    const screen = await open("path-beta");
    expect(
      screen.container.querySelector('[data-testid="waiting-amendments"]'),
    ).not.toBeNull();
  });

  it("A25 a master shows the trust notice, its history and the way to ask about the plan", async () => {
    state.trusted = false;
    state.worktree = true;
    HISTORY["path-beta"] = [
      {
        decision: "The master is written. Approve it?",
        answer: "Approve",
        by: "person",
        at: "2026-10-01T09:00:00.000Z",
      },
    ];
    const screen = await open("path-beta");
    expect(screen.container.textContent).toContain(
      "doesn't trust this project",
    );
    expect(
      screen.container.querySelectorAll('[data-testid="history-entry"]'),
    ).toHaveLength(1);
    await expect.element(screen.getByText("Ask about this plan")).toBeVisible();
  });
});
