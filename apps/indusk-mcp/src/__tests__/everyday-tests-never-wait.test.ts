import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";
import { SYSTEM as MCP_SYSTEM } from "../../vitest.tiers";

/**
 * The everyday suite never waits (test-kinds A14, A15).
 *
 * The everyday suite answers "is this rule right?", in seconds, at every
 * phase. A test that starts a server or waits on the wall clock is asking a
 * different question — does our code still fit something we do not own — and
 * belongs in the package's system tier (`vitest.tiers.ts` `SYSTEM`), which
 * runs at landing and on release. Eight such files in the admin once made
 * every phase wait five minutes.
 *
 * A process that runs and exits (`spawnSync`, `execFile` of git or the CLI)
 * is a contract with that tool for one call, and is allowed.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** What starts a server, or waits on the clock. Data: a new way to wait is one row. */
const PATTERNS: Array<{ name: string; re: RegExp; unlessFakeTimers?: boolean }> = [
	{ name: "starts next dev", re: /\bstartNextDev\(/ },
	{ name: "starts an always-on server", re: /\bstartAlwaysOnServer\(/ },
	{ name: "starts a local Jaeger", re: /\bstartLocalJaeger\(/ },
	{ name: "starts two Jaeger sources", re: /\bstartTwoSources\(/ },
	{ name: "starts a detached process", re: /\bspawn\([^)]*detached:\s*true/s },
	{ name: "sleeps", re: /\bsleep\(\s*[\w.]+/, unlessFakeTimers: true },
	// The wait idiom: a promise resolved after N ms. A deadline timer that fires
	// only when a test fails (\`setTimeout(() => r("still open"), 3_000)\`), or
	// a hanging child's body, waits for nothing on a passing run.
	{
		name: "waits 100 ms or more",
		re: /\bsetTimeout\(\s*(?:r|res|resolve|done|next|ok)\s*,\s*(?:[1-9]\d{2,}|\d{1,3}(?:_\d{3})+)\s*\)/,
		unlessFakeTimers: true,
	},
];

const PACKAGES = [
	{ dir: "apps/indusk-mcp", system: MCP_SYSTEM },
	{ dir: "apps/indusk-admin", system: adminSystem() },
];

function adminSystem(): string[] {
	const tiers = join(REPO, "apps/indusk-admin/vitest.tiers.ts");
	if (!existsSync(tiers)) return [];
	return [...readFileSync(tiers, "utf-8").matchAll(/"(src\/[^"]+\.test\.tsx?)"/g)].map((m) => m[1]);
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

async function everydayFiles(pkg: { dir: string; system: string[] }): Promise<string[]> {
	const root = join(REPO, pkg.dir);
	const files = await glob("src/**/*.test.{ts,tsx}", { cwd: root, nodir: true });
	const system = new Set(pkg.system);
	return files.filter((f) => !system.has(f) && !f.includes("/helpers/")).sort();
}

describe("everyday-tests-never-wait", () => {
	it("no everyday test in either package starts a server or waits on the clock (A14)", async () => {
		const findings: Finding[] = [];
		for (const pkg of PACKAGES) {
			for (const f of await everydayFiles(pkg)) {
				// This file names the patterns it looks for.
				if (f.endsWith("everyday-tests-never-wait.test.ts")) continue;
				findings.push(...scan(join(pkg.dir, f), readFileSync(join(REPO, pkg.dir, f), "utf-8")));
			}
		}
		const report = findings.map((x) => `  ${x.file}:${x.line} — ${x.call}`).join("\n");
		expect(
			findings,
			`These everyday tests start a server or wait on the clock. Give the rule its clock and its reads as inputs, or move the file to its package's vitest.tiers.ts SYSTEM (lesson: everyday-tests-never-wait):\n${report}`,
		).toEqual([]);
	});

	it("a process that runs and exits does not trip the guard (A15)", () => {
		const source = [
			`const out = spawnSync("git", ["rev-parse", "HEAD"], { cwd });`,
			`execFile(process.execPath, [cli, "promises", "check"], done);`,
			`const r = spawn("node", [cli, "status"], { stdio: "pipe" });`,
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
