import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import matter from "gray-matter";
import { parseTrajectory } from "../trajectory/parser.js";
import { detectGoalpostDrift, detectPrematureCheckoff, detectTestFirstDuty } from "./detect.js";
import { assertGitRepo, headSha, resolveBootstrapBaseline } from "./git.js";
import { appendVerifyRecord, findBaselineRecord, hashTrajectory, readLedger } from "./ledger.js";
import { detectRedTests } from "./red-tests.js";

/**
 * `atdawn verify <plan> --phase N` — phase-boundary verification for work Dawn
 * did not execute.
 *
 * Tier 3 of the enforcement ladder has no hook seam: the work arrives already
 * applied, already checked off, with no old/new string pair to gate. So this is
 * detection over committed state rather than prevention in the write path.
 *
 * It renders a verdict and NEVER repairs. Reverting belongs to component 7 —
 * and inherits a constraint dawn-hook-parity already established the hard way:
 * `git reset` unstages but cannot un-write a working tree, so what has been
 * written can only be accounted for, not unwritten.
 */

export type VerifyFindingKind =
	| "premature-checkoff"
	| "test-first"
	| "goalpost"
	| "red-test"
	| "phantom";

export interface VerifyFinding {
	kind: VerifyFindingKind;
	message: string;
	/** Trajectory row id, when the finding is about one. */
	row?: string;
	/** Checklist item text, when the finding is about one. */
	item?: string;
}

export interface VerifyBaseline {
	sha: string;
	/** `ledger` = a previous verification recorded it; `merge-base` = bootstrap. */
	source: "ledger" | "merge-base";
}

export interface VerifyReport {
	plan: string;
	phase: number;
	implPath: string;
	baseline: VerifyBaseline;
	findings: VerifyFinding[];
	/**
	 * Rows claiming `passing` that carry no test reference — reported as
	 * "could not be checked", never folded into "checked and passed". Without
	 * this distinction the backward-compat concession becomes a silent hole.
	 */
	unverifiedRows: string[];
	verdict: "clean" | "rejected";
}

export interface RunVerifyOptions {
	/** Repository root the plan lives in. */
	root: string;
	/** Plan name under `.indusk/planning/`, a directory, or an impl.md path. */
	plan: string;
	phase: number;
	/** Run the project's whole suite instead of only referenced test files. */
	fullSuite?: boolean;
	/** Gate scripts, injectable for tests. Defaults to the project's own. */
	scripts?: string[];
}

/** Resolve `<plan>` to an impl.md the same way `run` does. */
export function resolveImplPath(root: string, plan: string): string | null {
	const candidates = plan.endsWith("impl.md")
		? [resolve(root, plan)]
		: [resolve(root, plan, "impl.md"), resolve(root, ".indusk", "planning", plan, "impl.md")];
	return candidates.find((p) => existsSync(p)) ?? null;
}

/** A rejected verdict must fail a calling script; a clean one must not. */
export function exitCodeForReport(report: VerifyReport): number {
	return report.verdict === "rejected" ? 1 : 0;
}

export async function runVerify(options: RunVerifyOptions): Promise<VerifyReport> {
	const root = resolve(options.root);

	// LOUD before anything else: a non-git root must never yield a clean report.
	await assertGitRepo(root);

	const implPath = resolveImplPath(root, options.plan);
	if (implPath === null) {
		throw new Error(
			`Plan "${options.plan}" not found — expected an impl.md path, a directory containing one, or a plan under .indusk/planning/.`,
		);
	}

	// Read the ledger BEFORE forming any verdict: a corrupt ledger has to
	// refuse, not silently degrade into bootstrap mode against a wrong baseline.
	const implRepoRelPath = relative(root, implPath).split(sep).join("/");
	const planDirRepoRelPath = implRepoRelPath.replace(/\/impl\.md$/, "");

	const ledger = await readLedger(root);
	const record = findBaselineRecord(ledger, planNameFor(options.plan, implPath), options.phase);
	const baseline: VerifyBaseline = record
		? { sha: record.sha, source: "ledger" }
		: { sha: await resolveBootstrapBaseline(root, planDirRepoRelPath), source: "merge-base" };

	const content = await readFile(implPath, "utf8");
	const trajectory = parseTrajectory(matter(content).content);

	const findings: VerifyFinding[] = [
		...(await detectPrematureCheckoff({
			root,
			implPath,
			phase: options.phase,
			scripts: options.scripts,
		})),
		...detectTestFirstDuty(trajectory, options.phase),
		...(await detectGoalpostDrift({
			root,
			baselineSha: baseline.sha,
			implRepoRelPath,
			currentContent: content,
		})),
	];

	const redTests = await detectRedTests({
		root,
		trajectory,
		phase: options.phase,
		fullSuite: options.fullSuite,
	});
	findings.push(...redTests.findings);
	const unverifiedRows = redTests.unverifiedRows;

	const verdict: VerifyReport["verdict"] = findings.length > 0 ? "rejected" : "clean";
	const report: VerifyReport = {
		plan: planNameFor(options.plan, implPath),
		phase: options.phase,
		implPath,
		baseline,
		findings,
		unverifiedRows,
		verdict,
	};

	// Only a clean verdict records a baseline. A rejected phase must never
	// become the yardstick the next phase is measured against.
	if (verdict === "clean") {
		await appendVerifyRecord(root, {
			plan: report.plan,
			phase: report.phase,
			sha: await headSha(root),
			trajectory: hashTrajectory(trajectory),
			timestamp: new Date().toISOString(),
		});
	}

	return report;
}

/** The ledger keys on plan NAME, so a path argument still chains correctly. */
function planNameFor(plan: string, implPath: string): string {
	if (!plan.includes("/") && !plan.endsWith("impl.md")) return plan;
	const parts = implPath.split(/[\\/]/);
	return parts[parts.length - 2] ?? plan;
}
