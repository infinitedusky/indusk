import { formatReport } from "../../lib/verify/report.js";
import { exitCodeForReport, runVerify } from "../../lib/verify/verify.js";

export interface VerifyOptions {
	/** `--phase <n>` — the phase boundary to judge. */
	phase?: number;
	/** `--full-suite` — run the whole test command instead of referenced files. */
	fullSuite?: boolean;
}

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

	const { out, err } = formatReport(report);
	for (const line of out) console.info(line);
	for (const line of err) console.error(line);

	process.exitCode = exitCodeForReport(report);
}
