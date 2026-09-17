import { readdirSync, readFileSync, statSync } from "node:fs";
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

  it("A37: config.json is never parsed by hand in the admin's lib", () => {
    expect(filesContaining(join(SRC, "lib"), "config.json")).toEqual([]);
  });
});
