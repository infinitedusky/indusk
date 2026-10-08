/**
 * `indusk checks` — a project's declared step tooling, run and named
 * (release-checks-run-once).
 *
 * `indusk checks slow` runs `workflow.steps.land.slow_tests` and, when it
 * exits 0 over a clean tree, records the code it covered in the project's
 * home. `--unless-covered` first looks for a green run that already covered
 * the code at hand and, finding one, says so and runs nothing: release runs
 * the slow tests only when landing's green run does not cover what it ships.
 *
 * promise: slow-checks-run-once-per-tree
 */

import { spawnSync } from "node:child_process";
import { gitSync } from "../../lib/bookkeeping/git.js";
import { codeKey } from "../../lib/checks/key.js";
import { findCoveringRun, recordGreenRun } from "../../lib/checks/record.js";
import { readWorkflowSteps } from "../../lib/checks/steps.js";

export function checksSlow(checkout: string, opts: { unlessCovered?: boolean }): number {
	const steps = readWorkflowSteps(checkout);
	const command = steps.land?.slow_tests;
	if (!command) {
		console.info(
			"No slow tests are declared (workflow.steps.land.slow_tests in .indusk/config.json): nothing to run.",
		);
		return 0;
	}
	const top = gitSync(checkout, "rev-parse", "--show-toplevel");
	const root = top.code === 0 ? top.out : checkout;

	const before = codeKey(root, steps);
	if (opts.unlessCovered && before) {
		const covering = findCoveringRun(root, before);
		if (covering) {
			console.info(
				`slow tests skipped: covered by the green run at ${covering.at} (${covering.cwd}) of \`${covering.command}\`.`,
			);
			return 0;
		}
	}

	const at = new Date().toISOString();
	const run = spawnSync("sh", ["-c", command], { cwd: root, stdio: "inherit" });
	const code = run.status ?? 1;
	if (code !== 0) return code;

	const after = codeKey(root, steps);
	if (before && after === before) {
		recordGreenRun(root, { key: before, at, command, cwd: root });
		console.info("slow tests green: recorded for this code.");
	} else {
		console.info(
			"slow tests green, but not recorded: covered files had uncommitted changes, or changed during the run.",
		);
	}
	return 0;
}
