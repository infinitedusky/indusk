// promise: a-promise-page-shows-its-proof
// promise: the-admin-keeps-what-it-heard
// promise: a-break-opens-a-fix-in-one-click

import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  HEARD_DAY,
  PROJECT,
  PROOFS,
  resetFixture,
} from "@/__tests__/helpers/cockpit-fixture";

/**
 * plan-cockpit, Build Phase 3: a promise's page, rendered for the fixture. The
 * package's `proofOf` is answered from the fixture's `PROOFS`; what the page
 * must show of it is the contract:
 *
 *   - the heading is the promise's sentence in words
 *   - sections: "Tests that back it", "Where it is watched", "Last thirty
 *     days", "History", each `[data-testid="proof-<tests|marks|days|history>"]`
 *   - a test row: `[data-testid="proof-row"]` with its id, state and files
 *   - a mark: `[data-testid="proof-mark"]`
 *   - a day: `[data-testid="day-bar"][data-source][data-day]`, `data-broken`
 *     "true" on a day with a break, `data-count` the breaks that day
 *   - the banner: `[data-testid="promise-banner"]`, and the button
 *     `[data-testid="start-fix"]` only while the promise is broken
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
  usePathname: () => "/p/cockpit-proj/promises/seat-holds-never-double-book",
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
vi.mock("@infinitedusky/indusk-mcp/promises/proof", async () =>
  (await import("@/__tests__/helpers/cockpit-fixture")).proofMock(),
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

import PromisePage from "./page";

async function open(name: string) {
  const element = await PromisePage({
    params: Promise.resolve({ project: PROJECT, name }),
  });
  const screen = await render(element as React.ReactElement);
  return screen.container as HTMLElement;
}

const text = (el: Element | null | undefined) => el?.textContent ?? "";
const q = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-testid="${id}"]`);
const all = (root: HTMLElement, id: string) => [
  ...root.querySelectorAll(`[data-testid="${id}"]`),
];

beforeEach(() => {
  resetFixture();
  vi.restoreAllMocks();
});

describe("A24 — every promise has its own page, with its own address", () => {
  it("A24 the page is the promise's sentence in words, with the proof's four sections", async () => {
    const root = await open("seat-holds-never-double-book");
    expect(root.querySelector("h1")?.textContent).toBe(
      "Seat holds never double book",
    );
    expect(text(root)).toContain("seat-holds-never-double-book");
    expect(text(root)).toContain("Two guests are never given the same seat.");
    for (const section of ["tests", "marks", "days", "history"]) {
      expect(
        q(root, `proof-${section}`),
        `no ${section} section`,
      ).not.toBeNull();
    }
    expect(text(q(root, "proof-tests"))).toContain("Tests that back it");
    expect(text(q(root, "proof-marks"))).toContain("Where it is watched");
    expect(text(q(root, "proof-history"))).toContain("History");
  });

  it("A24 a name the registry does not hold is not found", async () => {
    await expect(open("no-such-promise")).rejects.toThrow("not found");
  });

  it("A24 the page names the plan that owns it, linking to it, and the promises beside it", async () => {
    const root = await open("seat-holds-never-double-book");
    const plan = [...root.querySelectorAll("a")].find(
      (a) => a.getAttribute("href") === `/p/${PROJECT}/plan/alpha-one`,
    );
    expect(plan, "no link to the owning plan").toBeDefined();
    expect(text(plan)).toContain("Seat holds rework");
  });
});

describe("A25 — every test row, in any plan, with its state and its files", () => {
  it("A25 lists the rows of an active and of an archived plan with their files", async () => {
    const root = await open("seat-holds-never-double-book");
    const rows = all(root, "proof-row");
    expect(rows).toHaveLength(2);
    expect(text(rows[0])).toContain("A1");
    expect(text(rows[0])).toContain("passing");
    expect(text(rows[0])).toContain("src/seats/hold.test.ts");
    expect(text(rows[1])).toContain("A4");
    expect(text(rows[1])).toContain("old-seat-rework");
    expect(text(rows[1])).toContain("src/seats/release.test.ts");
    expect(text(rows[1])).toContain("src/seats/race.test.ts");
  });

  it("A25 a promise no row names says so", async () => {
    const root = await open("exports-keep-their-columns");
    expect(all(root, "proof-row")).toHaveLength(0);
    expect(text(q(root, "proof-tests"))).toContain("No test row names it");
  });
});

describe("A26 — where it was marked, and when last held or broken", () => {
  it("A26 lists each place with its last held and last broken; a place never broken says so", async () => {
    const root = await open("seat-holds-never-double-book");
    const marks = all(root, "proof-mark");
    expect(marks).toHaveLength(2);
    expect(text(marks[0])).toContain("seat-holds");
    expect(text(marks[0])).toContain("hold");
    expect(text(marks[0])).toContain("2026-10-10 07:00");
    expect(text(marks[0])).toContain("2026-10-09 12:00");
    expect(text(marks[1])).toContain("release");
    expect(text(marks[1])).toContain("never broken");
  });

  it("A26 a promise never seen says not seen yet", async () => {
    const root = await open("checkout-never-charges-twice");
    expect(all(root, "proof-mark")).toHaveLength(0);
    expect(text(q(root, "proof-marks"))).toContain("not seen yet");
  });
});

describe("A27 — thirty days, held and broken, per source", () => {
  it("A27 draws thirty bars for each source the project reads, with broken days marked", async () => {
    const root = await open("seat-holds-never-double-book");
    for (const source of ["local", "production"]) {
      const bars = all(root, "day-bar").filter(
        (b) => b.getAttribute("data-source") === source,
      );
      expect(bars, `${source} bars`).toHaveLength(30);
    }
    const broken = all(root, "day-bar").filter(
      (b) => b.getAttribute("data-broken") === "true",
    );
    expect(
      broken.map(
        (b) => `${b.getAttribute("data-source")} ${b.getAttribute("data-day")}`,
      ),
    ).toEqual(["production 2026-10-08", "production 2026-10-09"]);
  });

  it("A27 a source whose held counts could not be read says why", async () => {
    PROOFS["receipts-arrive-within-a-minute"].unread = {
      local: "Jaeger did not answer",
    };
    const root = await open("receipts-arrive-within-a-minute");
    expect(text(q(root, "proof-days"))).toContain("Jaeger did not answer");
    PROOFS["receipts-arrive-within-a-minute"].unread = {};
  });
});

describe("A28 — the history, dated", () => {
  it("A28 lists declared, confirmed and each incident, with dates, in order", async () => {
    const root = await open("seat-holds-never-double-book");
    const lines = [
      ...(q(root, "proof-history")?.querySelectorAll("li") ?? []),
    ].map(text);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("2026-09-01");
    expect(lines[0]).toContain("declared");
    expect(lines[1]).toContain("2026-09-12");
    expect(lines[2]).toContain("2026-10-10");
    expect(lines[2]).toContain("INC-7");
  });
});

describe("A29 — a break the tests do not catch", () => {
  it("A29 a broken promise whose every test passes says the tests miss the case", async () => {
    const root = await open("seat-holds-never-double-book");
    expect(text(q(root, "promise-banner"))).toContain("broken");
    expect(text(q(root, "promise-banner"))).toContain(
      "the tests miss the case",
    );
  });

  it("A29 a broken promise with a test not yet passing does not say it", async () => {
    const root = await open("checkout-never-charges-twice");
    expect(text(q(root, "promise-banner"))).toContain("broken");
    expect(text(q(root, "promise-banner"))).not.toContain(
      "the tests miss the case",
    );
  });
});

describe("A30 — a violation recorded while no page was open", () => {
  it("A30 appears on its day, counted, though the page was not open when it happened", async () => {
    const root = await open("seat-holds-never-double-book");
    const bar = all(root, "day-bar").find(
      (b) =>
        b.getAttribute("data-source") === "production" &&
        b.getAttribute("data-day") === HEARD_DAY,
    );
    expect(bar, `no bar for ${HEARD_DAY}`).toBeDefined();
    expect(bar?.getAttribute("data-count")).toBe("2");
    expect(bar?.getAttribute("data-broken")).toBe("true");
  });
});

describe("A31 — Start a fix plan", () => {
  it("A31 is offered on a broken promise's page and on no other", async () => {
    expect(
      q(await open("seat-holds-never-double-book"), "start-fix"),
    ).not.toBeNull();
  });

  it("A31 is not offered on a promise that holds", async () => {
    expect(
      q(await open("receipts-arrive-within-a-minute"), "start-fix"),
    ).toBeNull();
  });

  it("A31 asks the admin to start the fix for this project and promise, and shows the session it started", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (init?.method === "POST")
        calls.push({
          url: String(url),
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
      return Response.json({ id: "s-1" }, { status: 201 });
    });
    const root = await open("seat-holds-never-double-book");
    await userEvent.click(q(root, "start-fix") as HTMLElement);
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toEqual({
      url: "/api/promises/seat-holds-never-double-book/fix",
      body: { project: PROJECT },
    });
    await vi.waitFor(() =>
      expect(q(root, "fix-session"), "no session panel").not.toBeNull(),
    );
  });

  it("A31 shows why when the admin refuses", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ error: "a session is already running" }, { status: 409 }),
    );
    const root = await open("seat-holds-never-double-book");
    await userEvent.click(q(root, "start-fix") as HTMLElement);
    await vi.waitFor(() =>
      expect(text(root)).toContain("a session is already running"),
    );
  });
});
