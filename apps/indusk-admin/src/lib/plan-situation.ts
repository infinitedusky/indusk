import { readBuildPlan } from "@infinitedusky/indusk-mcp/build";
import {
  type LivePlan,
  type PlanSnapshot,
  stepAt,
} from "@infinitedusky/indusk-mcp/plans/steps";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import {
  type Confirmation,
  confirmationsOf,
  liveCheckRecorded,
  type NextStep,
  nextStepFor,
  realGitReads,
  type Situation,
  landedOnMain as landed,
  shownPhase,
  situation,
} from "@infinitedusky/indusk-mcp/run-record";
import { readStanding } from "@infinitedusky/indusk-mcp/promises/standing";
import { runOfPlan } from "./build-host";
import { snapshotOf } from "./plan-snapshot";
import type { Plan } from "./planning-reader";
import { sessionManager } from "./session-host";

/**
 * What the plan page and the nav row say of a plan (a-run-can-be-trusted, Build
 * Phase 2): the situation sentence and the next step, from the package's one reader,
 * over what runs for the plan now. A plan carries it as `situation`; nothing here
 * composes a sentence of its own.
 */

export interface PlanSituation {
  situation: Situation;
  next: NextStep | null;
}

/** What runs for the plan right now: a process writing it, a build, a release. */
function liveOf(project: string, plan: string): LivePlan {
  const run = runOfPlan(project, plan);
  const going = run?.status.state === "running" ? run : null;
  const interactive = sessionManager()
    .running()
    .some((r) => r.project === project && r.plan === plan && r.kind !== "build");
  return {
    writing: going?.kind === "planning" || interactive,
    planningStep: going?.kind === "planning" ? going.step : null,
    build: going?.kind === "build",
    release: going?.kind === "release",
  };
}

/**
 * The trunk's merge subjects are read once for all plans: asking git per plan on every
 * render of the nav would be a log per plan.
 */
function landedAsker(projectPath: string): (plan: string) => boolean {
  const git = realGitReads(projectPath);
  let subjects: string[] | null = null;
  const reads = {
    mergeSubjects: (trunk: string) => (subjects ??= git.mergeSubjects(trunk)),
    hasPath: git.hasPath,
  };
  return (plan) => landed("HEAD", plan, reads);
}

export interface SituationOptions {
  /** The plan whose confirmation list is wanted (the plan's own page): each clause signal and live check. */
  confirmFor?: { plan: string; promises: readonly string[] };
}

/** Each plan with `live` (what runs for it) and `situation` (what it reads as), for the page and the nav. */
export async function withSituations(
  project: string,
  projectPath: string,
  plans: readonly Plan[],
  waiting: readonly Waiting[],
  options: SituationOptions = {},
): Promise<Plan[]> {
  const isLanded = landedAsker(projectPath);
  const out: Plan[] = [];
  for (const plan of plans) {
    if (plan.archived) {
      out.push(plan);
      continue;
    }
    const live = liveOf(project, plan.name);
    const withLive: Plan = { ...plan, live };
    const run = runOfPlan(project, plan.name);
    const phase =
      run?.kind === "build" && run.status.state === "running"
        ? shownPhase(await readBuildPlan(projectPath, plan.name).catch(() => null))
        : null;
    const onMain = isLanded(plan.name);
    const confirmations =
      onMain && options.confirmFor?.plan === plan.name
        ? await confirmationsFor(projectPath, plan, options.confirmFor.promises)
        : undefined;
    const reading = situation({
      stepName: stepAt(snapshotOf(withLive) as PlanSnapshot)?.name ?? null,
      archived: false,
      landedOnMain: onMain,
      waitingOn: waiting.find((w) => w.plan === plan.name)?.on ?? null,
      run: run ? { ...run, phase } : null,
      ...(confirmations ? { confirmations } : {}),
    });
    out.push({
      ...withLive,
      situation: { situation: reading, next: nextStepFor(reading) },
    });
  }
  return out;
}

/** The confirmation list of a plan on main: its promises' clause signals and its live checks. */
async function confirmationsFor(
  projectPath: string,
  plan: Plan,
  promises: readonly string[],
): Promise<Confirmation[]> {
  const rows = await readStanding(projectPath).catch(() => []);
  const content = plan.impl?.content ?? "";
  return confirmationsOf({
    promises: promises.map((name) => ({
      name,
      clauses: (rows.find((r) => r.entry.name === name)?.clauses ?? []).map(
        (c) => ({
          clause: c.clause,
          kind: c.kind,
          standing: c.standing,
        }),
      ),
    })),
    liveChecks: (plan.impl?.trajectory?.rows ?? [])
      .filter((r) => r.levelText === "live check")
      .map((r) => ({ id: r.id, recorded: liveCheckRecorded(content, r.id) })),
  });
}
