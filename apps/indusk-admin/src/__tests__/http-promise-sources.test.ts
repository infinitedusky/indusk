import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newTraceId } from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import {
  CRED_ENV,
  crossedMarks,
  HELD,
  OWNER,
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
 * promise-sources — the admin halves of A3, A4 and A6, over HTTP against
 * `next dev`, with a real local daemon and a real always-on server holding
 * different marks (the fixture is the mcp package's, imported by path).
 *
 * The markup contract fixed here: each behaviour promise row carries one
 * `data-testid="promise-health"` chip per source, each with
 * `data-source="local"` or `data-source="production"` and its own
 * `data-health`. The sidebar's red mark for a plan
 * (`data-plan="<plan>"` + `data-health="red"`) follows production.
 *
 * Red today: one chip per promise, from production only.
 */

function row(html: string, name: string): string {
  const start = html.indexOf(`data-promise="${name}"`);
  if (start === -1) return "";
  const next = html.indexOf('data-promise="', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function chip(
  html: string,
  name: string,
  source: "local" | "production",
): string | null {
  const tags =
    row(html, name).match(/<[^>]*data-testid="promise-health"[^>]*>/g) ?? [];
  const tag = tags.find((t) => t.includes(`data-source="${source}"`));
  return tag?.match(/data-health="([^"]+)"/)?.[1] ?? null;
}

function sidebarRed(html: string, plan: string): boolean {
  return (html.match(/<[a-z][^>]*>/gi) ?? []).some(
    (t) => t.includes(`data-plan="${plan}"`) && t.includes('data-health="red"'),
  );
}

async function open(t: TwoSources, name: string): Promise<DevServer> {
  writeRegistry(t.local.home, [{ name, path: t.project.root }]);
  return startNextDev({
    home: t.local.home,
    env: { [CRED_ENV]: t.production.credential },
  });
}

describe("A3, A4 — a chip per source; one source down, the other still shown", () => {
  let t: TwoSources;
  let dev: DevServer;

  beforeAll(async () => {
    t = await startTwoSources(crossedMarks());
    dev = await open(t, "sources");
  }, 240_000);

  afterAll(async () => {
    await dev?.stop();
    await t?.stop();
  });

  it("A3 — each promise has a local and a production chip with its own health", async () => {
    const html = await (await fetch(`${dev.url}/p/sources/promises`)).text();
    expect(chip(html, HELD, "local")).toBe("red");
    expect(chip(html, HELD, "production")).toBe("green");
    expect(chip(html, RELEASED, "local")).toBe("green");
    expect(chip(html, RELEASED, "production")).toBe("red");
  }, 60_000);

  it("A4 — with production down, production says unknown and local's chips still show", async () => {
    await t.production.stop();
    await sleep(5_500); // past the health cache
    const html = await (await fetch(`${dev.url}/p/sources/promises`)).text();
    expect(chip(html, HELD, "local")).toBe("red");
    expect(chip(html, RELEASED, "local")).toBe("green");
    expect(chip(html, RELEASED, "production")).not.toBe("red");
    expect(chip(html, RELEASED, "production")).not.toBe("green");
    expect(html).toMatch(/health unknown|watcher blind|could not be reached/i);
  }, 60_000);
});

describe("A6 — a local-only break is shown, not raised", () => {
  let t: TwoSources;
  let dev: DevServer;

  beforeAll(async () => {
    t = await startTwoSources({
      promises: [HELD],
      localMarks: [
        {
          service: "seats-app",
          name: "hold-seat",
          promise: HELD,
          outcome: "violated",
          traceId: newTraceId(),
        },
      ],
      productionMarks: [
        {
          service: "seats-app",
          name: "hold-seat",
          promise: HELD,
          outcome: "upheld",
        },
      ],
    });
    dev = await open(t, "quiet-prod");
  }, 240_000);

  afterAll(async () => {
    await dev?.stop();
    await t?.stop();
  });

  it("the promise's local chip is red, and the sidebar does not mark the plan red", async () => {
    const promises = await (
      await fetch(`${dev.url}/p/quiet-prod/promises`)
    ).text();
    expect(chip(promises, HELD, "local")).toBe("red");
    expect(chip(promises, HELD, "production")).toBe("green");
    const project = await (await fetch(`${dev.url}/p/quiet-prod/`)).text();
    expect(
      sidebarRed(project, OWNER),
      "lesson: the-alarm-comes-from-production-when-there-is-one",
    ).toBe(false);
  }, 60_000);
});
