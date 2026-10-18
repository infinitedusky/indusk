import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getTrunkBranches } from "../config.js";
import { git } from "../git.js";
import { phaseLabel } from "../impl-headings.js";
import { resolveImplPath } from "../impl-parser.js";
import { parseBriefContract } from "../promises/brief-contract.js";
import { readPromises } from "../promises/registry.js";
import { changedFilesForPhase } from "../shape/changed.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { resolveTestCommand } from "../verify/red-tests.js";
import { isRootsRefusal, resolveExecutionRoots } from "../worktree/roots.js";
import { PlanCommandRefusal } from "./plan-branch.js";
import { planTestSet, type TestSet, type TestSetReads, type TestSetScope } from "./test-set.js";
import {
	collectResults,
	describeTestSet,
	execRunner,
	findReached,
	type Runner,
	runFiles,
} from "./test-set-run.js";

/**
 * `indusk plans tests` (tests-never-make-us-wait ADR D3): what a plan runs at a
 * phase or at landing, run, with each file's reason.
 *
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 */

export interface PlanTestsOptions {
	plan: string;
	scope: TestSetScope;
	/** Print the rows' and Must-not-break files and run nothing. */
	list?: boolean;
	run?: Runner;
}

export interface PlanTestsOutcome {
	text: string;
	/** Non-zero when any test failed. */
	exitCode: number;
}

/** The reads that do not need the changed files: rows, Must-not-break names, the registry. */
export function readsFor(
	root: string,
	plan: string,
): Pick<TestSetReads, "rows" | "mustNotBreak" | "registry"> {
	const impl = resolveImplPath(root, plan);
	if (impl === null) throw new PlanCommandRefusal(`no impl.md for ${plan} under ${root}`);
	const rows = parseTrajectory(readFileSync(impl, "utf-8")).rows;

	let mustNotBreak: string[] = [];
	try {
		const brief = parseBriefContract(readFileSync(join(dirname(impl), "brief.md"), "utf-8"));
		if (brief.shape === "contract") mustNotBreak = brief.mustNotBreak;
	} catch {
		// A plan with no brief protects no promise; its rows and changes still run.
	}

	const read = readPromises(root);
	const registry = read.ok
		? read.registry.promises
		: "partial" in read
			? read.partial.promises
			: [];
	return { rows, mustNotBreak, registry };
}

/** The files a plan's branch changed since it left the trunk, committed. */
export async function landingChanged(codeRoot: string): Promise<string[]> {
	for (const trunk of getTrunkBranches(codeRoot)) {
		let base: string;
		try {
			base = await git(codeRoot, "merge-base", trunk, "HEAD");
		} catch {
			continue;
		}
		const out = await git(codeRoot, "diff", "--name-only", `${base}..HEAD`);
		return out.split("\n").filter(Boolean);
	}
	throw new PlanCommandRefusal(
		`no trunk branch (${getTrunkBranches(codeRoot).join(", ")}) shares history with HEAD, so what the plan changed cannot be told`,
	);
}

export async function plansTestsOutcome(
	root: string,
	options: PlanTestsOptions,
): Promise<PlanTestsOutcome> {
	const roots = resolveExecutionRoots(root, options.plan);
	if (isRootsRefusal(roots)) throw new PlanCommandRefusal(roots.error);
	const reads = readsFor(root, options.plan);

	if (options.list) {
		const set = planTestSet(reads, options.scope);
		return {
			text: `${describeTestSet(set)}\n\nTests reached by the changed files are found by running them; --list runs nothing.`,
			exitCode: 0,
		};
	}

	const run = options.run ?? execRunner;
	const changed =
		"phase" in options.scope
			? await changedFilesForPhase({
					root: roots.codeRoot,
					plan: options.plan,
					phase: options.scope.phase,
				})
			: await landingChanged(roots.codeRoot);
	const { reached, failed } = await findReached({ root: roots.codeRoot, changed, run });
	const set: TestSet = planTestSet({ ...reads, reached }, options.scope);

	// The reached files ran inside the related run; only the rest run now.
	const command = await resolveTestCommand(root);
	if (command === null) {
		throw new PlanCommandRefusal(
			"the project names no test command (verify.testRunner or verify.testCommand in .indusk/config.json), so the plan's tests cannot be run",
		);
	}
	const results = await runFiles({
		root: roots.codeRoot,
		command,
		files: set.files.filter((f) => !reached.includes(f.path)),
		run,
	});
	const all = collectResults(reached, failed, results);
	const bad = all.filter((r) => !r.passed);
	const label = "phase" in options.scope ? phaseLabel(options.scope.phase) : "landing";
	const text = [
		`${options.plan} ${label}: ${all.length - bad.length} of ${all.length} test file(s) passed`,
		describeTestSet(set, all),
		...bad.map((b) => `\n--- ${b.path}\n${b.output.trim().split("\n").slice(-40).join("\n")}`),
	].join("\n");
	return { text, exitCode: bad.length > 0 ? 1 : 0 };
}
