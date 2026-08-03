import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findEscapingPaths } from "./bash-gate.js";
import { checkGoalposts, snapshotTrajectory } from "./goalposts.js";
import { PROBE_ITEM } from "./probe.js";
import { resolveInWorktree } from "./worktree-paths.js";

/**
 * T17 — behavior parity across the Phase 7 decomposition.
 *
 * Each extracted module must be importable from its new home and behave
 * exactly as it did inside the file it came from. This is deliberately ONE
 * parity row rather than one row per module: the extractions are
 * structure-preserving and the behavior itself is already pinned by T0–T16.
 * What this file proves is that the SEAMS are real — that the units were
 * genuinely lifted out, not merely re-exported from their old home.
 */

let worktree: string;

beforeEach(async () => {
	worktree = await mkdtemp(join(tmpdir(), "decomp-"));
});

afterEach(async () => {
	await rm(worktree, { recursive: true, force: true });
});

describe("T17 — the decomposed modules are real seams", () => {
	it("worktree-paths owns path containment", () => {
		expect(resolveInWorktree(worktree, "a/b.txt")).toBe(join(worktree, "a/b.txt"));
		expect(() => resolveInWorktree(worktree, "../escape.txt")).toThrow(/escape/i);
	});

	it("bash-gate owns escape scanning", () => {
		expect(findEscapingPaths("echo hi > notes.txt", worktree)).toEqual([]);
		expect(findEscapingPaths("echo pwned > /etc/passwd", worktree)).toContain("/etc/passwd");
	});

	it("goalposts owns the anti-gaming policy", () => {
		// The heading is load-bearing: the parser anchors the table to it, and a
		// fixture without it yields zero rows — which would make the violation
		// assertion below pass or fail for the wrong reason.
		const table = (state: string) =>
			[
				"## Test Trajectory",
				"",
				"| ID | Asserts | Writable at | Passes at | State |",
				"|----|---------|-------------|-----------|-------|",
				`| T1 | a claim | Phase 1 | Phase 1 | ${state} |`,
				"",
			].join("\n");

		expect(
			checkGoalposts(snapshotTrajectory(table("written")), snapshotTrajectory(table("passing"))),
		).toEqual([]);
		expect(
			checkGoalposts(snapshotTrajectory(table("written")), snapshotTrajectory(table("skipped")))
				.length,
		).toBeGreaterThan(0);
	});

	it("probe owns the phase-close probe marker", () => {
		expect(PROBE_ITEM).toContain("probe");
	});
});
