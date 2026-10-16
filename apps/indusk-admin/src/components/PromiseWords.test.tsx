import type { HealthRow } from "@infinitedusky/indusk-mcp/promises/health";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";
import type { Strip } from "@/lib/timeline-strip";

// PlanList names a queued plan by the package's title rule, whose module reads
// the filesystem; the browser project cannot import it, so the rule is stubbed.
vi.mock("@infinitedusky/indusk-mcp/promises/display", () => ({
  __esModule: true,
  planTitle: (_title: unknown, handle: string) => handle,
}));

// `next/link` pulls in Node-only globals the browser runtime lacks; a plain anchor does.
vi.mock("next/link", () => {
  function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return { default: MockLink, __esModule: true };
});

import {
  PROMISE_HEALTH_CHIP,
  PROMISE_STATE_CHIP,
} from "@/components/bars/labels";
import { PlanList } from "@/components/PlanList";
import { HealthChip, HealthDetail } from "@/components/PromiseHealth";
import { PromisesDashboard } from "@/components/Promises";
import { PromiseTimeline, TimelineEmpty } from "@/components/PromiseTimeline";
import { LastThirtyDays } from "@/components/promise/PromiseProof";
import { type DashboardRow, parseQuery } from "@/lib/promise-dashboard";

// promise: a-promise-is-upheld-or-broken

/**
 * A6 and A7 of one-promise-language, the admin's half: the words a person
 * reads about a promise's standing. A6: the chips, the timeline's cells, the
 * health lines and the plan list's warning say upheld, holding, broken, held,
 * broke or no signal — never violated, violation, unverified, not seen or no
 * runs. A7: a promise nothing has reported on reads no signal, never green or
 * holding. Both are browser tests, as `Promises.test.tsx` is.
 */

/** What no person should read about a promise any more. */
const OLD_WORDS = /violat|unverified|not seen|no runs/i;

const chipText = (c: { label: string }) => c.label;

describe("A6 — the admin's chips say holding, broken and no signal", () => {
  it("each health chip carries its new word", () => {
    expect(
      Object.fromEntries(
        Object.entries(PROMISE_HEALTH_CHIP).map(([k, v]) => [k, chipText(v)]),
      ),
    ).toEqual({
      red: "broken",
      fixed: "broke — fixed",
      green: "holding",
      unverified: "no signal",
      amber: "known broken",
      grey: "retired",
    });
  });

  it("the declared state's chip for a broken promise says known broken", () => {
    const chips = PROMISE_STATE_CHIP as Record<string, { label: string }>;
    expect(chips["known-broken"]?.label).toBe("known broken");
  });

  it("no chip's label or accessible name uses an old word", () => {
    for (const chip of [
      ...Object.values(PROMISE_HEALTH_CHIP),
      ...Object.values(PROMISE_STATE_CHIP),
    ]) {
      expect(chip.label).not.toMatch(OLD_WORDS);
      expect(chip.aria).not.toMatch(OLD_WORDS);
    }
  });

  it("a rendered health chip shows its word and names it for assistive tech", async () => {
    const row: HealthRow = { health: "red", violations: 2, lastSeen: null };
    const { container } = await render(<HealthChip row={row} />);
    expect(container.textContent).toContain("broken");
    const aria =
      container
        .querySelector("[data-testid=promise-health]")
        ?.getAttribute("aria-label") ?? "";
    expect(aria).not.toMatch(OLD_WORDS);
  });
});

const strip = (): Strip => ({
  window: "7d",
  cells: (["red", "purple", "green", "empty"] as const).map((state, i) => ({
    from: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
    state,
    atLeast: false,
    runs: state === "empty" ? 0 : 1,
  })),
  bands: [],
  openBreak: null,
});

describe("A6 — the timeline's cells say broke, held and no signal", () => {
  it("each cell's title names its state in the new words", async () => {
    const { container } = await render(
      <PromiseTimeline promise="p" source="local" strip={strip()} />,
    );
    const titles = Array.from(
      container.querySelectorAll("[data-testid=timeline-cell]"),
    ).map((c) => c.getAttribute("title") ?? "");
    expect(titles[0]).toContain("broke — open");
    expect(titles[1]).toContain("broke — fixed");
    expect(titles[2]).toContain("held");
    expect(titles[3]).toContain("no signal");
    for (const t of titles) expect(t).not.toMatch(OLD_WORDS);
  });
});

describe("A6 — the health lines say breaks and no signal", () => {
  it("a promise with breaks counts breaks, not violations", async () => {
    const row: HealthRow = {
      health: "red",
      violations: 3,
      lastSeen: null,
      environment: "production",
    };
    const { container } = await render(<HealthDetail row={row} />);
    expect(container.textContent).toContain("3 breaks");
    expect(container.textContent).not.toMatch(OLD_WORDS);
  });

  it("a promise nothing has reported on says no signal, not not seen", async () => {
    const row: HealthRow = {
      health: "unverified",
      violations: null,
      lastSeen: null,
    };
    const { container } = await render(<HealthDetail row={row} />);
    expect(container.textContent).toContain("no signal");
    expect(container.textContent).not.toMatch(OLD_WORDS);
  });
});

describe("A6 — the plan list's warning", () => {
  it("says the plan holds a promise broken in the window", async () => {
    const plan: Plan = {
      name: "seat-holds",
      title: "seat-holds",
      description: null,
      status: "draft",
      archived: false,
    };
    const { container } = await render(
      <PlanList
        active={[plan]}
        archived={[]}
        masterOrder={["seat-holds"]}
        red={new Set(["seat-holds"])}
      />,
    );
    const dot = container.querySelector("[data-testid=plan-health]");
    expect(dot?.getAttribute("aria-label")).toBe(
      "holds a promise broken in the window",
    );
    expect(dot?.getAttribute("title")).toBe(
      "holds a promise broken in the window",
    );
  });
});

describe("A7 — a promise nothing has reported on reads no signal in the admin", () => {
  it("its chip says no signal, and is neither holding nor green", async () => {
    const row: HealthRow = {
      health: "unverified",
      violations: null,
      lastSeen: null,
    };
    const { container } = await render(<HealthChip row={row} />);
    const chip = container.querySelector("[data-testid=promise-health]");
    expect(chip?.textContent).toBe("no signal");
    expect(chip?.textContent).not.toMatch(/holding|upheld/);
    expect(chip?.getAttribute("data-health")).not.toBe("green");
    expect(chip?.getAttribute("aria-label")).not.toMatch(OLD_WORDS);
  });

  it("an empty timeline says no signal marks it, not no runs", async () => {
    const { container } = await render(<TimelineEmpty />);
    expect(container.textContent).toContain("no signal");
    expect(container.textContent).not.toMatch(OLD_WORDS);
  });
});

describe("A16 — where nothing has reported, the dashboard row and the legend say no signal", () => {
  const SILENT: DashboardRow = {
    name: "seat-released",
    sentence: "seat-released",
    plan: "seat-holds",
    planTitle: "Seat holds",
    path: null,
    pathTitle: null,
    standing: "enforced",
    tests: { passing: 0, total: 0 },
    held: null,
    broke: null,
    lastActivity: null,
    lastBreak: null,
  } as unknown as DashboardRow;

  it("the dashboard row's last-activity cell reads no signal, not never seen", async () => {
    const { container } = await render(
      <PromisesDashboard
        rows={[SILENT]}
        query={parseQuery({})}
        pathOrder={[]}
        incidents={[]}
        promises={[]}
        path="/p/demo/promises"
        planHrefPrefix="/p/demo/plan/"
        promiseHrefPrefix="/p/demo/promises/"
      />,
    );
    expect(container.textContent).not.toMatch(/never seen/i);
    expect(container.textContent).toMatch(/no signal(?! yet)/);
  });

  it("the promise page's thirty-day legend says grey is no signal, not nothing seen", async () => {
    const proof = {
      days: { local: [{ day: "2026-10-14", held: 0, broken: 0 }] },
      unread: {},
    };
    const { container } = await render(
      <LastThirtyDays proof={proof as never} />,
    );
    expect(container.textContent).toContain("Grey: no signal.");
    expect(container.textContent).not.toMatch(/nothing seen/i);
  });
});
