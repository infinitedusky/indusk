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

/**
 * Whether a folder has a Vitest config of its own. One without (the docs
 * site) has no tests to reach, and Vitest run there would fall back to the
 * root config, whose project globs find nothing from inside a package.
 */
const hasVitestConfig = (dir: string): boolean =>
	["ts", "mts", "js", "mjs"].some((ext) => existsSync(join(dir, `vitest.config.${ext}`)));

/** Whether a repo-relative folder is a package of `root`: it holds a Vitest config. */
export const configuredIn =
	(root: string) =>
	(dir: string): boolean =>
		hasVitestConfig(join(root, dir));

/**
 * The package a repo-relative path belongs to: the nearest folder above it
 * (below the root) that holds a Vitest config, or null. Any workspace folder
 * with its own test setup counts (`apps/*`, `packages/*`, `examples/*`), as
 * the workspace file lists them, not a fixed pair of names.
 */
export function packageOf(path: string, hasConfig: (dir: string) => boolean): string | null {
	const parts = path.split("/").slice(0, -1);
	for (let n = parts.length; n > 0; n--) {
		const dir = parts.slice(0, n).join("/");
		if (hasConfig(dir)) return dir;
	}
	return null;
}

/** Paths grouped by the package they belong to, each made package-relative; root-level paths are dropped. */
export function groupByPackage(
	paths: readonly string[],
	hasConfig: (dir: string) => boolean,
): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	for (const path of paths) {
		const pkg = packageOf(path, hasConfig);
		if (!pkg) continue;
		const list = groups.get(pkg) ?? [];
		list.push(path.slice(pkg.length + 1));
		groups.set(pkg, list);
	}
	return groups;
}

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

/** Whether `file` is listed in a package's system tier (`vitest.tiers.ts`), where the everyday config does not run it. */
export function inSystemTier(tiersSource: string, file: string): boolean {
	return tiersSource.includes(`"${file}"`);
}

/** A package's system-tier Vitest config, which its default config does not run. */
const SYSTEM_CONFIG = "vitest.system.config.ts";

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

/** One file's verdict. */
export interface FileResult {
	path: string;
	reason: string;
	passed: boolean;
	output: string;
}

/**
 * Run one batch of files and give each file its own verdict. A Vitest command
 * is asked for a JSON report and each file's status is read from it; a batch
 * with no report (another runner, a run that died before writing one) keeps
 * the whole batch's exit code for every file.
 */
async function runBatch(
	options: {
		command: { command: string; args: string[] };
		run: Runner;
	},
	cwd: string,
	batch: { files: string[]; extra: string[] },
): Promise<{ output: string; verdict: (file: string) => boolean }> {
	const tmp = mkdtempSync(join(tmpdir(), "plan-tests-"));
	const out = join(tmp, "report.json");
	const isVitest = options.command.args.includes("vitest");
	try {
		const report = isVitest ? ["--reporter=json", `--outputFile.json=${out}`] : [];
		const r = await options.run(
			options.command.command,
			[...options.command.args, ...report, ...batch.extra, ...batch.files],
			cwd,
		);
		const status = existsSync(out) ? statusByFile(readFileSync(out, "utf-8"), cwd) : null;
		return {
			output: r.output,
			verdict: (file) => {
				const own = status?.get(resolve(cwd, file));
				return own === undefined ? r.code === 0 : own !== "failed";
			},
		};
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

/** Each test file's status in a Vitest JSON report, by absolute path; null when the report is not JSON. */
function statusByFile(reportJson: string, cwd: string): Map<string, string> | null {
	try {
		const report = JSON.parse(reportJson) as {
			testResults?: Array<{ name?: string; status?: string }>;
		};
		return new Map(
			(report.testResults ?? []).flatMap((r) =>
				r.name && r.status ? [[resolve(cwd, r.name), r.status] as [string, string]] : [],
			),
		);
	} catch {
		return null;
	}
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
	const hasConfig = configuredIn(options.root);
	const groups = groupByPackage(
		options.files.map((f) => f.path),
		hasConfig,
	);
	const rootLevel = options.files.filter((f) => !packageOf(f.path, hasConfig)).map((f) => f.path);

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
			const ran = await runBatch(options, cwd, batch);
			for (const f of batch.files) {
				const path = `${pkg}/${f}`;
				results.push({
					path,
					reason: reasonOf.get(path) ?? "",
					passed: ran.verdict(f),
					output: ran.output,
				});
			}
		}
	}
	if (rootLevel.length > 0) {
		const ran = await runBatch(options, options.root, { files: rootLevel, extra: [] });
		for (const path of rootLevel)
			results.push({
				path,
				reason: reasonOf.get(path) ?? "",
				passed: ran.verdict(path),
				output: ran.output,
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
