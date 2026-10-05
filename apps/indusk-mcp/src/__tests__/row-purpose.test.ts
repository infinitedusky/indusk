import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { implText } from "./helpers/plan-fixture.js";

/**
 * promise: every-test-says-what-it-is-for — planner-promises A5.
 *
 * An impl that sets `test_purpose: required` gives every test row a `For`
 * cell: the promise it proves, the lesson it guards, or the reason it needs
 * neither. A row that says none of these is refused when the impl is written,
 * naming the row. Driven through the real hook. (Whether a named promise or
 * lesson exists is the contract check's, A6.)
 */

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

async function validate(impl: string) {
	const root = mkdtempSync(join(tmpdir(), "row-purpose-"));
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

// `draft`, so the rule under test is the row's own shape and nothing that
// needs a registry (the contract check runs once an impl is past draft).
const impl = (cells: Array<string | null>, keys = ["test_purpose: required"]) =>
	implText("seats", {
		status: "draft",
		keys,
		columns: cells.every((c) => c === null) ? [] : ["For"],
		rows: cells.map((c) => ({ state: "planned", cells: c === null ? {} : { For: c } })),
	});

describe("planner-promises A5 — every test row says what it is for", () => {
	it("accepts rows that name a promise, name a lesson, or give a reason", async () => {
		const r = await validate(
			impl([
				"promise: seat-never-double-booked",
				"lesson: a-seat-is-held-in-one-statement",
				"a regression guard over the old seat map",
				"promise: seat-never-double-booked, lesson: a-seat-is-held-in-one-statement",
			]),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("refuses a row whose For cell is empty, naming the row", async () => {
		const r = await validate(impl(["promise: seat-never-double-booked", ""]));
		expect(r.exitCode, "a row that says nothing about what it is for").not.toBe(0);
		expect(r.stderr).toMatch(/\bT2\b/);
		expect(r.stderr).toMatch(/promise|lesson|reason/);
	});

	it("refuses an opted-in impl with no For column at all", async () => {
		const r = await validate(impl([null, null]));
		expect(r.exitCode, "test_purpose: required with no For column").not.toBe(0);
		expect(r.stderr).toMatch(/\bFor\b/);
	});

	it("checks nothing in an impl that does not opt in", async () => {
		const r = await validate(impl([null, null], []));
		expect(r.exitCode, r.stderr).toBe(0);
	});
});
