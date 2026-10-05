import { rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AlwaysOnServer,
  startAlwaysOnServer,
} from "../../../indusk-mcp/src/__tests__/helpers/always-on-server";
import { newTraceId } from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import {
  daysAgo,
  type PromiseProject,
  promiseProject,
  siteFile,
  testFile,
} from "../../../indusk-mcp/src/__tests__/helpers/promises-fixture";
import {
  type DevServer,
  makeHome,
  sleep,
  startNextDev,
} from "./helpers/next-dev";

/**
 * promise-timeline Build Phase 6 — falsification, over HTTP against `next dev`
 * and real always-on servers.
 *
 *   A16  repointing `promises.jaeger.url` draws only the new server's runs
 *   A17  a violation that reaches Jaeger five minutes late still turns red
 *   A19  a window too slow to read in one refresh is drawn after a few
 *
 * Red today: the store is keyed by source name, re-reads only the last
 * minute, and reads a window all or nothing.
 */

const PROMISE = "checkout-never-charges-twice";
const OWNER = "checkout-v1";
const CRED_ENV = "INDUSK_TEST_FALSIFY_CREDENTIAL";
const HOUR = 3_600_000;

function project(jaeger: { url: string; otlp_url: string }): PromiseProject {
  return promiseProject({
    domains: ["checkout"],
    landed: { [OWNER]: daysAgo(30) },
    promises: [
      {
        name: PROMISE,
        kind: "behaviour",
        state: "enforced",
        domain: "checkout",
        owner: OWNER,
        sites: [`src/${PROMISE}.ts`],
        tests: [`src/${PROMISE}.test.ts`],
      },
    ],
    files: {
      [`src/${PROMISE}.ts`]: siteFile(PROMISE),
      [`src/${PROMISE}.test.ts`]: testFile(PROMISE),
    },
    extraConfig: {
      promises: {
        domains: ["checkout"],
        jaeger: { ...jaeger, credential_env: CRED_ENV },
      },
    },
  });
}

function repoint(
  p: PromiseProject,
  jaeger: { url: string; otlp_url: string },
): void {
  writeFileSync(
    join(p.planRoot, ".indusk", "config.json"),
    JSON.stringify({
      mode: "local",
      promises: {
        domains: ["checkout"],
        jaeger: { ...jaeger, credential_env: CRED_ENV },
      },
    }),
  );
}

async function page(dev: DevServer, name: string): Promise<string> {
  return (
    await fetch(`${dev.url}/p/${name}/promises?window=24h&source=production`)
  ).text();
}

function states(html: string): string[] {
  return (
    html.match(/data-testid="timeline-cell" data-state="([a-z]+)"/g) ?? []
  ).map((t) => /data-state="([a-z]+)"/.exec(t)?.[1] ?? "");
}

function productionChip(html: string): string | null {
  const tag = (
    html.match(/<[^>]*data-testid="promise-health"[^>]*>/g) ?? []
  ).find((t) => t.includes('data-source="production"'));
  return tag?.match(/data-health="([^"]+)"/)?.[1] ?? null;
}

const mark = (outcome: "upheld" | "violated", at: Date) => ({
  service: "checkout-demo",
  name: "charge-order",
  promise: PROMISE,
  outcome,
  at,
  ...(outcome === "violated" ? { traceId: newTraceId() } : {}),
});

describe("A16 — a repointed server draws only its own runs", () => {
  let a: AlwaysOnServer;
  let b: AlwaysOnServer;
  let fixture: PromiseProject;
  let home: string;
  let dev: DevServer;

  beforeAll(async () => {
    a = await startAlwaysOnServer();
    b = await startAlwaysOnServer();
    await a.load([mark("violated", new Date(Date.now() - 2 * HOUR))]);
    await b.load([mark("upheld", new Date(Date.now() - 2 * HOUR))]);
    fixture = project({ url: a.queryUrl, otlp_url: a.otlpUrl });
    home = makeHome([{ name: "repoint", path: fixture.root }]);
    dev = await startNextDev({ home, env: { [CRED_ENV]: a.credential } });
  }, 240_000);

  afterAll(async () => {
    await dev?.stop();
    await a?.stop();
    await b?.stop();
    for (const s of [a, b])
      if (s) rmSync(s.volume, { recursive: true, force: true });
    if (fixture) rmSync(fixture.root, { recursive: true, force: true });
    if (home) rmSync(home, { recursive: true, force: true });
  }, 60_000);

  it("after repointing, no cell holds the old server's break", async () => {
    expect(
      states(await page(dev, "repoint")),
      "server A's break is drawn first",
    ).toContain("red");
    expect(b.credential, "the two servers share one credential variable").toBe(
      a.credential,
    );
    repoint(fixture, { url: b.queryUrl, otlp_url: b.otlpUrl });
    await sleep(6_000); // past the health cache
    const after = await page(dev, "repoint");
    expect(states(after), "server B's run is drawn").toContain("green");
    expect(
      states(after),
      "lesson: a-cache-keyed-by-a-name-outlives-what-the-name-points-at",
    ).not.toContain("red");
  }, 90_000);
});

describe("A17 — a violation that arrives late is still read", () => {
  let server: AlwaysOnServer;
  let fixture: PromiseProject;
  let home: string;
  let dev: DevServer;

  beforeAll(async () => {
    server = await startAlwaysOnServer();
    await server.load([mark("upheld", new Date(Date.now() - HOUR))]);
    fixture = project({ url: server.queryUrl, otlp_url: server.otlpUrl });
    home = makeHome([{ name: "late", path: fixture.root }]);
    dev = await startNextDev({ home, env: { [CRED_ENV]: server.credential } });
  }, 240_000);

  afterAll(async () => {
    await dev?.stop();
    await server?.stop();
    if (server) rmSync(server.volume, { recursive: true, force: true });
    if (fixture) rmSync(fixture.root, { recursive: true, force: true });
    if (home) rmSync(home, { recursive: true, force: true });
  }, 60_000);

  it("a run that ended five minutes before it reached Jaeger turns the chip and its cell red", async () => {
    expect(productionChip(await page(dev, "late")), "green before").toBe(
      "green",
    );
    // Ended five minutes ago, arriving only now: a buffered exporter, an app
    // that reconnected.
    await server.load([mark("violated", new Date(Date.now() - 5 * 60_000))]);
    await sleep(6_000); // past the health cache
    const after = await page(dev, "late");
    expect(
      productionChip(after),
      "lesson: a-store-that-reads-only-what-is-new-must-still-read-what-arrives-late",
    ).toBe("red");
    expect(states(after)).toContain("red");
  }, 90_000);
});

describe("A19 — a window too slow for one refresh is drawn after a few", () => {
  let server: AlwaysOnServer;
  let proxy: Server;
  let fixture: PromiseProject;
  let home: string;
  let dev: DevServer;

  /** Forward to the server; a trace query spanning more than a day answers after 2.5 s. */
  function startSlowProxy(target: string): Promise<Server> {
    const p = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      const start = Number(url.searchParams.get("start"));
      const end = Number(url.searchParams.get("end"));
      if (url.pathname === "/api/traces" && end - start > 24 * HOUR * 1000) {
        await sleep(2_500);
      }
      const upstream = await fetch(`${target}${req.url}`, {
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(
            ([k]) => k !== "host" && k !== "connection",
          ) as [string, string][],
        ),
      }).catch(() => null);
      if (!upstream) {
        res.writeHead(502).end();
        return;
      }
      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "",
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    });
    return new Promise((resolve) => p.listen(0, "127.0.0.1", () => resolve(p)));
  }

  beforeAll(async () => {
    server = await startAlwaysOnServer();
    await server.load([mark("upheld", new Date(Date.now() - 2 * HOUR))]);
    proxy = await startSlowProxy(server.queryUrl);
    const proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
    fixture = project({ url: proxyUrl, otlp_url: server.otlpUrl });
    home = makeHome([{ name: "slow", path: fixture.root }]);
    dev = await startNextDev({ home, env: { [CRED_ENV]: server.credential } });
  }, 240_000);

  afterAll(async () => {
    await dev?.stop();
    proxy?.close();
    await server?.stop();
    if (server) rmSync(server.volume, { recursive: true, force: true });
    if (fixture) rmSync(fixture.root, { recursive: true, force: true });
    if (home) rmSync(home, { recursive: true, force: true });
  }, 60_000);

  it("within three refreshes, the run two hours ago is drawn green", async () => {
    let drawn = false;
    for (let i = 0; i < 3 && !drawn; i++) {
      const html = await page(dev, "slow");
      drawn = states(html).includes("green");
      if (!drawn) await sleep(6_000);
    }
    expect(
      drawn,
      "lesson: a-read-that-cannot-finish-must-keep-what-it-read",
    ).toBe(true);
  }, 120_000);
});
