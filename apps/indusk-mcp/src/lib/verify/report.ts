import type { VerifyFinding, VerifyReport } from "./verify.js";

/**
 * Rendering a verify report — pure string formatting, no I/O.
 *
 * Extracted from the CLI command so the *output* can be asserted on. The
 * command stays a thin printer; what a report looks like is a contract the docs
 * describe, and a contract nothing can test is one that quietly rots.
 */

/** Fixed-width labels so the findings column aligns. */
const KIND_LABELS: Record<VerifyFinding["kind"], string> = {
	"premature-checkoff": "premature ",
	"test-first": "test-first",
	goalpost: "goalpost  ",
	"red-test": "red-test  ",
	phantom: "phantom   ",
};

const CONTINUATION_INDENT = "\n              ";

/**
 * One finding as a single display line.
 *
 * The subject prefix is the trajectory **row id** and nothing else. It used to
 * fall back to `finding.item`, which for a phantom finding is the entire
 * checklist-item text — and the message already quotes it, so the item printed
 * twice: once as a runaway prefix, once inside the sentence. A row id is short
 * and stable; an item's text is neither.
 */
export function formatFinding(finding: VerifyFinding): string {
	const label = KIND_LABELS[finding.kind];
	const subject = finding.row ? `${finding.row} — ` : "";
	const body = finding.message.split("\n").join(CONTINUATION_INDENT);
	return `  ${label}  ${subject}${body}`;
}

/** The full report: header, findings, unverified accounting, verdict. */
export function formatReport(report: VerifyReport): { out: string[]; err: string[] } {
	const out: string[] = [
		`Plan:     ${report.plan}`,
		`Phase:    ${report.phase}`,
		`Baseline: ${report.baseline.sha} (${report.baseline.source})`,
		"",
	];
	const err: string[] = [];

	if (report.findings.length > 0) {
		const noun = report.findings.length === 1 ? "violation" : "violations";
		err.push(`✗ PHASE ${report.phase} REJECTED (${report.findings.length} ${noun})`, "");
		for (const finding of report.findings) err.push(formatFinding(finding));
		err.push("");
	}

	if (report.unverifiedRows.length > 0) {
		// Never silent: an unverifiable row is a gap in the evidence, not a pass.
		out.push(
			`unverified: ${report.unverifiedRows.length} row(s) could not be checked — ${report.unverifiedRows.join(", ")}`,
		);
	}

	if (report.verdict === "clean") {
		out.push(
			`✓ Phase ${report.phase} verified — the claims hold against ${report.baseline.sha}. Recorded as the baseline for the next phase.`,
		);
	}

	return { out, err };
}
