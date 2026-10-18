import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

/**
 * How a set of test files is run: package by package, a system-tier file under
 * its package's system config, each file's own verdict read from the JSON
 * report. The plan's test set (`plans/test-set-run.ts`) and phase verification
 * (`verify/red-tests.ts`) both run test files here, so a file is run one way.
 *
 * The one place a process starts is the `Runner` the caller hands in, so the
 * rest is asserted with a fake and never starts Vitest.
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

/** Whether `file` is listed in a package's system tier (`vitest.tiers.ts`), where the everyday config does not run it. */
export function inSystemTier(tiersSource: string, file: string): boolean {
	return tiersSource.includes(`"${file}"`);
}

/** A package's system-tier Vitest config, which its default config does not run. */
export const SYSTEM_CONFIG = "vitest.system.config.ts";

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
 * One invocation for the files of a tier under Vitest, which takes many; a
 * runner that takes a single file (`node file`) gets one invocation per file.
 */
function inBatches(
	command: { args: string[] },
	files: string[],
	extra: string[],
): Array<{ files: string[]; extra: string[] }> {
	if (files.length === 0) return [];
	if (command.args.includes("vitest")) return [{ files, extra }];
	return files.map((file) => ({ files: [file], extra }));
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
		const batches = [
			...inBatches(options.command, everyday, []),
			...inBatches(options.command, system, ["--config", SYSTEM_CONFIG]),
		];
		for (const batch of batches) {
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
	for (const batch of inBatches(options.command, rootLevel, [])) {
		const ran = await runBatch(options, options.root, batch);
		for (const path of batch.files)
			results.push({
				path,
				reason: reasonOf.get(path) ?? "",
				passed: ran.verdict(path),
				output: ran.output,
			});
	}
	return results;
}
