import { ScorecardsList } from "@/components/Scorecards";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { readEvalScorecards } from "@/lib/planning-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";
import { getCommitMessages } from "@/lib/vcs";

interface ScorecardsRouteProps {
  params: Promise<{ project: string }>;
}

/**
 * Per-project scorecards view — reads a single project's
 * `.indusk/eval/results.log` and renders the list. Replaces the Phase 4
 * cross-project `/scorecards` route, which is removed in Phase 6 as part
 * of the project-siloing move.
 *
 * Behavior parallels the per-project layout's stale-path handling: if the
 * project name isn't registered or its path no longer exists on disk,
 * render the same `<StaleProjectFailurePage>` (HTTP 200) that the rest of
 * the `/p/{project}/...` routes use — not a 404 or 500. Unregistered
 * `{project}` inside `/p/[project]/...` is an inherited contract from T11
 * and we keep it here.
 */
export default async function PerProjectScorecardsPage({
  params,
}: ScorecardsRouteProps) {
  const { project } = await params;
  const projectPath = getProjectPath(project);

  if (!projectPath || !projectPathExists(projectPath)) {
    return (
      <StaleProjectFailurePage
        projectName={project}
        projectPath={projectPath ?? undefined}
      />
    );
  }

  const since = new Date(0);
  const until = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);

  const scorecards = await readEvalScorecards(projectPath, {
    from: since,
    to: until,
  }).catch(() => []);

  const ids = scorecards
    .map((s) => (s.changeId ? String(s.changeId) : ""))
    .filter((id) => id !== "");
  const messages = getCommitMessages(projectPath, ids);

  // Single-project view — deliberately omit the project-name label per row
  // (it'd be redundant noise since every scorecard belongs to {project}).
  // ScorecardsList handles `undefined` / missing `project` fields by not
  // rendering the label.
  if (scorecards.length === 0) {
    // Not an error — just no scorecards yet. Surface a calm empty state.
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-gray-900">
          Scorecards — {project}
        </h1>
        <p className="text-sm text-gray-500">
          No eval scorecards recorded for this project yet. Commit via `jj
          describe` to trigger the eval agent.
        </p>
      </div>
    );
  }

  return <ScorecardsList scorecards={scorecards} descriptions={messages} />;
}
