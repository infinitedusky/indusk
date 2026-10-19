import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { phaseLabel } from "../impl-headings.js";
import { resolveImplPath } from "../impl-parser.js";
import { parseBriefContract } from "../promises/brief-contract.js";
import { readPromises } from "../promises/registry.js";
import { execRunner, type Runner, runFiles } from "../tests/run-files.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { resolveTestCommand } from "../verify/red-tests.js";
import { isRootsRefusal, resolveExecutionRoots } from "../worktree/roots.js";
import { PlanCommandRefusal } from "./plan-branch.js";
import { planTestSet, type TestSet, type TestSetReads, type TestSetScope } from "./test-set.js";
import { describeTestSet } from "./test-set-run.js";

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

/** The reads the test set takes: rows, Must-not-break names, the registry. */
export function readsFor(root: string, plan: string): TestSetReads {
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

export async function plansTestsOutcome(
	root: string,
	options: PlanTestsOptions,
): Promise<PlanTestsOutcome> {
	const roots = resolveExecutionRoots(root, options.plan);
	if (isRootsRefusal(roots)) throw new PlanCommandRefusal(roots.error);
	const set: TestSet = planTestSet(readsFor(root, options.plan), options.scope);

	if (options.list) {
		return {
			text: `${describeTestSet(set)}\n\n--list runs nothing.`,
			exitCode: 0,
		};
	}

	const run = options.run ?? execRunner;
	const command = await resolveTestCommand(root);
	if (command === null) {
		throw new PlanCommandRefusal(
			"the project names no test command (verify.testRunner or verify.testCommand in .indusk/config.json), so the plan's tests cannot be run",
		);
	}
	const results = await runFiles({
		root: roots.codeRoot,
		command,
		files: set.files,
		run,
	});
	const bad = results.filter((r) => !r.passed);
	const label = "phase" in options.scope ? phaseLabel(options.scope.phase) : "landing";
	const text = [
		`${options.plan} ${label}: ${results.length - bad.length} of ${results.length} test file(s) passed`,
		describeTestSet(set, results),
		...bad.map((b) => `\n--- ${b.path}\n${b.output.trim().split("\n").slice(-40).join("\n")}`),
	].join("\n");
	return { text, exitCode: bad.length > 0 ? 1 : 0 };
}
