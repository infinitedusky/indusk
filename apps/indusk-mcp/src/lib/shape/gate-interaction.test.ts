import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listOversizedChangedFiles } from "../cleanup/oversized.js";
import { getPhaseCompletion, parseImplString } from "../impl-parser.js";
import { collectCraftRules } from "./rules.js";
import { commitAll, git, implWithPhase, makeRepo, writeFixtureFile } from "./shape.test-support.js";

/**
 * A3, A9 — how Shape sits against machinery that already exists.
 *
 * Both are writable today: A3 asserts current `check-gates`/phase-completion
 * behavior, and A9 asserts that cleanup's scan is unaffected by Shape. A9's
 * answer is trivially true right now, and the point is that it must STAY true —
 * it is the other half of the intra-unit/inter-file line, guarding against
 * "Shape reviewed it" quietly meaning nobody looks again.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe("A3 — an unchecked Shape item keeps the phase open", () => {
	it("a phase with an outstanding item is not complete", () => {
		const withFinding = implWithPhase({
			phase: 1,
			items: [
				[true, "build the thing"],
				[false, "Extract the renderer into a named function — react/one-component-per-file"],
			],
			verification: [[true, "tests pass"]],
		});

		const phase = parseImplString(withFinding).phases.find((p) => p.number === 1);
		expect(phase).toBeDefined();
		if (!phase) return;

		expect(getPhaseCompletion(phase).complete).toBe(false);
	});

	it("the same phase completes once the item is checked", () => {
		const resolved = implWithPhase({
			phase: 1,
			items: [
				[true, "build the thing"],
				[true, "Extract the renderer into a named function — react/one-component-per-file"],
			],
			verification: [[true, "tests pass"]],
		});

		const phase = parseImplString(resolved).phases.find((p) => p.number === 1);
		expect(phase).toBeDefined();
		if (!phase) return;

		expect(getPhaseCompletion(phase).complete).toBe(true);
	});
});

describe("A9 — running Shape narrows nothing for cleanup at close", () => {
	it("cleanup's changed-file scan still returns files Shape would have reviewed", async () => {
		const root = await makeRepo();
		roots.push(root);
		await writeFixtureFile(
			root,
			join(".indusk", "config.json"),
			JSON.stringify({ cleanup: { max_file_loc: 5, scopes: [] } }, null, 2),
		);
		await commitAll(root, "config");
		// Work lands on a plan branch — on the trunk, merge-base(main, HEAD) IS
		// HEAD and the diff is vacuously empty (the degenerate case dawn-verify
		// hit). A fixture that ignores this measures nothing.
		await git(root, "checkout", "-q", "-b", "plan/demo");
		const fat = `${Array.from({ length: 40 }, (_, i) => `export const v${i} = ${i};`).join("\n")}\n`;
		await writeFixtureFile(root, "src/one.ts", fat);
		await writeFixtureFile(root, "src/two.ts", fat);
		await commitAll(root, "phase work");

		const flagged = listOversizedChangedFiles(root, "main");

		// Shape leaves no marker that could shrink this set — cleanup at close
		// sees the same files it always would.
		expect(flagged.map((f) => f.path)).toEqual(
			expect.arrayContaining(["src/one.ts", "src/two.ts"]),
		);
		// 30s, not vitest's 5s default — real repo, real git. See changed.test.ts.
	}, 30_000);

	it("the same logic in two files is out of Shape's scope and still in cleanup's", async () => {
		// A8 and A9 hold the two halves of the line separately. This holds them
		// together on ONE fixture, which is the only way to see the gap they are
		// really guarding: if Shape declined a duplicate AND cleanup no longer
		// reported it, "Shape reviewed it" would quietly mean nobody looked.
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);
		await writeFixtureFile(
			root,
			join(".indusk", "config.json"),
			JSON.stringify({ cleanup: { max_file_loc: 5, scopes: [] } }, null, 2),
		);
		await commitAll(root, "config");
		await git(root, "checkout", "-q", "-b", "plan/demo");

		// The same helper, written twice. Each copy is small and unremarkable on
		// its own — the defect is a fact ABOUT THE PAIR, which is exactly what a
		// per-phase review scoped to one phase's files cannot see.
		const duplicated = [
			"export interface Finding { kind: string; detail: string }",
			"",
			"export function formatFinding(f: Finding): string {",
			// Concatenation rather than a template literal purely so this fixture
			// text is not read as an unfinished template string in THIS file.
			'\treturn f.kind + ": " + f.detail;',
			"}",
			"",
			"export function formatAll(fs: Finding[]): string {",
			"\treturn fs.map(formatFinding).join('\\n');",
			"}",
			"",
		].join("\n");
		await writeFixtureFile(root, "src/run/report.ts", duplicated);
		await writeFixtureFile(root, "src/verify/report.ts", duplicated);
		await commitAll(root, "phase work");

		const rules = await collectCraftRules(root, pkg);

		// Shape declines it, in writing. Not silently absent from the rules —
		// declared out of scope, with the owner named.
		const outOfScope = rules.scope.outOfScope.join(" ").toLowerCase();
		expect(outOfScope).toMatch(/duplicat/);
		expect(outOfScope).toMatch(/cleanup/);
		expect(rules.scope.inScope.join(" ").toLowerCase()).not.toMatch(/duplicat/);

		// And cleanup still sees both files at close.
		const flagged = listOversizedChangedFiles(root, "main").map((f) => f.path);
		expect(flagged).toEqual(expect.arrayContaining(["src/run/report.ts", "src/verify/report.ts"]));
	}, 30_000);
});
