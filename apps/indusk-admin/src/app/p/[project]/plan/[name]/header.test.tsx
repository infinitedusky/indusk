// promise: a-plan-shows-two-workflows
// promise: every-plan-is-one-click-away
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { PROJECT, resetFixture } from "@/__tests__/helpers/cockpit-fixture";

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

import PlanPage from "./page";

async function pageFor(name: string) {
  const element = await PlanPage({
    params: Promise.resolve({ project: PROJECT, name }),
  });
  const screen = await render(element as React.ReactElement);
  return { screen, root: screen.container as HTMLElement };
}

beforeEach(() => resetFixture());

describe("the plan page's header", () => {
  it("names the plan by its title, with its dates, its Path and the promises it owns", async () => {
    const { root } = await pageFor("alpha-one");
    const header = root.querySelector('[data-testid="plan-header"]');
    expect(header?.querySelector("h1")?.textContent).toBe("Seat holds rework");
    expect(header?.textContent).toContain("alpha-one");
    expect(root.querySelector('[data-testid="plan-dates"]')?.textContent).toBe(
      "started 2026-09-01 · landed 2026-09-10 · released 1.60.0 (2026-09-12)",
    );
    expect(root.querySelector('[data-testid="plan-path"]')?.textContent).toBe(
      "Path: path-alpha",
    );
    const chips = [...root.querySelectorAll('[data-testid="plan-promises"] a')];
    expect(chips).toHaveLength(1);
    expect(chips[0]?.getAttribute("href")).toMatch(
      /\/promises\/seat-holds-never-double-book$/,
    );
    expect(chips[0]?.textContent).toContain("1/1 tests");
  });

  it("shows a plan inside Paths inside Paths with its outermost Path first, and stops at a repeat", async () => {
    const { root } = await pageFor("deep-one");
    expect(root.querySelector('[data-testid="plan-path"]')?.textContent).toBe(
      "Path: path-alpha › path-alpha-inner › path-deep",
    );
  });

  it("keeps Details closed, with every document still on the page beneath it", async () => {
    const { root } = await pageFor("alpha-one");
    const details = root.querySelector('[data-testid="plan-details"]');
    expect(details).not.toBeNull();
    expect((details as HTMLDetailsElement).open).toBe(false);
  });
});
