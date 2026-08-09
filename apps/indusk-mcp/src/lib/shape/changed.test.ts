import { rm, utimes } from "node:fs/promises";
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
		// 30s, not vitest's 5s default: this builds a real repo and spawns ~10
		// `git` subprocesses, which overran 5s under load and made the tripwire
		// flaky. Same call dawn-hook-parity made at `run/swap.test.ts:222`.
	}, 30_000);

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
	}, 30_000);
});

describe("T15 — a file the phase deleted is not offered for review", () => {
	it("excludes a path the phase removed", async () => {
		// `git diff --name-only` reports deletions, so without a filter Shape hands
		// the agent a path that is not there to read. cleanup/oversized.ts already
		// filters to files that still exist; this is the same requirement.
		const root = await makeRepo();
		roots.push(root);
		await writeFixtureFile(root, "src/doomed.ts", "export const d = 1;\n");
		await commitAll(root, "before the phase");
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 2,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-08-09T00:00:00.000Z",
		});

		await rm(join(root, "src", "doomed.ts"));
		await commitAll(root, "delete it");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 2 });

		expect(changed).not.toContain("src/doomed.ts");
	}, 30_000);

	it("reports no code surface for a phase that only deleted files", async () => {
		// Otherwise a deletion-only phase claims a code surface it does not have,
		// and the review is asked to read files that are gone.
		const root = await makeRepo();
		roots.push(root);
		await writeFixtureFile(root, "src/doomed.ts", "export const d = 1;\n");
		await commitAll(root, "before the phase");
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 2,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-08-09T00:00:00.000Z",
		});

		await rm(join(root, "src", "doomed.ts"));
		await commitAll(root, "delete it");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 2 });

		expect(changed).toHaveLength(0);
	}, 30_000);
});

describe("T16 — untracked work belongs to the phase that wrote it", () => {
	it("excludes an untracked file written before this phase opened", async () => {
		// `git ls-files --others` is repo-wide with no phase filter, so an
		// uncommitted file from Phase 1 is attributed to Phase 2 and every phase
		// after it. This is A5's own claim, on the path A5's fixture does not take
		// — that one commits the earlier phase's work, and committed work is
		// scoped by the sha. Untracked work has only its mtime.
		const root = await makeRepo();
		roots.push(root);

		// Phase 1 leaves a scratch file behind, never staged.
		await writeFixtureFile(root, "src/phase-one-scratch.ts", "export const s = 1;\n");
		const anHourAgo = new Date(Date.now() - 3_600_000);
		await utimes(join(root, "src", "phase-one-scratch.ts"), anHourAgo, anHourAgo);

		// Phase 2 opens half an hour later — after the scratch file, before now.
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 2,
			sha: await git(root, "rev-parse", "HEAD"),
			at: new Date(Date.now() - 1_800_000).toISOString(),
		});

		await writeFixtureFile(root, "src/phase-two.ts", "export const t = 2;\n");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 2 });

		expect(changed).toContain("src/phase-two.ts");
		expect(changed).not.toContain("src/phase-one-scratch.ts");
	}, 30_000);
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
	}, 30_000);

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
	}, 30_000);
});
