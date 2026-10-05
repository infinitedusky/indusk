import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type LocalJaeger,
  newTraceId,
  startLocalJaeger,
} from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import {
  daysAgo,
  type PromiseProject,
  promiseProject,
  siteFile,
  testFile,
  writeIncident,
} from "../../../indusk-mcp/src/__tests__/helpers/promises-fixture";
import {
  type DevServer,
  startNextDev,
  writeRegistry,
} from "./helpers/next-dev";

/**
 * promise-timeline — A1–A4, A6 and A11, over HTTP against `next dev`, reading
 * a real local daemon loaded with marks at chosen times.
 *
 * The markup contract (impl.md, Test Trajectory): a strip is
 * `data-testid="promise-timeline"` with `data-promise`, `data-source`,
 * `data-window`; a cell is `data-testid="timeline-cell"` with `data-state`
 * (green | red | purple | empty), `data-from` (ISO) and `data-at-least` when
 * its read hit the limit; a band is `data-testid="incident-band"` with
 * `data-incident`, `data-from`, `data-to`; `data-testid="open-break"` is the
 * old-break marker; `data-testid="timeline-empty"` is a promise no run marks.
 *
 *   seat-held      upheld 2 h and 26 h ago; violated 5 h ago, incident open
 *   seat-released  no marks
 *   seat-counted   violated 3 days ago, incident open
 *   seat-busy      12 upheld runs in one minute; the query limit is 5
 *
 * Red today: the page draws no timeline at all.
 */

const OWNER = "seats-v2";
const HELD = "seat-held";
const RELEASED = "seat-released";
const COUNTED = "seat-counted";
const BUSY = "seat-busy";
const OPEN = "i-2026-10-05-seat-held";
const OLD = "i-2026-10-02-seat-counted";

const HOUR = 3_600_000;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);
const RECENT_BREAK = newTraceId();
const OLD_BREAK = newTraceId();

let jaeger: LocalJaeger;
let fixture: PromiseProject;
let dev: DevServer;

function incidentsDir(): string {
  return join(fixture.planRoot, ".indusk", "promises", "incidents");
}

async function page(window: "24h" | "7d" | "30d"): Promise<string> {
  const res = await fetch(`${dev.url}/p/timeline/promises?window=${window}`);
  return res.text();
}

/** The HTML of one promise's row: from its `data-promise` to the next one. */
function row(html: string, promise: string): string {
  const start = html.indexOf(`data-promise="${promise}"`);
  if (start === -1) return "";
  // The next *other* promise: the strip under a row carries its promise's
  // name too (the markup contract), and must stay inside the row's slice.
  const other = /data-promise="([^"]*)"/g;
  other.lastIndex = start + 1;
  let next = -1;
  for (let m = other.exec(html); m; m = other.exec(html)) {
    if (m[1] !== promise) {
      next = m.index;
      break;
    }
  }
  return html.slice(start, next === -1 ? undefined : next);
}

function tags(html: string, testid: string): string[] {
  return (
    html.match(new RegExp(`<[^>]*data-testid="${testid}"[^>]*>`, "g")) ?? []
  );
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

/** The strip's cells, oldest first, as { from, state, atLeast }. */
function cells(html: string, promise: string) {
  return tags(row(html, promise), "timeline-cell")
    .map((t) => ({
      from: Date.parse(attr(t, "data-from") ?? ""),
      state: attr(t, "data-state"),
      atLeast: t.includes("data-at-least"),
    }))
    .sort((a, b) => a.from - b.from);
}

/** The cell a moment falls in: the last cell starting at or before it. */
function cellAt(html: string, promise: string, at: Date) {
  return cells(html, promise)
    .filter((c) => c.from <= at.getTime())
    .at(-1);
}

beforeAll(async () => {
  const behaviour = (name: string) => ({
    name,
    kind: "behaviour" as const,
    state: "enforced" as const,
    domain: "seating",
    owner: OWNER,
    sites: [`src/${name}.ts`],
    tests: [`src/${name}.test.ts`],
  });
  fixture = promiseProject({
    domains: ["seating"],
    landed: { [OWNER]: daysAgo(30) },
    promises: [
      { ...behaviour(HELD), state: "known-violated", incidents: [OPEN] },
      behaviour(RELEASED),
      { ...behaviour(COUNTED), state: "known-violated", incidents: [OLD] },
      behaviour(BUSY),
    ],
    incidents: [
      {
        id: OPEN,
        promise: HELD,
        source: "local",
        status: "open",
        opened: ago(5 * HOUR).toISOString(),
        lastSeen: ago(5 * HOUR).toISOString(),
        traces: [RECENT_BREAK],
      },
      {
        id: OLD,
        promise: COUNTED,
        source: "local",
        status: "open",
        opened: ago(72 * HOUR).toISOString(),
        lastSeen: ago(72 * HOUR).toISOString(),
        traces: [OLD_BREAK],
      },
    ],
    files: Object.fromEntries(
      [HELD, RELEASED, COUNTED, BUSY].flatMap((n) => [
        [`src/${n}.ts`, siteFile(n)],
        [`src/${n}.test.ts`, testFile(n)],
      ]),
    ),
  });

  jaeger = await startLocalJaeger();
  const mark = (
    promise: string,
    outcome: "upheld" | "violated",
    at: Date,
    traceId?: string,
  ) => ({
    service: "seats-app",
    name: promise,
    promise,
    outcome,
    at,
    ...(traceId ? { traceId } : {}),
  });
  await jaeger.load([
    mark(HELD, "upheld", ago(2 * HOUR)),
    mark(HELD, "upheld", ago(26 * HOUR)),
    mark(HELD, "violated", ago(5 * HOUR), RECENT_BREAK),
    mark(COUNTED, "violated", ago(72 * HOUR), OLD_BREAK),
    ...Array.from({ length: 12 }, (_, i) =>
      mark(BUSY, "upheld", new Date(now - HOUR + i * 5_000)),
    ),
  ]);

  writeRegistry(jaeger.home, [{ name: "timeline", path: fixture.root }]);
  dev = await startNextDev({
    home: jaeger.home,
    env: { INDUSK_PROMISE_QUERY_LIMIT: "5" },
  });
}, 240_000);

afterAll(async () => {
  await dev?.stop();
  jaeger?.stop();
  if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
  if (fixture) rmSync(fixture.root, { recursive: true, force: true });
});

describe("promise-timeline — the page draws each promise's history", () => {
  it("preconditions: the page renders every promise's row", async () => {
    const res = await fetch(`${dev.url}/p/timeline/promises?window=7d`);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const p of [HELD, RELEASED, COUNTED, BUSY])
      expect(row(html, p), p).not.toBe("");
  }, 60_000);

  it("A1 — a strip per window, each run in the cell for its time", async () => {
    const day = await page("24h");
    const week = await page("7d");
    const month = await page("30d");
    expect(cells(day, HELD), "96 cells for 24 hours").toHaveLength(96);
    expect(cells(week, HELD), "84 cells for 7 days").toHaveLength(84);
    expect(cells(month, HELD), "90 cells for 30 days").toHaveLength(90);
    expect(cellAt(day, HELD, ago(2 * HOUR))?.state).toBe("green");
    expect(cellAt(day, HELD, ago(5 * HOUR))?.state).toBe("red");
    expect(
      cells(day, HELD)[0].from,
      "the 24 h strip starts 24 h ago",
    ).toBeGreaterThan(now - 25 * HOUR);
    expect(
      cellAt(week, HELD, ago(26 * HOUR))?.state,
      "26 h ago is inside 7 days",
    ).toBe("green");
  }, 90_000);

  it("A2 — a promise no run marks says so, with no strip", async () => {
    const html = await page("7d");
    expect(tags(row(html, RELEASED), "timeline-empty")).toHaveLength(1);
    expect(cells(html, RELEASED)).toHaveLength(0);
  }, 60_000);

  it("A6 — an open break older than the window is still marked on its row", async () => {
    const html = await page("24h");
    const marker = row(html, COUNTED);
    expect(tags(marker, "open-break"), "the old-break marker").toHaveLength(1);
    expect(marker).toMatch(/violated 3 ?d(ays?)? ago — open/);
  }, 60_000);

  it("A11 — a cell whose read hit the limit says at least", async () => {
    const html = await page("24h");
    const busy = cellAt(html, BUSY, ago(HOUR - 30_000));
    expect(busy?.state).toBe("green");
    expect(
      busy?.atLeast,
      "the cell holding 12 runs read with a limit of 5",
    ).toBe(true);
  }, 60_000);

  it("A3, A4 — red and a band to now while open; purple and a band to the fix once fixed", async () => {
    const before = await page("24h");
    expect(cellAt(before, HELD, ago(5 * HOUR))?.state).toBe("red");
    const openBand = tags(row(before, HELD), "incident-band").find(
      (t) => attr(t, "data-incident") === OPEN,
    );
    expect(openBand, "an open incident's band").toBeDefined();
    expect(Date.parse(attr(openBand ?? "", "data-from") ?? "")).toBe(
      Date.parse(ago(5 * HOUR).toISOString()),
    );
    expect(
      Date.now() - Date.parse(attr(openBand ?? "", "data-to") ?? ""),
    ).toBeLessThan(5 * 60_000);

    const fixedAt = ago(HOUR).toISOString();
    writeIncident(incidentsDir(), {
      id: OPEN,
      promise: HELD,
      source: "local",
      status: "fixed",
      opened: ago(5 * HOUR).toISOString(),
      lastSeen: ago(5 * HOUR).toISOString(),
      traces: [RECENT_BREAK],
      fixed: fixedAt,
    });
    writeFileSync(
      join(fixture.planRoot, ".indusk", "promises", `${HELD}.md`),
      `---\nname: ${HELD}\nkind: behaviour\nlifetime: holds\nstate: enforced\ndomain: seating\nowner: ${OWNER}\nsites:\n  - src/${HELD}.ts\ntests:\n  - src/${HELD}.test.ts\nincidents:\n  - ${OPEN}\n---\n\nThe seat is held.\n`,
    );

    const after = await page("24h");
    expect(
      cellAt(after, HELD, ago(5 * HOUR))?.state,
      "fixed reads purple",
    ).toBe("purple");
    const fixedBand = tags(row(after, HELD), "incident-band").find(
      (t) => attr(t, "data-incident") === OPEN,
    );
    expect(Date.parse(attr(fixedBand ?? "", "data-to") ?? "")).toBe(
      Date.parse(fixedAt),
    );
  }, 90_000);
});
