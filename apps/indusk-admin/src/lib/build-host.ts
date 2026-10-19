import {
  autoAccepts,
  type BuildStepName,
  buildStepModel,
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
} from "@infinitedusky/indusk-mcp/build";
import { acceptPlan } from "@infinitedusky/indusk-mcp/plans";
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

export function buildState(project: string, plan: string): BuildState | null {
  return builds().get(key(project, plan)) ?? null;
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

async function depsFor(project: string, plan: string, state: BuildState) {
  const root = getProjectPath(project);
  if (!root) throw new Error(`no project named ${project}`);
  const where = await planLocation(project, plan);
  if ("error" in where) throw new Error(where.error);
  return {
    root,
    deps: {
      read: () => readBuildPlan(root, plan),
      run: async (
        step: BuildStepName,
        phase?: string,
        reason?: ShortenReason,
      ) => {
        // A shortened reason is one line rewritten: it runs on the work step's default tier.
        const chosen = await stepModelOption(
          root,
          plan,
          step === "shorten-reason" ? "work" : step,
          phase,
        );
        if ("error" in chosen) return { error: chosen.error };
        return runStepSession(step, {
          manager: sessionManager(),
          worktree: where.cwd,
          ...(where.addDirs ? { addDirs: where.addDirs } : {}),
          project,
          plan,
          ...(reason ? { reason } : {}),
          ...chosen,
        });
      },
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

/** Start the build in the background; refused while a build runs or a build session is held for the plan. */
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
  let root: string;
  let deps: Awaited<ReturnType<typeof depsFor>>["deps"];
  try {
    ({ root, deps } = await depsFor(project, plan, state));
  } catch (err) {
    free();
    throw err;
  }
  builds().set(key(project, plan), state);
  void runBuild({ ...deps, autoAccept: autoAccepts(root) })
    .then((stop) => {
      state.stop = stop;
    })
    .catch((err: Error) => {
      state.stop = { step: "cannot-continue", why: err.message };
    })
    .finally(() => {
      state.running = false;
      state.step = null;
      free();
    });
  return state;
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
  const state: BuildState = existing ?? {
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
  let deps: Awaited<ReturnType<typeof depsFor>>["deps"];
  try {
    ({ deps } = await depsFor(project, plan, state));
  } catch (err) {
    state.running = false;
    throw err;
  }
  void runRelease(deps, "person")
    .then((r) => {
      state.release = r;
      state.stop = r.released
        ? { step: "released" }
        : { step: "release-failed", why: r.error ?? "unknown" };
    })
    .catch((err: Error) => {
      state.release = { released: false, error: err.message };
      state.stop = { step: "release-failed", why: err.message };
    })
    .finally(() => {
      state.running = false;
      state.step = null;
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

export function planningState(
  project: string,
  plan: string,
): PlanningRunState | null {
  return plannings().get(key(project, plan)) ?? null;
}

/**
 * A planning conversation on `plan` has ended: ask for its planning run. The
 * brief is normally accepted from inside that conversation, where the run is
 * held back while it is open, so its end is the next moment to ask. Asking is
 * safe at any end — `startPlanning` starts nothing unless the brief is
 * accepted, its looks approved and a document still to write — so a decline or
 * a refusal is not this caller's to report.
 */
export async function planningConversationEnded(
  project: string,
  plan: string,
): Promise<PlanningRunState | null> {
  try {
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
    free = sessionManager().admitBuild(project, plan);
    where = await planLocation(project, plan);
    if ("error" in where) throw new Error(where.error);
  } catch (err) {
    release();
    free?.();
    throw err;
  }
  const releasePlace = free;
  const location = where;
  void runPlanning({
    read: () => readPlanningState(root, plan),
    run: async (step) => {
      // A planning step runs on the work step's default tier.
      const chosen = await stepModelOption(root, plan, "work", undefined);
      if ("error" in chosen) return { error: chosen.error };
      return runStepSession(step, {
        manager: sessionManager(),
        worktree: location.cwd,
        ...(location.addDirs ? { addDirs: location.addDirs } : {}),
        project,
        plan,
        ...chosen,
      });
    },
    onStep: (step) => {
      state.step = step;
    },
  })
    .then((stop) => {
      state.stop = stop;
    })
    .catch((err: Error) => {
      state.stop = { step: "cannot-continue", why: err.message };
    })
    .finally(() => {
      state.running = false;
      state.step = null;
      releasePlace();
    });
  return state;
}
