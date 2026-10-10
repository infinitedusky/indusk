/**
 * `indusk release` — run the release a project declares, in the order it
 * declares (release-records-its-failures). Reads `workflow.steps.release`,
 * runs it through `runRelease`, prints the order and the outcome, appends the
 * release record, and exits 0 only when the release is done.
 *
 * promise: a-release-runs-as-its-project-declares
 */

import { spawnSync } from "node:child_process";
import { gitSync } from "../../lib/bookkeeping/git.js";
import { codeKey } from "../../lib/checks/key.js";
import { findCoveringRun, headCommit, recordGreenRun } from "../../lib/checks/record.js";
import { readWorkflowSteps } from "../../lib/checks/steps.js";
import type { WorkflowSteps } from "../../lib/config.js";
import { recordOf, recordRelease, releaseVersion } from "../../lib/release/record.js";
import { type ReleaseOutcome, runRelease } from "../../lib/release/run.js";

export function releaseCommand(checkout: string): number {
	let steps: WorkflowSteps;
	try {
		steps = readWorkflowSteps(checkout);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		return 2;
	}
	const top = gitSync(checkout, "rev-parse", "--show-toplevel");
	const root = top.code === 0 ? top.out : checkout;

	const outcome = runRelease({
		steps,
		exec: (command) => ({
			code: spawnSync("sh", ["-c", command], { cwd: root, stdio: "inherit" }).status ?? 1,
		}),
		now: () => new Date(),
		codeKey: () => codeKey(root, steps),
		coveringRun: (key) => findCoveringRun(root, key),
		recordGreen: (run) => recordGreenRun(root, { ...run, cwd: root, sha: headCommit(root) }),
	});

	if (!outcome.declared) {
		console.error(
			"no release declared: workflow.steps.release.command in .indusk/config.json names what publishes",
		);
		return 1;
	}

	const now = new Date();
	recordRelease(
		root,
		recordOf(outcome, { version: releaseVersion(root, steps), commit: headCommit(root), at: now }),
	);
	console.info(report(outcome));
	return outcome.done ? 0 : 1;
}

/** The lines `indusk release` prints, one fact per line. */
function report(outcome: ReleaseOutcome): string {
	const lines: string[] = [];
	const { slow } = outcome;
	if (slow.skipped && slow.covering) {
		lines.push(
			`slow tests skipped: covered by the green run at ${slow.covering.at} (${slow.covering.cwd}) of \`${slow.covering.command}\`.`,
		);
	}
	if (slow.result === "red") lines.push("the slow tests failed");
	lines.push(outcome.published ? "release published" : "release not published");
	lines.push(outcome.done ? "release done" : "release not done");
	if (outcome.published && !outcome.done && outcome.openFailures.length) {
		lines.push(`open failures: ${outcome.openFailures.join(", ")}`);
	}
	lines.push("recorded: releases.jsonl");
	return lines.join("\n");
}
