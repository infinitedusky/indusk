import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../../../indusk-mcp/src/__tests__/helpers/cli";
import { newTraceId } from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import {
  CRED_ENV,
  crossedMarks,
  HELD,
  RELEASED,
  startTwoSources,
  type TwoSources,
} from "../../../indusk-mcp/src/__tests__/helpers/two-sources";
import { UNWRITTEN_ROOT_CAUSE } from "../../../indusk-mcp/src/lib/promises/vocabulary";
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
 *   A9   production's chip is red while the incident the admin recorded for
 *        its violation is open, and `fixed` once `promises fix` closes it
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

let t: TwoSources;
let dev: DevServer;

async function page(query = ""): Promise<string> {
  return (await fetch(`${dev.url}/p/sources/promises${query}`)).text();
}

function row(html: string, promise: string): string {
  const start = html.indexOf(`data-promise="${promise}"`);
  if (start === -1) return "";
  // Up to the next *other* promise, since the strip under a row carries its promise.s
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

/**
 * The incident the admin daemon's recorder wrote for `trace` (incident-recording):
 * its id and file, once one exists under the fixture's incidents directory.
 */
function recordedIncident(
  promise: string,
  trace: string,
): { id: string; file: string } | null {
  const dir = incidentsDir();
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const file = join(dir, name);
    const text = readFileSync(file, "utf-8");
    if (text.includes(`promise: ${promise}`) && text.includes(trace)) {
      return { id: name.replace(/\.md$/, ""), file };
    }
  }
  return null;
}

async function waitForRecordedIncident(
  promise: string,
  trace: string,
): Promise<{ id: string; file: string }> {
  for (let waited = 0; waited < 60_000; waited += 1_000) {
    const found = recordedIncident(promise, trace);
    if (found) return found;
    await sleep(1_000);
  }
  throw new Error(
    `the admin recorded no incident for ${promise} / ${trace} within 60s`,
  );
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

  it("A9 — production's chip is red while the incident the admin recorded is open, and fixed once it is fixed", async () => {
    // The daemon's recorder, not this test, writes the incident for the break.
    const incident = await waitForRecordedIncident(RELEASED, PROD_BREAK);
    await sleep(6_000); // past the health cache
    expect(chip(await page(), RELEASED, "production"), "open incident").toBe(
      "red",
    );

    // The recorder leaves the root cause for a person; `promises fix` refuses
    // an incident until someone has said what broke.
    writeFileSync(
      incident.file,
      readFileSync(incident.file, "utf-8").replace(
        UNWRITTEN_ROOT_CAUSE,
        "The hold was not atomic.",
      ),
    );
    const fix = runCli(t.project.root, ["promises", "fix", incident.id], t.env);
    expect(fix.code, fix.stdout + fix.stderr).toBe(0);
    await sleep(6_000);
    expect(
      chip(await page(), RELEASED, "production"),
      "lesson: a-fixed-break-is-history-not-health",
    ).toBe("fixed");
  }, 120_000);

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
