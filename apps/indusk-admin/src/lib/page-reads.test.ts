// clause: admin-pages-load-fast/one-read-per-page
// clause: admin-pages-load-fast/never-freezes
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { bookkeepingRoots } from "@infinitedusky/indusk-mcp/bookkeeping/roots";
import {
  realProcessReads,
  startRunRecord,
  writeRunRecord,
} from "@infinitedusky/indusk-mcp/run-record";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * admin-pages-load-fast, Test Phase 1 (A2, A3, A4, A14): what one page load costs in
 * programs started. A page showing many plans reads the machine's process list once and the
 * trunk's landing history once, and starts no more programs than a page showing one plan;
 * and a slow process list never stops the server's event loop.
 *
 * Real plan folders and real run records in a temporary project, read through the real
 * `withSituations`. The only stand-ins are the session host and the registry (as the sibling
 * planning tests do) and a counting wrapper around `node:child_process`, which passes every
 * call through: a program started by any reader, named or not, is counted by its command.
 */

type Start = { cmd: string; args: string[] };
const started = vi.hoisted(() => ({ calls: [] as Array<Start> }));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  // biome-ignore lint/suspicious/noExplicitAny: a pass-through wrapper over five call shapes
  const count = <F extends (...a: any[]) => any>(fn: F): F => {
    const wrapped = ((...a: unknown[]) => {
      started.calls.push({
        cmd: String(a[0]),
        args: Array.isArray(a[1]) ? (a[1] as string[]).map(String) : [],
      });
      return fn(...a);
    }) as F;
    // keep `util.promisify.custom` and friends, so a promisified start still counts
    return Object.assign(wrapped, fn);
  };
  return {
    ...actual,
    spawnSync: count(actual.spawnSync),
    execFileSync: count(actual.execFileSync),
    execSync: count(actual.execSync),
    execFile: count(actual.execFile),
    spawn: count(actual.spawn),
  };
});

const registry = vi.hoisted(() => ({ paths: new Map<string, string>() }));
vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => () => {},
    running: () => [],
    pendingQuestion: () => null,
    isWriting: () => false,
  }),
}));
vi.mock("./registry-client", () => ({
  getProjectPath: (name: string) => registry.paths.get(name),
}));

import { withSituations } from "./plan-situation";
import { readActivePlans } from "./planning-reader";

const made: string[] = [];
let seq = 0;
const priorPath = process.env.PATH;

/** `ps -axo …` is the whole process list; every other `ps` asks about one pid. */
const isProcessList = (s: Start) =>
  s.cmd.endsWith("ps") && s.args.some((a) => a.startsWith("-axo"));
const isGit = (s: Start) => s.cmd.endsWith("git");
const isTrunkLog = (s: Start) =>
  isGit(s) && s.args.includes("log") && s.args.includes("--merges");

/**
 * A temporary project with `plans` open plans, each with a build run record naming this test
 * process as its process (so a reader that asks the table finds it alive), when `withRun`.
 * The project is a bare repository skeleton: git answers (an error is an answer), nothing
 * in it is real history.
 */
function projectWith(
  plans: number,
  withRun = true,
): { name: string; root: string } {
  const name = `reads-${process.pid}-${++seq}`;
  const root = mkdtempSync(join(tmpdir(), "page-reads-"));
  made.push(root);
  mkdirSync(join(root, ".git/refs/heads"), { recursive: true });
  mkdirSync(join(root, ".git/objects"), { recursive: true });
  writeFileSync(join(root, ".git/HEAD"), "ref: refs/heads/main\n");
  mkdirSync(join(root, ".indusk/planning"), { recursive: true });
  writeFileSync(join(root, ".indusk/config.json"), '{ "mode": "full" }\n');
  registry.paths.set(name, root);
  const startedAt = (
    realProcessReads.startTime(process.pid) ?? new Date()
  ).toISOString();
  for (let i = 0; i < plans; i++) {
    const plan = `plan-${i}`;
    const dir = join(root, ".indusk/planning", plan);
    mkdirSync(dir, { recursive: true });
    const doc = (status: string) =>
      `---\ntitle: "P${i}"\nstatus: ${status}\nworkflow: bugfix\n---\n\n# P${i}\n`;
    writeFileSync(join(dir, "brief.md"), doc("accepted"));
    writeFileSync(join(dir, "test-plan.md"), doc("accepted"));
    writeFileSync(join(dir, "impl.md"), doc("draft"));
    if (withRun)
      writeRunRecord(bookkeepingRoots(root).home, {
        ...startRunRecord(plan, "build", new Date().toISOString()),
        process: { pid: process.pid, bin: process.execPath, startedAt },
      });
  }
  return { name, root };
}

/** One page load of `project`: the plans it shows, read as the page reads them. */
async function loadPage(project: { name: string; root: string }) {
  const plans = await readActivePlans(project.root);
  return withSituations(project.name, project.root, plans, []);
}

/** The programs one page load of `project` starts; what setup started is not counted. */
async function startsOfLoading(project: { name: string; root: string }) {
  started.calls.length = 0;
  await loadPage(project);
  return [...started.calls];
}

// Today a page load is slow (that is the defect), so the assertions get time to be reached.
vi.setConfig({ testTimeout: 90_000 });

beforeEach(() => {
  started.calls.length = 0;
});
afterEach(() => {
  process.env.PATH = priorPath;
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("one read per page (A2, A3, A4)", () => {
  it("A2 a page of ten plans, each with a run, reads the process list once and starts no more programs than a page of one plan", async () => {
    const one = await startsOfLoading(projectWith(1));
    const ten = await startsOfLoading(projectWith(10));
    expect(
      ten.filter(isProcessList).length,
      "process-list reads for ten plans",
    ).toBe(1);
    expect(
      ten.length,
      `programs started for ten plans (${ten.length}) vs one plan (${one.length})`,
    ).toBeLessThanOrEqual(one.length);
  });

  it("A3 a page of ten plans reads the trunk's landing history once and starts no per-plan git program", async () => {
    const one = await startsOfLoading(projectWith(1));
    const ten = await startsOfLoading(projectWith(10));
    expect(
      ten.filter(isTrunkLog).length,
      "trunk-history reads for ten plans",
    ).toBe(1);
    expect(
      ten.filter(isGit).length,
      `git programs started for ten plans (${ten.filter(isGit).length}) vs one plan (${one.filter(isGit).length})`,
    ).toBeLessThanOrEqual(one.filter(isGit).length);
  });

  it("A4 a plan with no run, and a project with no plans, load without asking for the process list", async () => {
    const noRun = await startsOfLoading(projectWith(3, false));
    expect(
      noRun.filter(isProcessList).length,
      "process-list reads for plans with no run",
    ).toBe(0);
    const noPlans = await startsOfLoading(projectWith(0));
    expect(
      noPlans.filter(isProcessList).length,
      "process-list reads for a project with no plans",
    ).toBe(0);
  });
});

describe("a slow process list never freezes the server (A14)", () => {
  it("A14 while one page waits on a slow process list, the event loop never lags past 100 ms and another page is answered within a second", async () => {
    // A real `ps` that answers the whole-machine list after two seconds, first on PATH.
    const bin = mkdtempSync(join(tmpdir(), "slow-ps-"));
    made.push(bin);
    writeFileSync(
      join(bin, "ps"),
      '#!/bin/sh\ncase "$*" in *-axo*) sleep 2;; esac\nexec /bin/ps "$@"\n',
    );
    chmodSync(join(bin, "ps"), 0o755);
    const slow = projectWith(1);
    const other = projectWith(1, false);
    process.env.PATH = `${bin}${delimiter}${priorPath ?? ""}`;

    // A 50 ms timer: when the loop is held, the tick that was due arrives late, and by how much is the lag.
    let expected = performance.now() + 50;
    let worstLag = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      worstLag = Math.max(worstLag, now - expected);
      expected = now + 50;
    }, 50);

    const first = loadPage(slow);
    await new Promise((r) => setTimeout(r, 10));
    const askedAt = performance.now();
    await loadPage(other);
    const otherTook = performance.now() - askedAt;
    await first;
    // let a timer that fell due while the loop was held run, so the lag it saw is counted
    await new Promise((r) => setTimeout(r, 60));
    clearInterval(timer);

    expect(
      Math.round(worstLag),
      "worst event-loop lag in ms while the process list was slow",
    ).toBeLessThan(100);
    expect(
      Math.round(otherTook),
      "ms to answer a page that needs no process list",
    ).toBeLessThan(1000);
  });
});

describe("a page's finish call reports what the page read (A24)", () => {
  it("A24 finish hands the report the real counts, early-refresh flags, reading ages and the time counted from the top of the page", async () => {
    const { startPage } = await import("./page-reads");
    const { resetKept } = await import("@infinitedusky/indusk-mcp/run-record");
    resetKept();
    const root = mkdtempSync(join(tmpdir(), "page-reads-finish-"));
    made.push(root);
    mkdirSync(join(root, ".indusk"), { recursive: true });
    writeFileSync(join(root, ".indusk/config.json"), '{ "mode": "full" }\n');
    let clock = 5_000;
    const reports: Array<{ root: string; input: Record<string, unknown> }> = [];
    const page = startPage("plan", root, {
      now: () => clock,
      exec: async (file, args) =>
        file === "ps"
          ? `${process.pid} Mon Oct 19 10:00:00 2026 ${process.execPath}\n`
          : args[0] === "log"
            ? ""
            : "main\n",
      report: async (r, input) => {
        reports.push({
          root: r,
          input: input as unknown as Record<string, unknown>,
        });
      },
    });
    // 400 ms pass on the page before its first read (plan files, rendering): they count.
    clock += 400;
    await page.reads();
    clock += 100;
    page.finish(7);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    const { input } = reports[0];
    expect(input).toMatchObject({
      page: "plan",
      plans: 7,
      processReads: 1,
      landingReads: 1,
      elapsedMs: 500,
    });
    expect(input.programStarts, "program starts counted").toBeGreaterThan(0);
    const flags = input.refreshedEarly as boolean[];
    expect(flags.length, "a flag for each fresh read").toBeGreaterThanOrEqual(
      2,
    );
    expect(
      flags.every((f) => f === false),
      "no early refresh on a cold start",
    ).toBe(true);
    expect(
      (input.readings as unknown[]).length,
      "the age of each reading used",
    ).toBeGreaterThanOrEqual(flags.length);
  });
});
