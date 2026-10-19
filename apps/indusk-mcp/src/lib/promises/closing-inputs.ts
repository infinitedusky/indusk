import { execRunner, type Runner, runFiles } from "../tests/run-files.js";
import { resolveTestCommand } from "../verify/red-tests.js";
import type { ClauseTestRunner } from "./clause-proof.js";

/**
 * The real inputs closing and landing take (mark-first ADR D2), made at the
 * edge — `indusk promises confirm`, the confirm tool and `indusk plans land` —
 * so the rule in `clause-proof.ts` stays a unit decided from values.
 */

/**
 * Runs clause test files the way every plan test is run (`runFiles`), with the
 * project's own test command (`verify.testRunner` / `verify.testCommand` in
 * `configRoot`'s config), in `codeRoot`. A project naming no test command
 * cannot run them, which is a refusal, never a pass.
 */
export function clauseTestRunner(
	configRoot: string,
	codeRoot: string,
	run: Runner = execRunner,
): ClauseTestRunner {
	return async (files) => {
		const command = await resolveTestCommand(configRoot);
		if (command === null) {
			throw new Error(
				"the project names no test command (verify.testRunner or verify.testCommand in .indusk/config.json)",
			);
		}
		const results = await runFiles({
			root: codeRoot,
			command,
			files: files.map((path) => ({ path, reason: "proves a clause" })),
			run,
		});
		return results.map((r) => ({ file: r.path, passed: r.passed }));
	};
}
