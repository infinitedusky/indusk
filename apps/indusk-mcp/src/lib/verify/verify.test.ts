import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exitCodeForReport, runVerify } from "./verify.js";
import { buildImpl, makeVerifyFixture, treeSnapshot } from "./verify.test-support.js";

/**
 * A6, A7, A8, A15 (dawn-verify) — the clean path, the read-only guarantee, the
 * exit-code contract, and the non-git guard.
 *
 * A7 is the load-bearing one: the whole scope decision for this component is
 * "detect, never repair", and that is asserted directly rather than inferred
 * from the absence of mutation code. Gate scripts spawn subprocesses and the
 * probe writes temp files — "we didn't write a mutation" is not evidence.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

function honestImpl(): string {
	return buildImpl({
		rows: [
			{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
		],
		phases: [
			{
				n: 1,
				name: "Parse",
				items: [[true, "add the parser"]],
				verification: [[true, "A1 passes"]],
			},
		],
	});
}

/** Phase 2 checked off while Phase 1's verification gate is still open. */
function dishonestImpl(): string {
	return buildImpl({
		rows: [
			{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
		],
		phases: [
			{
				n: 1,
				name: "Parse",
				items: [[true, "add the parser"]],
				verification: [[false, "A1 passes"]],
			},
			{ n: 2, name: "Render", items: [[true, "add the renderer"]] },
		],
	});
}

describe("A6 — an honest phase verifies clean", () => {
	it("reports success and states the baseline commit it judged against", async () => {
		const fixture = await makeVerifyFixture({ impl: honestImpl() });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("clean");
		expect(report.findings).toEqual([]);
		expect(report.baseline.sha).toBeTruthy();
		expect(report.plan).toBe(fixture.plan);
		expect(report.phase).toBe(1);
	});

	it("exits 0 so a calling script continues", async () => {
		const fixture = await makeVerifyFixture({ impl: honestImpl() });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });
		expect(exitCodeForReport(report)).toBe(0);
	});
});

describe("A7 — a rejecting verify changes nothing on disk", () => {
	it("leaves every file byte-identical", async () => {
		const fixture = await makeVerifyFixture({ impl: dishonestImpl() });
		roots.push(fixture.root);

		const before = await treeSnapshot(fixture.root);
		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 2 });
		const after = await treeSnapshot(fixture.root);

		expect(report.verdict).toBe("rejected");
		expect(after).toBe(before);
	});
});

describe("A8 — a rejecting verify exits non-zero", () => {
	it("maps a rejected verdict to a failing exit code", async () => {
		const fixture = await makeVerifyFixture({ impl: dishonestImpl() });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 2 });

		expect(report.verdict).toBe("rejected");
		expect(exitCodeForReport(report)).not.toBe(0);
	});
});

describe("A15 — no git repository is a loud failure", () => {
	it("fails naming the missing repository rather than reporting a clean phase", async () => {
		// A directory with a plan in it but no `git init` — the workbench shape.
		const bare = await mkdtemp(join(tmpdir(), "dawn-verify-nogit-"));
		roots.push(bare);
		const { writeFixtureFile } = await import("./verify.test-support.js");
		await writeFixtureFile(bare, join(".indusk", "planning", "demo", "impl.md"), honestImpl());

		await expect(runVerify({ root: bare, plan: "demo", phase: 1 })).rejects.toThrow(
			/git repository/i,
		);
	});
});
