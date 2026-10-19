import { join } from "node:path";
import { readBuildPlan } from "@infinitedusky/indusk-mcp/build";
import {
  type LivePlan,
  type PlanSnapshot,
  planSteps,
  stepAt,
} from "@infinitedusky/indusk-mcp/plans/steps";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { readStanding } from "@infinitedusky/indusk-mcp/promises/standing";
import {
  type Confirmation,
  confirmationsOf,
  landedAsker,
  liveCheckRecorded,
  type NextStep,
  nextStepFor,
  psAll,
  readDocumentsHash,
  readReviewText,
  reportNextStep,
  reportPlanningAudit,
  reportSaysWhatIsTrue,
  type Situation,
  shownPhase,
  situation,
  trunkMergeSubjects,
} from "@infinitedusky/indusk-mcp/run-record";
import { heldRunning, runOfPlan, throttled } from "./build-host";
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
    .some(
      (r) => r.project === project && r.plan === plan && r.kind !== "build",
    );
  return {
    writing: going?.kind === "planning" || interactive,
    planningStep: going?.kind === "planning" ? going.step : null,
    build: going?.kind === "build",
    release: going?.kind === "release",
  };
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
  // The trunk's merge subjects are read once for all plans, from the trunk branch (never the
  // root checkout's own) and, for a workbench plan, from its code repository (A94, A95).
  const isLanded = landedAsker(projectPath);
  const out: Plan[] = [];
  for (const plan of plans) {
    out.push(
      plan.archived
        ? plan
        : await situatedPlan({
            project,
            projectPath,
            plan,
            waiting,
            onMain: isLanded(plan.name),
            confirmFor: options.confirmFor,
          }),
    );
  }
  return out;
}

/** One open plan with what runs for it and what it reads as; the reads of `withSituations`, named. */
async function situatedPlan(input: {
  project: string;
  projectPath: string;
  plan: Plan;
  waiting: readonly Waiting[];
  onMain: boolean;
  confirmFor: SituationOptions["confirmFor"];
}): Promise<Plan> {
  const { project, projectPath, plan, onMain } = input;
  const withLive: Plan = { ...plan, live: liveOf(project, plan.name) };
  const run = runOfPlan(project, plan.name);
  const phase =
    run?.kind === "build" && run.status.state === "running"
      ? shownPhase(
          await readBuildPlan(projectPath, plan.name).catch(() => null),
        )
      : null;
  const confirmations =
    onMain && input.confirmFor?.plan === plan.name
      ? await confirmationsFor(projectPath, plan, input.confirmFor.promises)
      : undefined;
  const reading = situation({
    stepName: stepAt(snapshotOf(withLive) as PlanSnapshot)?.name ?? null,
    archived: false,
    landedOnMain: onMain,
    waitingOn: input.waiting.find((w) => w.plan === plan.name)?.on ?? null,
    run: run ? { ...run, phase } : null,
    ...(confirmations ? { confirmations } : {}),
  });
  const next = nextStepFor(reading);
  reportSituation(project, projectPath, withLive, reading, next);
  return { ...withLive, situation: { situation: reading, next } };
}

/**
 * The confirmation list of a plan on main: its promises' clause signals and its live checks.
 * A registry that cannot be read is said so, never read as a plan with nothing to confirm (A92).
 */
async function confirmationsFor(
  projectPath: string,
  plan: Plan,
  promises: readonly string[],
): Promise<Confirmation[] | { unreadable: string }> {
  let rows: Awaited<ReturnType<typeof readStanding>>;
  try {
    rows = await readStanding(projectPath);
  } catch (err) {
    return { unreadable: (err as Error).message };
  }
  const content = plan.impl?.content ?? "";
  return confirmationsOf({
    promises: promises.map((name) => {
      const row = rows.find((r) => r.entry.name === name);
      return {
        name,
        inForce: row?.entry.state === "enforced",
        clauses: (row?.clauses ?? []).map((c) => ({
          clause: c.clause,
          kind: c.kind,
          standing: c.standing,
        })),
      };
    }),
    liveChecks: (plan.impl?.trajectory?.rows ?? [])
      .filter((r) => r.levelText === "live check")
      .map((r) => ({ id: r.id, recorded: liveCheckRecorded(content, r.id) })),
  });
}

/**
 * The signals that read what the page says of a plan, judged from raw sources the reader
 * does not use (a-run-can-be-trusted, Decision 17): the process table beside the session
 * manager's own sessions, a plain `git log` of the trunk, and plan-review.md on disk.
 * At most once per plan in a while, so the nav's reads and the page's poll do not flood.
 */
function reportSituation(
  project: string,
  root: string,
  plan: Plan,
  reading: Situation,
  next: NextStep | null,
): void {
  const id = `${project}/${plan.name}`;
  // signal: a-run-is-read-from-its-record/says-what-is-true
  throttled(`${id}/says`, () =>
    reportSaysWhatIsTrue(root, {
      plan: plan.name,
      kind: reading.kind,
      text: reading.text,
      heldHere: heldRunning(project, plan.name),
      sessions: sessionManager()
        .running()
        .filter((r) => r.project === project && r.plan === plan.name),
      table: psAll(),
      subjects: trunkMergeSubjects(root),
    }),
  );
  // signal: a-run-is-read-from-its-record/always-a-next-step
  throttled(`${id}/next`, () =>
    reportNextStep(root, { plan: plan.name, kind: reading.kind, next }),
  );
  // signal: a-run-is-read-from-its-record/the-planning-audit-is-a-step
  const implStatus =
    typeof plan.impl?.frontmatter.status === "string"
      ? plan.impl.frontmatter.status
      : null;
  if (implStatus !== null)
    throttled(`${id}/audit`, () => {
      const planDir = join(
        plan.worktree?.path ?? root,
        ".indusk",
        "planning",
        plan.name,
      );
      return reportPlanningAudit(root, {
        plan: plan.name,
        shown:
          planSteps(snapshotOf(plan)).planning.find(
            (s) => s.name === "Planning audit",
          )?.state ?? null,
        implStatus,
        reviewText: readReviewText(planDir),
        documentsHash: readDocumentsHash(planDir),
      });
    });
}
