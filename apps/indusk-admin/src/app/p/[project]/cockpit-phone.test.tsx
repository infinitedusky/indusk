// promise: the-nav-fits-a-phone
import "@/app/globals.css";
import { page, userEvent } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  PROJECT,
  resetFixture,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit, Test Phase 1: the nav on a phone and on a desktop, rendered
 * with the app's real stylesheet at a set viewport (the browser project's
 * iframe is resized with `page.viewport`).
 *
 * The DOM these rows read is the contract Build Phase 4 builds to:
 *   - the nav:            `[data-testid="cockpit-nav"]`, `data-open="true|false"`
 *                         below 760 px, `data-collapsed="true|false"` above
 *   - the menu button:    `[data-testid="nav-menu-button"]`, `aria-expanded`
 *   - the collapse button:`[data-testid="nav-collapse-button"]`, `aria-expanded`
 *
 * The promise page joins A7's widths in Build Phase 3.
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
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/p/cockpit-proj/plan/mid-build",
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
vi.mock("@infinitedusky/indusk-mcp/promises/display", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).displayMock(),
);
vi.mock("@/lib/registry-client", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).registryClientMock(),
);
vi.mock("@/lib/research-reader", () => ({
  __esModule: true,
  readProjectResearch: async () => [],
}));
vi.mock("@/lib/trust-reader", () => ({ projectTrusted: () => true }));
vi.mock("@/lib/project-reader", () => ({
  __esModule: true,
  readAdminRefreshMs: () => 5000,
}));
vi.mock("@infinitedusky/indusk-mcp/promises/sources", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).sourcesMock(),
);
vi.mock("@/lib/timeline-strip", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).timelineStripMock(),
);
vi.mock("@/lib/promise-timeline", () => ({
  __esModule: true,
  readTimelineView: async () => undefined,
}));

import PerProjectLayout from "./layout";
import PerProjectPromisesPage from "./promises/page";
import PlanPage from "./plan/[name]/page";

async function shell(child: "plan" | "dashboard") {
  const params = Promise.resolve({ project: PROJECT });
  const children =
    child === "plan"
      ? await PlanPage({
          params: Promise.resolve({ project: PROJECT, name: "mid-build" }),
        })
      : await PerProjectPromisesPage({ params });
  const element = await PerProjectLayout({
    children: children as React.ReactNode,
    params,
  });
  return render(element as React.ReactElement);
}

function nav(): HTMLElement | null {
  return document.querySelector('[data-testid="cockpit-nav"]');
}
function visibleWidth(el: Element): number {
  const r = el.getBoundingClientRect();
  return Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
}

beforeEach(() => {
  resetFixture();
  try {
    localStorage.clear();
  } catch {
    // storage blocked: the page must still render
  }
});

describe("A6 — at 400 px the nav is a drawer, closed, opened and closed by the menu button", () => {
  it("A6 starts closed and the menu button opens it and closes it again", async () => {
    await page.viewport(400, 800);
    await shell("plan");
    const menu = document.querySelector<HTMLElement>(
      '[data-testid="nav-menu-button"]',
    );
    expect(menu, "no menu button at 400 px").not.toBeNull();
    expect(menu?.getAttribute("aria-expanded")).toBe("false");
    expect(nav()?.getAttribute("data-open")).toBe("false");
    expect(visibleWidth(nav() as Element), "a closed drawer shows nothing").toBe(0);

    await userEvent.click(menu as HTMLElement);
    await vi.waitFor(() => expect(nav()?.getAttribute("data-open")).toBe("true"));
    expect(menu?.getAttribute("aria-expanded")).toBe("true");
    expect(visibleWidth(nav() as Element)).toBeGreaterThan(100);

    await userEvent.click(menu as HTMLElement);
    await vi.waitFor(() => expect(nav()?.getAttribute("data-open")).toBe("false"));
    expect(menu?.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("A7 — at 400 px, with forty plans, no page scrolls sideways", () => {
  for (const which of ["plan", "dashboard"] as const) {
    it(`A7 the ${which} page fits 400 px and leaves its content the width of the screen`, async () => {
      await page.viewport(400, 800);
      await shell(which);
      const root = document.documentElement;
      expect(
        root.scrollWidth,
        `the ${which} page is ${root.scrollWidth}px wide in a ${root.clientWidth}px window`,
      ).toBeLessThanOrEqual(root.clientWidth);
      // The nav is a drawer, so it takes no room from the page: the content
      // is not squeezed into what a 288 px rail leaves.
      const main = document.querySelector("main");
      const width = main?.getBoundingClientRect().width ?? 0;
      expect(
        width,
        `the ${which} page's content is ${Math.round(width)}px of a ${root.clientWidth}px window: a permanent rail takes the rest`,
      ).toBeGreaterThanOrEqual(root.clientWidth - 1);
    });
  }
});

describe("A8 — on a desktop, a collapsed nav is still collapsed after a reload", () => {
  it("A8 collapses to a strip and stays collapsed when the page is rendered again", async () => {
    await page.viewport(1280, 900);
    const first = await shell("plan");
    const collapse = document.querySelector<HTMLElement>(
      '[data-testid="nav-collapse-button"]',
    );
    expect(collapse, "no collapse button at 1280 px").not.toBeNull();
    expect(nav()?.getAttribute("data-collapsed")).toBe("false");
    const openWidth = nav()?.getBoundingClientRect().width ?? 0;

    await userEvent.click(collapse as HTMLElement);
    await vi.waitFor(() =>
      expect(nav()?.getAttribute("data-collapsed")).toBe("true"),
    );
    expect(nav()?.getBoundingClientRect().width ?? openWidth).toBeLessThan(
      openWidth,
    );

    // A reload: the page is built again from nothing, the browser's storage kept.
    await first.unmount();
    await shell("plan");
    await vi.waitFor(() =>
      expect(nav()?.getAttribute("data-collapsed")).toBe("true"),
    );
  });
});
