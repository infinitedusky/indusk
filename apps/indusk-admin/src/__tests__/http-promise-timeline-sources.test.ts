import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newTraceId } from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import { writeIncident } from "../../../indusk-mcp/src/__tests__/helpers/promises-fixture";
import {
  CRED_ENV,
  crossedMarks,
  HELD,
  RELEASED,
  startTwoSources,
  type TwoSources,
} from "../../../indusk-mcp/src/__tests__/helpers/two-sources";
import {
  type DevServer,
  sleep,
  startNextDev,
  writeRegistry,
} from "./helpers/next-dev";

/**
 * promise-timeline — A8–A10, over HTTP against `next dev`, with a real local
 * daemon and a real always-on server holding crossed marks: `seat-held`
 * broken on the laptop, `seat-released` broken in production.
 *
 *   A10  local's chip follows the newest local run
 *   A9   production's chip is `fixed` once its violation's incident is fixed
 *   A8   production's strip by default, local's on request; production
 *        stopped → said in place of its strip, local's still drawn
 *
 * Run in that order: A8 stops the server.
 *
 * Red today: chips colour by "any violation in the window", and there is no
 * strip.
 */

const LOCAL_BREAK = newTraceId();
const PROD_BREAK = newTraceId();
const INCIDENT = "i-2026-10-05-seat-released";

let t: TwoSources;
let dev: DevServer;

async function page(query = ""): Promise<string> {
  return (await fetch(`${dev.url}/p/sources/promises${query}`)).text();
}

function row(html: string, promise: string): string {
  const start = html.indexOf(`data-promise="${promise}"`);
  if (start === -1) return "";
  const next = html.indexOf('data-promise="', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function chip(
  html: string,
  promise: string,
  source: "local" | "production",
): string | null {
  const tag = (
    row(html, promise).match(/<[^>]*data-testid="promise-health"[^>]*>/g) ?? []
  ).find((t) => t.includes(`data-source="${source}"`));
  return tag?.match(/data-health="([^"]+)"/)?.[1] ?? null;
}

function strips(html: string, promise: string): string[] {
  return (
    row(html, promise).match(/<[^>]*data-testid="promise-timeline"[^>]*>/g) ??
    []
  );
}

function incidentsDir(): string {
  return join(t.project.planRoot, ".indusk", "promises", "incidents");
}

beforeAll(async () => {
  t = await startTwoSources(
    crossedMarks({ local: LOCAL_BREAK, production: PROD_BREAK }),
  );
  writeRegistry(t.local.home, [{ name: "sources", path: t.project.root }]);
  dev = await startNextDev({
    home: t.local.home,
    env: { [CRED_ENV]: t.production.credential },
  });
}, 240_000);

afterAll(async () => {
  await dev?.stop();
  await t?.stop();
});

describe("promise-timeline — chips and strips per source", () => {
  it("A10 — local's chip goes green once a newer local run holds, with no incident", async () => {
    expect(
      chip(await page(), HELD, "local"),
      "red while the newest local run broke",
    ).toBe("red");
    await t.local.load([
      {
        service: "seats-app",
        name: "hold-seat",
        promise: HELD,
        outcome: "upheld",
      },
    ]);
    await sleep(6_000); // past the health cache
    expect(
      chip(await page(), HELD, "local"),
      "green after a newer run held",
    ).toBe("green");
  }, 90_000);

  it("A9 — production's chip is red while its incident is open, and fixed once it is fixed", async () => {
    writeIncident(incidentsDir(), {
      id: INCIDENT,
      promise: RELEASED,
      source: "deployed",
      status: "open",
      opened: new Date(Date.now() - 60_000).toISOString(),
      lastSeen: new Date(Date.now() - 60_000).toISOString(),
      traces: [PROD_BREAK],
    });
    await sleep(6_000);
    expect(chip(await page(), RELEASED, "production"), "open incident").toBe(
      "red",
    );

    writeIncident(incidentsDir(), {
      id: INCIDENT,
      promise: RELEASED,
      source: "deployed",
      status: "fixed",
      opened: new Date(Date.now() - 60_000).toISOString(),
      lastSeen: new Date(Date.now() - 60_000).toISOString(),
      traces: [PROD_BREAK],
      fixed: new Date().toISOString(),
    });
    await sleep(6_000);
    expect(
      chip(await page(), RELEASED, "production"),
      "lesson: a-fixed-break-is-history-not-health",
    ).toBe("fixed");
  }, 90_000);

  it("A8 — production's strip by default, local's on request; a stopped source is said, the other still drawn", async () => {
    const byDefault = await page();
    expect(
      strips(byDefault, RELEASED).some((s) =>
        s.includes('data-source="production"'),
      ),
    ).toBe(true);
    const local = await page("?source=local");
    expect(
      strips(local, HELD).some((s) => s.includes('data-source="local"')),
    ).toBe(true);
    expect(local, "local's view says how far back it reaches").toMatch(
      /local history since|reaches back to/i,
    );

    await t.production.stop();
    await sleep(6_000);
    const down = await page();
    expect(
      strips(down, RELEASED),
      "no production strip drawn from nothing",
    ).toHaveLength(0);
    expect(down).toMatch(
      /could not be read|could not be reached|watcher blind/i,
    );
    const stillLocal = await page("?source=local");
    expect(
      strips(stillLocal, HELD).some((s) => s.includes('data-source="local"')),
    ).toBe(true);
  }, 120_000);
});
