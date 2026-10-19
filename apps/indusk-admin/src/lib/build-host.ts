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
  bringTrunkIntoPlan,
} from "@infinitedusky/indusk-mcp/plans";
import {
  type RunKind,
  type RunRecord,
  readRunRecord,
  realProcessReads,
  restartStep,
  runStatus,
  startRunRecord,
  writeRunRecord,
} from "@infinitedusky/indusk-mcp/run-record";
import matter from "gray-matter";
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
  const write = () => {
    if (home === null) return;
    try {
      writeRunRecord(home, current);
    } catch {
      // the record is a cache of the run for the page; the run goes on without it
    }
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

const newest = (records: RunRecord[]): RunRecord | undefined =>
  [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

/** What the record alone says of a run, with no entry held here: judged by its own process. */
function statusOfRecord(record: RunRecord) {
  return runStatus(record, realProcessReads, false);
}

/** The build page's state from a record: nothing held here, so the record decides. */
function buildStateFromRecord(record: RunRecord): BuildState {
  const status = statusOfRecord(record);
  if (status.state === "running") {
    return {
      running: true,
      step: record.step,
      detail: record.phase,
      stop: null,
      release: null,
    };
  }
  const stop = (record.stop as RunnerStop | null) ?? {
    step: "cannot-continue" as const,
    why: status.reason ?? "the run's process is gone",
  };
  return {
    running: false,
    step: null,
    detail: record.phase,
    stop,
    release:
      record.kind === "release" && record.stop
        ? record.stop.step === "released"
          ? { released: true, error: null }
          : { released: false, error: whyOf(record.stop) }
        : null,
  };
}

/**
 * The kind of the run that died: a record with no stop whose process is gone,
 * the newest of the plan's. A run that stopped on its own is not dead; one
 * whose record cannot be read is not known to be.
 */
function deadRun(project: string, plan: string): RunKind | null {
  const dead = recordsOf(project, plan, [
    "planning",
    "release",
    "build",
  ]).filter((r) => r.stop === null && statusOfRecord(r).state === "stopped");
  return newest(dead)?.kind ?? null;
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
export function buildState(project: string, plan: string): BuildState | null {
  const held = builds().get(key(project, plan));
  if (held) return held;
  const record = newest(recordsOf(project, plan, ["build", "release"]));
  return record ? buildStateFromRecord(record) : null;
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
              onSession: (r) => handle.update({ process: processOf(r) }),
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
  const existing = buildState(project, plan);
  if (existing?.running) throw new Error(`${plan} is already building`);
  if (planningState(project, plan)?.running)
    throw new Error(`${plan} is being planned: its planning run has not ended`);
  assertNoBuildSession(project, plan);
  const dead = deadRun(project, plan);
  if (dead !== null) {
    const root = getProjectPath(project);
    if (!root) throw new Error(`no project named ${project}`);
    const restart = await restartFor(root, plan, dead);
    if (restart.run === "planning")
      return startPlanningFromBuild(project, plan);
    if (restart.run === "release") return startRelease(project, plan);
  }
  // Admitted once, here, and holding its place under the cap until it ends —
  // between its steps too, so another plan's start cannot take it.
  const free = sessionManager().admitBuild(project, plan);
  const state: BuildState = {
    running: true,
    step: null,
    detail: null,
    stop: null,
    release: null,
  };
  const handle = openRecord(project, plan, "build");
  let root: string;
  let deps: Awaited<ReturnType<typeof depsFor>>["deps"];
  try {
    ({ root, deps } = await depsFor(project, plan, state, handle));
  } catch (err) {
    handle.update({
      stop: { step: "cannot-continue", why: (err as Error).message },
      stopReason: (err as Error).message,
    });
    free();
    throw err;
  }
  builds().set(key(project, plan), state);
  void runBuild({ ...deps, autoAccept: autoAccepts(root) })
    .then((stop) => {
      state.stop = stop;
      handle.update({ stop, stopReason: whyOf(stop) });
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
  const existing = buildState(project, plan);
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
    .then((r) => {
      state.release = r;
      state.stop = r.released
        ? { step: "released" }
        : { step: "release-failed", why: r.error ?? "unknown" };
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
): PlanningRunState | null {
  const held = plannings().get(key(project, plan));
  if (held) return held;
  const record = recordsOf(project, plan, ["planning"])[0];
  if (!record) return null;
  const status = statusOfRecord(record);
  if (status.state === "running") {
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
): Promise<PlanningRunState> {
  const inPlanning = planningStepRefusal("starting a planning run");
  if (inPlanning) throw new Error(inPlanning);
  if (planningState(project, plan)?.running)
    throw new Error(`${plan} is already being planned`);
  if (buildState(project, plan)?.running)
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
    await bringTrunkIntoPlan(root, plan, {
      refused: "its planning run did not start",
      again: "start its planning again",
      when: "its planning run",
    });
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
            onSession: (r) => handle.update({ process: processOf(r) }),
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
