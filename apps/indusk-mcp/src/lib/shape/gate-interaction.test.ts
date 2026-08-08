import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listOversizedChangedFiles } from "../cleanup/oversized.js";
import { getPhaseCompletion, parseImplString } from "../impl-parser.js";
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
	});
});
