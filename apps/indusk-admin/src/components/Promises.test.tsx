import type {
  IncidentEntry,
  PromiseEntry,
} from "@infinitedusky/indusk-mcp/promises/registry";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// Promises.tsx and PlanList.tsx link to plans — stub next/link as everywhere.
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

import { HoldingBadge } from "@/components/HoldingBadge";
import { PlanList } from "@/components/PlanList";
import { PromiseChip, PromisesTable } from "@/components/Promises";
import type { Plan } from "@/lib/planning-reader";

/**
 * day-promises — A18, A19, A20, A22: the Promises page renders declared state
 * only. Deferred from Test Phase 1 because the component did not exist; the
 * bodies were reviewed there and are authored here against the real API.
 */

function promise(over: Partial<PromiseEntry> & { name: string }): PromiseEntry {
  return {
    kind: "behaviour",
    lifetime: "holds",
    state: "enforced",
    domain: "seating",
    owner: "lab-v0",
    statement: `${over.name} holds.`,
    sites: [],
    tests: [],
    incidents: [],
    aliases: [],
    file: `${over.name}.md`,
    ...over,
  };
}

// 6 promises: 2 enforced, 1 declared, 1 known-violated (1 incident), 1
// retired, 1 established + enforced. Two owners, two domains, three kinds.
const PROMISES: PromiseEntry[] = [
  promise({ name: "seat-never-double-booked", kind: "behaviour" }),
  promise({
    name: "seat-count-matches-table",
    kind: "state",
    owner: "seats-v2",
  }),
  promise({
    name: "seat-release-on-timeout",
    state: "declared",
    owner: "seats-v2",
  }),
  promise({
    name: "impact-events-are-strikes",
    state: "known-violated",
    domain: "archive",
    incidents: ["i-2026-08-26-detector-overtriggers"],
  }),
  promise({ name: "old-seat-rule", state: "retired", kind: "state" }),
  promise({
    name: "seat-backfill-ran",
    kind: "structure",
    lifetime: "established",
    domain: "archive",
    owner: "seats-v2",
  }),
];

const INCIDENTS: IncidentEntry[] = [
  {
    id: "i-2026-08-26-detector-overtriggers",
    promise: "impact-events-are-strikes",
    source: "smoke",
    status: "open",
    date: "2026-08-26",
    symptom: "395 candidates in 156 minutes.",
    rootCause: "Loud sound in a quiet moment.",
    fix: "v1 classifier.",
    file: "incidents/i-2026-08-26-detector-overtriggers.md",
  },
];

const rows = (container: Element) =>
  container.querySelectorAll('[data-testid="promise-row"]');

describe("A18 — every grouping shows every non-retired promise exactly once", () => {
  it.each([
    "owner",
    "domain",
    "state",
    "kind",
  ] as const)("grouped by %s: five rows, each promise once", async (by) => {
    const { container } = await render(
      <PromisesTable
        promises={PROMISES}
        incidents={INCIDENTS}
        initialGroupBy={by}
      />,
    );
    const names = [...rows(container)].map((r) =>
      r.getAttribute("data-promise"),
    );
    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(5);
    expect(names).not.toContain("old-seat-rule");
    expect(
      container.querySelectorAll('[data-testid="promise-group"]').length,
    ).toBeGreaterThan(1);
  });
});

describe("A19 — every enforced chip is hollow, and no health is rendered", () => {
  it('renders each enforced promise as "declared, not yet observed" and nothing upheld or violated in a window', async () => {
    const { container } = await render(
      <PromisesTable promises={PROMISES} incidents={INCIDENTS} />,
    );
    const hollow = container.querySelectorAll(
      '[data-testid="promise-chip"][aria-label="declared, not yet observed"]',
    );
    // 2 enforced + 1 established-and-enforced
    expect(hollow).toHaveLength(3);
    for (const chip of hollow) {
      expect(chip.getAttribute("data-state")).toBe("enforced");
      expect(chip.className).toContain("bg-white");
    }
    expect(container.textContent).not.toMatch(
      /upheld|violated in window|last seen|health/i,
    );
  });
});

describe("A20 — known-violated shows its incident, declared is outlined, retired is behind a toggle", () => {
  it("renders the incident id on the known-violated row", async () => {
    const { container } = await render(
      <PromisesTable promises={PROMISES} incidents={INCIDENTS} />,
    );
    const row = container.querySelector(
      '[data-promise="impact-events-are-strikes"]',
    );
    expect(row).not.toBeNull();
    expect(
      row?.querySelector('[data-testid="promise-incidents"]')?.textContent,
    ).toContain("i-2026-08-26-detector-overtriggers");
    expect(
      row
        ?.querySelector('[data-testid="promise-chip"]')
        ?.getAttribute("data-state"),
    ).toBe("known-violated");
  });

  it("draws a declared chip outlined (dashed border, white fill)", async () => {
    const { container } = await render(<PromiseChip state="declared" />);
    const chip = container.querySelector('[data-testid="promise-chip"]');
    expect(chip?.getAttribute("data-state")).toBe("declared");
    expect(chip?.className).toContain("border-dashed");
    expect(chip?.className).toContain("bg-white");
  });

  it("hides retired promises by default and shows them behind the toggle", async () => {
    const screen = await render(
      <PromisesTable promises={PROMISES} incidents={INCIDENTS} />,
    );
    expect(
      screen.container.querySelector('[data-promise="old-seat-rule"]'),
    ).toBeNull();
    await screen.getByRole("button", { name: /show retired \(1\)/i }).click();
    expect(
      screen.container.querySelector('[data-promise="old-seat-rule"]'),
    ).not.toBeNull();
    expect(rows(screen.container)).toHaveLength(6);
  });
});

describe("A22 — an archived plan shows holding N; one owning none shows no count", () => {
  it("HoldingBadge renders the count, and nothing for zero", async () => {
    const some = await render(<HoldingBadge count={3} plan="lab-v0" />);
    expect(some.container.textContent).toContain("holding 3");
    const none = await render(<HoldingBadge count={0} plan="empty" />);
    expect(none.container.textContent).not.toContain("holding");
  });

  it("the sidebar's archived items carry the badge from the holding map", async () => {
    const archived = [
      { name: "lab-v0", status: "completed", archived: true },
      { name: "empty-plan", status: "completed", archived: true },
    ] as Plan[];
    const screen = await render(
      <PlanList
        active={[]}
        archived={archived}
        masterOrder={[]}
        holding={new Map([["lab-v0", 3]])}
      />,
    );
    // The archived section is collapsed by default and renders its items only
    // when opened — open it the way a reader would.
    await screen.getByRole("button", { name: /archived \(2\)/i }).click();
    const { container } = screen;
    const badge = container.querySelector('[data-testid="holding-lab-v0"]');
    expect(badge?.textContent).toContain("holding 3");
    expect(
      container.querySelector('[data-plan-name="empty-plan"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="holding-empty-plan"]'),
    ).toBeNull();
  });
});

describe("day-monitor A20 — a retired promise's health chip is grey", () => {
  it("behind the retired toggle, the retired row's health chip reads grey", async () => {
    const screen = await render(
      <PromisesTable promises={PROMISES} incidents={INCIDENTS} />,
    );
    await screen.getByRole("button", { name: /show retired \(1\)/i }).click();
    const row = screen.container.querySelector(
      '[data-promise="old-seat-rule"]',
    );
    expect(row).not.toBeNull();
    expect(
      row
        ?.querySelector('[data-testid="promise-health"]')
        ?.getAttribute("data-health"),
    ).toBe("grey");
  });
});
