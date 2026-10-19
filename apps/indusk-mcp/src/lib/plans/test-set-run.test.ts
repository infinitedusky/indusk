// clause: a-plan-runs-its-tests-and-what-must-not-break/its-own-tests
// promise: a-plan-runs-its-tests-and-what-must-not-break
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { type Runner, runFiles } from "../tests/run-files.js";
import { describeTestSet } from "./test-set-run.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
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

it("T15 a test under examples/ runs in its own package", async () => {
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
