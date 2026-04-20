import { ScorecardsList } from "@/components/Scorecards";
import { readEvalScorecards } from "@/lib/planning-reader";
import { readRegistryProjects } from "@/lib/registry-client";
import { getCommitMessages } from "@/lib/vcs";

/**
 * Cross-project eval scorecards view. Walks every registered project's
 * `.indusk/eval/results.log`, merges the entries, and renders them as a
 * single list sorted most-recent-first (ScorecardsList owns the sort).
 *
 * Phase 3 delivers the walk + merge. Phase 4 adds the project-name column
 * on each card so the user can tell which project a scorecard belongs to;
 * for now the scorecards are interleaved but unlabeled — acceptable when
 * only one project is registered (the common case today).
 *
 * The commit-message enrichment stays per-project because jj describe
 * output is scoped to the repo it's invoked in. We accumulate into a
 * single descriptions map keyed by changeId; duplicate changeIds across
 * projects (unlikely but possible) fall back to the last-seen project's
 * description.
 */
export default async function ScorecardsPage() {
	const projects = readRegistryProjects();
	const since = new Date(0);
	const until = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);

	const perProject = await Promise.all(
		projects.map(async (entry) => {
			const raw = await readEvalScorecards(entry.path, {
				from: since,
				to: until,
			}).catch(() => []);
			// Inject the registered project name on each scorecard so
			// Scorecards.tsx can display it as a label. The field isn't in
			// the underlying results.log — it's an enrichment from the
			// walker.
			const scorecards = raw.map((s) => ({ ...s, project: entry.name }));
			const ids = scorecards
				.map((s) => (s.changeId ? String(s.changeId) : ""))
				.filter((id) => id !== "");
			const messages = getCommitMessages(entry.path, ids);
			return { scorecards, messages };
		}),
	);

	const allScorecards = perProject.flatMap((p) => p.scorecards);
	const allMessages = new Map<string, string>();
	for (const { messages } of perProject) {
		for (const [k, v] of messages) {
			allMessages.set(k, v);
		}
	}

	return (
		<ScorecardsList scorecards={allScorecards} descriptions={allMessages} />
	);
}
