import { ScorecardsList } from "@/components/Scorecards";
import { readEvalScorecards } from "@/lib/planning-reader";
import { getProjectRoot } from "@/lib/project-root";
import { getCommitMessages } from "@/lib/vcs";

/**
 * Global eval scorecards view. Lists EVERY entry from
 * `.indusk/eval/results.log`, framed as a system-improvement signal —
 * not tied to any individual plan.
 *
 * Enriches each scorecard with the commit message for its `changeId` —
 * the human-authored intent of what was being scored. Tries jj first (per
 * dusk convention) and falls back to git for repos that don't use jj. The
 * canonical fix would be to capture this AT THE TIME OF SCORING in the
 * eval agent (so it survives later jj abandon / restructure), but the
 * UI-level lookup works retroactively for every existing scorecard.
 */
export default async function ScorecardsPage() {
  const projectRoot = getProjectRoot();
  const scorecards = await readEvalScorecards(projectRoot, {
    from: new Date(0),
    to: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  });
  const ids = scorecards
    .map((s) => (s.changeId ? String(s.changeId) : ""))
    .filter((id) => id !== "");
  const messages = getCommitMessages(projectRoot, ids);
  return <ScorecardsList scorecards={scorecards} descriptions={messages} />;
}
