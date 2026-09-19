import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type LocalJaeger,
  newTraceId,
  startLocalJaeger,
} from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import { makeHome, sleep, startNextDev } from "./helpers/next-dev";

/**
 * day-monitor — the admin halves of A14, A16, A18, and A20–A23, over HTTP
 * against `next dev`, with the local-telemetry extension's real Jaeger
 * started in the same `INDUSK_HOME` the admin reads (the helper is imported
 * by path from the mcp package — one copy of "how a test starts Jaeger").
 *
 * The markup contract these rows fix:
 * - each promise row (already `data-promise="<name>"`) carries one
 *   `data-testid="promise-health"` chip with `data-health` =
 *   red | green | unverified | amber | grey;
 * - the sidebar marks a plan holding a red promise with an element carrying
 *   `data-plan="<plan>"` and `data-health="red"`;
 * - the plan bar's `monitor` segment is `data-segment="monitor"`.
 *
 *   health     active plan seats-v2 owns four behaviour promises: one
 *              violated twice (red), one seen upheld (green), one never seen
 *              (unverified), one declared known-violated (amber)
 *   monitor    archived lab-v0 landed 2 days ago, holding a behaviour promise
 *   restarted  archived lab-v0 landed 10 days ago, violated 1 day ago
 *   reopened   archived lab-v0 with an appended, unchecked Maintenance phase
 *
 * Red today on their own assertions: the page renders declared state only,
 * the plan bar's `monitor` is always pending, and an archived plan never
 * executes. Green after Build Phase 5. A22 runs last: it stops Jaeger.
 */

const DOUBLE = "seat-never-double-booked";
const RELEASE = "seat-release-on-timeout";
const UNSEEN = "seat-hold-expires";
const AMBER = "impact-events-are-strikes";
const AMBER_INCIDENT = "i-2026-08-26-detector-overtriggers";
const UNWRITTEN = "_Unwritten — a person writes this._";
const MAINTENANCE_ID = `i-2026-09-17-${DOUBLE}`;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function promiseFile(o: {
  name: string;
  state: string;
  owner: string;
  kind?: string;
  incidents?: string[];
}): string {
  const incidents = o.incidents ?? [];
  return [
    "---",
    `name: ${o.name}`,
    `kind: ${o.kind ?? "behaviour"}`,
    "lifetime: holds",
    `state: ${o.state}`,
    "domain: seating",
    `owner: ${o.owner}`,
    "sites: []",
    "tests: []",
    incidents.length ? `incidents: [${incidents.join(", ")}]` : "incidents: []",
    "---",
    "",
    `${o.name} holds.`,
    "",
  ].join("\n");
}

function incidentFile(o: {
  id: string;
  promise: string;
  lastSeen: string;
}): string {
  return [
    "---",
    `id: ${o.id}`,
    `promise: ${o.promise}`,
    "source: local",
    "status: open",
    `date: ${o.lastSeen.slice(0, 10)}`,
    `opened: '${o.lastSeen}'`,
    `last_seen: '${o.lastSeen}'`,
    "traces: []",
    "---",
    "",
    "## Symptom",
    "Two players held seat 4.",
    "",
    "## Root cause",
    UNWRITTEN,
    "",
    "## Fix",
    "",
  ].join("\n");
}

const LEGACY_IMPL = `---
title: lab-v0
status: completed
---

# lab-v0

## Checklist

### Phase 1: Seats

- [x] Hold a seat atomically

#### Phase 1 Verification

- [x] The seat tests pass

#### Phase 1 Context

- [x] Noted in CLAUDE.md

#### Phase 1 Document

- [x] The seats page
`;

const MAINTENANCE = `
### Build Phase 2: Maintenance — ${MAINTENANCE_ID}

- [ ] Write the root cause in the incident
- [ ] Fix: a code site, a widened test, or a revised promise

#### Build Phase 2 Verification

- [ ] The promise is seen upheld after the fix (\`indusk promises status\`)

#### Build Phase 2 Context

- [ ] CLAUDE.md, if the fix changes a convention

#### Build Phase 2 Document

- [ ] The incident's Fix section
`;

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function baseProject(label: string): string {
  const root = mkdtempSync(path.join(tmpdir(), `health-${label}-`));
  write(
    root,
    ".indusk/config.json",
    JSON.stringify({
      mode: "full",
      promises: { domains: ["seating"] },
      admin: { refresh_ms: 1000 },
    }),
  );
  return root;
}

function archivedOwner(root: string, landedDaysAgo: number, impl?: string) {
  const dir = ".indusk/planning/archive/lab-v0";
  write(
    root,
    `${dir}/brief.md`,
    "---\ntitle: lab-v0\nstatus: accepted\n---\n# lab-v0\n",
  );
  const date = daysAgo(landedDaysAgo);
  write(
    root,
    `${dir}/retrospective.md`,
    `---\ntitle: lab-v0 — Retrospective\ndate: ${date}\nstatus: accepted\n---\n\n# lab-v0 — Retrospective\n\nLanded on main at 0123abcd, ${date}.\n`,
  );
  if (impl) write(root, `${dir}/impl.md`, impl);
}

function healthProject(): string {
  const root = baseProject("health");
  write(
    root,
    ".indusk/planning/seats-v2/brief.md",
    "---\ntitle: seats-v2\nstatus: accepted\n---\n# seats-v2\n",
  );
  const reg = ".indusk/promises";
  for (const name of [DOUBLE, RELEASE, UNSEEN]) {
    write(
      root,
      `${reg}/${name}.md`,
      promiseFile({ name, state: "enforced", owner: "seats-v2" }),
    );
  }
  write(
    root,
    `${reg}/${AMBER}.md`,
    promiseFile({
      name: AMBER,
      state: "known-violated",
      owner: "seats-v2",
      incidents: [AMBER_INCIDENT],
    }),
  );
  write(
    root,
    `${reg}/incidents/${AMBER_INCIDENT}.md`,
    incidentFile({
      id: AMBER_INCIDENT,
      promise: AMBER,
      lastSeen: "2026-08-26T10:00:00Z",
    }),
  );
  return root;
}

function monitorProject(
  label: string,
  landedDaysAgo: number,
  violatedDaysAgo?: number,
): string {
  const root = baseProject(label);
  archivedOwner(root, landedDaysAgo, LEGACY_IMPL);
  const id = `i-${daysAgo(violatedDaysAgo ?? 0)}-${DOUBLE}`;
  write(
    root,
    `.indusk/promises/${DOUBLE}.md`,
    promiseFile({
      name: DOUBLE,
      state: violatedDaysAgo === undefined ? "enforced" : "known-violated",
      owner: "lab-v0",
      incidents: violatedDaysAgo === undefined ? [] : [id],
    }),
  );
  if (violatedDaysAgo !== undefined) {
    write(
      root,
      `.indusk/promises/incidents/${id}.md`,
      incidentFile({
        id,
        promise: DOUBLE,
        lastSeen: `${daysAgo(violatedDaysAgo)}T12:00:00Z`,
      }),
    );
  }
  return root;
}

function reopenedProject(): string {
  const root = baseProject("reopened");
  archivedOwner(root, 20, LEGACY_IMPL + MAINTENANCE);
  write(
    root,
    `.indusk/promises/${DOUBLE}.md`,
    promiseFile({
      name: DOUBLE,
      state: "known-violated",
      owner: "lab-v0",
      incidents: [MAINTENANCE_ID],
    }),
  );
  write(
    root,
    `.indusk/promises/incidents/${MAINTENANCE_ID}.md`,
    incidentFile({
      id: MAINTENANCE_ID,
      promise: DOUBLE,
      lastSeen: "2026-09-17T12:00:00Z",
    }),
  );
  return root;
}

/** The HTML of one promise row: from its `data-promise` to the next row's. */
function row(html: string, name: string): string {
  const start = html.indexOf(`data-promise="${name}"`);
  if (start === -1) return "";
  const next = html.indexOf('data-promise="', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function healthOf(html: string, name: string): string | null {
  const r = row(html, name);
  const chip = r.match(/<[^>]*data-testid="promise-health"[^>]*>/)?.[0];
  return chip?.match(/data-health="([^"]+)"/)?.[1] ?? null;
}

/** Opening tags carrying every one of `attrs` (each an `a="b"` string). */
function tagsWith(html: string, ...attrs: string[]): string[] {
  return (html.match(/<[a-z][^>]*>/gi) ?? []).filter((t) =>
    attrs.every((a) => t.includes(a)),
  );
}

let stop: (() => Promise<void>) | null = null;
let url = "";
let home = "";
let jaeger: LocalJaeger | null = null;
const roots: string[] = [];
const violated = [newTraceId(), newTraceId()];

beforeAll(async () => {
  const health = healthProject();
  const monitor = monitorProject("monitor", 2);
  const restarted = monitorProject("restarted", 10, 1);
  const reopened = reopenedProject();
  roots.push(health, monitor, restarted, reopened);
  home = makeHome([
    { name: "health", path: health },
    { name: "monitor", path: monitor },
    { name: "restarted", path: restarted },
    { name: "reopened", path: reopened },
  ]);
  jaeger = await startLocalJaeger({ home });
  const now = Date.now();
  await jaeger.load([
    {
      service: "fixture-app",
      name: "hold-seat",
      promise: DOUBLE,
      outcome: "violated",
      symptom: "seat 4 held by two players",
      traceId: violated[0],
      at: new Date(now - 3_600_000),
    },
    {
      service: "fixture-app",
      name: "hold-seat",
      promise: DOUBLE,
      outcome: "violated",
      symptom: "seat 7 held by two players",
      traceId: violated[1],
      at: new Date(now - 1_800_000),
    },
    {
      service: "fixture-app",
      name: "release-seat",
      promise: RELEASE,
      outcome: "upheld",
      at: new Date(now - 600_000),
    },
  ]);
  const dev = await startNextDev({ home });
  url = dev.url;
  stop = dev.stop;
}, 120_000);

afterAll(async () => {
  await stop?.();
  jaeger?.stop();
  for (const dir of [home, ...roots]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("A20–A21 — observed health on the Promises page", () => {
  it("A20 — red when violated in the window, green when seen upheld, hollow unverified when not seen, amber when known-violated", async () => {
    const html = await (await fetch(`${url}/p/health/promises`)).text();
    expect(html).toContain(`data-promise="${DOUBLE}"`);
    expect(healthOf(html, DOUBLE)).toBe("red");
    expect(healthOf(html, RELEASE)).toBe("green");
    expect(healthOf(html, UNSEEN)).toBe("unverified");
    expect(healthOf(html, AMBER)).toBe("amber");
  });

  it("A21 — red sorts first, and each behaviour row shows its violations in the window and last seen", async () => {
    const html = await (await fetch(`${url}/p/health/promises`)).text();
    const at = (n: string) => html.indexOf(`data-promise="${n}"`);
    expect(at(DOUBLE)).toBeGreaterThan(-1);
    for (const other of [RELEASE, UNSEEN, AMBER]) {
      expect(at(DOUBLE), `${DOUBLE} before ${other}`).toBeLessThan(at(other));
    }
    expect(row(html, DOUBLE)).toMatch(/\b2 violations\b/);
    expect(row(html, DOUBLE)).toMatch(/last seen/i);
    expect(row(html, RELEASE)).toMatch(/last seen/i);
  });
});

describe("A23 — the sidebar", () => {
  it("a plan holding a red promise shows red in the sidebar without being opened", async () => {
    const html = await (await fetch(`${url}/p/health/`)).text();
    expect(
      tagsWith(html, 'data-plan="seats-v2"', 'data-health="red"'),
    ).not.toHaveLength(0);
  });
});

describe("A16, A18 — monitor on the plan bar", () => {
  it("A16 — closed 2 days ago: the monitor segment is active and says how much of the window has passed", async () => {
    const res = await fetch(`${url}/p/monitor/plan/lab-v0`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(
      tagsWith(html, 'data-segment="monitor"', 'data-state="active"'),
    ).toHaveLength(1);
    expect(html).toMatch(/\b\d+ of 7 days\b/);
  });

  it("A18 — a violation in the window keeps it in monitor, and the page says the window restarted", async () => {
    const html = await (await fetch(`${url}/p/restarted/plan/lab-v0`)).text();
    expect(
      tagsWith(html, 'data-segment="monitor"', 'data-state="active"'),
    ).toHaveLength(1);
    expect(html).toMatch(/restarted/i);
  });
});

describe("A14 — a reopened plan (admin half)", () => {
  it("the archived owner shows executing its Maintenance phase", async () => {
    const html = await (await fetch(`${url}/p/reopened/plan/lab-v0`)).text();
    expect(html).toContain(`Maintenance — ${MAINTENANCE_ID}`);
    const label = html.match(
      /data-testid="plan-bar-active-label"[^>]*>([^<]*)</,
    )?.[1];
    expect(label ?? "", "the plan bar's active label").toMatch(/^executing/);
  });
});

describe("A22 — Jaeger unreachable (runs last: stops Jaeger)", () => {
  it(
    "every behaviour chip is hollow with 'health unknown since …', and none is green",
    { timeout: 30_000 },
    async () => {
      // One successful read first, so "since" has a time to name.
      await fetch(`${url}/p/health/promises`);
      jaeger?.stop();
      await sleep(2_500); // past the project's 1s refresh interval
      const html = await (await fetch(`${url}/p/health/promises`)).text();
      for (const name of [DOUBLE, RELEASE, UNSEEN]) {
        expect(healthOf(html, name), name).toBe("unverified");
      }
      expect(html).not.toContain('data-health="green"');
      expect(html).toMatch(/health unknown since/i);
    },
  );
});
