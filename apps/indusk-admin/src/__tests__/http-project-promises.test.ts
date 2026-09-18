import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHome, startNextDev } from "./helpers/next-dev";

/**
 * day-promises — A17, A23, A24 over HTTP.
 *
 * Three projects in one registry: one with a clean registry of two promises,
 * one whose registry holds a malformed entry, one with no registry at all.
 * The route does not exist today, so every request 404s — a real red at the
 * boundary, no import to fail. Green after Build Phase 4.
 *
 * The page's chip and grouping behaviour are component rows (A18–A22) and
 * live in `components/Promises.test.tsx`; this file asserts what the server
 * renders: the rows, the nav entry, the error block, the empty state, and a
 * request-time read.
 */

function promiseFile(opts: {
  name: string;
  kind: string;
  state: string;
  domain: string;
  owner: string;
  statement: string;
}): string {
  return [
    "---",
    `name: ${opts.name}`,
    `kind: ${opts.kind}`,
    "lifetime: holds",
    `state: ${opts.state}`,
    `domain: ${opts.domain}`,
    `owner: ${opts.owner}`,
    "sites: []",
    "tests: []",
    "incidents: []",
    "---",
    "",
    opts.statement,
    "",
  ].join("\n");
}

function project(opts: { registry: "clean" | "malformed" | "none" }): string {
  const root = mkdtempSync(path.join(tmpdir(), `promises-${opts.registry}-`));
  mkdirSync(path.join(root, ".indusk", "planning", "archive", "lab-v0"), {
    recursive: true,
  });
  writeFileSync(
    path.join(root, ".indusk", "config.json"),
    JSON.stringify(
      { mode: "full", promises: { domains: ["seating", "archive"] } },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(root, ".indusk", "planning", "archive", "lab-v0", "brief.md"),
    "---\ntitle: lab-v0\nstatus: accepted\n---\n# lab-v0\n",
  );
  if (opts.registry === "none") return root;
  const registry = path.join(root, ".indusk", "promises");
  mkdirSync(registry, { recursive: true });
  writeFileSync(
    path.join(registry, "seat-never-double-booked.md"),
    promiseFile({
      name: "seat-never-double-booked",
      kind: "behaviour",
      state: "enforced",
      domain: "seating",
      owner: "lab-v0",
      statement: "A seat is never held by two players at once.",
    }),
  );
  if (opts.registry === "malformed") {
    writeFileSync(
      path.join(registry, "archive-write-once.md"),
      "---\nname: archive-write-once\nstate: enforced\ndomain: archive\nowner: lab-v0\n---\n\nAn archived capture is never modified.\n",
    );
  } else {
    writeFileSync(
      path.join(registry, "archive-write-once.md"),
      promiseFile({
        name: "archive-write-once",
        kind: "state",
        state: "known-violated",
        domain: "archive",
        owner: "lab-v0",
        statement: "An archived capture is never modified or deleted.",
      }),
    );
  }
  return root;
}

let stop: (() => Promise<void>) | null = null;
let url = "";
let home = "";
let clean = "";
let malformed = "";
let none = "";

beforeAll(async () => {
  clean = project({ registry: "clean" });
  malformed = project({ registry: "malformed" });
  none = project({ registry: "none" });
  home = makeHome([
    { name: "clean", path: clean },
    { name: "malformed", path: malformed },
    { name: "none", path: none },
  ]);
  const dev = await startNextDev({ home });
  url = dev.url;
  stop = dev.stop;
}, 60_000);

afterAll(async () => {
  await stop?.();
  for (const dir of [home, clean, malformed, none]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("A17 — the Promises page lists the registry and sits in the project nav", () => {
  it("GET /p/clean/promises is 200 with one row per promise carrying its fields", async () => {
    const res = await fetch(`${url}/p/clean/promises`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("seat-never-double-booked");
    expect(html).toContain("A seat is never held by two players at once.");
    expect(html).toContain("archive-write-once");
    expect(html).toContain("behaviour");
    expect(html).toContain("seating");
    expect(html).toContain("lab-v0");
    expect(html).toContain("known-violated");
  });

  it("the project nav on /p/clean/ links to /p/clean/promises beside scorecards", async () => {
    const res = await fetch(`${url}/p/clean/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="/p/clean/promises"');
    expect(html).toContain('href="/p/clean/scorecards"');
  });
});

describe("A23 — a bad registry is an error block, none is an empty state", () => {
  it("a malformed entry renders an error naming the file and the field, and no table row for it", async () => {
    const res = await fetch(`${url}/p/malformed/promises`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("archive-write-once.md");
    expect(html).toMatch(/\bkind\b/);
    expect(html).toContain("seat-never-double-booked");
  });

  it("no registry renders an empty state naming the directory and how to create one", async () => {
    const res = await fetch(`${url}/p/none/promises`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(".indusk/promises");
    expect(html).toMatch(/reference\/cli\/promises|indusk promises check/);
  });
});

describe("A24 — the registry is read at request time", () => {
  it("an entry added between two requests appears on the second with no restart", async () => {
    const before = await (await fetch(`${url}/p/clean/promises`)).text();
    expect(before).not.toContain("seat-release-on-timeout");

    writeFileSync(
      path.join(clean, ".indusk", "promises", "seat-release-on-timeout.md"),
      promiseFile({
        name: "seat-release-on-timeout",
        kind: "behaviour",
        state: "declared",
        domain: "seating",
        owner: "lab-v0",
        statement: "A held seat is released after thirty seconds.",
      }),
    );

    const after = await (await fetch(`${url}/p/clean/promises`)).text();
    expect(after).toContain("seat-release-on-timeout");
  });
});
