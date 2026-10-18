import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { TestSet } from "./test-set.js";

/**
 * Running a plan's test set (tests-never-make-us-wait ADR D2 and D3).
 *
 * `planTestSet` decides which files; this decides how a package runs them. The
 * deciding parts are pure functions over what was read; the one place a
 * process starts is the `Runner` the caller hands in, so the rest is asserted
 * with a fake and never starts Vitest.
 *
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 */

const execFileAsync = promisify(execFile);

/** What a started command came to: its exit code and what it printed. */
export interface RunResult {
	code: number;
	output: string;
}

/** Starts a command in a directory. The only thing here that starts a process. */
export type Runner = (command: string, args: string[], cwd: string) => Promise<RunResult>;

export const execRunner: Runner = async (command, args, cwd) => {
	try {
		const { stdout, stderr } = await execFileAsync(command, args, {
			cwd,
			maxBuffer: 64 * 1024 * 1024,
		});
		return { code: 0, output: stdout + stderr };
	} catch (err) {
		const e = err as { code?: number | string; stdout?: string; stderr?: string };
		return {
			code: typeof e.code === "number" ? e.code : 1,
			output: `${e.stdout ?? ""}${e.stderr ?? ""}`,
		};
	}
};

/** The package a repo-relative path belongs to (`apps/<x>` or `packages/<x>`), or null at the root. */
export function packageOf(path: string): string | null {
	const m = /^((?:apps|packages)\/[^/]+)\//.exec(path);
	return m ? m[1] : null;
}

/** Paths grouped by the package they belong to, each made package-relative; root-level paths are dropped. */
export function groupByPackage(paths: readonly string[]): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	for (const path of paths) {
		const pkg = packageOf(path);
		if (!pkg) continue;
		const list = groups.get(pkg) ?? [];
		list.push(path.slice(pkg.length + 1));
		groups.set(pkg, list);
	}
	return groups;
}

/** A path Vitest could trace imports from. A document or a data file reaches no test. */
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
export const tracedFiles = (paths: readonly string[]): string[] =>
	paths.filter((p) => CODE_FILE.test(p));

/** The repo-relative test files a Vitest JSON report names (`testResults[].name`, absolute). */
export function reachedFromReport(reportJson: string, root: string): string[] {
	const report = JSON.parse(reportJson) as { testResults?: Array<{ name?: string }> };
	const names = (report.testResults ?? []).flatMap((r) => (r.name ? [r.name] : []));
	return names.map((name) => relative(root, resolve(root, name)));
}

/** Whether `file` is listed in a package's system tier (`vitest.tiers.ts`), where the everyday config does not run it. */
export function inSystemTier(tiersSource: string, file: string): boolean {
	return tiersSource.includes(`"${file}"`);
}

/**
 * The test files the plan's changes reach, found by running Vitest's related
 * mode in each package a change is in. Vitest cannot list them without running
 * them, so they ran there and are not run again (ADR D2).
 */
export async function findReached(options: {
	root: string;
	changed: readonly string[];
	run: Runner;
}): Promise<{ reached: string[]; failed: Array<{ path: string; output: string }> }> {
	const reached: string[] = [];
	const failed: Array<{ path: string; output: string }> = [];
	for (const [pkg, files] of groupByPackage(tracedFiles(options.changed))) {
		const cwd = join(options.root, pkg);
		const tmp = mkdtempSync(join(tmpdir(), "plan-tests-"));
		const out = join(tmp, "report.json");
		try {
			const result = await options.run(
				"npx",
				["vitest", "related", ...files, "--run", "--reporter=json", `--outputFile.json=${out}`],
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

/** One file's verdict. */
export interface FileResult {
	path: string;
	reason: string;
	passed: boolean;
	output: string;
}

/**
 * Run the files a package's own Vitest config can run, in one invocation per
 * package; a file in a package's system tier runs under that package's system
 * config instead. The command is the project's own (`resolveTestCommand`).
 */
export async function runFiles(options: {
	root: string;
	command: { command: string; args: string[] };
	files: ReadonlyArray<{ path: string; reason: string }>;
	run: Runner;
}): Promise<FileResult[]> {
	const results: FileResult[] = [];
	const reasonOf = new Map(options.files.map((f) => [f.path, f.reason]));
	const groups = groupByPackage(options.files.map((f) => f.path));
	const rootLevel = options.files.filter((f) => !packageOf(f.path)).map((f) => f.path);

	for (const [pkg, files] of groups) {
		const cwd = join(options.root, pkg);
		const tiersFile = join(cwd, "vitest.tiers.ts");
		const tiers = existsSync(tiersFile) ? readFileSync(tiersFile, "utf-8") : "";
		const system = files.filter((f) => inSystemTier(tiers, f));
		const everyday = files.filter((f) => !system.includes(f));
		const batches: Array<{ files: string[]; extra: string[] }> = [
			{ files: everyday, extra: [] },
			{ files: system, extra: ["--config", "vitest.system.config.ts"] },
		];
		for (const batch of batches) {
			if (batch.files.length === 0) continue;
			const r = await options.run(
				options.command.command,
				[...options.command.args, ...batch.extra, ...batch.files],
				cwd,
			);
			for (const f of batch.files) {
				const path = `${pkg}/${f}`;
				results.push({
					path,
					reason: reasonOf.get(path) ?? "",
					passed: r.code === 0,
					output: r.output,
				});
			}
		}
	}
	if (rootLevel.length > 0) {
		const r = await options.run(
			options.command.command,
			[...options.command.args, ...rootLevel],
			options.root,
		);
		for (const path of rootLevel)
			results.push({
				path,
				reason: reasonOf.get(path) ?? "",
				passed: r.code === 0,
				output: r.output,
			});
	}
	return results;
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
