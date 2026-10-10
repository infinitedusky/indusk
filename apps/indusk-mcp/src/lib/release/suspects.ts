import { gitSync } from "../bookkeeping/git.js";
import type { GreenRun } from "../checks/record.js";
import type { WorkflowSteps } from "../config.js";
import type { Suspects } from "../promises/incidents.js";

/**
 * The commits that may have broken the slow tests (release-records-its-failures
 * D9): `git log <sha>..HEAD` over the release's `covers` paths (the whole
 * repository when it declares none), from the commit the last green slow run
 * was made on. A run recorded without a `sha`, or a `sha` git no longer has,
 * names none and says why — never a guess at a range.
 *
 * promise: a-failing-slow-test-breaks-its-promise
 */
export function suspectsSince(
	root: string,
	steps: WorkflowSteps,
	green: GreenRun | null,
): Suspects {
	const covers = steps.release?.covers ?? ["."];
	if (!green) return { since: null, unnamed: "no green slow run is recorded", covers, commits: [] };
	if (!green.sha || green.sha === "unknown") {
		return {
			since: null,
			unnamed: `the last green slow run (${green.at}) recorded no commit to count from`,
			covers,
			commits: [],
		};
	}
	const log = gitSync(root, "log", "--format=%h %s", `${green.sha}..HEAD`, "--", ...covers);
	if (log.code !== 0) {
		return {
			since: null,
			unnamed: `git could not list the commits since ${green.sha.slice(0, 7)}, the last green slow run's`,
			covers,
			commits: [],
		};
	}
	return { since: green.sha, covers, commits: log.out.split("\n").filter(Boolean) };
}
