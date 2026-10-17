// promise: a-plan-shows-two-workflows
// promise: every-plan-is-one-click-away
// promise: a-plan-reads-by-its-title
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  PROJECT,
  resetFixture,
  titleOf,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit, Build Phase 5: the plan page's header carries what the package
 * knows of the plan — its title and dates, the Paths that declare it, and the
 * promises it owns with their passing tests — beside the two workflows.
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
vi.mock("@/lib/plan-health", () => ({
  __esModule: true,
  readPlanHealth: async () => ({}),
}));
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

beforeEach(() => resetFixture());

describe("the plan page's frame", () => {
  it("draws the crumb and the plan's title, as the plan mockups do (plan-stories A12)", async () => {
    const { root } = await pageFor("alpha-one");
    const header = root.querySelector('[data-testid="plan-header"]');
    expect(header?.querySelector("h1")?.textContent).toBe(titleOf("alpha-one"));
    expect(header?.textContent).toContain(
      `${PROJECT} / Plans / ${titleOf("alpha-one")}`,
    );
  });

  it("keeps the handle in the page's address data (plan-stories A12)", async () => {
    const { root } = await pageFor("alpha-one");
    expect(
      root
        .querySelector('[data-testid="plan-detail"]')
        ?.getAttribute("data-plan-name"),
    ).toBe("alpha-one");
  });

  it("draws no dates, Path or promise chips in the header, and no Details of documents", async () => {
    // The approved mockups draw none of them: the promises are a part of the
    // brief beneath the header, and the documents are read on the brief page.
    for (const plan of ["alpha-one", "deep-one"]) {
      const { root } = await pageFor(plan);
      for (const testid of [
        "plan-header-facts",
        "plan-dates",
        "plan-path",
        "plan-promises",
        "plan-details",
        "plan-history",
      ])
        expect(
          root.querySelector(`[data-testid="${testid}"]`),
          `${testid} on ${plan}`,
        ).toBeNull();
    }
  });

  it("keeps the workflows rail beside what the plan waits on", async () => {
    const { root } = await pageFor("alpha-one");
    expect(root.querySelector('[data-testid="plan-stage"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="plan-workflows"]')).not.toBeNull();
  });
});
