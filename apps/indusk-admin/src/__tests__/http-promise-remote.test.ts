import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AlwaysOnServer,
  startAlwaysOnServer,
} from "../../../indusk-mcp/src/__tests__/helpers/always-on-server";
import { newTraceId } from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import { makeHome, sleep, startNextDev } from "./helpers/next-dev";

/**
 * day-always-on — A15–A17: the admin shows a deployed system's promises
 * (ADR D5–D8).
 *
 * The project names the always-on server in `promises.jaeger`, and the
 * admin's health read follows it there. The chips and their meaning are
 * day-monitor's; what is new is where the marks came from, that the row names
 * the environment, and that the page refreshes itself.
 *
 * Red today: the admin reads the local daemon, so a project naming a server
 * shows nothing from it. Green after Build Phase 4.
 */

const PROMISE = "seat-never-double-booked";
const OWNER = "seats-v2";
const CRED_ENV = "INDUSK_TEST_SERVER_CREDENTIAL";

function promiseFile(name: string, owner: string): string {
  return [
    "---",
    `name: ${name}`,
    "kind: behaviour",
    "lifetime: holds",
    "state: enforced",
    "domain: seating",
    `owner: ${owner}`,
    "sites: []",
    "tests: []",
    "incidents: []",
    "---",
    "",
    `${name} holds.`,
    "",
  ].join("\n");
}

function project(queryUrl: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "remote-promises-"));
  mkdirSync(path.join(root, ".indusk", "planning", OWNER), { recursive: true });
  writeFileSync(
    path.join(root, ".indusk", "config.json"),
    JSON.stringify({
      mode: "full",
      admin: { refresh_ms: 1000 },
      promises: {
        domains: ["seating"],
        jaeger: { url: queryUrl, credential_env: CRED_ENV },
      },
    }),
  );
  writeFileSync(
    path.join(root, ".indusk", "planning", OWNER, "brief.md"),
    `---\ntitle: ${OWNER}\nstatus: accepted\n---\n# ${OWNER}\n`,
  );
  mkdirSync(path.join(root, ".indusk", "promises"), { recursive: true });
  writeFileSync(
    path.join(root, ".indusk", "promises", `${PROMISE}.md`),
    promiseFile(PROMISE, OWNER),
  );
  return root;
}

function healthOf(html: string, name: string): string | null {
  const start = html.indexOf(`data-promise="${name}"`);
  if (start === -1) return null;
  const next = html.indexOf('data-promise="', start + 1);
  const row = html.slice(start, next === -1 ? undefined : next);
  const chip = row.match(/<[^>]*data-testid="promise-health"[^>]*>/)?.[0];
  return chip?.match(/data-health="([^"]+)"/)?.[1] ?? null;
}

let stop: (() => Promise<void>) | null = null;
let url = "";
let home = "";
let root = "";
let server: AlwaysOnServer;

beforeAll(async () => {
  server = await startAlwaysOnServer();
  root = project(server.queryUrl);
  home = makeHome([{ name: "remote", path: root }]);
  await server.load([
    {
      service: "seats-api",
      name: "hold-seat",
      promise: PROMISE,
      outcome: "violated",
      symptom: "seat 4 held by two players",
      traceId: newTraceId(),
      attributes: { "deployment.environment": "production" },
    },
  ]);
  const dev = await startNextDev({
    home,
    env: { [CRED_ENV]: server.credential } as NodeJS.ProcessEnv,
  });
  url = dev.url;
  stop = dev.stop;
}, 180_000);

afterAll(async () => {
  await stop?.();
  await server?.stop();
  for (const dir of [home, root, server?.volume]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("A15 — the deployed system's health on the page", () => {
  it("shows the violated promise red, naming its environment", async () => {
    const res = await fetch(`${url}/p/remote/promises`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(healthOf(html, PROMISE)).toBe("red");
    expect(html).toMatch(/production/);
  });
});

describe("A16 — the page refreshes itself", () => {
  it(
    "a violation arriving while the page is open turns the promise red without a reload",
    { timeout: 60_000 },
    async () => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${url}/p/remote/promises`, {
          waitUntil: "networkidle",
        });
        const second = "seat-release-on-timeout";
        writeFileSync(
          path.join(root, ".indusk", "promises", `${second}.md`),
          promiseFile(second, OWNER),
        );
        await server.load([
          {
            service: "seats-api",
            name: "release-seat",
            promise: second,
            outcome: "violated",
            symptom: "a held seat stayed held",
            traceId: newTraceId(),
            attributes: { "deployment.environment": "production" },
          },
        ]);
        await page
          .locator(
            `[data-promise="${second}"] [data-testid="promise-health"][data-health="red"]`,
          )
          .waitFor({ timeout: 30_000 });
      } finally {
        await browser.close();
      }
    },
  );
});

describe("A17 — the server unreachable", () => {
  it("every behaviour chip is hollow with health unknown, and none is green", async () => {
    await server.stop();
    await sleep(2_500); // past the project's 1s refresh interval
    const html = await (await fetch(`${url}/p/remote/promises`)).text();
    expect(healthOf(html, PROMISE)).toBe("unverified");
    expect(html).not.toContain('data-health="green"');
    expect(html).toMatch(/health unknown since/i);
  });
});
