import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type FakeQueryPort,
  startFakeQueryPort,
} from "../../../indusk-mcp/src/__tests__/helpers/local-jaeger";
import { type DevServer, makeHome, startNextDev } from "./helpers/next-dev";

/**
 * watcher-heartbeat — the admin half of A2, over HTTP against `next dev`.
 *
 * The daemon record in `INDUSK_HOME` points at something that answers every
 * request the way an empty Jaeger does (`{"data":[]}`) and stores nothing —
 * the 2026-10-01 case, a Jaeger that is reachable and not listening. The
 * Promises page must say *watcher blind* and show no health it did not
 * observe: no green chip, no "not seen" read as a fact about the promise.
 *
 * Red today: the page reads the empty answer as "not seen" (unverified).
 */

const PROMISE = "seat-never-double-booked";
const EMPTY_JAEGER = '{"data":[]}';

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function project(): string {
  const root = mkdtempSync(path.join(tmpdir(), "watcher-blind-"));
  write(
    root,
    ".indusk/config.json",
    JSON.stringify({ mode: "full", promises: { domains: ["seating"] } }),
  );
  write(
    root,
    ".indusk/planning/seats-v2/brief.md",
    "---\ntitle: seats-v2\nstatus: accepted\n---\n# seats-v2\n",
  );
  write(
    root,
    `.indusk/promises/${PROMISE}.md`,
    [
      "---",
      `name: ${PROMISE}`,
      "kind: behaviour",
      "lifetime: holds",
      "state: enforced",
      "domain: seating",
      "owner: seats-v2",
      "sites: []",
      "tests: []",
      "incidents: []",
      "---",
      "",
      `${PROMISE} holds.`,
      "",
    ].join("\n"),
  );
  return root;
}

describe("watcher-heartbeat — A2 (admin): a Jaeger that answers and hears nothing", () => {
  let root: string;
  let home: string;
  let fake: FakeQueryPort;
  let dev: DevServer;

  beforeAll(async () => {
    root = project();
    home = makeHome([{ name: "blind", path: root }]);
    fake = await startFakeQueryPort(home, EMPTY_JAEGER);
    dev = await startNextDev({ home });
  }, 60_000);

  afterAll(async () => {
    await dev?.stop();
    await fake?.close();
    if (root) rmSync(root, { recursive: true, force: true });
    if (home) rmSync(home, { recursive: true, force: true });
  });

  it("the Promises page says watcher blind and shows no observed health", async () => {
    const res = await fetch(`${dev.url}/p/blind/promises`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/watcher blind/i);
    expect(html).not.toContain('data-health="green"');
    expect(html).not.toMatch(/not seen/i);
  }, 30_000);
});
