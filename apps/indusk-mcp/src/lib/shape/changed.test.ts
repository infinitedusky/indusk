import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { recordPhaseStart } from "./boundary.js";
import { changedFilesForPhase } from "./changed.js";
import { commitAll, git, makeRepo, writeFixtureFile } from "./shape.test-support.js";

/**
 * A5, A12 — what a phase actually changed.
 *
 * Shape reviews the code THIS phase wrote. Getting the scope wrong in either
 * direction breaks it: too wide and earlier phases' code is re-flagged forever;
 * too narrow and real work goes unreviewed.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe("A5 — only this phase's files are in scope", () => {
	it("excludes files an earlier phase changed", async () => {
		const root = await makeRepo();
		roots.push(root);

		// Phase 1's work.
		await writeFixtureFile(root, "src/phase-one.ts", "export const one = 1;\n");
		await commitAll(root, "phase 1");

		// Phase 2 opens here — everything before this point is someone else's.
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 2,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-08-08T00:00:00.000Z",
		});

		await writeFixtureFile(root, "src/phase-two.ts", "export const two = 2;\n");
		await commitAll(root, "phase 2");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 2 });

		expect(changed).toContain("src/phase-two.ts");
		expect(changed).not.toContain("src/phase-one.ts");
	});

	it("includes work that was written but never staged", async () => {
		// An agent that writes code without `git add` has still done the work —
		// the verify suite learned this the hard way (its A19).
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 1,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-08-08T00:00:00.000Z",
		});

		await writeFixtureFile(root, "src/unstaged.ts", "export const x = 1;\n");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 1 });

		expect(changed).toContain("src/unstaged.ts");
	});
});

describe("A12 — InDusk machine state is never counted as work", () => {
	it("excludes the phase-boundary record itself", async () => {
		// The record is written when the phase OPENS. If it counted as a change,
		// every phase would look productive before doing anything — the same
		// self-satisfying-artifact trap the verify ledger sprang on phantom
		// detection.
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 1,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-08-08T00:00:00.000Z",
		});
		await commitAll(root, "open phase 1");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 1 });

		expect(changed.some((p) => p.startsWith(".indusk/"))).toBe(false);
	});

	it("excludes plan documents so editing impl.md is not mistaken for code", async () => {
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 1,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-08-08T00:00:00.000Z",
		});

		await writeFixtureFile(root, join(".indusk", "planning", "demo", "impl.md"), "# plan\n");
		await writeFixtureFile(root, "src/real.ts", "export const x = 1;\n");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 1 });

		expect(changed).toContain("src/real.ts");
		expect(changed.some((p) => p.includes("planning/demo/impl.md"))).toBe(false);
	});
});
