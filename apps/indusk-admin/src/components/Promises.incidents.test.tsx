import type {
  IncidentEntry,
  PromiseEntry,
} from "@infinitedusky/indusk-mcp/promises/registry";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

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

import { PromisesTable } from "@/components/Promises";

/**
 * incident-recording A12 — promise: an-open-incident-stays-loud.
 *
 * The admin's incidents table shows how long each open incident has been
 * open, and links to its owner's Maintenance phase, where the fix happens; a
 * fixed one says when it was fixed. Red today: the table has `status` and
 * `date` columns only.
 */

const OWNER = "seat-holds";
const OPEN = "i-2026-10-06-seat-released";
const FIXED = "i-2026-10-01-seat-released";
const PREFIX = "/p/demo/plan/";

const PROMISES: PromiseEntry[] = [
  {
    name: "seat-released",
    kind: "behaviour",
    lifetime: "holds",
    state: "known-violated",
    domain: "seating",
    owner: OWNER,
    statement: "A held seat is released after its timeout.",
    sites: [],
    tests: [],
    incidents: [OPEN, FIXED],
    aliases: [],
    file: "seat-released.md",
  },
];

function incident(over: Partial<IncidentEntry> & { id: string }): IncidentEntry {
  return {
    promise: "seat-released",
    source: "deployed",
    status: "open",
    date: "2026-10-06",
    environment: "production",
    symptom: "a held seat was not released",
    rootCause: "",
    fix: "",
    opened: null,
    fixed: null,
    traces: [],
    file: `incidents/${over.id}.md`,
    ...over,
  } as IncidentEntry;
}

const INCIDENTS: IncidentEntry[] = [
  incident({
    id: OPEN,
    opened: new Date(Date.now() - 2 * 86_400_000 - 3_600_000).toISOString(),
  }),
  incident({
    id: FIXED,
    status: "fixed",
    opened: "2026-10-01T08:00:00Z",
    fixed: "2026-10-02T09:00:00Z",
  }),
];

function rowFor(container: Element, id: string): HTMLElement {
  // The incidents table's row: its first cell is the id. The promise row
  // above it also lists incident ids, and must not be mistaken for it.
  const row = [...container.querySelectorAll("tr")].find(
    (r) => r.querySelector("td")?.textContent?.trim() === id,
  );
  if (!row) throw new Error(`no incidents-table row for ${id}`);
  return row as HTMLElement;
}

describe("A12 — the incidents table shows age and the owner's Maintenance phase", () => {
  it("shows how long the open incident has been open, with a link to its owner's phase", async () => {
    const { container } = await render(
      <PromisesTable
        promises={PROMISES}
        incidents={INCIDENTS}
        planHrefPrefix={PREFIX}
      />,
    );
    const row = rowFor(container, OPEN);
    expect(row.textContent).toMatch(/2 days/);
    const link = [...row.querySelectorAll("a")].find((a) =>
      a.getAttribute("href")?.startsWith(`${PREFIX}${OWNER}`),
    );
    expect(link, row.innerHTML).toBeDefined();
    expect(link?.textContent).toMatch(/Maintenance/);
  });

  it("shows when a fixed incident was fixed, and no age", async () => {
    const { container } = await render(
      <PromisesTable
        promises={PROMISES}
        incidents={INCIDENTS}
        planHrefPrefix={PREFIX}
      />,
    );
    const row = rowFor(container, FIXED);
    expect(row.textContent).toMatch(/fixed 2026-10-02/);
    expect(row.textContent).not.toMatch(/\bdays?\b/);
  });
});
