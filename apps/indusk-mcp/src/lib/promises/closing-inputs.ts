import { execRunner, type Runner, runFiles } from "../tests/run-files.js";
import { resolveTestCommand } from "../verify/red-tests.js";
import type { ClauseReports, ClauseTestRunner, SignalReader } from "./clause-proof.js";
import { type ClauseReport, reportsOfClause } from "./clause-standing.js";
import { readPromises } from "./registry.js";
import {
	healthWindowMs,
	JaegerUnreachable,
	readPromiseMarks,
	sourceAdvice,
	WatcherBlind,
} from "./sources.js";
import type { MarkedSpansResult } from "./telemetry.js";

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

/**
 * Asks the local daemon what each clause's signal reported, through the read
 * `indusk promises status` makes (`readPromiseMarks`, source `local`, over the
 * health window; a test run's spans already dropped by `parseMarkedSpan`). The
 * daemon is read once per close, on the first promise asked. A daemon that is
 * not running, or a watcher that is blind, is a failed read naming how to
 * start it — never an empty one. `reads` is the daemon's read; the real one
 * unless a test hands in its own.
 */
export function localSignalReader(
	projectRoot: string,
	reads: typeof readPromiseMarks = readPromiseMarks,
): SignalReader {
	let read: Promise<MarkedSpansResult | Error> | null = null;
	const marks = (): Promise<MarkedSpansResult | Error> => {
		if (read === null) {
			const registry = readPromises(projectRoot);
			if (!registry.ok) {
				return Promise.resolve(new Error(`the promise registry cannot be read in ${projectRoot}`));
			}
			read = reads(projectRoot, registry.registry, {
				source: "local",
				sinceMs: healthWindowMs(projectRoot, registry.registry),
			}).catch((err: unknown) =>
				err instanceof JaegerUnreachable || err instanceof WatcherBlind
					? new Error(`${err.message}. ${sourceAdvice("local", err)}`)
					: (err as Error),
			);
		}
		return read;
	};
	return async (promise): Promise<ClauseReports> => {
		const result = await marks();
		if (result instanceof Error) return { ok: false, reason: result.message };
		const seen = result.byPromise.get(promise.name)?.byClause ?? {};
		const byClause: Record<string, ClauseReport[]> = {};
		for (const [clause, s] of Object.entries(seen)) byClause[clause] = reportsOfClause(s);
		return { ok: true, byClause, heartbeatOk: true };
	};
}
