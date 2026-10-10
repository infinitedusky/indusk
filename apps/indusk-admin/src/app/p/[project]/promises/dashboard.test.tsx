// promise: every-promise-is-listed
// promise: broken-promises-come-first
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import {
  BROKEN,
  PROJECT,
  PROMISES,
  resetFixture,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit, Test Phase 1: the promises dashboard, rendered for the
 * fixture's registry (six promises, two of them broken). The DOM and the URL
 * these rows read are the contract Build Phase 2 builds to:
 *
 *   - a promise row:   `[data-testid="promise-row"][data-promise="<name>"]`
 *                      (as today), holding its sentence in words, its name
 *                      and its plan's title
 *   - a group:         `[data-testid="promise-group"][data-group="<key>"]`
 *                      with a heading; the keys for `group=state` are the
 *                      standings (broken, being-proven, declared, enforced)
 *   - the query:       `?group=state|plan|path`, `?sort=activity|name|plan`,
 *                      `?q=<text>` — read from the page's `searchParams`
 *
 * The readers are mocked from the fixture; a dashboard that reads through
 * another module (`promises/standing`) adds that mock to the fixture once.
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
vi.mock("@/lib/project-reader", () => ({
  __esModule: true,
  readAdminRefreshMs: () => 5000,
}));
vi.mock("@/lib/promise-timeline", () => ({
  __esModule: true,
  readTimelineView: async () => undefined,
}));

import PerProjectPromisesPage from "./page";

type Query = { group?: string; sort?: string; q?: string };

async function dashboard(query: Query = {}) {
  // The page's props type names only `window` and `source` today; Build Phase
  // 2 adds `group`, `sort` and `q`, and this cast can go with it.
  const props = {
    params: Promise.resolve({ project: PROJECT }),
    searchParams: Promise.resolve(query),
  } as unknown as Parameters<typeof PerProjectPromisesPage>[0];
  const element = await PerProjectPromisesPage(props);
  const screen = await render(element as React.ReactElement);
  return screen.container as HTMLElement;
}

const rowNames = (root: HTMLElement) =>
  [...root.querySelectorAll('[data-testid="promise-row"]')].map((r) =>
    r.getAttribute("data-promise"),
  );

function groupsOf(
  root: HTMLElement,
): Array<{ key: string | null; heading: string; names: Array<string | null> }> {
  return [...root.querySelectorAll('[data-testid="promise-group"]')].map(
    (g) => ({
      key: g.getAttribute("data-group"),
      heading: g.querySelector("h2")?.textContent ?? "",
      names: [...g.querySelectorAll('[data-testid="promise-row"]')].map((r) =>
        r.getAttribute("data-promise"),
      ),
    }),
  );
}

/** Each promise: its name, its sentence in words, its plan's title — literal, as a person reads them. */
const WORDS: Record<string, [sentence: string, planTitle: string]> = {
  "seat-holds-never-double-book": [
    "Seat holds never double book",
    "Seat holds rework",
  ],
  "checkout-never-charges-twice": [
    "Checkout never charges twice",
    "Checkout rebuild",
  ],
  "receipts-arrive-within-a-minute": [
    "Receipts arrive within a minute",
    "Receipts and refunds",
  ],
  "refunds-reach-the-card": ["Refunds reach the card", "Checkout rebuild"],
  "search-results-stay-sorted": [
    "Search results stay sorted",
    "Search ranking",
  ],
  "exports-keep-their-columns": ["Exports keep their columns", "Loose ends"],
};

beforeEach(() => resetFixture());

describe("A18 — the dashboard lists every promise in the registry, in words", () => {
  it("A18 shows each promise's sentence in words, its name and its plan's title", async () => {
    const root = await dashboard();
    expect(rowNames(root).sort()).toEqual(PROMISES.map((p) => p.name).sort());
    for (const p of PROMISES) {
      const row = root.querySelector(
        `[data-testid="promise-row"][data-promise="${p.name}"]`,
      );
      const text = row?.textContent ?? "";
      const [sentence, title] = WORDS[p.name];
      expect(text, `${p.name}: its sentence`).toContain(sentence);
      expect(text, `${p.name}: its name`).toContain(p.name);
      expect(text, `${p.name}: its plan's title`).toContain(title);
    }
  });
});

describe("A19 — grouping puts every promise in exactly one group; sorting by activity puts the latest first", () => {
  it("A19 groups by state: broken apart from the rest, each promise once", async () => {
    const groups = groupsOf(await dashboard({ group: "state" }));
    expect(groups.flatMap((g) => g.names).sort()).toEqual(
      PROMISES.map((p) => p.name).sort(),
    );
    for (const g of groups) {
      expect(
        ["broken", "being-proven", "declared", "enforced"],
        `group ${g.key}`,
      ).toContain(g.key);
    }
    const broken = groups.find((g) => g.key === "broken");
    expect(broken?.names.slice().sort()).toEqual([...BROKEN].sort());
  });

  it("A19 groups by plan: a plan's promises together, headed by the plan's title", async () => {
    const groups = groupsOf(await dashboard({ group: "plan" }));
    expect(groups.flatMap((g) => g.names).sort()).toEqual(
      PROMISES.map((p) => p.name).sort(),
    );
    const checkout = groups.find((g) =>
      g.names.includes("checkout-never-charges-twice"),
    );
    expect(checkout?.names.slice().sort()).toEqual([
      "checkout-never-charges-twice",
      "refunds-reach-the-card",
    ]);
    expect(checkout?.heading).toContain("Checkout rebuild");
  });

  it("A19 groups by Path: the plans of one Path together, a plan in no Path still in one group", async () => {
    const groups = groupsOf(await dashboard({ group: "path" }));
    expect(groups.flatMap((g) => g.names).sort()).toEqual(
      PROMISES.map((p) => p.name).sort(),
    );
    const together = (a: string, b: string) =>
      groups.some((g) => g.names.includes(a) && g.names.includes(b));
    // beta-one and beta-two are both in path-beta; gamma-one is in path-gamma.
    expect(
      together(
        "checkout-never-charges-twice",
        "receipts-arrive-within-a-minute",
      ),
    ).toBe(true);
    expect(
      together("checkout-never-charges-twice", "search-results-stay-sorted"),
    ).toBe(false);
  });

  it("A19 sorts by latest activity, the most recently seen first", async () => {
    const names = rowNames(
      await dashboard({ group: "state", sort: "activity" }),
    );
    const order = (n: string) => names.indexOf(n);
    // seen 2026-10-10T09, 2026-10-08, 2026-10-07
    expect(order("receipts-arrive-within-a-minute")).toBeGreaterThanOrEqual(0);
    expect(order("receipts-arrive-within-a-minute")).toBeLessThan(
      order("search-results-stay-sorted"),
    );
    expect(order("search-results-stay-sorted")).toBeLessThan(
      order("refunds-reach-the-card"),
    );
  });
});

describe("A20 — filtering by text matches a promise's sentence, its name and its plan", () => {
  it("A20 matches the sentence in words", async () => {
    // "double book" is in the sentence; the name spells it "double-book".
    expect(rowNames(await dashboard({ q: "double book" }))).toEqual([
      "seat-holds-never-double-book",
    ]);
  });

  it("A20 matches the name", async () => {
    // "charges-twice" is only in the name; the sentence has a space.
    expect(rowNames(await dashboard({ q: "charges-twice" }))).toEqual([
      "checkout-never-charges-twice",
    ]);
  });

  it("A20 matches the plan, whatever the case", async () => {
    // "search ranking" is the plan's title; the promise's own words are "search results".
    expect(rowNames(await dashboard({ q: "search ranking" }))).toEqual([
      "search-results-stay-sorted",
    ]);
  });
});

describe("A23 — broken promises are listed first, the latest break first", () => {
  it("A23 puts the two broken promises at the top, checkout (broken 10-10) before seat holds (10-09)", async () => {
    const names = rowNames(await dashboard());
    expect(names.slice(0, BROKEN.length)).toEqual([...BROKEN]);
    expect(
      names
        .slice(BROKEN.length)
        .some((n) => (BROKEN as readonly (string | null)[]).includes(n)),
    ).toBe(false);
  });
});
