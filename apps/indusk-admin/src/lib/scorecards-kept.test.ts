// clause: admin-pages-load-fast/never-freezes
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evalDir } from "@infinitedusky/indusk-mcp/bookkeeping/roots";
import { afterEach, describe, expect, it } from "vitest";
import { readEvalScorecards } from "./planning-reader";

/**
 * admin-pages-load-fast, fifth round: the eval log is megabytes, so it is parsed again only when
 * it changes. A line appended after a read shows on the next read; a date range still narrows
 * the kept entries.
 */

const home = mkdtempSync(join(tmpdir(), "kept-evals-"));
const previousHome = process.env.INDUSK_HOME;
process.env.INDUSK_HOME = home;
afterEach(() => {
  if (previousHome === undefined) delete process.env.INDUSK_HOME;
  else process.env.INDUSK_HOME = previousHome;
  rmSync(home, { recursive: true, force: true });
});

const line = (at: string) => `${JSON.stringify({ timestamp: at, changeId: at })}\n`;
const ALL = { from: new Date(0), to: new Date("2100-01-01") };

describe("the eval log is parsed once per change", () => {
  it("A30 reads a line appended after a read, and narrows the kept entries by range", async () => {
    const root = mkdtempSync(join(tmpdir(), "kept-evals-project-"));
    const log = join(evalDir(root), "results.log");
    mkdirSync(evalDir(root), { recursive: true });
    writeFileSync(log, line("2026-01-01T00:00:00Z"));
    expect(await readEvalScorecards(root, ALL)).toHaveLength(1);
    appendFileSync(log, line("2026-02-01T00:00:00Z"));
    const again = await readEvalScorecards(root, ALL);
    expect(again.map((c) => c.timestamp)).toEqual([
      "2026-02-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ]);
    const narrowed = await readEvalScorecards(root, {
      from: new Date("2026-01-15"),
      to: ALL.to,
    });
    expect(narrowed).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });
});
