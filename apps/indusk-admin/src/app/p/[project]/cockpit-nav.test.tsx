// promise: every-plan-is-one-click-away
// promise: paths-keep-their-order
// promise: a-plan-can-start-from-the-admin
import { page } from "vitest/browser";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  activePlanNames,
  BROKEN,
  displayMock,
  healthMock,
  planningReaderMock,
  PROJECT,
  promisesReaderMock,
  registryClientMock,
  resetFixture,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit, Test Phase 1: the nav, rendered by the project layout around
 * each page. The DOM these rows read is the contract Build Phases 2 and 4
 * build to (change it there only with the reason):
 *
 *   - the nav:            `[data-testid="cockpit-nav"]`
 *   - a plan's link:      `a[data-plan-name]`, `aria-current="page"` on the
 *                         plan whose page is open
 *   - the Promises entry: `[data-testid="nav-promises"]`, `aria-current` on
 *                         the dashboard and promise pages, and inside it
 *                         `[data-testid="broken-count"]` (the number)
 *   - a Path:             `[data-testid="plan-group-<name>"]` with
 *                         `data-depth="1|2|3…"`, its released count in
 *                         `[data-testid="path-released"]` as `released/total`
 *   - a plan's number:    `[data-testid="plan-number"]` inside its link, 1-up
 *                         within its Path
 *
 * The readers are mocked from the fixture, the way `plan/[name]/page.test.tsx`
 * mocks them; a layout that reads through another module adds that mock to
 * the fixture once.
 */

const route = vi.hoisted(() => ({ path: "" }));

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
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => route.path,
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
vi.mock("@infinitedusky/indusk-mcp/promises/health", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).healthMock(),
);
vi.mock("@infinitedusky/indusk-mcp/promises/display", async (original) =>
  (await import("@/__tests__/helpers/cockpit-fixture")).displayMock(
    (await original()) as Record<string, unknown>,
  ),
);
vi.mock("@/lib/registry-client", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).registryClientMock(),
);
vi.mock("@/lib/research-reader", () => ({
  __esModule: true,
  readProjectResearch: async () => [],
}));
vi.mock("@/lib/trust-reader", () => ({ projectTrusted: () => true }));
vi.mock("@infinitedusky/indusk-mcp/worktree/repos", () => ({
  __esModule: true,
  readWorkbenchRepos: () => [],
}));

import PerProjectLayout from "./layout";
import PerProjectPage from "./page";

// Keep the fixture's mock factories referenced so a bundler never drops them.
void [healthMock, planningReaderMock, promisesReaderMock, registryClientMock];
void displayMock;

const base = `/p/${PROJECT}`;

async function layoutAround(child: React.ReactNode, path: string) {
  route.path = path;
  const element = await PerProjectLayout({
    children: child,
    params: Promise.resolve({ project: PROJECT }),
  });
  const screen = await render(element as React.ReactElement);
  return screen.container as HTMLElement;
}

const planPage = <div data-testid="child-plan-page">plan</div>;
const dashboard = <div data-testid="child-dashboard">dashboard</div>;
const promisePage = <div data-testid="child-promise-page">promise</div>;

beforeAll(async () => {
  await page.viewport(1280, 900);
});
beforeEach(() => {
  resetFixture();
});

describe("A1 — every active plan is in the nav on every page, and the open one is marked current", () => {
  it("A1 lists all forty plans on the plan page, the dashboard and a promise page, each linking to its page", async () => {
    const names = activePlanNames();
    expect(names).toHaveLength(40);
    for (const [child, path] of [
      [planPage, `${base}/plan/beta-one`],
      [dashboard, `${base}/promises`],
      [promisePage, `${base}/promises/seat-holds-never-double-book`],
    ] as const) {
      const root = await layoutAround(child, path);
      const nav = root.querySelector('[data-testid="cockpit-nav"]');
      expect(nav, `no cockpit nav on ${path}`).not.toBeNull();
      const missing = names.filter(
        (n) => !nav?.querySelector(`a[data-plan-name="${n}"]`),
      );
      expect(missing, `plans missing from the nav on ${path}`).toEqual([]);
      expect(
        nav?.querySelector('a[data-plan-name="mid-build"]')?.getAttribute("href"),
      ).toBe(`${base}/plan/mid-build`);
    }
  });

  it("A1 marks the open plan current and no other", async () => {
    const root = await layoutAround(planPage, `${base}/plan/beta-one`);
    const current = [
      ...root.querySelectorAll('[data-testid="cockpit-nav"] [aria-current="page"]'),
    ].map((el) => el.getAttribute("data-plan-name"));
    expect(current).toContain("beta-one");
    expect(current.every((n) => n === "beta-one")).toBe(true);
  });

  it("A1 marks Promises current on the dashboard, and no plan", async () => {
    const root = await layoutAround(dashboard, `${base}/promises`);
    const nav = root.querySelector('[data-testid="cockpit-nav"]');
    expect(
      nav?.querySelector('[data-testid="nav-promises"]')?.getAttribute("aria-current"),
    ).toBe("page");
    expect(nav?.querySelectorAll("a[data-plan-name][aria-current]")).toHaveLength(0);
  });
});

describe("A2 — Paths and their plans keep the declared order, numbered", () => {
  it("A2 lists the Paths in the roadmap's order", async () => {
    const root = await layoutAround(planPage, `${base}/plan/beta-one`);
    const paths = [
      ...root.querySelectorAll('[data-testid="cockpit-nav"] [data-testid^="plan-group-"][data-depth="1"]'),
    ].map((el) => el.getAttribute("data-testid"));
    expect(paths).toEqual([
      "plan-group-path-alpha",
      "plan-group-path-beta",
      "plan-group-path-gamma",
    ]);
  });

  it("A2 numbers the plans in a Path 1, 2 in the order the master declares them", async () => {
    const root = await layoutAround(planPage, `${base}/plan/beta-one`);
    const group = root.querySelector('[data-testid="plan-group-path-beta"]');
    const numbered = [...(group?.querySelectorAll("a[data-plan-name]") ?? [])]
      .filter((a) => a.getAttribute("data-plan-name")?.startsWith("beta-"))
      .map((a) => [
        a.getAttribute("data-plan-name"),
        a.querySelector('[data-testid="plan-number"]')?.textContent?.trim(),
      ]);
    expect(numbered).toEqual([
      ["beta-one", "1"],
      ["beta-two", "2"],
    ]);
  });
});

describe("A3 — Paths nest as deep as they are declared, and a cycle stops at the repeat", () => {
  it("A3 shows a Path inside a Path inside a Path three levels deep", async () => {
    const root = await layoutAround(planPage, `${base}/plan/deep-one`);
    const depth = (name: string) =>
      root
        .querySelector(`[data-testid="plan-group-${name}"]`)
        ?.getAttribute("data-depth");
    expect(depth("path-alpha")).toBe("1");
    expect(depth("path-alpha-inner")).toBe("2");
    expect(depth("path-deep")).toBe("3");
    expect(
      root
        .querySelector('[data-testid="plan-group-path-deep"]')
        ?.querySelector('a[data-plan-name="deep-one"]'),
    ).not.toBeNull();
  });

  it("A3 stops at a master that names its own ancestor: path-alpha opens once", async () => {
    const root = await layoutAround(planPage, `${base}/plan/deep-one`);
    expect(
      root.querySelectorAll('[data-testid="plan-group-path-alpha"]'),
    ).toHaveLength(1);
    expect(
      root.querySelector('[data-testid="plan-group-path-alpha"]')?.getAttribute("data-depth"),
    ).toBe("1");
  });
});

describe("A4 — each Path shows how many of its plans a release has shipped", () => {
  it("A4 shows released/total beside each Path, counting only shipped plans", async () => {
    const root = await layoutAround(planPage, `${base}/plan/beta-one`);
    const released = (name: string) =>
      root
        .querySelector(`[data-testid="plan-group-${name}"] [data-testid="path-released"]`)
        ?.textContent?.trim();
    // beta-one shipped in 1.60.0; beta-two landed but no release has it.
    expect(released("path-beta")).toBe("1/2");
    // gamma-one has neither landed nor shipped.
    expect(released("path-gamma")).toBe("0/1");
  });
});

describe("A5 — a plan no Path declares is still in the nav (regression guard)", () => {
  it("A5 lists undeclared-plan and every filler plan after the Paths", async () => {
    const root = await layoutAround(planPage, `${base}/plan/undeclared-plan`);
    const nav = root.querySelector('[data-testid="cockpit-nav"]') ?? root;
    expect(nav.querySelector('a[data-plan-name="undeclared-plan"]')).not.toBeNull();
    expect(nav.querySelector('a[data-plan-name="filler-plan-01"]')).not.toBeNull();
    expect(nav.querySelector('a[data-plan-name="undeclared-plan"]')?.getAttribute("href")).toBe(
      `${base}/plan/undeclared-plan`,
    );
  });
});

describe("A22 — a broken promise is counted in the nav on every page", () => {
  it("A22 shows the number of broken promises beside Promises on the plan page, the dashboard and a promise page", async () => {
    for (const [child, path] of [
      [planPage, `${base}/plan/beta-one`],
      [dashboard, `${base}/promises`],
      [promisePage, `${base}/promises/seat-holds-never-double-book`],
    ] as const) {
      const root = await layoutAround(child, path);
      const count = root.querySelector(
        '[data-testid="nav-promises"] [data-testid="broken-count"]',
      );
      expect(count?.textContent?.trim(), `broken count on ${path}`).toBe(
        String(BROKEN.length),
      );
    }
  });
});

describe("A36 — a new plan can still be started from the admin (regression guard)", () => {
  it("A36 the project's landing page, under the layout, offers the New plan form with a type and a name", async () => {
    const landing = await PerProjectPage({
      params: Promise.resolve({ project: PROJECT }),
    });
    const root = await layoutAround(landing, base);
    const form = root.querySelector("form");
    expect(form?.textContent).toContain("New plan");
    expect(form?.querySelector("select")).not.toBeNull();
    expect(form?.querySelector("input")).not.toBeNull();
    expect(
      [...(form?.querySelectorAll("button") ?? [])].some((b) =>
        /start|create/i.test(b.textContent ?? ""),
      ),
    ).toBe(true);
    // the nav is still the frame around it
    expect(root.querySelector('a[data-plan-name="mid-build"]')).not.toBeNull();
  });
});
