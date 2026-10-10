import type { WorkflowSteps } from "../config.js";
import { failedFiles } from "./junit.js";
import type { SettledFailures } from "./run.js";

/**
 * A red slow run, settled (release-records-its-failures D4, D5): the failing
 * files are read from the declared JUnit report; when more than half the
 * report's files failed it is the environment and nothing else is said; else
 * the failing files are run once more through `slow_tests.rerun` (`{files}`
 * substituted) and the report is read again — a file the rerun does not leave
 * failing is a flake.
 *
 * promise: a-failure-is-read-from-the-report
 * promise: a-flake-opens-nothing
 */
export function settleFromReport(
	steps: WorkflowSteps,
	root: string,
	exec: (command: string) => { code: number },
): SettledFailures {
	const spec = steps.release?.slow_tests;
	if (!spec) return { failed: [], flakes: [] };
	const first = failedFiles(spec.report, root);
	if (!first.readable || first.files.size === 0) return { failed: [], flakes: [] };
	if (first.files.size * 2 > first.total) {
		return {
			failed: [],
			flakes: [],
			environment: { failed: first.files.size, total: first.total },
		};
	}
	const names = [...first.files.keys()].sort();
	let still = names;
	if (spec.rerun) {
		exec(spec.rerun.replaceAll("{files}", names.join(" ")));
		const second = failedFiles(spec.report, root);
		if (second.readable) still = names.filter((f) => second.files.has(f));
	}
	return {
		failed: still.map((file) => ({ file, routed: "unrouted" })),
		flakes: names.filter((f) => !still.includes(f)),
	};
}
