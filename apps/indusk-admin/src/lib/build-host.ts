import {
  autoAccepts,
  type BuildStepName,
  buildStepModel,
  type RunnerStop,
  readBuildPlan,
  runBuild,
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

/** Start the build in the background; refused while a build runs or a build session is held for the plan. */
export async function startBuild(
  project: string,
  plan: string,
): Promise<BuildState> {
  const existing = buildState(project, plan);
  if (existing?.running) throw new Error(`${plan} is already building`);
  const running = sessionManager().forPlan(project, plan, "build");
  if (running)
    throw new Error(
      `a build session is already running for ${plan}: ${running.id} — stop it first`,
    );
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
  const running = sessionManager().forPlan(project, plan, "build");
  if (running)
    throw new Error(
      `a build session is already running for ${plan}: ${running.id} — stop it first`,
    );
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
