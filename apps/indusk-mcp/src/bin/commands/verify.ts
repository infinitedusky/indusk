import { exitCodeForReport, runVerify, type VerifyFinding } from "../../lib/verify/verify.js";

export interface VerifyOptions {
	/** `--phase <n>` — the phase boundary to judge. */
	phase?: number;
	/** `--full-suite` — run the whole test command instead of referenced files. */
	fullSuite?: boolean;
}

/** Human labels for each detection — the report's left column. */
const KIND_LABELS: Record<VerifyFinding["kind"], string> = {
	"premature-checkoff": "premature ",
	"test-first": "test-first ",
	goalpost: "goalpost   ",
	"red-test": "red-test   ",
	phantom: "phantom    ",
};

/**
 * `atdawn verify <plan> --phase N` — phase-boundary verification for work Dawn
 * did not execute.
 *
 * Renders a verdict and never repairs. Exit codes: 0 = clean (a ledger record
 * was appended), 1 = rejected or bad invocation.
 */
export async function verify(
	projectRoot: string,
	plan: string,
	options: VerifyOptions = {},
): Promise<void> {
	if (options.phase === undefined) {
		console.error("--phase <n> is required: verify judges one phase boundary at a time.");
		process.exitCode = 1;
		return;
	}
	if (!Number.isInteger(options.phase) || options.phase < 1) {
		console.error(
			`--phase must be a positive whole number (got "${options.phase}"). Phases are numbered from 1.`,
		);
		process.exitCode = 1;
		return;
	}

	let report: Awaited<ReturnType<typeof runVerify>>;
	try {
		report = await runVerify({
			root: projectRoot,
			plan,
			phase: options.phase,
			fullSuite: options.fullSuite,
		});
	} catch (err) {
		// Every throw out of runVerify is a refusal to guess — a missing repo, a
		// corrupt ledger, an unresolvable plan. None may look like a clean phase.
		console.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	console.info(`Plan:     ${report.plan}`);
	console.info(`Phase:    ${report.phase}`);
	console.info(`Baseline: ${report.baseline.sha} (${report.baseline.source})`);
	console.info("");

	if (report.findings.length > 0) {
		console.error(
			`✗ PHASE ${report.phase} REJECTED (${report.findings.length} ${
				report.findings.length === 1 ? "violation" : "violations"
			})`,
		);
		console.error("");
		for (const finding of report.findings) {
			const label = KIND_LABELS[finding.kind];
			const subject = finding.row ?? finding.item;
			const head = subject ? `${subject} — ` : "";
			console.error(`  ${label} ${head}${finding.message.split("\n").join("\n             ")}`);
		}
		console.error("");
	}

	if (report.unverifiedRows.length > 0) {
		// Never silent: an unverifiable row is a gap in the evidence, not a pass.
		console.info(
			`unverified: ${report.unverifiedRows.length} row(s) claim "passing" with no test reference — not checked: ${report.unverifiedRows.join(", ")}`,
		);
	}

	if (report.verdict === "clean") {
		console.info(
			`✓ Phase ${report.phase} verified — the claims hold against ${report.baseline.sha}. Recorded as the baseline for the next phase.`,
		);
	}

	process.exitCode = exitCodeForReport(report);
}
