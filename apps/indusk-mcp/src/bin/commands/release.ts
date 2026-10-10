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
import {
	findCoveringRun,
	headCommit,
	latestGreenRun,
	recordGreenRun,
} from "../../lib/checks/record.js";
import { readWorkflowSteps } from "../../lib/checks/steps.js";
import type { WorkflowSteps } from "../../lib/config.js";
import { announceIncidents } from "../../lib/release/announce.js";
import { recordOf, recordRelease, releaseVersion } from "../../lib/release/record.js";
import { type ReleaseOutcome, runRelease } from "../../lib/release/run.js";
import { type Routed, routeFailures, settleFromReport } from "../../lib/release/settle.js";
import { suspectsSince } from "../../lib/release/suspects.js";

export async function releaseCommand(checkout: string): Promise<number> {
	let steps: WorkflowSteps;
	try {
		steps = readWorkflowSteps(checkout);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		return 2;
	}
	const top = gitSync(checkout, "rev-parse", "--show-toplevel");
	const root = top.code === 0 ? top.out : checkout;

	const exec = (command: string) => ({
		code: spawnSync("sh", ["-c", command], { cwd: root, stdio: "inherit" }).status ?? 1,
	});
	const outcome = runRelease({
		steps,
		exec,
		settleFailures: () => settleFromReport(steps, root, exec),
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
	const version = releaseVersion(root, steps);
	const commit = headCommit(root);
	// A claimed failure becomes an incident on its promise (ADR D6, D7); the
	// rest stay unrouted for the bugfix plan. Routing never changes the outcome.
	const routed = await routeFailures(root, outcome.recorded, {
		version,
		commit,
		now,
		suspects: suspectsSince(root, steps, latestGreenRun(root)),
	});
	outcome.recorded = { ...outcome.recorded, failed: routed.failed };
	recordRelease(root, recordOf(outcome, { version, commit, at: now }));
	try {
		await announceIncidents(root, routed.incidents, now);
	} catch (err) {
		console.error(
			`incident not committed or announced: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	console.info(report(outcome, routed));
	for (const line of routingProblems(routed)) console.error(line);
	return outcome.done ? 0 : 1;
}

/** What routing could not do, said rather than swallowed: an owner not reopened, an impl not read, a registry refused. */
function routingProblems(routed: Routed): string[] {
	const lines: string[] = [];
	if (routed.refused) lines.push(`no incident recorded: ${routed.refused}`);
	if (routed.unreadable.length > 0) {
		lines.push(
			`not read while routing — the impl could not be parsed: ${routed.unreadable.join(", ")}`,
		);
	}
	for (const problem of routed.planProblems) lines.push(`no bugfix plan opened — ${problem}`);
	for (const i of routed.incidents) {
		const r = i.reopen;
		if (r.reopened || r.reason === "already") continue;
		let why = "it is not a plan folder";
		if (r.reason === "collision") {
			why = `its impl already has "${r.heading}", which this incident did not write`;
		} else if (r.reason === "copy-problem") {
			why = `its worktree assignment could not be read: ${r.detail}`;
		}
		lines.push(`incident ${i.id}: ${i.owner} was not reopened — ${why}`);
	}
	return lines;
}

/** The lines `indusk release` prints, one fact per line. */
function report(outcome: ReleaseOutcome, routed: Routed): string {
	const lines: string[] = [];
	const { slow } = outcome;
	if (slow.skipped && slow.covering) {
		lines.push(
			`slow tests skipped: covered by the green run at ${slow.covering.at} (${slow.covering.cwd}) of \`${slow.covering.command}\`.`,
		);
	}
	if (slow.result === "red") lines.push("the slow tests failed");
	const { environment, failed, flakes } = outcome.recorded;
	if (environment) {
		lines.push(
			`the environment failed: ${environment.failed} of ${environment.total} slow test files failed`,
		);
	}
	for (const f of failed) lines.push(`failing: ${f.file}`);
	for (const f of flakes) lines.push(`flaky: ${f}`);
	lines.push(outcome.published ? "release published" : "release not published");
	lines.push(outcome.done ? "release done" : "release not done");
	if (outcome.published && !outcome.done && outcome.openFailures.length) {
		lines.push(`open failures: ${outcome.openFailures.join(", ")}`);
	}
	for (const i of routed.incidents) {
		lines.push(`recorded: incident ${i.id}`);
		if (i.reopen.reopened) {
			lines.push(`  reopened ${i.owner}: Build Phase ${i.reopen.phase}: Maintenance — ${i.id}`);
		}
	}
	for (const p of routed.plans) lines.push(`recorded: plan ${p.plan}`);
	lines.push("recorded: releases.jsonl");
	return lines.join("\n");
}
