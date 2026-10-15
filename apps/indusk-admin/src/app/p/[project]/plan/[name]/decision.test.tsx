// promise: decisions-wait-in-one-place
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { PROJECT, resetFixture } from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit A14, the page's half: a waiting plan's page shows exactly one
 * decision card — the one `planWaiting` names for it — beside its workflows,
 * and no *What happened* list (the plan mockups draw none); a
 * plan waiting on nothing shows no card. The card's own controls are
 * `components/cockpit/DecisionCard.test.tsx`'s.
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
  return (await render(element as React.ReactElement)).container as HTMLElement;
}

const cards = (root: HTMLElement) =>
  root.querySelectorAll('[data-testid="decision-card"]');

beforeEach(() => resetFixture());

describe("A14 — a waiting plan's page shows exactly one decision", () => {
  it("A14 each waiting plan's page has one card, for what it waits on", async () => {
    for (const [plan, on] of [
      ["asking-plan", "question"],
      ["awaiting-approval", "approval"],
      ["at-review", "review"],
    ] as const) {
      const root = await pageFor(plan);
      expect(cards(root), `cards on ${plan}`).toHaveLength(1);
      expect(cards(root)[0]?.getAttribute("data-on")).toBe(on);
    }
  });

  it("A14 a plan waiting on nothing shows no card", async () => {
    expect(cards(await pageFor("mid-build"))).toHaveLength(0);
  });

  it("the page draws no What happened list: the plan mockups do not draw one", async () => {
    // The history is still recorded on main by `plans/history`; the plan page
    // draws what its approved mockups draw, and they hold the decision card only.
    const root = await pageFor("at-review");
    expect(root.querySelector('[data-testid="plan-history"]')).toBeNull();
  });
});
