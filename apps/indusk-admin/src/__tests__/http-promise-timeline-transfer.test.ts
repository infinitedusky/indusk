import { rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AlwaysOnServer,
  startAlwaysOnServer,
} from "../../../indusk-mcp/src/__tests__/helpers/always-on-server";
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
 * promise-timeline A12 — a refresh with nothing new moves almost nothing.
 *
 * A week of one promise's marks is megabytes, because Jaeger returns whole
 * traces (research.md: 368 marks, 10.9 MB). The project names a production
 * server through a proxy that counts every byte the server sends back, so
 * the test measures the transfer itself — not a counter inside the admin,
 * which would prove the counter. Two page loads, past the health cache, with
 * nothing new between them: the second must move under 5 % of the first.
 *
 * Red today: every refresh past the cache re-reads the whole window.
 */

const PROMISE = "seat-held";
const OWNER = "seats-v2";
const CRED_ENV = "INDUSK_TEST_TRANSFER_CREDENTIAL";
const HOUR = 3_600_000;

let server: AlwaysOnServer;
let proxy: Server;
let proxyUrl = "";
let bytes = 0;
let fixture: PromiseProject;
let home: string;
let dev: DevServer;

/** Forward every request to the server, counting the response bytes. */
function startCountingProxy(target: string): Promise<Server> {
  const p = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const upstream = await fetch(`${target}${req.url}`, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(
          ([k]) => k !== "host" && k !== "connection",
        ) as [string, string][],
      ),
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    bytes += body.length;
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "",
    });
    res.end(body);
  });
  return new Promise((resolve) => p.listen(0, "127.0.0.1", () => resolve(p)));
}

beforeAll(async () => {
  server = await startAlwaysOnServer();
  await server.load(
    Array.from({ length: 200 }, (_, i) => ({
      service: "seats-app",
      name: "hold-seat",
      promise: PROMISE,
      outcome: "upheld" as const,
      at: new Date(Date.now() - (i + 1) * 0.5 * HOUR),
    })),
  );
  proxy = await startCountingProxy(server.queryUrl);
  proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
  fixture = promiseProject({
    domains: ["seating"],
    landed: { [OWNER]: daysAgo(30) },
    promises: [
      {
        name: PROMISE,
        kind: "behaviour",
        state: "enforced",
        domain: "seating",
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
        domains: ["seating"],
        jaeger: {
          url: proxyUrl,
          otlp_url: server.otlpUrl,
          credential_env: CRED_ENV,
        },
      },
    },
  });
  home = makeHome([{ name: "transfer", path: fixture.root }]);
  dev = await startNextDev({ home, env: { [CRED_ENV]: server.credential } });
}, 240_000);

afterAll(async () => {
  await dev?.stop();
  proxy?.close();
  await server?.stop();
  if (server) rmSync(server.volume, { recursive: true, force: true });
  if (fixture) rmSync(fixture.root, { recursive: true, force: true });
  if (home) rmSync(home, { recursive: true, force: true });
});

describe("promise-timeline A12 — a refresh reads only what is new", () => {
  it("the second load, with nothing new, moves under 5 % of the first's bytes", async () => {
    bytes = 0;
    const first = await fetch(`${dev.url}/p/transfer/promises?window=7d`);
    expect(first.status).toBe(200);
    await first.text();
    const firstBytes = bytes;
    expect(
      firstBytes,
      "the first load read the window through the proxy",
    ).toBeGreaterThan(50_000);

    await sleep(6_000); // past the health cache
    bytes = 0;
    await (await fetch(`${dev.url}/p/transfer/promises?window=7d`)).text();
    const secondBytes = bytes;
    expect(
      secondBytes,
      `first ${firstBytes} bytes, second ${secondBytes} bytes`,
    ).toBeLessThan(firstBytes * 0.05);
  }, 120_000);
});
