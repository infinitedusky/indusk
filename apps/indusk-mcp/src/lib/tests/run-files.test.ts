// promise: a-plan-runs-its-tests-and-what-must-not-break
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { groupByPackage, inSystemTier, packageOf, type Runner, runFiles } from "./run-files.js";

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

it("a file is in the system tier when the package's tiers list names it", () => {
	const tiers = 'export const SYSTEM = [\n\t"src/__tests__/slow.test.ts",\n];';
	expect(inSystemTier(tiers, "src/__tests__/slow.test.ts")).toBe(true);
	expect(inSystemTier(tiers, "src/__tests__/fast.test.ts")).toBe(false);
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
