import { monitorEventLoopDelay } from "node:perf_hooks";
import {
  beginStartCount,
  countStarts,
  type Exec,
  type KeptNote,
  keptProcessTable,
  keptWindow,
  onPage,
  type PageReadsInput,
  type PsRow,
  processReadsFromTable,
  readLandings,
  reportPageReads,
  trunkMergeSubjectsAsync,
  warmProject,
} from "@infinitedusky/indusk-mcp/run-record";
import { readAdminRefreshMs } from "./project-reader";
import { getProjectPath } from "./registry-client";

/**
 * Where a page gets its reads (admin-pages-load-fast, decisions 2, 8, 13, 14, 15, 19, 21).
 *
 * A page reads the machine's process list and the trunk's landing history once, at its top, as
 * kept readings; the synchronous rules (`situation`, `runStatus`, `landedOnMain`) are then
 * handed the table and the answers in the shapes they already take. A page opens with
 * `startPage`, which starts its clock and its count of program starts, asks `reads()` for the
 * readings, and ends with `finish(plans)`, which reports the page's counts, ages, blocked time
 * and elapsed time off the page path.
 *
 * clause: admin-pages-load-fast/one-read-per-page
 * clause: admin-pages-load-fast/kept-briefly
 * clause: admin-pages-load-fast/never-freezes
 */

/** What the rules read a run's process with: the one table's rows, signal 0 for "alive". */
export type ProcessReads = ReturnType<typeof processReadsFromTable>;

export interface PageCounts {
  processReads: number;
  landingReads: number;
  /** For each fresh read the page made, whether the previous reading was still inside its window. */
  refreshedEarly: boolean[];
  /** The age and window of each reading the page used. */
  readings: Array<{ ageMs: number; windowMs: number }>;
  /** Repositories whose landing history the page read. */
  repositories: number;
}

export interface PageReads {
  /** The machine's process list, or `null` when it could not be read (a live run then reads unknown). */
  table: PsRow[] | null;
  /** The rules' process reads, answered from `table`. */
  reads: ProcessReads;
  /** Whether a plan has landed, answered from the one reading of the trunk. */
  landed: (plan: string) => boolean;
  /** The trunk's merge subjects, for the reports that compare against the trunk's own log. */
  subjects: string[];
  counts: PageCounts;
}

/** What a rule needs of a page's reading: the table, the process reads over it, and the landings. */
export type Reading = Pick<PageReads, "table" | "reads" | "landed">;

const LATEST = Symbol.for("indusk.admin.latest-reading");
const slot = globalThis as unknown as Record<symbol, Reading | undefined>;

/** The most recent reading any request made: what a caller that was handed none reads with. */
export function latestReading(): Reading {
  return (
    slot[LATEST] ?? {
      table: null,
      reads: processReadsFromTable(null),
      landed: () => false,
    }
  );
}

/** What a page takes besides its path: the program runner, the clock and the report are inputs. */
export interface PageDeps {
  exec?: Exec;
  now?: () => number;
  /** The live refresh in ms; absent, the project's `admin.refresh_ms`. */
  refreshMs?: number;
  /** Sends the page's report; absent, the package's, scheduled after the response. */
  report?: (root: string, input: PageReadsInput) => Promise<void>;
}

/** What the readings are read with: the project's window, the injected runner and clock. */
function readDeps(
  projectPath: string,
  deps: PageDeps,
  onKept?: (k: KeptNote) => void,
) {
  return {
    forMs: keptWindow(deps.refreshMs ?? readAdminRefreshMs(projectPath)),
    ...(deps.exec ? { exec: deps.exec } : {}),
    ...(deps.now ? { now: deps.now } : {}),
    ...(onKept ? { onKept } : {}),
  };
}

/** The process list, the landings and the trunk's subjects for `projectPath`, each read once and kept. */
async function readThrough(
  projectPath: string,
  deps: PageDeps,
  want: ReadWant = {},
): Promise<PageReads> {
  const counts: PageCounts = {
    processReads: 0,
    landingReads: 0,
    refreshedEarly: [],
    readings: [],
    repositories: 0,
  };
  const logs = new Set<string>();
  const failed = new Set<string>();
  const note = (k: KeptNote) => {
    counts.readings.push({ ageMs: k.ageMs, windowMs: k.windowMs });
    if (!k.reused) counts.refreshedEarly.push(k.refreshedEarly);
    if (k.key.startsWith("landings:")) logs.add(k.key);
  };
  const withDeps = { ...readDeps(projectPath, deps, note), failed };
  // The project's shared git directory is found first, off the page's thread, so the readers
  // beneath it that ask for it synchronously are answered and start nothing.
  await warmProject(projectPath);
  const wantList =
    typeof want.processList === "function"
      ? want.processList()
      : want.processList !== false;
  counts.processReads = wantList ? 1 : 0;
  counts.landingReads = 1;
  const [table, landed, subjects] = await Promise.all([
    wantList
      ? keptProcessTable(withDeps).then(
          (k) => k.value,
          () => null,
        )
      : Promise.resolve(null),
    readLandings(projectPath, withDeps),
    trunkMergeSubjectsAsync(projectPath, withDeps),
  ]);
  counts.repositories = Math.max(1, logs.size);
  const read: PageReads = {
    table,
    reads: processReadsFromTable(table),
    landed,
    subjects,
    counts,
  };
  slot[LATEST] = { table, reads: read.reads, landed };
  return read;
}

/** What a page asks of its readings. A page whose plans have no run needs no process list. */
export interface ReadWant {
  /** Whether the process list is read; a function is asked after the project is found. */
  processList?: boolean | (() => boolean);
}

/** One reading for a caller that is not a page (an API route, a timer tick): kept, so a tick inside the window starts nothing. */
export function readPageReads(
  projectPath: string,
  deps: PageDeps = {},
  want: ReadWant = {},
): Promise<PageReads> {
  return readThrough(projectPath, deps, want);
}

/** The rules' process reads for a caller that wants only the process table (a route, a timer). */
export async function readProcessReads(
  projectPath: string,
  deps: PageDeps = {},
): Promise<ProcessReads> {
  const table = await keptProcessTable(readDeps(projectPath, deps)).then(
    (k) => k.value,
    () => null,
  );
  const reads = processReadsFromTable(table);
  slot[LATEST] = { table, reads, landed: latestReading().landed };
  return reads;
}

export interface Page {
  /** The page's readings, read once however many times it is asked. */
  reads(want?: ReadWant): Promise<PageReads>;
  /** The page is done: report what it read, how long it took and how long the loop was blocked. */
  finish(plans: number): void;
}

/** Sends the report after the response when Next can, else on the next turn; never raises. */
function scheduled(send: () => Promise<void>): void {
  const run = () => {
    send().catch(() => {
      // a report is best-effort: it must never reach the page
    });
  };
  void import("next/server").then(
    ({ after }) => {
      try {
        after(run);
      } catch {
        setTimeout(run, 0).unref?.();
      }
    },
    () => setTimeout(run, 0).unref?.(),
  );
}

/**
 * Opens a page: call it first, at the top of the page function, so the elapsed time counts the
 * plan files read and the rendering around the reads, and the count of program starts covers
 * every helper the page awaits.
 */
export function startPage(
  page: string,
  projectPath: string,
  deps: PageDeps = {},
): Page {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const starts = beginStartCount();
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  // A page that returns early never finishes: the monitor is not left running for it.
  setTimeout(() => loop.disable(), 30_000).unref?.();
  let reading: Promise<PageReads> | null = null;
  let done = false;
  return {
    reads(want) {
      reading ??= readThrough(projectPath, deps, want);
      return reading;
    },
    finish(plans) {
      if (done) return;
      done = true;
      const elapsedMs = now() - startedAt;
      loop.disable();
      // The histogram's delays include the sampling interval; the loop was blocked by the excess.
      const maxBlockedMs = Math.max(0, loop.max / 1e6 - 10);
      const programStarts = starts.count();
      // No project, no home for the report (the home page before any project is registered).
      if (projectPath === "") return;
      void (reading ?? Promise.resolve(null)).then(
        (read) => {
          const counts = read?.counts;
          const input: PageReadsInput = {
            page,
            plans,
            processReads: counts?.processReads ?? 0,
            landingReads: counts?.landingReads ?? 0,
            programStarts,
            repositories: counts?.repositories ?? 1,
            refreshedEarly: counts?.refreshedEarly ?? [],
            readings: counts?.readings ?? [],
            maxBlockedMs,
            elapsedMs,
          };
          const send = deps.report ?? reportPageReads;
          if (deps.report) void send(projectPath, input);
          else scheduled(() => send(projectPath, input));
        },
        () => {
          // the readings failed: the page already answered with them unknown
        },
      );
    },
  };
}

/**
 * Runs `fn` inside a page's count of program starts: the page's own when it opened one with
 * `startPage`, else a count of its own, so a reader called outside a page (a test, a route)
 * keeps what it reads for the window exactly as it does on a page.
 */
export async function withPageContext<T>(fn: () => Promise<T>): Promise<T> {
  return onPage() ? fn() : (await countStarts(fn)).result;
}

/** `startPage` for a page that knows its project by name: the path is the registry's, none when it is not registered. */
export function startPageFor(
  page: string,
  project: string,
  deps: PageDeps = {},
): Page {
  return startPage(page, getProjectPath(project) ?? "", deps);
}
