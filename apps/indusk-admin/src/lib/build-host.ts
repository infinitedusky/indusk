import {
  autoAccepts,
  type BuildStepName,
  buildStepModel,
  type RunnerStop,
  readBuildPlan,
  runBuild,
  runRelease,
  runStepSession,
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
  step: BuildStepName,
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
      run: async (step: BuildStepName, phase?: string) => {
        const chosen = await stepModelOption(root, plan, step, phase);
        if ("error" in chosen) return { error: chosen.error };
        return runStepSession(step, {
          manager: sessionManager(),
          worktree: where.cwd,
          ...(where.addDirs ? { addDirs: where.addDirs } : {}),
          project,
          plan,
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

/** Start the build in the background; refused while one runs for the plan or any session runs. */
export async function startBuild(
  project: string,
  plan: string,
): Promise<BuildState> {
  const existing = buildState(project, plan);
  if (existing?.running) throw new Error(`${plan} is already building`);
  const running = sessionManager().current();
  if (running)
    throw new Error(
      `a session is already running: ${running.kind} for ${running.plan} — stop it first`,
    );
  const state: BuildState = {
    running: true,
    step: null,
    detail: null,
    stop: null,
    release: null,
  };
  const { root, deps } = await depsFor(project, plan, state);
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
    });
  return state;
}

/** Accept a built plan and run the release in the background (A19). */
export async function startRelease(
  project: string,
  plan: string,
): Promise<BuildState> {
  const running = sessionManager().current();
  if (running)
    throw new Error(
      `a session is already running: ${running.kind} for ${running.plan} — stop it first`,
    );
  const state: BuildState = buildState(project, plan) ?? {
    running: false,
    step: null,
    detail: null,
    stop: null,
    release: null,
  };
  state.running = true;
  const { deps } = await depsFor(project, plan, state);
  builds().set(key(project, plan), state);
  void runRelease(deps, "person")
    .then((r) => {
      state.release = r;
    })
    .catch((err: Error) => {
      state.release = { released: false, error: err.message };
    })
    .finally(() => {
      state.running = false;
      state.step = null;
    });
  return state;
}
