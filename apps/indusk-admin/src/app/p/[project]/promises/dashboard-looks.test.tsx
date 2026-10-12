// promise: a-look-reports-like-any-promise
// promise: broken-promises-come-first
// promise: every-promise-is-listed
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  BROKEN,
  type FixtureLook,
  PROJECT,
  PROMISES,
  resetFixture,
  setLooks,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * ui-promises A23, A26: looks on the dashboard and in the nav's broken count,
 * beside the promises. Each look's standing is `promises/standing`'s
 * (`readLookStanding`), mocked from the fixture as `readStanding` is; what
 * these rows read is that the dashboard and the nav count and order what the
 * package decided, and hide no promise doing it.
 *
 *   - a look's row:  `[data-testid="look-row"]` with `data-look="<app>/<look>"`,
 *                    `data-device` and `data-standing`
 *   - the nav count: `[data-testid="nav-promises"] [data-testid="broken-count"]`
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
  usePathname: () => "/p/cockpit-proj/promises",
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
vi.mock("@infinitedusky/indusk-mcp/promises/standing", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).standingMock(),
);
vi.mock("@infinitedusky/indusk-mcp/promises/display", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).displayMock(),
);
vi.mock("@infinitedusky/indusk-mcp/promises/sources", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).sourcesMock(),
);
vi.mock("@/lib/timeline-strip", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).timelineStripMock(),
);
vi.mock("@/lib/registry-client", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).registryClientMock(),
);
vi.mock("@/lib/decisions-reader", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).decisionsReaderMock(),
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
vi.mock("@/lib/project-reader", () => ({
  __esModule: true,
  readAdminRefreshMs: () => 5000,
}));
vi.mock("@/lib/promise-timeline", () => ({
  __esModule: true,
  readTimelineView: async () => undefined,
}));

import PerProjectLayout from "../layout";
import PerProjectPromisesPage from "./page";

const look = (
  name: string,
  device: string,
  standing: FixtureLook["standing"],
  symptom: string | null = null,
): FixtureLook => ({
  app: "admin",
  look: name,
  kind: "screen",
  device,
  standing,
  word: standing,
  at: "2026-10-10T09:30:00.000Z",
  symptom,
});

/** One broken look, one held, one unchecked: the dashboard's looks beside the six promises. */
const LOOKS: FixtureLook[] = [
  look(
    "dashboard.default",
    "phone",
    "broken",
    "dashboard.default @ phone: token --color-dusk approved #c2620b actual #c2620c",
  ),
  look("dashboard.default", "desktop", "held"),
  look("plan.default", "phone", "unchecked"),
];

async function dashboard() {
  const props = {
    params: Promise.resolve({ project: PROJECT }),
    searchParams: Promise.resolve({}),
  } as unknown as Parameters<typeof PerProjectPromisesPage>[0];
  const element = await PerProjectPromisesPage(props);
  const screen = await render(element as React.ReactElement);
  return screen.container as HTMLElement;
}

async function nav() {
  const element = await PerProjectLayout({
    children: <div />,
    params: Promise.resolve({ project: PROJECT }),
  });
  const screen = await render(element as React.ReactElement);
  return screen.container as HTMLElement;
}

beforeEach(() => {
  resetFixture();
  setLooks(LOOKS);
});

describe("A23 — a broken look is counted with the broken promises and listed first", () => {
  it("A23 the nav's broken count is the broken promises and the broken looks", async () => {
    const root = await nav();
    const count = root.querySelector(
      '[data-testid="nav-promises"] [data-testid="broken-count"]',
    );
    expect(count?.textContent?.trim()).toBe(String(BROKEN.length + 1));
  });

  it("A23 the broken look is listed above every promise that holds, naming what broke", async () => {
    const root = await dashboard();
    const broken = root.querySelector(
      '[data-testid="look-row"][data-standing="broken"]',
    );
    expect(broken?.getAttribute("data-look")).toBe("admin/dashboard.default");
    expect(broken?.getAttribute("data-device")).toBe("phone");
    expect(broken?.textContent).toContain("--color-dusk");
    const held = root.querySelector(
      '[data-testid="promise-row"][data-promise="receipts-arrive-within-a-minute"]',
    );
    expect(held).not.toBeNull();
    if (broken && held) {
      expect(
        broken.compareDocumentPosition(held) & Node.DOCUMENT_POSITION_FOLLOWING,
        "the broken look comes before a promise that holds",
      ).toBeTruthy();
    }
  });

  it("A23 with no broken look, the nav counts the broken promises alone", async () => {
    setLooks([look("dashboard.default", "phone", "held")]);
    const root = await nav();
    expect(
      root
        .querySelector(
          '[data-testid="nav-promises"] [data-testid="broken-count"]',
        )
        ?.textContent?.trim(),
    ).toBe(String(BROKEN.length));
  });
});

describe("the nav — Looks under Promises", () => {
  it("the nav links the Looks page, right after Promises", async () => {
    const root = await nav();
    const promises = root.querySelector('[data-testid="nav-promises"]');
    const looks = root.querySelector('[data-testid="nav-looks"]');
    expect(looks?.getAttribute("href")).toBe(`/p/${PROJECT}/looks`);
    expect(promises?.nextElementSibling).toBe(looks);
  });
});

describe("A26 — every promise is still listed, looks beside them", () => {
  it("A26 lists every promise of the registry and the looks too", async () => {
    const root = await dashboard();
    const names = [...root.querySelectorAll('[data-testid="promise-row"]')].map(
      (r) => r.getAttribute("data-promise"),
    );
    expect(names.sort()).toEqual(PROMISES.map((p) => p.name).sort());
    expect(
      root.querySelectorAll('[data-testid="look-row"]').length,
    ).toBeGreaterThan(0);
  });
});
