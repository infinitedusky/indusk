import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readBoundaries } from "./boundary.js";

/**
 * A21 — Shape has actually been run here, against this repository.
 *
 * Every other test in this suite builds a throwaway repo, which means every one
 * of them passed while the feature had never executed once: no boundary record
 * existed, `prepareShapeReview` had never been called outside a fixture, and the
 * calibration obligation this plan invented had no first data point.
 *
 * Fixtures share the author's blind spots by construction. This asserts on the
 * artifact real use leaves behind, which a fixture cannot fake — the lesson
 * `point-the-tool-at-itself-before-calling-it-done` as a structural check.
 */

/**
 * The repository this test asserts about — resolved by asking git, not by
 * counting `..`.
 *
 * The counted form was five unexplained levels, in the one file whose entire job
 * is asserting on real repo state: move the file and it silently points at some
 * other directory, where the assertions either fail confusingly or pass against
 * the wrong tree. Shape flagged this on its first real run.
 */
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: dirname(fileURLToPath(import.meta.url)),
	encoding: "utf-8",
}).trim();

describe("A21 — the boundary artifact exists because Shape was really used", () => {
	it("this repository has at least one phase-boundary record", async () => {
		expect(
			existsSync(join(repoRoot, ".indusk", "phase-boundary.jsonl")),
			"no phase has ever been opened in this repo — Shape has never run",
		).toBe(true);

		const records = await readBoundaries(repoRoot);

		expect(records.length).toBeGreaterThan(0);
	});

	it("the plan that opened a phase records a Shape outcome for it", async () => {
		// A record on its own only proves a phase was opened. The outcome is what
		// proves the review actually ran and said something — the distinction
		// between "did not run" and "nothing to do" that Shape exists to preserve,
		// applied to Shape itself.
		const records = await readBoundaries(repoRoot);
		expect(records.length).toBeGreaterThan(0);

		const record = records[records.length - 1];
		const implPath = join(repoRoot, ".indusk", "planning", record.plan, "impl.md");
		expect(existsSync(implPath), `${record.plan} has no impl.md`).toBe(true);

		const impl = readFileSync(implPath, "utf-8");
		const outcomes = impl
			.split("\n")
			.filter(
				(line) => /^\s*-\s+\[x\]\s+Shape\b/.test(line) || /^\s*-\s+\[ \]\s+Shape\b/.test(line),
			);

		expect(
			outcomes.length,
			`${record.plan} opened phase ${record.phase} but recorded no Shape outcome`,
		).toBeGreaterThan(0);
	});
});
