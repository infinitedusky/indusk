import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * admin-ui-phase-progress — the structural halves of A34–A37 (cleanup).
 *
 * Each extraction the Cleanup Phase made is pinned by counting definitions,
 * the way the package pins its single-definition primitives: a second copy
 * of any of these would come back silently, and the render tests cannot see
 * a copy that is never rendered.
 */

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(p);
  }
  return out;
}

function filesContaining(root: string, needle: string | RegExp): string[] {
  return walk(root)
    .filter((f) => {
      const s = readFileSync(f, "utf-8");
      return typeof needle === "string" ? s.includes(needle) : needle.test(s);
    })
    .map((f) => relative(SRC, f));
}

describe("cleanup pins — one definition each", () => {
  it("A34: exactly one rows-table header exists under components", () => {
    expect(
      filesContaining(join(SRC, "components"), "<TableHead>ID</TableHead>"),
    ).toEqual(["components/phases/TrajectoryRowsTable.tsx"]);
  });

  it("A35: falsificationPhaseMarkdown is gone; one ritualPhaseMarkdown remains", () => {
    expect(filesContaining(SRC, "falsificationPhaseMarkdown")).toEqual([]);
    expect(filesContaining(SRC, "export function ritualPhaseMarkdown")).toEqual(
      ["lib/markdown-export.ts"],
    );
  });

  it("A36: the admin spells phases through phaseTitle in the display vocabulary, never the package's phaseLabel", () => {
    expect(filesContaining(join(SRC, "components"), /\bphaseLabel\(/)).toEqual(
      [],
    );
    expect(filesContaining(SRC, "export function phaseTitle")).toEqual([
      "components/bars/labels.ts",
    ]);
  });

  it("A37: config.json is never read by hand in the admin's lib", () => {
    // The quoted literal is what a hand `join(root, ".indusk", "config.json")`
    // needs; prose in a docblock names the file in backticks.
    expect(filesContaining(join(SRC, "lib"), '"config.json"')).toEqual([]);
  });
});

/**
 * day-promises — A34 (cleanup). `HoldingBadge` is rendered by two server
 * components (the sidebar's plan items, the plan header) and by the Promises
 * page; it lives in its own file with no client boundary, so the sidebar and
 * the header do not pull a page module into the client bundle for a span.
 */
describe("A34 — HoldingBadge has one server-renderable home", () => {
  it("components/HoldingBadge.tsx exists, exports the badge and carries no client directive", () => {
    const path = join(SRC, "components", "HoldingBadge.tsx");
    expect(existsSync(path), "components/HoldingBadge.tsx is missing").toBe(
      true,
    );
    const source = readFileSync(path, "utf-8");
    expect(source).toMatch(/export function HoldingBadge\b/);
    expect(source).not.toMatch(/"use client"/);
  });

  it("the sidebar and the plan header import it from there, and nothing else exports it", () => {
    expect(
      filesContaining(
        join(SRC, "components"),
        /export function HoldingBadge\b/,
      ),
    ).toEqual(["components/HoldingBadge.tsx"]);
    for (const rel of ["PlanList.tsx", "PlanDetail.tsx"]) {
      const source = readFileSync(join(SRC, "components", rel), "utf-8");
      expect(
        source,
        `${rel} does not import HoldingBadge from its home`,
      ).toMatch(/from "@\/components\/HoldingBadge"/);
    }
  });
});
