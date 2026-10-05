import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";
import { implText } from "./helpers/plan-fixture.js";

/**
 * planner-promises A19 — tests have a level.
 *
 * test-kinds called a test's level its kind, the word promises already use
 * (behaviour, state, structure). A new impl says `Level` and opts in with
 * `test_levels: required`; the five values are unchanged. The one impl
 * written with the old spelling — `Kind`, `test_kinds: required` — still
 * validates. Driven through the real hook.
 */

const LEVELS = /unit.*contract.*live check.*smoke.*promise/s;
const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

async function validate(impl: string) {
	const root = mkdtempSync(join(tmpdir(), "test-levels-validation-"));
	roots.push(root);
	const dir = join(root, ".indusk", "planning", "seats");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	const path = join(dir, "impl.md");
	writeFileSync(path, impl);
	return runHook("validate-impl-structure.js", {
		tool_name: "Write",
		tool_input: { file_path: path, content: impl },
		cwd: root,
	});
}

const impl = (levels: Array<string | null>) =>
	implText("seats", {
		status: "draft",
		keys: ["test_levels: required"],
		columns: levels.every((l) => l === null) ? [] : ["Level"],
		rows: levels.map((l) => ({ state: "planned", cells: l === null ? {} : { Level: l } })),
	});

describe("planner-promises A19 — a new impl names each test's level", () => {
	it("accepts rows whose level is one of the five", async () => {
		const r = await validate(impl(["unit", "contract", "live check", "smoke", "promise"]));
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("refuses a row whose level is another word, naming the row and the five", async () => {
		const r = await validate(impl(["unit", "example"]));
		expect(r.exitCode, "`example` is not a level").not.toBe(0);
		expect(r.stderr).toMatch(/\bT2\b/);
		expect(r.stderr).toMatch(LEVELS);
		expect(r.stderr, "the refusal says level, the word a new impl uses").toMatch(/level/i);
	});

	it("refuses an opted-in impl with no Level column", async () => {
		const r = await validate(impl([null, null]));
		expect(r.exitCode, "test_levels: required with no Level column").not.toBe(0);
		expect(r.stderr).toMatch(LEVELS);
	});
});

/**
 * The first spelling (test-kinds, 1.61.0): `Kind` and `test_kinds: required`.
 * One archived impl is written with it, and it means what it meant.
 */
describe("planner-promises A19 — the first spelling keeps working", () => {
	const archived = () =>
		readFileSync(
			join(REPO_ROOT, ".indusk", "planning", "archive", "test-kinds", "impl.md"),
			"utf-8",
		);
	/** The archived impl with every row's `Kind` cell set to `kind`, or the column removed. */
	function archivedWith(kind: string | null): string {
		const dropLast = (line: string) => line.replace(/[^|]*\|$/, "");
		return archived()
			.split("\n")
			.map((line) => {
				const isTrajectory =
					/^\| ID \| Asserts \|/.test(line) ||
					line.startsWith("|----|") ||
					/^\| A\d+ \|/.test(line);
				if (!isTrajectory) return line;
				if (kind === null) return dropLast(line);
				return /^\| A\d+ \|/.test(line) ? `${dropLast(line)} ${kind} |` : line;
			})
			.join("\n");
	}

	it("the archived test-kinds impl, which says Kind and test_kinds, still validates", async () => {
		expect(archived()).toMatch(/^test_kinds: required$/m);
		const r = await validate(archived());
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("under the old key a word that is not a level is still refused, naming the five", async () => {
		const r = await validate(archivedWith("example"));
		expect(r.exitCode, "a style word is not a level").not.toBe(0);
		expect(r.stderr).toMatch(LEVELS);
	});

	it("under the old key an impl with no Kind or Level column is still refused", async () => {
		const r = await validate(archivedWith(null));
		expect(r.exitCode, "test_kinds: required with no levels").not.toBe(0);
		expect(r.stderr).toMatch(LEVELS);
	});
});
