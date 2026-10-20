#!/usr/bin/env node
// clause: admin-pages-load-fast/never-freezes
// A1 of admin-pages-load-fast: how long each page route of the running admin takes, fresh and
// kept. The headline promise is "every admin page answers in under a second"; this is the
// recorded measure of it (a `manual:` live check, run by hand at close).
//
//   node apps/indusk-admin/scripts/measure-pages.mjs [--project <name>] [--plan <handle>]
//        [--research <slug>] [--draft <id>] [--base-url <url>] [--wait-ms <ms>] [--runs <n>] [--only <text>]
//
// The admin's address is the one `indusk ui status` prints (the daemon's stored address),
// never a guessed port. Page routes are the `page.tsx` files under src/app/p/[project].
// Each page is fetched three times with the kept reading allowed to expire in between (so
// every run reads fresh; its median is "fresh"), then once more straight after (inside the
// window; "kept"). Exits 1 when any time is over one second.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT_S = 1.0;
const KEPT_FOR_MS = 8000; // keep in step with the package's KEPT_FOR_MS
const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROUTES = join(HERE, "..", "src", "app", "p", "[project]");

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const project = arg("project", "dusk");
const plan = arg("plan", "admin-pages-load-fast");
const waitMs = Number(arg("wait-ms", String(KEPT_FOR_MS + 1000)));
const runs = Number(arg("runs", "3"));
const only = arg("only", "");

function adminOrigin() {
  const base = arg("base-url", null);
  if (base) return base.replace(/\/$/, "");
  const bin = process.env.INDUSK_BIN ?? "indusk";
  const out = execFileSync(bin, ["ui", "status"], { encoding: "utf-8" });
  const port = /running on port (\d+)/.exec(out)?.[1];
  if (!port)
    throw new Error(
      `the admin is not running (indusk ui status said: ${out.trim()})`,
    );
  return `http://127.0.0.1:${port}`;
}

function pageFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) pageFiles(path, out);
    else if (entry.name === "page.tsx") out.push(path);
  }
  return out;
}

/** The route a page.tsx serves, with the parameters this run was given; null when it has none. */
function routeOf(file) {
  const parts = relative(APP_ROUTES, dirname(file)).split("/").filter(Boolean);
  const values = {
    "[project]": project,
    "[name]": plan,
    "[slug]": arg("research", null),
    "[id]": arg("draft", null),
    "[doc]": null,
  };
  const out = [];
  for (const part of parts) {
    if (part in values) {
      if (values[part] === null) return null;
      out.push(values[part]);
    } else out.push(part);
  }
  return `/p/${project}${out.length ? `/${out.join("/")}` : ""}`.replace(
    `/p/${project}/${project}`,
    `/p/${project}`,
  );
}

const routes = [
  `/p/${project}`,
  ...pageFiles(APP_ROUTES)
    .map(routeOf)
    .filter((r) => r !== null),
].filter(
  (r, i, all) =>
    all.indexOf(r) === i && r.split("/").length >= 3 && r.includes(only),
);

async function timeOf(origin, route) {
  const start = performance.now();
  const res = await fetch(origin + route, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  await res.arrayBuffer();
  return { s: (performance.now() - start) / 1000, status: res.status };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const origin = adminOrigin();
const rows = [];
for (const route of routes) {
  const fresh = [];
  let status = 0;
  for (let i = 0; i < runs; i++) {
    if (i > 0) await sleep(waitMs);
    const t = await timeOf(origin, route);
    fresh.push(t.s);
    status = t.status;
  }
  const kept = (await timeOf(origin, route)).s;
  rows.push({ route, status, fresh: median(fresh), kept });
  const last = rows[rows.length - 1];
  console.error(
    `measured ${route}: fresh ${last.fresh.toFixed(2)} s, kept ${last.kept.toFixed(2)} s`,
  );
}

let slow = 0;
for (const r of rows) {
  const over = r.fresh > LIMIT_S || r.kept > LIMIT_S;
  if (over) slow += 1;
  console.log(
    `${over ? "SLOW" : "ok  "} ${r.route}  fresh ${r.fresh.toFixed(2)} s  kept ${r.kept.toFixed(2)} s  (HTTP ${r.status})`,
  );
}
console.log(
  slow === 0
    ? "every page under one second"
    : `${slow} page(s) over ${LIMIT_S} s`,
);
process.exit(slow === 0 ? 0 : 1);
