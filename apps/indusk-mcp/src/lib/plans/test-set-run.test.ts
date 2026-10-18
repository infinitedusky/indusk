// clause: a-plan-runs-its-tests-and-what-must-not-break/its-own-tests
// clause: a-plan-runs-its-tests-and-what-must-not-break/what-its-changes-reach
// promise: a-plan-runs-its-tests-and-what-must-not-break
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
	collectResults,
	describeTestSet,
	findReached,
	groupByPackage,
	inSystemTier,
	packageOf,
	type Runner,
	reachedFromReport,
	runFiles,
	tracedFiles,
} from "./test-set-run.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Which folders hold a Vitest config, as the package rule reads them. */
const configured =
	(...dirs: string[]) =>
	(dir: string) =>
		dirs.includes(dir);

it("a path belongs to the nearest folder above it with a Vitest config, or to none", () => {
	const has = configured("apps/indusk-mcp", "packages/x", "examples/demo");
	expect(packageOf("apps/indusk-mcp/src/a.ts", has)).toBe("apps/indusk-mcp");
	expect(packageOf("packages/x/y.ts", has)).toBe("packages/x");
	expect(packageOf("examples/demo/src/x.ts", has)).toBe("examples/demo");
	expect(packageOf("vitest.config.ts", has)).toBeNull();
	expect(packageOf("apps/no-config/src/a.ts", has)).toBeNull();
});

it("changed files are grouped per package and made package-relative", () => {
	const groups = groupByPackage(
		["apps/a/src/x.ts", "apps/a/src/y.ts", "apps/b/z.ts", "root.ts"],
		configured("apps/a", "apps/b"),
	);
	expect([...groups]).toEqual([
		["apps/a", ["src/x.ts", "src/y.ts"]],
		["apps/b", ["z.ts"]],
	]);
});

it("a document is not handed to the related run", () => {
	expect(tracedFiles(["a.ts", "b.tsx", "c.md", "e.mjs"])).toEqual(["a.ts", "b.tsx", "e.mjs"]);
});

it("a report's absolute test names become repo-relative paths", () => {
	const report = JSON.stringify({ testResults: [{ name: "/repo/apps/a/src/x.test.ts" }] });
	expect(reachedFromReport(report, "/repo")).toEqual(["apps/a/src/x.test.ts"]);
});

it("a file is in the system tier when the package's tiers list names it", () => {
	const tiers = 'export const SYSTEM = [\n\t"src/__tests__/slow.test.ts",\n];';
	expect(inSystemTier(tiers, "src/__tests__/slow.test.ts")).toBe(true);
	expect(inSystemTier(tiers, "src/__tests__/fast.test.ts")).toBe(false);
});

it("the related run reads the reached files from the report each package writes", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "apps/a"), { recursive: true });
	writeFileSync(join(root, "apps/a/vitest.config.ts"), "export default {};\n");
	const calls: Array<{ args: string[]; cwd: string }> = [];
	const run: Runner = async (_c, args, cwd) => {
		calls.push({ args, cwd });
		const out = args.find((a) => a.startsWith("--outputFile.json="))?.split("=")[1] ?? "";
		writeFileSync(
			out,
			JSON.stringify({ testResults: [{ name: join(cwd, "src/x.test.ts"), status: "passed" }] }),
		);
		return { code: 0, output: "" };
	};
	const found = await findReached({ root, changed: ["apps/a/src/x.ts", "docs.md"], run });
	expect(found.reached).toEqual(["apps/a/src/x.test.ts"]);
	expect(calls).toHaveLength(1);
	expect(calls[0].cwd).toBe(join(root, "apps/a"));
	expect(calls[0].args.slice(0, 3)).toEqual(["vitest", "related", "src/x.ts"]);
});

it("a package with no Vitest config of its own has no tests to reach and is not searched", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "apps/docs/src"), { recursive: true });
	const calls: string[] = [];
	const run: Runner = async (_c, _args, cwd) => {
		calls.push(cwd);
		return { code: 1, output: "No projects were found" };
	};
	const found = await findReached({ root, changed: ["apps/docs/src/config.ts"], run });
	expect(calls).toEqual([]);
	expect(found).toEqual({ reached: [], failed: [] });
});

it("a package with a system config is searched under it too, and the reached files are the union", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "apps/a"), { recursive: true });
	writeFileSync(join(root, "apps/a/vitest.config.ts"), "export default {};\n");
	writeFileSync(join(root, "apps/a/vitest.system.config.ts"), "export default {};\n");
	const calls: string[][] = [];
	const run: Runner = async (_c, args, cwd) => {
		calls.push(args);
		const system = args.includes("vitest.system.config.ts");
		const out = args.find((a) => a.startsWith("--outputFile.json="))?.split("=")[1] ?? "";
		const name = join(cwd, system ? "src/x.contract.test.ts" : "src/x.test.ts");
		writeFileSync(out, JSON.stringify({ testResults: [{ name, status: "passed" }] }));
		return { code: 0, output: "" };
	};
	const found = await findReached({ root, changed: ["apps/a/src/x.ts"], run });
	expect(calls).toHaveLength(2);
	expect(calls[1]).toEqual(expect.arrayContaining(["--config", "vitest.system.config.ts"]));
	expect(found.reached.sort()).toEqual(["apps/a/src/x.contract.test.ts", "apps/a/src/x.test.ts"]);
});

it("a failed related run is a failure naming the file the report marks failed", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "apps/a"), { recursive: true });
	writeFileSync(join(root, "apps/a/vitest.config.ts"), "export default {};\n");
	const run: Runner = async (_c, args, cwd) => {
		const out = args.find((a) => a.startsWith("--outputFile.json="))?.split("=")[1] ?? "";
		writeFileSync(
			out,
			JSON.stringify({ testResults: [{ name: join(cwd, "src/x.test.ts"), status: "failed" }] }),
		);
		return { code: 1, output: "boom" };
	};
	const found = await findReached({ root, changed: ["apps/a/src/x.ts"], run });
	expect(found.failed.map((f) => f.path)).toEqual(["apps/a/src/x.test.ts"]);
});

it("files run once per package, and a system-tier file under that package's system config", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "apps/a"), { recursive: true });
	writeFileSync(join(root, "apps/a/vitest.config.ts"), "export default {};\n");
	writeFileSync(join(root, "apps/a/vitest.tiers.ts"), 'export const SYSTEM = ["slow.test.ts"];');
	const calls: string[][] = [];
	const run: Runner = async (_c, args) => {
		calls.push(args);
		return { code: args.includes("vitest.system.config.ts") ? 1 : 0, output: "" };
	};
	const results = await runFiles({
		root,
		command: { command: "npx", args: ["vitest", "run"] },
		files: [
			{ path: "apps/a/fast.test.ts", reason: "row T1" },
			{ path: "apps/a/slow.test.ts", reason: "row T2" },
		],
		run,
	});
	// Each batch is also asked for a JSON report, which gives each file its own verdict.
	expect(calls.every((c) => c.includes("--reporter=json"))).toBe(true);
	expect(calls.every((c) => c.some((a) => a.startsWith("--outputFile.json=")))).toBe(true);
	expect(
		calls.map((c) =>
			c.filter((a) => a !== "--reporter=json" && !a.startsWith("--outputFile.json=")),
		),
	).toEqual([
		["vitest", "run", "fast.test.ts"],
		["vitest", "run", "--config", "vitest.system.config.ts", "slow.test.ts"],
	]);
	expect(results.map((r) => [r.path, r.passed])).toEqual([
		["apps/a/fast.test.ts", true],
		["apps/a/slow.test.ts", false],
	]);
});

it("the printed set gives each file its reason and names what is not run", () => {
	const text = describeTestSet(
		{
			files: [{ path: "a.test.ts", reason: "row T1" }],
			withoutTests: ["bare"],
			manual: ["T9: signed off"],
		},
		[{ path: "a.test.ts", reason: "row T1", passed: false, output: "" }],
	);
	expect(text).toContain("FAIL a.test.ts  (row T1)");
	expect(text).toContain("no tests: bare");
	expect(text).toContain("manual, not run: T9: signed off");
});

it("a related run that failed without naming a file still makes the set red", () => {
	const all = collectResults([], [{ path: "(a related run)", output: "boom" }], []);
	expect(all.map((r) => r.passed)).toEqual([false]);
});

// Build Phase 4 falsification.

/** A fake Vitest that writes the JSON report each batch is asked for, with the given verdict per file name. */
const reporting =
	(
		status: Record<string, "passed" | "failed">,
		code: number,
		calls: Array<{ args: string[]; cwd: string }> = [],
	): Runner =>
	async (_c, args, cwd) => {
		calls.push({ args, cwd });
		const out = args.find((a) => a.startsWith("--outputFile.json="))?.split("=")[1];
		if (out)
			writeFileSync(
				out,
				JSON.stringify({
					testResults: Object.entries(status).map(([name, s]) => ({
						name: join(cwd, name),
						status: s,
					})),
				}),
			);
		return { code, output: "ran" };
	};

it("T15 a test under examples/ runs in its own package, and a change there is searched in it", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "examples/demo/src"), { recursive: true });
	writeFileSync(join(root, "examples/demo/vitest.config.ts"), "export default {};\n");
	const calls: Array<{ args: string[]; cwd: string }> = [];
	const results = await runFiles({
		root,
		command: { command: "npx", args: ["vitest", "run"] },
		files: [{ path: "examples/demo/src/x.test.ts", reason: "row T1" }],
		run: reporting({ "src/x.test.ts": "passed" }, 0, calls),
	});
	expect(calls.map((c) => c.cwd)).toEqual([join(root, "examples/demo")]);
	expect(calls[0].args).toContain("src/x.test.ts");
	expect(results.map((r) => [r.path, r.passed])).toEqual([["examples/demo/src/x.test.ts", true]]);

	const searched: string[] = [];
	await findReached({
		root,
		changed: ["examples/demo/src/x.ts"],
		run: async (_c, _a, cwd) => {
			searched.push(cwd);
			return { code: 0, output: "" };
		},
	});
	expect(searched).toEqual([join(root, "examples/demo")]);
});

it("T16 when one of several files fails, only that file is reported failed", async () => {
	const root = mkdtempSync(join(tmpdir(), "set-run-"));
	dirs.push(root);
	mkdirSync(join(root, "apps/a"), { recursive: true });
	writeFileSync(join(root, "apps/a/vitest.config.ts"), "export default {};\n");
	const files = [
		{ path: "apps/a/ok.test.ts", reason: "row T1" },
		{ path: "apps/a/bad.test.ts", reason: "row T2" },
	];
	const command = { command: "npx", args: ["vitest", "run"] };
	const results = await runFiles({
		root,
		command,
		files,
		run: reporting({ "ok.test.ts": "passed", "bad.test.ts": "failed" }, 1),
	});
	expect(results.map((r) => [r.path, r.passed])).toEqual([
		["apps/a/ok.test.ts", true],
		["apps/a/bad.test.ts", false],
	]);
	// No report written: the whole batch's verdict, as before.
	const none = await runFiles({
		root,
		command,
		files,
		run: async () => ({ code: 1, output: "x" }),
	});
	expect(none.map((r) => r.passed)).toEqual([false, false]);
});

it("T19 a changed JSON file a test imports is handed to the related run; a document is not", () => {
	expect(tracedFiles(["fixture.json", "notes.md", "a.ts"])).toEqual(["fixture.json", "a.ts"]);
});
