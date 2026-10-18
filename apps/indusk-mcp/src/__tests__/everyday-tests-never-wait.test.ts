import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";
import { SYSTEM as MCP_SYSTEM } from "../../vitest.tiers";

/**
 * promise: everyday-tests-never-wait (test-kinds A14, A15).
 *
 * The everyday suite answers "is this rule right?", in seconds, at every
 * phase. A test that starts a server or waits on the wall clock is asking a
 * different question — does our code still fit something we do not own — and
 * belongs in the package's system tier (`vitest.tiers.ts` `SYSTEM`), which
 * runs at landing and on release. Eight such files in the admin once made
 * every phase wait five minutes.
 *
 * So does a test that starts InDusk's command line, git or another Node
 * process, even one that runs and exits (tests-never-make-us-wait, T13/T14):
 * a process start is most of the suite's time. A plan runs such a file when
 * its rows name it or its changes reach it, and the release runs it.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** What starts a server, or waits on the clock. Data: a new way to wait is one row. */
const PATTERNS: Array<{ name: string; re: RegExp; unlessFakeTimers?: boolean }> = [
	{ name: "starts next dev", re: /\bstartNextDev\(/ },
	{ name: "starts an always-on server", re: /\bstartAlwaysOnServer\(/ },
	{ name: "starts a local Jaeger", re: /\bstartLocalJaeger\(/ },
	{ name: "starts two Jaeger sources", re: /\bstartTwoSources\(/ },
	{ name: "starts a detached process", re: /\bspawn\([^)]*detached:\s*true/s },
	// A process start, even one that exits: InDusk's command line, git, or node.
	{ name: "starts the command line", re: /\brunCli(?:Async)?\(/ },
	{
		name: "starts git or node",
		re: /\b(?:spawnSync|execFileSync|spawn|execFile)\(\s*(?:"(?:git|node)"|'(?:git|node)'|process\.execPath\b)/,
	},
	{ name: "sleeps", re: /\bsleep\(\s*[\w.]+/, unlessFakeTimers: true },
	// The wait idiom: a promise resolved after N ms. A deadline timer that fires
	// only when a test fails (\`setTimeout(() => r("still open"), 3_000)\`), or
	// a hanging child's body, waits for nothing on a passing run.
	{
		name: "waits 100 ms or more",
		re: /\bsetTimeout\(\s*(?:r|res|resolve|done|next|ok)\s*,\s*(?:[1-9]\d{2,}|\d{1,3}(?:_\d{3})+)\s*\)/,
		unlessFakeTimers: true,
	},
	// The promise form (`node:timers/promises`): the delay is the first argument.
	{
		name: "waits 100 ms or more",
		re: /\bsetTimeout\(\s*(?:[1-9]\d{2,}|\d{1,3}(?:_\d{3})+)\s*[,)]/,
		unlessFakeTimers: true,
	},
	{
		name: "waits 100 ms or more",
		re: /\bscheduler\.wait\(\s*(?:[1-9]\d{2,}|\d{1,3}(?:_\d{3})+)\s*[,)]/,
		unlessFakeTimers: true,
	},
];

const ADMIN_TIERS = join(REPO, "apps/indusk-admin/vitest.tiers.ts");

/**
 * The admin's SYSTEM list, imported as its vitest config imports it — never
 * read from the file's text, where a line commented out of the array still
 * looks like an entry (test-kinds A22).
 */
export async function adminSystem(tiers: string = ADMIN_TIERS): Promise<string[]> {
	if (!existsSync(tiers)) return [];
	const mod = (await import(pathToFileURL(tiers).href)) as { SYSTEM: string[] };
	return [...mod.SYSTEM];
}

async function packages() {
	return [
		{ dir: "apps/indusk-mcp", system: MCP_SYSTEM },
		{ dir: "apps/indusk-admin", system: await adminSystem() },
		// The seat-holds example runs in the everyday suite too (demo-app-template A9);
		// it has no system tier, so every test there must never wait.
		{ dir: "examples/seat-holds", system: [] },
	];
}

export interface Finding {
	file: string;
	line: number;
	call: string;
}

/** Every server start or wall-clock wait in `source`. */
export function scan(file: string, raw: string): Finding[] {
	// Comment lines are prose, not calls: blank them, keeping line numbers.
	const source = raw
		.split("\n")
		.map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? "" : l))
		.join("\n");
	const fake = /\bvi\.useFakeTimers\(/.test(source);
	const found: Finding[] = [];
	for (const p of PATTERNS) {
		if (p.unlessFakeTimers && fake) continue;
		for (const m of source.matchAll(new RegExp(p.re.source, `${p.re.flags.replace("g", "")}g`))) {
			const line = source.slice(0, m.index).split("\n").length;
			found.push({ file, line, call: `${p.name}: ${m[0].split("\n")[0].trim()}` });
		}
	}
	return found;
}

/** Calls that start a process, directly. */
const DIRECT_START =
	/\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork|runCli|runCliAsync)\(/;

/** A helper module's top-level functions (exported or not) and what each one's body holds. */
function functionsOf(source: string): Array<{ name: string; body: string }> {
	const starts = [
		...source.matchAll(
			/^(export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function|\())/gm,
		),
	];
	return starts.map((m, i) => ({
		name: (m[2] ?? m[3]) as string,
		body: source.slice(m.index, starts[i + 1]?.index ?? source.length),
	}));
}

/** The named imports of `source` from a helper module: local name to [module, exported name]. */
function helperImports(source: string): Map<string, [module: string, name: string]> {
	const imports = new Map<string, [string, string]>();
	for (const m of source.matchAll(
		/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*\bhelpers\/([\w-]+)(?:\.js|\.ts)?["']/g,
	)) {
		for (const part of m[1].split(",")) {
			const [name, local] = part.trim().split(/\s+as\s+/);
			if (name && !part.trim().startsWith("type ")) imports.set(local ?? name, [m[2], name]);
		}
	}
	return imports;
}

/**
 * The functions each helper module exports that start a process, by module
 * name (tests-never-make-us-wait T17): directly, or by calling another such
 * function in the same module or one imported from another helper. Comment
 * lines are prose, not calls. Starters are found by fixpoint: a function joins
 * the set when its body calls one already in it.
 */
export function helperStarters(helpers: Record<string, string>): Map<string, Set<string>> {
	const parsed = Object.entries(helpers).map(([module, raw]) => {
		const source = raw
			.split("\n")
			.map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? "" : l))
			.join("\n");
		return { module, fns: functionsOf(source), imports: helperImports(source) };
	});
	const starters = new Map(parsed.map((p) => [p.module, new Set<string>()]));
	for (const p of parsed)
		for (const f of p.fns) if (DIRECT_START.test(f.body)) starters.get(p.module)?.add(f.name);
	for (let changed = true; changed; ) {
		changed = false;
		for (const p of parsed) {
			const mine = starters.get(p.module) as Set<string>;
			for (const f of p.fns) {
				if (mine.has(f.name)) continue;
				const calls = (name: string) =>
					new RegExp(`\\b${name}\\(`).test(f.body.slice(f.body.indexOf("{")));
				const viaSame = [...mine].some(calls);
				const viaImport = [...p.imports].some(
					([local, [mod, name]]) => starters.get(mod)?.has(name) && calls(local),
				);
				if (viaSame || viaImport) {
					mine.add(f.name);
					changed = true;
				}
			}
		}
	}
	return starters;
}

/** Calls in `source` to a process-starting function imported from a helper module, matched by the imported name. */
export function scanHelperCalls(
	file: string,
	raw: string,
	starters: Map<string, Set<string>>,
): Finding[] {
	const source = raw
		.split("\n")
		.map((l) => (/^\s*(?:\/\/|\*|\/\*|import\b)/.test(l) ? "" : l))
		.join("\n");
	const found: Finding[] = [];
	for (const [local, [module, name]] of helperImports(raw)) {
		if (!starters.get(module)?.has(name)) continue;
		for (const m of source.matchAll(new RegExp(`(?<![\\w.])${local}\\(`, "g"))) {
			const line = source.slice(0, m.index).split("\n").length;
			found.push({ file, line, call: `starts a process through a helper: ${name}(` });
		}
	}
	return found.sort((a, b) => a.line - b.line);
}

/** Whether the suite runs `file` (a package-relative path) every day: not in the system tier, not a helper. */
export function isEveryday(file: string, system: string[]): boolean {
	return !system.includes(file) && !file.includes("/helpers/");
}

/** What the guard finds in `source` at package-relative `file`: nothing when the system tier holds it. */
export function scanEveryday(
	file: string,
	source: string,
	system: string[],
	starters: Map<string, Set<string>> = new Map(),
): Finding[] {
	if (!isEveryday(file, system)) return [];
	const direct = scan(file, source);
	const lines = new Set(direct.map((d) => d.line));
	return [...direct, ...scanHelperCalls(file, source, starters).filter((h) => !lines.has(h.line))];
}

/** The process-starting functions of a package's helper modules, by module name. */
async function packageStarters(pkg: { dir: string }): Promise<Map<string, Set<string>>> {
	const root = join(REPO, pkg.dir);
	const helpers: Record<string, string> = {};
	for (const f of await glob("src/**/helpers/*.ts", { cwd: root, nodir: true })) {
		helpers[basename(f).replace(/\.ts$/, "")] = readFileSync(join(root, f), "utf-8");
	}
	return helperStarters(helpers);
}

async function everydayFiles(pkg: { dir: string; system: string[] }): Promise<string[]> {
	const root = join(REPO, pkg.dir);
	const files = await glob("src/**/*.test.{ts,tsx}", { cwd: root, nodir: true });
	return files.filter((f) => isEveryday(f, pkg.system)).sort();
}

describe("everyday-tests-never-wait", () => {
	it("no everyday test in either package starts a server, a process or waits on the clock (A14, T14)", async () => {
		const findings: Finding[] = [];
		for (const pkg of await packages()) {
			const starters = await packageStarters(pkg);
			for (const f of await everydayFiles(pkg)) {
				// This file names the patterns it looks for.
				if (f.endsWith("everyday-tests-never-wait.test.ts")) continue;
				const source = readFileSync(join(REPO, pkg.dir, f), "utf-8");
				// A helper that starts a process makes its callers start one (T17).
				findings.push(...scanEveryday(join(pkg.dir, f), source, [], starters));
			}
		}
		const report = findings.map((x) => `  ${x.file}:${x.line} — ${x.call}`).join("\n");
		expect(
			findings,
			`These everyday tests start a server or a process (the command line, git, node) or wait on the clock. Give the rule its clock and its reads as inputs, or move the file to its package's vitest.tiers.ts SYSTEM (lesson: everyday-tests-never-wait):\n${report}`,
		).toEqual([]);
	});

	// promise: everyday-tests-never-wait — demo-app-template A9: the seat-holds
	// example runs in the everyday suite too, so the guard reads its tests.
	it("the seat-holds example's tests are scanned too (demo-app-template A9)", async () => {
		const example = (await packages()).find((p) => p.dir === "examples/seat-holds");
		expect(example, "examples/seat-holds is one of the packages the guard reads").toBeDefined();
		if (example) expect(await everydayFiles(example)).toContain("src/seats.test.ts");
	});

	// promise: everyday-tests-never-wait, everyday-suite-stays-fast — ui-promises A25.
	// A look check opens Chromium: it is a contract with the browser, so it lives in
	// the system tier. The generic scan above reads for servers and waits, not for a
	// browser, so this names the look checks' files directly.
	it("a looks*.contract.test.ts file is in its package's system tier (ui-promises A25)", async () => {
		const missing: string[] = [];
		for (const pkg of await packages()) {
			const root = join(REPO, pkg.dir);
			const files = await glob("src/**/looks*.contract.test.ts", { cwd: root, nodir: true });
			for (const f of files) if (!pkg.system.includes(f)) missing.push(join(pkg.dir, f));
		}
		expect(
			missing.sort(),
			`These look checks open a browser and are not in their package's vitest.tiers.ts SYSTEM (lesson: everyday-tests-never-wait):\n${missing.join("\n")}`,
		).toEqual([]);
	});

	// promise: everyday-tests-never-wait — storybook-components A21.
	// Story tests render every story in Chromium: the admin's `storybook` vitest
	// project belongs to the system tier. The tier file names its projects
	// (`SYSTEM_PROJECTS`, as it names its files in `SYSTEM`), and the everyday
	// config — read as vitest reads it, by importing it — runs none of them and
	// includes no `*.stories.*` file in any project it does run.
	it("the admin's storybook project is in the system tier and no everyday project includes stories (A21)", async () => {
		const tiers = (await import(pathToFileURL(ADMIN_TIERS).href)) as { SYSTEM_PROJECTS?: string[] };
		const systemProjects = tiers.SYSTEM_PROJECTS ?? [];
		expect(
			systemProjects,
			"apps/indusk-admin/vitest.tiers.ts must export SYSTEM_PROJECTS naming the `storybook` project (lesson: everyday-tests-never-wait)",
		).toContain("storybook");

		// The config sets two environment variables as it loads; leave the test's own alone.
		const saved = {
			skip: process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART,
			bin: process.env.INDUSK_BIN,
		};
		let projects: Array<{ test?: { name?: string; include?: string[] } }> = [];
		try {
			const config = (await import(
				pathToFileURL(join(REPO, "apps/indusk-admin/vitest.config.ts")).href
			)) as {
				default: { test?: { projects?: typeof projects } };
			};
			projects = config.default.test?.projects ?? [];
		} finally {
			for (const [key, value] of [
				["INDUSK_SKIP_TELEMETRY_AUTOSTART", saved.skip],
				["INDUSK_BIN", saved.bin],
			] as const) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}
		const everyday = projects.filter((p) => !systemProjects.includes(p.test?.name ?? ""));
		expect(
			everyday.map((p) => p.test?.name),
			"an everyday project is one `pnpm test` runs; the storybook project is not among them",
		).not.toContain("storybook");
		for (const p of everyday) {
			const stories = (p.test?.include ?? []).filter((glob) => glob.includes(".stories."));
			expect(stories, `everyday project ${p.test?.name} includes story files`).toEqual([]);
		}
	});

	it("a short timer, a comment and a string do not trip the guard (A15)", () => {
		const source = [
			`const out = spawnSync(bin, ["rev-parse", "HEAD"], { cwd });`,
			`setTimeout(resolve, 50);`,
			`setTimeout(() => r("still open after 3 s"), 3_000);`,
			`const child = "setTimeout(() => {}, 60_000)";`,
			`//     await sleep(500); // let Jaeger index`,
			` * the evaluator is detached: startNextDev( is not called here`,
		].join("\n");
		expect(scan("fixture.test.ts", source)).toEqual([]);
	});

	it("fake timers make a timer a fake wait, not a real one", () => {
		const source = `vi.useFakeTimers();\nsetTimeout(done, 6_000);\nawait sleep(6_000);`;
		expect(scan("fixture.test.ts", source)).toEqual([]);
	});

	it("a wait in the promise form of timers is caught too (A21)", () => {
		const source = [
			`import { setTimeout } from "node:timers/promises";`,
			"await setTimeout(5_000);",
			"await scheduler.wait(5_000);",
		].join("\n");
		expect(scan("fixture.test.ts", source).map((f) => f.line)).toEqual([2, 3]);
	});

	it("the admin's tier list is read as vitest reads it — a line commented out of SYSTEM is everyday (A22)", async () => {
		const real = await adminSystem();
		const dir = mkdtempSync(join(tmpdir(), "never-wait-tiers-"));
		try {
			const copy = join(dir, "vitest.tiers.ts");
			writeFileSync(
				copy,
				readFileSync(ADMIN_TIERS, "utf-8").replace(`"${real[0]}",`, `// "${real[0]}",`),
			);
			expect(
				await adminSystem(copy),
				"vitest runs the commented-out file as everyday",
			).not.toContain(real[0]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	// promise: everyday-tests-never-wait — tests-never-make-us-wait T13.
	it("a test that starts the command line, git or node is refused, naming the call; in the system tier it is not (T13)", () => {
		const source = [
			`const r = await runCli(["status"], { cwd });`,
			`const a = await runCliAsync(["plans"], { cwd });`,
			`const g = spawnSync("git", ["rev-parse", "HEAD"], { cwd });`,
			`execFileSync('git', ["init"]);`,
			`execFile(process.execPath, [cli, "promises", "check"], done);`,
			`const n = spawn("node", [cli, "status"], { stdio: "pipe" });`,
		].join("\n");
		const file = "src/__tests__/fixture.test.ts";
		const found = scanEveryday(file, source, []);
		expect(found.map((f) => f.line).sort()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(found.every((f) => f.file === file)).toBe(true);
		expect(found.find((f) => f.line === 1)?.call).toBe("starts the command line: runCli(");
		expect(found.find((f) => f.line === 3)?.call).toContain('starts git or node: spawnSync("git"');
		expect(scanEveryday(file, source, [file])).toEqual([]);
		expect(scanEveryday("src/__tests__/helpers/cli.ts", source, [])).toEqual([]);
	});

	// promise: everyday-tests-never-wait — tests-never-make-us-wait T17.
	it("a test calling a helper that starts a process is refused, naming the helper call; in the system tier it is not (T17)", () => {
		const helpers = {
			"hook-runner": [
				'import { spawn } from "node:child_process";',
				"function spawnHook(hook: string) { return spawn(process.execPath, [hook]); }",
				"export function runHook(hook: string) { return spawnHook(hook); }",
				"export async function validateWrite(p: string) { return runHook(p); }",
				"export function fixtureDir() { return '/tmp'; }",
			].join("\n"),
			"test-git": [
				'import { spawnSync } from "node:child_process";',
				"export const git = (cwd: string, args: string[]) => spawnSync('git', args, { cwd });",
				"export function initRepoWithCommit(dir: string) { git(dir, ['init']); }",
				"export const headLabel = 'main';",
			].join("\n"),
		};
		const starters = helperStarters(helpers);
		expect([...(starters.get("hook-runner") ?? [])].sort()).toEqual([
			"runHook",
			"spawnHook",
			"validateWrite",
		]);
		expect([...(starters.get("test-git") ?? [])].sort()).toEqual(["git", "initRepoWithCommit"]);

		const source = [
			'import { fixtureDir, validateWrite } from "./helpers/hook-runner.js";',
			'import { git as run, headLabel } from "../helpers/test-git.js";',
			"const d = fixtureDir();",
			"const r = await validateWrite(d);",
			'run(d, ["init"]);',
		].join("\n");
		const file = "src/__tests__/fixture.test.ts";
		const found = scanHelperCalls(file, source, starters);
		expect(found.map((f) => f.line)).toEqual([4, 5]);
		expect(found[0].call).toBe("starts a process through a helper: validateWrite(");
		expect(found[1].call).toBe("starts a process through a helper: git(");
		expect(scanHelperCalls(file, "const x = headLabel;", starters)).toEqual([]);
		expect(scanEveryday(file, source, [], starters).map((f) => f.line)).toEqual([4, 5]);
		expect(scanEveryday(file, source, [file], starters)).toEqual([]);
	});

	it("each pattern catches what it names", () => {
		const source = [
			"await startNextDev({ home });",
			"setTimeout(resolve, 6_000);",
			"await sleep(2_500);",
			`spawn(bin, args, { detached: true, stdio: "ignore" });`,
		].join("\n");
		expect(scan("fixture.test.ts", source).map((f) => f.line)).toEqual([1, 4, 3, 2]);
	});
});
