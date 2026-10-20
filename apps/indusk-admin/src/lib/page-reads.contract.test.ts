// promise: admin-pages-load-fast
// clause: admin-pages-load-fast/kept-briefly
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Exec,
  KEPT_FOR_MS,
  resetKept,
} from "@infinitedusky/indusk-mcp/run-record";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * admin-pages-load-fast A12 (Build Phase 2): the plan page, the promises page and the looks
 * page loaded one after another inside the kept window make one process-list read and one
 * trunk-history read together. Each page opens with `startPage` and asks `reads()`, as the real
 * pages do; the program runner and the clock are the page-reads module's inputs, so a counting
 * runner sees every program the three pages start and no time passes between them.
 */

const started: Array<{ file: string; args: string[] }> = [];
const exec: Exec = async (file, args) => {
  started.push({ file, args });
  if (file === "ps")
    return `${process.pid} Mon Oct 19 10:00:00 2026 ${process.execPath}\n`;
  if (args[0] === "log") return "Merge plan/other: other landed\n";
  if (args[0] === "branch") return "main\n";
  if (args[0] === "for-each-ref") return "main\n";
  return "";
};

let root: string;
let clock = 1_000_000;
beforeEach(() => {
  resetKept();
  started.length = 0;
  root = mkdtempSync(join(tmpdir(), "page-reads-contract-"));
  mkdirSync(join(root, ".indusk/planning"), { recursive: true });
  writeFileSync(join(root, ".indusk/config.json"), '{ "mode": "full" }\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const isProcessList = (s: { file: string; args: string[] }) =>
  s.file === "ps" && s.args.some((a) => a.startsWith("-axo"));
const isTrunkLog = (s: { file: string; args: string[] }) =>
  s.file === "git" && s.args[0] === "log" && s.args.includes("--merges");

async function load(page: string) {
  const { startPage } = await import("./page-reads");
  const loading = startPage(page, root, {
    exec,
    now: () => clock,
    report: async () => {},
  });
  const reads = await loading.reads();
  loading.finish(3);
  return reads;
}

describe("A12 — three pages inside the window read once between them", () => {
  it("A12 the plan, promises and looks pages make one process-list read and one trunk-history read together", async () => {
    await load("plan");
    clock += 1000;
    await load("promises");
    clock += 1000;
    await load("looks");
    expect(started.filter(isProcessList).length, "process-list reads").toBe(1);
    expect(started.filter(isTrunkLog).length, "trunk-history reads").toBe(1);
  });

  it("A12 a page loaded after the window reads both fresh again", async () => {
    await load("plan");
    clock += KEPT_FOR_MS + 1000;
    await load("plan");
    expect(started.filter(isProcessList).length).toBe(2);
    expect(started.filter(isTrunkLog).length).toBe(2);
  });

  it("A12 a page that follows one inside the window starts no program that grows with its plans", async () => {
    await load("plan");
    const before = started.length;
    clock += 1000;
    await load("promises");
    // only the checked-out-branch question is asked again; the process list and the log are reused
    expect(started.length - before).toBeLessThanOrEqual(1);
  });
});
