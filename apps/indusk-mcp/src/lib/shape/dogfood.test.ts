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

	it("T23 — stays green while a phase is open with no outcome yet", async () => {
		// The original coupled these: it took the NEWEST record and demanded that
		// plan already carry an outcome. But the outcome is written at phase
		// CLOSE, so between opening a phase and finishing it — the entire time
		// anyone is working — this suite went red for following the workflow it
		// documents. It passed only because the plan happened to be closed when
		// it was written.
		const records = await readBoundaries(repoRoot);
		const newest = records[records.length - 1];

		// A record with no outcome yet is the normal mid-phase state. The only
		// thing that must hold is that the plan it names exists.
		const implPath = join(repoRoot, ".indusk", "planning", newest.plan, "impl.md");

		expect(existsSync(implPath), `${newest.plan} has no impl.md`).toBe(true);
	});

	it("some plan in this repo carries a recorded Shape outcome", async () => {
		// A record on its own only proves a phase was opened. The outcome is what
		// proves the review actually ran and said something — the distinction
		// between "did not run" and "nothing to do" that Shape exists to preserve,
		// applied to Shape itself.
		const records = await readBoundaries(repoRoot);
		expect(records.length).toBeGreaterThan(0);

		// ANY plan that has opened a phase, not specifically the newest one —
		// evidence that Shape has really run is a claim about this repository's
		// history, not about whichever phase happens to be open right now.
		const outcomes = [...new Set(records.map((r) => r.plan))]
			.map((plan) => join(repoRoot, ".indusk", "planning", plan, "impl.md"))
			.filter((path) => existsSync(path))
			.flatMap((path) => readFileSync(path, "utf-8").split("\n"))
			.filter((line) => /^\s*-\s+\[[ x]\]\s+Shape\b/.test(line));

		expect(
			outcomes.length,
			"a phase has been opened in this repo, but no plan records a Shape outcome — the review has never run",
		).toBeGreaterThan(0);
	});
});
