// clause: admin-pages-load-fast/never-freezes
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * admin-pages-load-fast, Test Phase 1 (A13): no code on the admin's page paths starts a
 * program the server must stand still for. A `spawnSync`, `execSync` or `execFileSync` in a
 * module a page reaches holds the whole server's event loop while the program runs; a page
 * that read the process list that way took 4 s of a 17 s plan page. The rule is held by a
 * scan, so a reader added later is caught the day it is added, not found in a profile.
 *
 * Two parts, read from files only (this starts no process, so it is not in `vitest.tiers.ts`):
 *   1. every module the admin's pages reach, in the admin and in the package it imports
 *      (followed through the package's `exports` map into its source), holds no synchronous
 *      start, except a function named in ALLOWED with its reason;
 *   2. no admin source imports a synchronous reader by name, whatever else its module holds.
 *
 * ALLOWED is empty today; Build Phase 2 fills it from the inventory of reached modules, an
 * entry naming the synchronous functions it excuses and why (impl decision 17). An entry is
 * valid only while no admin source imports any function it names (checked below).
 */

const ADMIN = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADMIN_SRC = join(ADMIN, "src");
const PACKAGE = resolve(ADMIN, "..", "indusk-mcp");
const PACKAGE_NAME = "@infinitedusky/indusk-mcp/";

/** Synchronous program starts. */
const SYNC_START = /\b(?:spawnSync|execSync|execFileSync)\s*\(/;

/** The synchronous readers of the process list and the trunk history; the admin uses their kept, asynchronous twins. */
const BANNED_IMPORTS = [
  "psAll",
  "ps",
  "landedAsker",
  "planLandedOnMain",
  "trunkMergeSubjects",
  "realProcessReads",
];

/**
 * A package function allowed to start a program synchronously, because it is for the command
 * line or the daemon's own checks and no admin page calls it. `file` is repo-relative.
 */
interface Allowed {
  file: string;
  functions: string[];
  reason: string;
}
const ALLOWED: Allowed[] = [];

const read = (file: string) => readFileSync(file, "utf-8");

/** Source with comments and fenced blocks blanked, keeping line numbers. */
function code(raw: string): string {
  const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  let fenced = false;
  return noBlock
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line.replace(/(^|\s)\/\/.*$/, "$1");
    })
    .join("\n");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(?:ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const isTestFile = (file: string) =>
  /\.(?:test|stories)\.(?:ts|tsx)$/.test(file) ||
  file.split("/").includes("__tests__");

/** What a source imports from: static `from "x"`, `import("x")` and `export … from "x"`. */
function specifiers(source: string): string[] {
  return [
    ...source.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g),
  ].map((m) => m[1]);
}

function withExtension(base: string): string | null {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    base.replace(/\.js$/, ".ts"),
  ])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}

const exportsMap = JSON.parse(read(join(PACKAGE, "package.json")))
  .exports as Record<string, { default?: string } | string>;

/** The package source file an `@infinitedusky/indusk-mcp/<sub>` entry point is built from. */
function packageEntry(sub: string): string | null {
  const entry = exportsMap[`./${sub}`];
  const built = typeof entry === "string" ? entry : entry?.default;
  if (!built) return null;
  return withExtension(
    join(PACKAGE, built.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts")),
  );
}

/** Where `spec`, imported from `from`, leads inside the admin or the package; null for anything else. */
function follow(from: string, spec: string): string | null {
  if (spec.startsWith(PACKAGE_NAME))
    return packageEntry(spec.slice(PACKAGE_NAME.length));
  if (spec.startsWith("@/"))
    return withExtension(join(ADMIN_SRC, spec.slice(2)));
  if (spec.startsWith(".")) return withExtension(resolve(dirname(from), spec));
  return null;
}

/** The admin's entry points: every page, layout and route, and the daemon's instrumentation hook. */
function adminEntries(): string[] {
  const entries = walk(join(ADMIN_SRC, "app")).filter(
    (f) =>
      !isTestFile(f) &&
      /\/(?:page|layout|route|loading|error|not-found|template|default)\.tsx?$/.test(
        f,
      ),
  );
  const hook = join(ADMIN_SRC, "instrumentation.ts");
  return existsSync(hook) ? [...entries, hook] : entries;
}

/** Every module the pages reach: the admin's own non-test sources and the package modules they import, transitively. */
function reached(): string[] {
  const seen = new Set<string>();
  const queue = adminEntries();
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || isTestFile(file)) continue;
    seen.add(file);
    for (const spec of specifiers(code(read(file)))) {
      const next = follow(file, spec);
      if (next !== null) queue.push(next);
    }
  }
  return [...seen].sort();
}

/** The name of the function a line sits in: the nearest earlier top-level declaration. */
function functionAt(lines: string[], index: number): string {
  for (let i = index; i >= 0; i--) {
    const m =
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/.exec(lines[i]) ??
      /^(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function|\()/.exec(
        lines[i],
      );
    if (m) return m[1];
  }
  return "(module)";
}

const repoRelative = (file: string) =>
  relative(resolve(ADMIN, "..", ".."), file);

/** Each synchronous start in `file` that no ALLOWED entry excuses, as `file:line in function`. */
function syncStartsIn(file: string): string[] {
  const lines = code(read(file)).split("\n");
  const allowed = ALLOWED.find((a) => a.file === repoRelative(file));
  const found: string[] = [];
  lines.forEach((line, i) => {
    if (!SYNC_START.test(line)) return;
    const fn = functionAt(lines, i);
    if (allowed?.functions.includes(fn)) return;
    found.push(`${repoRelative(file)}:${i + 1} in ${fn}`);
  });
  return found;
}

describe("no program start on a page's path freezes the server (A13)", () => {
  it("A13 finds the pages' modules (the scan reads real files, not an empty list)", () => {
    const files = reached().map(repoRelative);
    expect(files).toContain("apps/indusk-admin/src/lib/plan-situation.ts");
    expect(files).toContain("apps/indusk-mcp/src/lib/run-record/landed.ts");
  });

  it("A13 no module the admin's pages reach starts a program synchronously", () => {
    const found = reached().flatMap(syncStartsIn);
    expect(
      found,
      `synchronous program starts on a page's path:\n${found.join("\n")}`,
    ).toEqual([]);
  });

  it("A13 no admin source imports a synchronous reader of the process list or the trunk history", () => {
    const offenders: string[] = [];
    for (const file of walk(ADMIN_SRC).filter((f) => !isTestFile(f))) {
      const source = code(read(file));
      for (const m of source.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@infinitedusky\/indusk-mcp\/[^"']+["']/g,
      )) {
        for (const part of m[1].split(",")) {
          const name = part
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0];
          if (BANNED_IMPORTS.includes(name))
            offenders.push(`${relative(ADMIN, file)} imports ${name}`);
        }
      }
    }
    expect(
      offenders,
      `synchronous readers imported by the admin:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("A13 an allow-list entry excuses only functions the admin never imports", () => {
    const imported = new Set<string>();
    for (const file of walk(ADMIN_SRC).filter((f) => !isTestFile(f)))
      for (const m of code(read(file)).matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s*from/g,
      ))
        for (const part of m[1].split(","))
          imported.add(
            part
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0],
          );
    const hidden = ALLOWED.flatMap((a) =>
      a.functions.filter((f) => imported.has(f)).map((f) => `${a.file}: ${f}`),
    );
    expect(
      hidden,
      `allow-listed functions the admin imports:\n${hidden.join("\n")}`,
    ).toEqual([]);
    expect(
      ALLOWED.filter((a) => a.reason.trim() === "").map((a) => a.file),
      "allow-list entries with no reason",
    ).toEqual([]);
  });
});
