/**
 * `indusk checks` — a project's declared step tooling, run and named
 * (release-checks-run-once).
 *
 * `indusk checks show` names each step's declared tooling, or says plainly what
 * not declaring it means, so the landing and release steps never assume a
 * project's commands.
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

/**
 * What landing and release will run for this project, from `workflow.steps`,
 * one line per fact; for each that is not declared, what that means.
 *
 * promise: landing-and-release-name-the-projects-commands
 */
export function checksShow(checkout: string): number {
	const steps = readWorkflowSteps(checkout);
	const land = steps.land ?? {};
	const release = steps.release ?? {};
	const lines = [
		"Landing",
		land.slow_tests
			? `  slow tests:    ${land.slow_tests}  (run by indusk checks slow; release skips them when a green run covered the same code)`
			: "  slow tests:    none declared — landing runs no slow tests (workflow.steps.land.slow_tests)",
		"Release",
		release.command
			? `  command:       ${release.command}`
			: "  command:       none declared — nothing to publish; the plan closes at landing (workflow.steps.release.command)",
		release.version_file
			? `  version file:  ${release.version_file}`
			: "  version file:  none declared — no version to bump (workflow.steps.release.version_file)",
		release.changelog
			? `  changelog:     ${release.changelog}`
			: "  changelog:     none declared — no changelog to roll (workflow.steps.release.changelog)",
		`  slow tests cover: ${release.covers?.length ? release.covers.join(", ") : "the whole repository but .indusk/"}`,
	];
	console.info(lines.join("\n"));
	return 0;
}
