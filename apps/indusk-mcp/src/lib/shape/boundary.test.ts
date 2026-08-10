import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findPhaseStart, readBoundaries, recordPhaseStart } from "./boundary.js";
import { changedFilesForPhase } from "./changed.js";
import { commitAll, git, makeRepo, trackedRoots, writeFixtureFile } from "./shape.test-support.js";

/**
 * T13 — a phase begins once.
 *
 * `/work` records the phase start at phase start. But a phase spans sessions: a
 * later session runs `/work` again, reaches the same instruction, and records a
 * second start at the CURRENT head. If the second record wins, everything the
 * first session committed falls out of scope and is never reviewed — and the
 * review still reports success, which is the failure mode worth guarding.
 */

const roots = trackedRoots();

const AT_OPEN = "2026-08-09T00:00:00.000Z";
const AT_RESUME = "2026-08-09T01:00:00.000Z";

describe("T24 — concurrent branches both keep their boundary record", () => {
	it("this repo declares merge=union for the boundary record", async () => {
		// The record is tracked, and worktree-per-plan is the DEFAULT here — two
		// plans opening phases on two branches is the expected case, not an exotic
		// one. Its sibling the verify ledger carries this declaration with a
		// comment explaining exactly why; the boundary record was committed
		// without one.
		const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
			cwd: dirname(fileURLToPath(import.meta.url)),
			encoding: "utf-8",
		}).trim();

		const attributes = readFileSync(join(root, ".gitattributes"), "utf-8");

		expect(attributes).toMatch(/\.indusk\/phase-boundary\.jsonl\s+merge=union/);
	}, 30_000);

	it("union merge actually keeps both appends", async () => {
		// Proves the strategy does what the declaration claims, rather than
		// trusting the attribute name.
		const root = await makeRepo();
		roots.push(root);
		await writeFixtureFile(root, ".gitattributes", "boundary.jsonl merge=union\n");
		await writeFixtureFile(root, "boundary.jsonl", '{"plan":"base","phase":0}\n');
		await commitAll(root, "baseline");

		await git(root, "checkout", "-q", "-b", "plan/a");
		await writeFixtureFile(root, "boundary.jsonl", '{"plan":"base","phase":0}\n{"plan":"a"}\n');
		await commitAll(root, "a opens a phase");

		await git(root, "checkout", "-q", "main");
		await writeFixtureFile(root, "boundary.jsonl", '{"plan":"base","phase":0}\n{"plan":"b"}\n');
		await commitAll(root, "b opens a phase");

		await git(root, "merge", "--no-edit", "plan/a");

		const merged = readFileSync(join(root, "boundary.jsonl"), "utf-8");
		expect(merged).toContain('"plan":"a"');
		expect(merged).toContain('"plan":"b"');
	}, 30_000);
});

describe("T13 — a resumed phase still scopes from where it first began", () => {
	it("findPhaseStart returns the earliest record for the phase, not the latest", async () => {
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, { plan: "demo", phase: 2, sha: "aaaaaaa", at: AT_OPEN });
		await recordPhaseStart(root, { plan: "demo", phase: 2, sha: "bbbbbbb", at: AT_RESUME });

		const start = findPhaseStart(await readBoundaries(root), "demo", 2);

		expect(start?.sha).toBe("aaaaaaa");
	}, 30_000);

	it("keeps the phases apart while doing so", async () => {
		// The earliest-wins rule must not collapse into "the earliest record of
		// any phase" — each phase keeps its own first opening.
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, { plan: "demo", phase: 1, sha: "111aaaa", at: AT_OPEN });
		await recordPhaseStart(root, { plan: "demo", phase: 2, sha: "222aaaa", at: AT_RESUME });

		const records = await readBoundaries(root);

		expect(findPhaseStart(records, "demo", 1)?.sha).toBe("111aaaa");
		expect(findPhaseStart(records, "demo", 2)?.sha).toBe("222aaaa");
	}, 30_000);

	it("re-opening an already-open phase does not append a second record", async () => {
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, { plan: "demo", phase: 2, sha: "aaaaaaa", at: AT_OPEN });
		await recordPhaseStart(root, { plan: "demo", phase: 2, sha: "bbbbbbb", at: AT_RESUME });

		const forThisPhase = (await readBoundaries(root)).filter(
			(r) => r.plan === "demo" && r.phase === 2,
		);

		expect(forThisPhase).toHaveLength(1);
	}, 30_000);

	it("work committed before the resume is still in scope", async () => {
		// The end-to-end shape of the bug: two sessions, one phase.
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 2,
			sha: await git(root, "rev-parse", "HEAD"),
			at: AT_OPEN,
		});

		await writeFixtureFile(root, "src/first-session.ts", "export const a = 1;\n");
		await commitAll(root, "phase 2, first session");

		// A later session reaches the same phase-start instruction and re-records.
		await recordPhaseStart(root, {
			plan: "demo",
			phase: 2,
			sha: await git(root, "rev-parse", "HEAD"),
			at: AT_RESUME,
		});
		await writeFixtureFile(root, "src/second-session.ts", "export const b = 2;\n");
		await commitAll(root, "phase 2, second session");

		const changed = await changedFilesForPhase({ root, plan: "demo", phase: 2 });

		expect(changed).toContain("src/second-session.ts");
		expect(changed).toContain("src/first-session.ts");
	}, 30_000);
});
