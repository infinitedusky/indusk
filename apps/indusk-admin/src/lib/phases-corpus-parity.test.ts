import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseImplString } from "@infinitedusky/indusk-mcp/impl-parser";
import { describe, expect, it } from "vitest";
import { extractPhases } from "./phases";

/**
 * admin-ui-phase-progress — A3, a parity row over the corpus.
 *
 * The admin's `extractPhases` becomes an adapter over the package's
 * `parseImplString` in Build Phase 3. This asserts the two agree on every
 * impl in the repository — kind, number, name and item count per phase, in
 * document order — so swapping the parser changes nothing a reader sees for
 * the 80-odd plans that exist today, and every new plan shape lands in both
 * at once. Authored RED in Build Phase 1 (the subpath export exists; the
 * adapter does not: today's regex reads a two-sequence impl as one phase).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const PLANNING = resolve(REPO_ROOT, ".indusk/planning");

// node:fs, not glob — the admin has no glob dependency, and a test that cannot
// load is an absent test wearing a failure's clothes.
const impls = existsSync(PLANNING)
  ? readdirSync(PLANNING, { recursive: true, encoding: "utf-8" })
      .filter((rel) => rel.endsWith("impl.md"))
      .map((rel) => join(PLANNING, rel))
      .sort()
  : [];

/** The adapter's view after Build Phase 3; widened so A25 stays green until then. */
interface PhaseView {
  kind: string;
  number: number;
  title: string;
  itemCount: number;
}

describe("A3 — the admin renders the phases the package parser reports, over the corpus", () => {
  it("found impls to compare", () => {
    expect(impls.length).toBeGreaterThan(0);
  });

  it.each(impls)("%s", (file) => {
    const content = readFileSync(file, "utf-8");
    const expected = parseImplString(content).phases.map((p) => [
      p.kind,
      p.number,
      p.name,
      p.gates.flatMap((g) => g.items).length,
    ]);
    const actual = (extractPhases(content) as unknown as PhaseView[]).map(
      (p) => [p.kind, p.number, p.title, p.itemCount],
    );
    expect(actual).toEqual(expected);
  });
});
