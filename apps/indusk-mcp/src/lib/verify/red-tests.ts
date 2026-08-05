import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Trajectory } from "../trajectory/parser.js";
import type { VerifyFinding } from "./verify.js";

/**
 * Red-test detection — the first thing in InDusk that ever checks a trajectory
 * row's `passing` claim against an actual test run.
 *
 * `check-gates` reads the State column and trusts it, and the goalpost guard
 * deliberately permits `planned → written → passing` as honest progress. So the
 * word `passing` has always been an unverified self-report — in every lane,
 * including the two Dawn controls. This closes that.
 *
 * Attribution is runner-agnostic by design: the command comes from the
 * project's own `verify` config, the unit is a FILE, and the verdict is the
 * exit code. Parsing a runner's structured output to match per-test tags would
 * be more precise and would survive file moves — and would hardcode tool
 * knowledge into core, which is the extensions' job (maxim 7). If file-level
 * attribution proves too coarse, tags come back as an extension capability.
 */

const execFileAsync = promisify(execFile);

/** Rows whose claim we are entitled to check — they assert they already pass. */
const CLAIMS_GREEN: ReadonlySet<string> = new Set(["passing"]);

export interface TestCommand {
	command: string;
	/** Fixed arguments before the file path. */
	args: string[];
}

/**
 * Resolve a runnable test command from `.indusk/config.json`.
 *
 * `verify.testCommand` is the explicit escape hatch and wins outright — a
 * project whose runner needs an unusual invocation states it rather than
 * hoping core guesses. The derived map covers the common runners only; an
 * unknown runner with no explicit command is a refusal, not a guess.
 */
export async function resolveTestCommand(root: string): Promise<TestCommand | null> {
	let raw: string;
	try {
		raw = await readFile(join(root, ".indusk", "config.json"), "utf8");
	} catch {
		return null;
	}

	let config: {
		verify?: { testCommand?: string; testRunner?: { tool?: string } };
	};
	try {
		config = JSON.parse(raw);
	} catch {
		return null;
	}

	const explicit = config.verify?.testCommand?.trim();
	if (explicit) {
		const [command, ...args] = explicit.split(/\s+/);
		return { command, args };
	}

	switch (config.verify?.testRunner?.tool) {
		case "vitest":
			return { command: "npx", args: ["vitest", "run", "--silent"] };
		case "jest":
			return { command: "npx", args: ["jest"] };
		case "node":
			return { command: "node", args: [] };
		default:
			return null;
	}
}

export interface RedTestResult {
	findings: VerifyFinding[];
	/** Rows claiming `passing` whose truth could not be established. */
	unverifiedRows: string[];
}

/**
 * Run the test files the in-scope rows reference and attribute failures back.
 *
 * A file is executed once no matter how many rows point at it, and a non-zero
 * exit marks EVERY row referencing it. That over-attributes a shared file's
 * failure — conservative in the safe direction, and the alternative (guessing
 * which row inside the file broke) is exactly the runner-specific parsing this
 * design rejects.
 */
export async function detectRedTests(options: {
	root: string;
	trajectory: Trajectory;
	phase: number;
	fullSuite?: boolean;
}): Promise<RedTestResult> {
	// Rows this phase is accountable for that claim to be green already.
	const inScope = options.trajectory.rows.filter(
		(row) => row.passesAt <= options.phase && CLAIMS_GREEN.has(row.state),
	);
	if (inScope.length === 0) return { findings: [], unverifiedRows: [] };

	const command = await resolveTestCommand(options.root);
	if (command === null) {
		// No runnable command: every claim is unchecked. Say so — never silently
		// treat "could not check" as "checked and passed".
		return { findings: [], unverifiedRows: inScope.map((row) => row.id) };
	}

	const unverifiedRows = inScope.filter((row) => !row.test?.length).map((row) => row.id);
	const checkable = inScope.filter((row) => row.test?.length);
	if (checkable.length === 0) return { findings: [], unverifiedRows };

	if (options.fullSuite) {
		const failed = await runFails(options.root, command, []);
		const findings: VerifyFinding[] = failed
			? checkable.map((row) => ({
					kind: "red-test" as const,
					row: row.id,
					message: `Row ${row.id} claims "passing", but the project's full test suite is red (${describe(command, [])}).`,
				}))
			: [];
		return { findings, unverifiedRows };
	}

	// One invocation per distinct file, however many rows point at it.
	const files = [...new Set(checkable.flatMap((row) => row.test ?? []))];
	const failedFiles = new Set<string>();
	for (const file of files) {
		if (await runFails(options.root, command, [file])) failedFiles.add(file);
	}

	const findings: VerifyFinding[] = [];
	for (const row of checkable) {
		const red = (row.test ?? []).filter((file) => failedFiles.has(file));
		if (red.length === 0) continue;
		findings.push({
			kind: "red-test",
			row: row.id,
			message: `Row ${row.id} claims "passing", but its test does not pass: ${red.join(", ")} exited non-zero.`,
		});
	}
	return { findings, unverifiedRows };
}

function describe(command: TestCommand, extra: string[]): string {
	return [command.command, ...command.args, ...extra].join(" ");
}

/** True when the command exits non-zero — the whole verdict, runner-agnostic. */
async function runFails(root: string, command: TestCommand, extra: string[]): Promise<boolean> {
	try {
		await execFileAsync(command.command, [...command.args, ...extra], {
			cwd: root,
			maxBuffer: 32 * 1024 * 1024,
		});
		return false;
	} catch {
		return true;
	}
}
