import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { token } from "../lib/tokens.js";
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

// Built, never spelled: a literal token in a test source reads as a citation
// to the repository's own registry check.
const PROMISE = token("promise", "seat-never-double-booked");
const LESSON = token("lesson", "a-seat-is-held-in-one-statement");

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
			impl([PROMISE, LESSON, "a regression guard over the old seat map", `${PROMISE}, ${LESSON}`]),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("refuses a row whose For cell is empty, naming the row", async () => {
		const r = await validate(impl([PROMISE, ""]));
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

/**
 * planner-promises A30 — a purpose is a token or a reason, never something
 * between. A cell that tries to name a promise or a lesson and is not written
 * as one used to read as the reason the row needs neither, so the row named
 * nothing and the plan's promise looked unproven with no refusal anywhere. A
 * cell that is only a mark is not a reason either.
 */
describe("planner-promises A30 — a purpose that is neither a token nor a reason", () => {
	it.each([
		["the name in backticks", "promise: `seat-never-double-booked`"],
		["words after the name", `${PROMISE} (the seat map)`],
		["and in place of a comma", `${PROMISE} and ${LESSON}`],
		["a dash", "-"],
		["n/a", "n/a"],
		["TBD", "TBD"],
	])("refuses %s, naming the row", async (_why, cell) => {
		const r = await validate(impl([PROMISE, cell]));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/\bT2\b/);
	});

	it("still accepts a plain reason", async () => {
		const r = await validate(
			impl(["a regression guard", "renames the column; keeps the old spelling"]),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

/**
 * planner-promises A31 — a row the table cannot hold is refused by name. The
 * parser dropped a row whose cell count was not the header's, so every rule
 * above it passed the row, and the promise it named read as named by none.
 */
describe("planner-promises A31 — a row with a cell missing or too many", () => {
	const broken = (mangle: (line: string) => string) => {
		const text = impl([PROMISE, "a regression guard"]);
		return text
			.split("\n")
			.map((l) => (l.startsWith("| T2 |") ? mangle(l) : l))
			.join("\n");
	};

	it("refuses a row one cell short, naming it", async () => {
		const r = await validate(broken((l) => l.replace(/ \| a regression guard \|$/, " |")));
		expect(
			r.exitCode,
			`lesson: a-reader-that-drops-what-it-cannot-read-passes-every-rule-above-it\n${r.stderr}`,
		).toBe(2);
		// About the row's cells: a dangling Verification reference also names T2.
		expect(r.stderr).toMatch(/T2[^\n]*cells?|cells?[^\n]*T2/i);
	});

	it("refuses a row one cell long, naming it", async () => {
		const r = await validate(broken((l) => `${l} extra |`));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/T2[^\n]*cells?|cells?[^\n]*T2/i);
	});
});
