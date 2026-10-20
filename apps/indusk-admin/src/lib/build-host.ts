import { randomUUID } from "node:crypto";
import { bookkeepingRoots } from "@infinitedusky/indusk-mcp/bookkeeping/roots";
import {
  autoAccepts,
  type BuildStepName,
  buildStepModel,
  nextBuildStep,
  nextPlanningStep,
  type PlanningStep,
  type PlanningStop,
  planningStepRefusal,
  type RunnerStop,
  readBuildPlan,
  readPlanningState,
  runBuild,
  runPlanning,
  runRelease,
  runStepSession,
  type ShortenReason,
  timedStep,
} from "@infinitedusky/indusk-mcp/build";
import {
  acceptPlan,
  type BringTrunkOptions,
  bringTrunkIntoPlan,
} from "@infinitedusky/indusk-mcp/plans";
import {
  forgetLandings,
  forgetProcessList,
  keptProcessTable,
  type RunKind,
  type RunRecord,
  readLandings,
  readRunRecord,
  releaseOutcome,
  reportDeadReadsStopped,
  reportKeptOnDisk,
  reportNotInProgressWhenIdle,
  reportReleased,
  reportShowsWhereItIs,
  restartStep,
  runStatus,
  shownPhase,
  startRunRecord,
  stopSentence,
  writeRunRecord,
} from "@infinitedusky/indusk-mcp/run-record";
import matter from "gray-matter";
import { latestReading, type Reading, readPageReads } from "./page-reads";
import { getProjectPath } from "./registry-client";
import { planLocation, sessionManager } from "./session-host";

/**
 * The admin daemon's builds (admin-plan-authoring, ADR D4, D7). A build runs
 * in the daemon, not in the request that starts it; its state is held here,
 * on `globalThis` like the session manager, so the plan's page can ask what
 * it is doing. Every decision is the package's `runBuild` / `runRelease`;
 * this only supplies what they touch.
 */

export interface BuildState {
  running: boolean;
  /** The step running now, and the phase it works, if any. */
  step: string | null;
  detail: string | null;
  /** Why it stopped, once it has. */
  stop: RunnerStop | null;
  /** What a release that has run said, if one has. */
  release: { released: boolean; error: string | null } | null;
}

const KEY = Symbol.for("indusk.admin.builds");
const builds = (): Map<string, BuildState> => {
  const g = globalThis as unknown as Record<
    symbol,
    Map<string, BuildState> | undefined
  >;
  g[KEY] ??= new Map();
  return g[KEY];
};

const key = (project: string, plan: string) => `${project}/${plan}`;

/** What a planning run's stop says when it ended on a question that holds (the package words it). */
const ASKED_A_QUESTION = "asked a question";

/**
 * A run's record on disk (a-run-can-be-trusted, Decision 3): the truth, where
 * the maps below are a cache. A run writes its step, phase, process and stop as
 * they change, and every ask for its state reads the record when this daemon
 * holds nothing, as after a restart. Writing is best-effort: a record that
 * cannot be written never fails the run it describes.
 */
interface RunHandle {
  update(patch: Partial<RunRecord>): void;
}

function homeOf(project: string): string | null {
  const root = getProjectPath(project);
  return root ? bookkeepingRoots(root).home : null;
}

function openRecord(project: string, plan: string, kind: RunKind): RunHandle {
  const home = homeOf(project);
  let current = startRunRecord(plan, kind, new Date().toISOString());
  const root = getProjectPath(project);
  const write = () => {
    if (home === null) return;
    try {
      writeRunRecord(home, current);
    } catch {
      // the record is a cache of the run for the page; the run goes on without it
    }
    // signal: a-run-is-read-from-its-record/kept-on-disk, read back from the file
    if (root !== null) void reportKeptOnDisk(root, home, current);
  };
  write();
  return {
    update(patch) {
      current = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      write();
    },
  };
}

/** How a runner's stop is worded when the record keeps it. */
function whyOf(stop: { step: string }): string | null {
  const why = (stop as { why?: unknown }).why;
  return typeof why === "string" ? why : null;
}

/**
 * How a release ended, read from the trunk and not from the release step's say-so
 * (a-run-can-be-trusted, Decision 6): released only when the plan is on main,
 * otherwise stopped with the reason — `plans land`'s refusal when the step carried
 * one, else that the plan is not on main.
 */
function judgedRelease(
  project: string,
  plan: string,
  step: { released: boolean; error: string | null } | null,
  landed: boolean,
): {
  release: { released: boolean; error: string | null };
  stop: RunnerStop;
} {
  const root = getProjectPath(project);
  const outcome = releaseOutcome({
    step,
    landedOnMain: root !== null && landed,
    landError: step?.error ?? null,
  });
  // signal: a-run-is-read-from-its-record/released-only-when-landed, from the trunk's own log read again
  if (outcome.state === "released" && root !== null)
    void reportReleased(root, plan);
  return outcome.state === "released"
    ? { release: { released: true, error: null }, stop: { step: "released" } }
    : {
        release: { released: false, error: outcome.reason },
        stop: { step: "release-failed", why: outcome.reason },
      };
}

/**
 * Whether the trunk shows the plan landed, read now. A release has just ended, so whatever a page
 * kept of the trunk's history a moment ago may predate the merge: it is dropped first (decision 12).
 */
async function landedNow(project: string, plan: string): Promise<boolean> {
  const root = getProjectPath(project);
  if (root === null) return false;
  forgetLandings();
  return (await readLandings(root))(plan);
}

/** The step session's own process, as the manager recorded it, for the record. */
function processOf(r: { pid: number; bin: string; startedAt: string }) {
  return { pid: r.pid, bin: r.bin, startedAt: r.startedAt };
}

function recordsOf(
  project: string,
  plan: string,
  kinds: RunKind[],
): RunRecord[] {
  const home = homeOf(project);
  if (home === null) return [];
  return kinds.flatMap((kind) => {
    const r = readRunRecord(home, plan, kind);
    return r === null || r === "unknown" ? [] : [r];
  });
}

/**
 * The reading an entry point that is not a page makes of the processes and the trunk (a route, a
 * start): the kept table and landings of the project, read once and shared with any page inside the
 * window. A project that is not registered reads nothing.
 */
export async function readNow(project: string): Promise<Reading> {
  const root = getProjectPath(project);
  if (!root) return latestReading();
  return readPageReads(root);
}

const newest = (records: RunRecord[]): RunRecord | undefined =>
  [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

/** What the record alone says of a run, with no entry held here: judged by its own process. */
function statusOfRecord(record: RunRecord, read: Reading) {
  return runStatus(record, read.reads, false);
}

/** The build page's state from a record: nothing held here, so the record decides. */
function buildStateFromRecord(
  project: string,
  record: RunRecord,
  read: Reading,
): BuildState {
  const status = statusOfRecord(record, read);
  if (status.state === "running") {
    return {
      running: true,
      step: record.step,
      detail: record.phase,
      stop: null,
      release: null,
    };
  }
  // A release that recorded "released" is read again from the trunk (found after a restart too).
  const recorded =
    record.kind === "release" && record.stop?.step === "released"
      ? judgedRelease(
          project,
          record.plan,
          { released: true, error: null },
          read.landed(record.plan),
        )
      : null;
  const stop = recorded?.stop ??
    (record.stop as RunnerStop | null) ?? {
      step: "cannot-continue" as const,
      why: status.reason ?? "the run's process is gone",
    };
  return {
    running: false,
    step: null,
    detail: record.phase,
    stop,
    release:
      recorded?.release ??
      (record.kind === "release" && record.stop
        ? { released: false, error: whyOf(stop) }
        : null),
  };
}

/**
 * The kind of the run that died: a record with no stop whose process is gone,
 * the newest of the plan's. A run that stopped on its own is not dead; one
 * whose record cannot be read is not known to be.
 */
function deadRun(project: string, plan: string, read: Reading): RunKind | null {
  const dead = recordsOf(project, plan, [
    "planning",
    "release",
    "build",
  ]).filter(
    (r) => r.stop === null && statusOfRecord(r, read).state === "stopped",
  );
  return newest(dead)?.kind ?? null;
}

/**
 * signal: a-run-is-read-from-its-record/dead-reads-stopped — when Build is pressed, the run's
 * recorded step session is looked for in the process table, apart from the rule that decided
 * what the page showed.
 */
function reportBuildPressed(
  project: string,
  plan: string,
  read: Reading,
): void {
  const root = getProjectPath(project);
  if (!root) return;
  // An unreadable table says nothing of the run: judged against nothing, it would call a live run dead.
  if (read.table === null) return;
  try {
    const record = newest(
      recordsOf(project, plan, ["planning", "release", "build"]),
    );
    if (!record?.process || record.stop) return;
    const heldHere =
      builds().get(key(project, plan))?.running === true ||
      plannings().get(key(project, plan))?.running === true;
    void reportDeadReadsStopped(root, {
      record,
      shown: heldHere ? "running" : statusOfRecord(record, read).state,
      heldHere,
      table: read.table,
    });
  } catch {
    // best-effort
  }
}

/**
 * What Build starts for a run that died, asked of the plan's own documents:
 * the impl's status and acceptance, then the package's decisions.
 */
async function restartFor(root: string, plan: string, dead: RunKind) {
  let content: string | null = null;
  let buildPlan: Awaited<ReturnType<typeof readBuildPlan>> | null = null;
  try {
    buildPlan = await readBuildPlan(root, plan);
    content = buildPlan.content;
  } catch {
    // no impl to read: the plan is not past planning
  }
  const planning = await readPlanningState(root, plan).catch(() => null);
  const data = content === null ? {} : matter(content).data;
  const status = typeof data.status === "string" ? data.status : null;
  return restartStep(dead, {
    implStatus: status,
    accepted: data.accepted !== undefined && data.accepted !== null,
    build: () => nextBuildStep(buildPlan as NonNullable<typeof buildPlan>),
    planning: () => nextPlanningStep(planning as NonNullable<typeof planning>),
  });
}

/**
 * What the plan's build or release is doing. This daemon's own entry when it
 * holds one; otherwise the newest record of a build or release on disk, judged
 * by the run's own process, so a restart changes nothing and a run that died
 * reads stopped with its reason.
 */
export function buildState(
  project: string,
  plan: string,
  read: Reading = latestReading(),
): BuildState | null {
  const held = builds().get(key(project, plan));
  const shown = held ?? buildStateOnDisk(project, plan, read);
  if (shown?.running)
    checkInProgress(project, plan, "build", held?.running === true, read);
  return shown;
}

/**
 * What the build controls show: the run's state, the phase the plan is on read from
 * its impl now (never the run's start phase), and the stop sentence naming it.
 */
export async function buildView(
  project: string,
  plan: string,
  read?: Reading,
): Promise<{
  build: BuildState | null;
  phase: string | null;
  sentence: string | null;
}> {
  const root = getProjectPath(project);
  const asked: Reading =
    read ??
    (root
      ? await readPageReads(root, {}, { processList: true })
      : latestReading());
  const build = buildState(project, plan, asked);
  const phase = root
    ? shownPhase(await readBuildPlan(root, plan).catch(() => null))
    : null;
  const sentence =
    build && !build.running && build.stop
      ? stopSentence(build.stop, phase)
      : null;
  // signal: a-run-is-read-from-its-record/shows-where-it-is, against the phase the live session works
  if (root && build?.running && build.step === "work" && build.detail)
    throttled(`${project}/${plan}/shows`, () =>
      reportShowsWhereItIs(root, {
        plan,
        shown: phase,
        sessionPhase: build.detail,
      }),
    );
  return { build, phase, sentence };
}

/** Whether this daemon holds a run of the plan in memory as running: the gap between two step sessions. */
export function heldRunning(project: string, plan: string): boolean {
  return (
    builds().get(key(project, plan))?.running === true ||
    plannings().get(key(project, plan))?.running === true
  );
}

/** A signal is reported at most once per key in a while: the page polls every few seconds. */
const SIGNAL_EVERY_MS = 15_000;
const signalledAt = new Map<string, number>();
export function throttled(id: string, send: () => Promise<void>): void {
  const now = Date.now();
  if (now - (signalledAt.get(id) ?? 0) < SIGNAL_EVERY_MS) return;
  signalledAt.set(id, now);
  void send();
}

/**
 * The newest run of the plan, of any kind, with what the run reader says of it: this
 * daemon's own entry decides while it holds the run, the record and its process otherwise.
 * What the situation sentence and the steps read, so none says "in progress" without a process.
 */
export function runOfPlan(
  project: string,
  plan: string,
  read: Reading = latestReading(),
): {
  kind: RunKind;
  status: ReturnType<typeof runStatus>;
  step: string | null;
  phase: string | null;
  /** The step the record's stop names, when the run stopped on its own. */
  stopStep: string | null;
} | null {
  const record = newest(
    recordsOf(project, plan, ["planning", "release", "build"]),
  );
  if (!record) return null;
  const heldHere =
    record.kind === "planning"
      ? plannings().get(key(project, plan))?.running === true
      : builds().get(key(project, plan))?.running === true;
  const status = heldHere
    ? ({ state: "running" } as const)
    : statusOfRecord(record, read);
  return {
    kind: record.kind,
    status,
    step: record.step,
    phase: record.phase,
    stopStep: heldHere ? null : (record.stop?.step ?? null),
  };
}

/** The newest build or release record's state: what the page shows when this daemon holds nothing. */
function buildStateOnDisk(
  project: string,
  plan: string,
  read: Reading,
): BuildState | null {
  const record = newest(recordsOf(project, plan, ["build", "release"]));
  return record ? buildStateFromRecord(project, record, read) : null;
}

/**
 * Whether a page of these plans needs the machine's process list: a plan has a run on record, or
 * a session runs for the project. A page of plans with neither starts no `ps` (A4).
 */
export function needsProcessList(
  project: string,
  plans: readonly { name: string }[],
): boolean {
  return (
    anyRunOnRecord(project, plans) ||
    sessionManager()
      .running()
      .some((r) => r.project === project)
  );
}

/** Whether any of the plans has a run on record: a page with none needs no process list. */
export function anyRunOnRecord(
  project: string,
  plans: readonly { name: string }[],
): boolean {
  return plans.some(
    (p) =>
      recordsOf(project, p.name, ["planning", "release", "build"]).length > 0,
  );
}

/** Once per plan in a while: a plan shown in progress has a process running for it (a signal, Decision 17). */
const IDLE_CHECK_EVERY_MS = 15_000;
const idleCheckedAt = new Map<string, number>();
function checkInProgress(
  project: string,
  plan: string,
  kind: RunKind,
  heldHere: boolean,
  read: Reading,
): void {
  const k = `${key(project, plan)}/${kind}`;
  const now = Date.now();
  if (now - (idleCheckedAt.get(k) ?? 0) < IDLE_CHECK_EVERY_MS) return;
  idleCheckedAt.set(k, now);
  const root = getProjectPath(project);
  if (!root) return;
  try {
    const sessions = sessionManager()
      .running()
      .filter((r) => r.project === project && r.plan === plan);
    const report = (table: NonNullable<Reading["table"]>) =>
      // signal: a-run-is-read-from-its-record/never-in-progress-when-idle, read from the process table
      reportNotInProgressWhenIdle(root, {
        plan,
        kind,
        heldHere,
        sessions,
        table,
      });
    // The timer's own read when the caller has none: kept, so a tick inside the window starts no `ps`.
    if (read.table !== null) void report(read.table);
    else
      void keptProcessTable()
        .then((k) => report(k.value))
        .catch(() => {
          // an unreadable table says nothing: no report
        });
  } catch {
    // best-effort
  }
}

/**
 * The `model` option for a step's session: the model its tier names, nothing
 * when the project names no tiers (the session runs on `claude`'s own). A tier
 * the config has no model for is the step's error with its message, never a
 * build on the wrong model without a word.
 */
async function stepModelOption(
  root: string,
  plan: string,
  step: Exclude<BuildStepName, "shorten-reason">,
  phase: string | undefined,
): Promise<{ model?: string } | { error: string }> {
  try {
    const answer = await buildStepModel(root, plan, step, phase);
    return answer ? { model: answer.model } : {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * How a step that returned ended, beyond finished or failed (plan-timing ADR):
 * `stopped` when its session was ended by a signal, `blocked` when the plan now
 * carries a blocker. Anything it cannot tell leaves the step's default.
 */
function classifierFor(root: string, plan: string, planning: boolean) {
  return async (result: { error: string | null } | undefined) => {
    if (result?.error && /on a signal/.test(result.error))
      return "stopped" as const;
    if (planning) {
      const state = await readPlanningState(root, plan);
      return state.blocker ? ("blocked" as const) : undefined;
    }
    const next = nextBuildStep(await readBuildPlan(root, plan));
    return next.step === "cannot-continue" && /has a blocker/.test(next.why)
      ? ("blocked" as const)
      : undefined;
  };
}

async function depsFor(
  project: string,
  plan: string,
  state: BuildState,
  handle: RunHandle,
) {
  const root = getProjectPath(project);
  if (!root) throw new Error(`no project named ${project}`);
  const where = await planLocation(project, plan);
  if ("error" in where) throw new Error(where.error);
  return {
    root,
    deps: {
      signals: { root, plan },
      read: () => readBuildPlan(root, plan),
      run: timedStep(
        async (step: BuildStepName, phase?: string, reason?: ShortenReason) => {
          // A shortened reason is one line rewritten: it runs on the work step's default tier.
          const chosen = await stepModelOption(
            root,
            plan,
            step === "shorten-reason" ? "work" : step,
            phase,
          );
          if ("error" in chosen) return { error: chosen.error };
          try {
            return await runStepSession(step, {
              manager: sessionManager(),
              worktree: where.cwd,
              ...(where.addDirs ? { addDirs: where.addDirs } : {}),
              project,
              plan,
              ...(reason ? { reason } : {}),
              ...chosen,
              onSession: (r) => {
                handle.update({ process: processOf(r) });
                // A table taken before this process existed must not be reused for its page.
                forgetProcessList();
              },
            });
          } finally {
            handle.update({ process: null });
          }
        },
        {
          root,
          plan,
          newId: randomUUID,
          classify: classifierFor(root, plan, false),
        },
      ),
      accept: async (by: "person" | "auto") => {
        await acceptPlan(root, plan, by);
      },
      onStep: (u: {
        kind: string;
        step?: string;
        detail?: string;
        stop?: RunnerStop;
      }) => {
        if (u.kind === "step") {
          state.step = u.step ?? null;
          state.detail = u.detail ?? null;
          handle.update({ step: state.step, phase: state.detail });
        }
      },
    },
  };
}

/** A build session held for the plan blocks any run that would start another. */
function assertNoBuildSession(project: string, plan: string): void {
  const held = sessionManager().forPlan(project, plan, "build");
  if (held)
    throw new Error(
      `a build session is already running for ${plan}: ${held.id} — stop it first`,
    );
}

/**
 * Start the build in the background; refused while a build runs or a build session is held for the plan.
 * A run whose process is gone is not "running": its record reads stopped, and Build starts the step the
 * plan's own documents say is next (a-run-can-be-trusted, Decision 5) — a planning run that died, or a
 * plan not yet past planning, is sent to its planning run.
 */
export async function startBuild(
  project: string,
  plan: string,
): Promise<BuildState> {
  const inPlanning = planningStepRefusal("starting a build");
  if (inPlanning) throw new Error(inPlanning);
  const read = await readNow(project);
  const existing = buildState(project, plan, read);
  if (existing?.running) throw new Error(`${plan} is already building`);
  if (planningState(project, plan, read)?.running)
    throw new Error(`${plan} is being planned: its planning run has not ended`);
  assertNoBuildSession(project, plan);
  reportBuildPressed(project, plan, read);
  // Held before the first await, as startRelease and startPlanning are: from the press on the
  // plan reads running and a second press is refused, so one plan never has two builds (A96).
  const k = key(project, plan);
  const before = builds().get(k);
  const state: BuildState = {
    running: true,
    step: null,
    detail: null,
    stop: null,
    release: null,
  };
  builds().set(k, state);
  // Pressing Build starts a process no earlier reading of the table has seen (A20).
  forgetProcessList();
  const letGo = () => {
    if (builds().get(k) !== state) return;
    if (before) builds().set(k, before);
    else builds().delete(k);
  };
  const dead = deadRun(project, plan, read);
  if (dead !== null) {
    let restart: Awaited<ReturnType<typeof restartFor>>;
    try {
      const root = getProjectPath(project);
      if (!root) throw new Error(`no project named ${project}`);
      restart = await restartFor(root, plan, dead);
    } catch (err) {
      letGo();
      throw err;
    }
    if (restart.run === "planning") {
      letGo();
      return startPlanningFromBuild(project, plan);
    }
    if (restart.run === "release") {
      letGo();
      return startRelease(project, plan);
    }
  }
  // Admitted once, here, and holding its place under the cap until it ends —
  // between its steps too, so another plan's start cannot take it.
  let free: () => void;
  try {
    free = sessionManager().admitBuild(project, plan);
  } catch (err) {
    letGo();
    throw err;
  }
  const handle = openRecord(project, plan, "build");
  let root: string;
  let deps: Awaited<ReturnType<typeof depsFor>>["deps"];
  try {
    ({ root, deps } = await depsFor(project, plan, state, handle));
  } catch (err) {
    state.running = false;
    state.stop = { step: "cannot-continue", why: (err as Error).message };
    handle.update({
      stop: state.stop,
      stopReason: (err as Error).message,
    });
    free();
    throw err;
  }
  void runBuild({ ...deps, autoAccept: autoAccepts(root) })
    .then(async (stop) => {
      // An auto-accepted release is judged from the trunk too, never from its step's word.
      const judged =
        stop.step === "released"
          ? judgedRelease(
              project,
              plan,
              { released: true, error: null },
              await landedNow(project, plan),
            )
          : null;
      state.stop = judged?.stop ?? stop;
      if (judged) state.release = judged.release;
      // A run that ended on a held question holds no place while it waits.
      if (stop.step === "question")
        sessionManager().holdQuestion(project, plan);
      handle.update({ stop: state.stop, stopReason: whyOf(state.stop) });
    })
    .catch((err: Error) => {
      state.stop = { step: "cannot-continue", why: err.message };
      handle.update({ stop: state.stop, stopReason: err.message });
    })
    .finally(() => {
      state.running = false;
      state.step = null;
      handle.update({ process: null });
      free();
    });
  return state;
}

/** Build on a plan still in planning: its planning run is started again, and the answer says it runs. */
async function startPlanningFromBuild(
  project: string,
  plan: string,
): Promise<BuildState> {
  const run = await startPlanning(project, plan);
  if (!run.started) {
    const why =
      run.stop && "why" in run.stop ? run.stop.why : (run.stop?.step ?? "");
    throw new Error(`${plan} is still being planned: ${why}`);
  }
  return {
    running: run.running,
    step: run.step,
    detail: null,
    stop: null,
    release: null,
  };
}

/**
 * Accept a built plan and run the release in the background (A19). Refused
 * while a build or a release for the plan runs, so a second Accept starts no
 * second release; the build's recorded stop is cleared when the release starts
 * — the plan no longer waits on review — and replaced by how the release
 * ended (plan-cockpit A37).
 */
export async function startRelease(
  project: string,
  plan: string,
): Promise<BuildState> {
  const existing = buildState(project, plan, await readNow(project));
  if (existing?.running)
    throw new Error(`${plan} is already building or releasing`);
  assertNoBuildSession(project, plan);
  const state: BuildState = builds().get(key(project, plan)) ?? {
    running: false,
    step: null,
    detail: null,
    stop: null,
    release: null,
  };
  // Held before the first await, so two accepts at once cannot both start.
  state.running = true;
  state.stop = null;
  builds().set(key(project, plan), state);
  const handle = openRecord(project, plan, "release");
  let deps: Awaited<ReturnType<typeof depsFor>>["deps"];
  try {
    ({ deps } = await depsFor(project, plan, state, handle));
  } catch (err) {
    state.running = false;
    handle.update({
      stop: { step: "cannot-continue", why: (err as Error).message },
      stopReason: (err as Error).message,
    });
    throw err;
  }
  void runRelease(deps, "person")
    .then(async (r) => {
      const judged = judgedRelease(
        project,
        plan,
        r,
        await landedNow(project, plan),
      );
      state.release = judged.release;
      state.stop = judged.stop;
      handle.update({ stop: state.stop, stopReason: whyOf(state.stop) });
    })
    .catch((err: Error) => {
      state.release = { released: false, error: err.message };
      state.stop = { step: "release-failed", why: err.message };
      handle.update({ stop: state.stop, stopReason: err.message });
    })
    .finally(() => {
      state.running = false;
      state.step = null;
      handle.update({ process: null });
    });
  return state;
}

/**
 * A planning run's state (a-brief-is-planned-unasked, ADR decision 5), held
 * beside the builds' and keyed the same. `started` says whether this ask began
 * a run; an ask that begins none (a look still unapproved, a brief not yet
 * accepted, a plan already written) answers with why in `stop` and holds
 * nothing, so asking again later is always allowed.
 */
export interface PlanningRunState {
  started: boolean;
  running: boolean;
  /** The planning step running now. */
  step: PlanningStep | null;
  /** Why the run ended, or why none began. */
  stop: PlanningStop | null;
}

const PLANNING_KEY = Symbol.for("indusk.admin.plannings");
const plannings = (): Map<string, PlanningRunState> => {
  const g = globalThis as unknown as Record<
    symbol,
    Map<string, PlanningRunState> | undefined
  >;
  g[PLANNING_KEY] ??= new Map();
  return g[PLANNING_KEY];
};

/**
 * The plan's planning run: this daemon's own entry when it holds one, else the
 * record on disk, judged by the run's own process (a-run-can-be-trusted).
 */
export function planningState(
  project: string,
  plan: string,
  read: Reading = latestReading(),
): PlanningRunState | null {
  const held = plannings().get(key(project, plan));
  if (held) {
    if (held.running) checkInProgress(project, plan, "planning", true, read);
    return held;
  }
  const record = recordsOf(project, plan, ["planning"])[0];
  if (!record) return null;
  const status = statusOfRecord(record, read);
  if (status.state === "running") {
    checkInProgress(project, plan, "planning", false, read);
    return {
      started: true,
      running: true,
      step: record.step as PlanningStep | null,
      stop: null,
    };
  }
  return {
    started: true,
    running: false,
    step: null,
    stop: (record.stop as PlanningStop | null) ?? {
      step: "cannot-continue",
      why: status.reason ?? "the run's process is gone",
    },
  };
}

/**
 * A planning conversation on `plan` (begun at `startedAt`) has ended: ask for
 * its planning run, but only when that conversation accepted the brief — the
 * brief's `accepted_at` is at or after `startedAt`. A person planning by hand
 * who only paused, or a brief accepted before this or by hand (no
 * `accepted_at`), starts nothing here. Beyond that, `startPlanning` starts
 * nothing unless the looks are approved and a document is still to write, so a
 * decline or a refusal is not this caller's to report.
 */
export async function planningConversationEnded(
  project: string,
  plan: string,
  startedAt: string,
): Promise<PlanningRunState | null> {
  try {
    const root = getProjectPath(project);
    if (!root) return null;
    const { acceptedAt } = await readPlanningState(root, plan);
    if (acceptedAt === null || Date.parse(acceptedAt) < Date.parse(startedAt))
      return null;
    return await startPlanning(project, plan);
  } catch {
    return null;
  }
}

const declined = (stop: PlanningStop): PlanningRunState => ({
  started: false,
  running: false,
  step: null,
  stop,
});

/**
 * Start the plan's planning run in the background, if its brief is ready:
 * accepted, with every look it names approved, and a document still to write.
 * It takes the same place a build does (one run per plan, one slot under the
 * cap, held between steps) and is refused inside a planning step — the run
 * never starts another. The package's `nextPlanningStep` is asked first, so
 * this host never restates when a run starts.
 */
export async function startPlanning(
  project: string,
  plan: string,
  /** The tracer the three clauses of a-brief-is-accepted-on-current-main report through; absent, the commands' one. */
  bring: BringTrunkOptions = {},
): Promise<PlanningRunState> {
  const inPlanning = planningStepRefusal("starting a planning run");
  if (inPlanning) throw new Error(inPlanning);
  const read = await readNow(project);
  if (planningState(project, plan, read)?.running)
    throw new Error(`${plan} is already being planned`);
  if (buildState(project, plan, read)?.running)
    throw new Error(`${plan} is building: its build has not ended`);
  assertNoBuildSession(project, plan);
  const root = getProjectPath(project);
  if (!root) throw new Error(`no project named ${project}`);

  // Taken before the first await, so two asks at once cannot both start: the
  // second meets a run in progress, as it would after the first had begun.
  const state: PlanningRunState = {
    started: true,
    running: true,
    step: null,
    stop: null,
  };
  plannings().set(key(project, plan), state);
  const release = () => {
    if (plannings().get(key(project, plan)) === state)
      plannings().delete(key(project, plan));
  };

  let free: (() => void) | null = null;
  let where: Awaited<ReturnType<typeof planLocation>>;
  try {
    if (sessionManager().forPlan(project, plan, "planning")) {
      release();
      return declined({
        step: "cannot-continue",
        why: `a planning conversation is open on ${plan}: the run starts when it ends`,
      });
    }
    const read = await readPlanningState(root, plan);
    if (read.briefStatus !== "accepted") {
      release();
      return declined({
        step: "cannot-continue",
        why: `the brief is ${read.briefStatus ?? "without a status"}, not accepted`,
      });
    }
    const next = nextPlanningStep(read);
    if (
      next.step === "wait-for-looks" ||
      next.step === "ready-for-approval" ||
      next.step === "cannot-continue"
    ) {
      release();
      return declined(next);
    }
    // A brief accepted by hand, or a run held for looks and started later, is
    // still planned on current main; a refusal here is the route's 409.
    // The place for the run is taken first: a run that cannot start leaves the branch as it was.
    free = sessionManager().admitBuild(project, plan);
    where = await planLocation(project, plan);
    if ("error" in where) throw new Error(where.error);
    await bringTrunkIntoPlan(
      root,
      plan,
      {
        refused: "its planning run did not start",
        again: "start its planning again",
        when: "its planning run",
      },
      undefined,
      bring,
    );
  } catch (err) {
    release();
    free?.();
    throw err;
  }
  const releasePlace = free;
  const location = where;
  const handle = openRecord(project, plan, "planning");
  void runPlanning({
    signals: { root, plan },
    read: () => readPlanningState(root, plan),
    run: timedStep(
      async (step: PlanningStep) => {
        // A planning step runs on the work step's default tier.
        const chosen = await stepModelOption(root, plan, "work", undefined);
        if ("error" in chosen) return { error: chosen.error };
        try {
          return await runStepSession(step, {
            manager: sessionManager(),
            worktree: location.cwd,
            ...(location.addDirs ? { addDirs: location.addDirs } : {}),
            project,
            plan,
            ...chosen,
            onSession: (r) => {
              handle.update({ process: processOf(r) });
              forgetProcessList();
            },
          });
        } finally {
          handle.update({ process: null });
        }
      },
      {
        root,
        plan,
        newId: randomUUID,
        classify: classifierFor(root, plan, true),
      },
    ),
    onStep: (step) => {
      state.step = step;
      handle.update({ step });
    },
  })
    .then((stop) => {
      state.stop = stop;
      handle.update({ stop, stopReason: whyOf(stop) });
      if (
        stop.step === "cannot-continue" &&
        stop.why.includes(ASKED_A_QUESTION)
      )
        sessionManager().holdQuestion(project, plan);
    })
    .catch((err: Error) => {
      state.stop = { step: "cannot-continue", why: err.message };
      handle.update({ stop: state.stop, stopReason: err.message });
    })
    .finally(() => {
      state.running = false;
      state.step = null;
      handle.update({ process: null });
      releasePlace();
    });
  return state;
}

/**
 * A held question was answered (decisions-as-questions, ADR decision 6): the plan no
 * longer waits, and its run starts again — a planning run that stopped on the question
 * is planned again, anything else is built — and the new session is told the answer.
 */
export async function resumeAfterQuestion(
  project: string,
  plan: string,
): Promise<unknown> {
  sessionManager().releaseQuestion(project, plan);
  const planning = planningState(project, plan, await readNow(project));
  const stop = planning?.stop;
  if (
    planning &&
    !planning.running &&
    stop?.step === "cannot-continue" &&
    stop.why.includes(ASKED_A_QUESTION)
  )
    return startPlanning(project, plan);
  return startBuild(project, plan);
}
