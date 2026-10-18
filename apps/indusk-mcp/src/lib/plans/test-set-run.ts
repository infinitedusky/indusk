import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import {
	configuredIn,
	type FileResult,
	groupByPackage,
	type Runner,
	SYSTEM_CONFIG,
} from "../tests/run-files.js";
import type { TestSet } from "./test-set.js";

/**
 * Running a plan's test set (tests-never-make-us-wait ADR D2 and D3).
 *
 * `planTestSet` decides which files; this finds the files a change reaches and
 * reports the set. How a file is run is `lib/tests/run-files.ts`.
 *
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 */

/** A path Vitest could trace imports from: code, and JSON a test can import. A document reaches no test. */
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json)$/;
export const tracedFiles = (paths: readonly string[]): string[] =>
	paths.filter((p) => CODE_FILE.test(p));

/** The repo-relative test files a Vitest JSON report names (`testResults[].name`, absolute). */
export function reachedFromReport(reportJson: string, root: string): string[] {
	const report = JSON.parse(reportJson) as { testResults?: Array<{ name?: string }> };
	const names = (report.testResults ?? []).flatMap((r) => (r.name ? [r.name] : []));
	return names.map((name) => relative(root, resolve(root, name)));
}

/**
 * The test files the plan's changes reach, found by running Vitest's related
 * mode in each package a change is in, under its default config and, when the
 * package has one, its system config too: a system-tier test that imports a
 * changed file is reached like any other (ADR D2, both tiers). Vitest cannot
 * list them without running them, so they ran there and are not run again.
 */
export async function findReached(options: {
	root: string;
	changed: readonly string[];
	run: Runner;
}): Promise<{ reached: string[]; failed: Array<{ path: string; output: string }> }> {
	const reached: string[] = [];
	const failed: Array<{ path: string; output: string }> = [];
	for (const [pkg, files] of groupByPackage(
		tracedFiles(options.changed),
		configuredIn(options.root),
	)) {
		const cwd = join(options.root, pkg);
		const configs = existsSync(join(cwd, SYSTEM_CONFIG)) ? [[], ["--config", SYSTEM_CONFIG]] : [[]];
		for (const config of configs) {
			const tmp = mkdtempSync(join(tmpdir(), "plan-tests-"));
			const out = join(tmp, "report.json");
			try {
				const result = await options.run(
					"npx",
					[
						"vitest",
						"related",
						...files,
						...config,
						"--run",
						"--passWithNoTests",
						"--reporter=json",
						`--outputFile.json=${out}`,
					],
					cwd,
				);
				if (existsSync(out)) {
					for (const path of reachedFromReport(readFileSync(out, "utf-8"), options.root)) {
						if (!reached.includes(path)) reached.push(path);
					}
				}
				if (result.code !== 0) failed.push(...failedIn(out, options.root, result.output));
			} finally {
				rmSync(tmp, { recursive: true, force: true });
			}
		}
	}
	return { reached, failed };
}

/** The files a related run reports failing, or the whole run named once when no report was written. */
function failedIn(
	reportPath: string,
	root: string,
	output: string,
): Array<{ path: string; output: string }> {
	if (existsSync(reportPath)) {
		const report = JSON.parse(readFileSync(reportPath, "utf-8")) as {
			testResults?: Array<{ name?: string; status?: string }>;
		};
		const bad = (report.testResults ?? []).filter((r) => r.name && r.status === "failed");
		if (bad.length > 0)
			return bad.map((r) => ({ path: relative(root, resolve(root, r.name as string)), output }));
	}
	return [{ path: "(a related run)", output }];
}

/** The set as lines, each file with its reason, then what was named and not run. */
export function describeTestSet(set: TestSet, results?: readonly FileResult[]): string {
	const verdict = new Map((results ?? []).map((r) => [r.path, r.passed]));
	const lines = set.files.map((f) => {
		const v = verdict.get(f.path);
		const mark = v === undefined ? "  " : v ? "ok" : "FAIL";
		return `${mark.padEnd(4)} ${f.path}  (${f.reason})`;
	});
	if (set.withoutTests.length > 0)
		lines.push(
			"",
			`no tests: ${set.withoutTests.join(", ")} (a Must-not-break promise naming no test)`,
		);
	if (set.manual.length > 0) lines.push("", `manual, not run: ${set.manual.join("; ")}`);
	return lines.join("\n");
}

/**
 * Every file's verdict: the files the related run reached (failed by name when
 * its report says so), a related run that failed without naming a file, and the
 * files run after it.
 */
export function collectResults(
	reached: readonly string[],
	failed: ReadonlyArray<{ path: string; output: string }>,
	ran: readonly FileResult[],
): FileResult[] {
	const failure = (path: string) => failed.find((f) => f.path === path);
	return [
		...reached.map((path) => ({
			path,
			reason: "reached",
			passed: !failure(path),
			output: failure(path)?.output ?? "",
		})),
		// A related run that failed without naming a file is still a failure.
		...failed
			.filter((f) => !reached.includes(f.path))
			.map((f) => ({ path: f.path, reason: "reached", passed: false, output: f.output })),
		...ran,
	];
}
