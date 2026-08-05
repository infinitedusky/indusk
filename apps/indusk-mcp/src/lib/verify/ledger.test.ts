import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendVerifyRecord, findBaselineRecord, readLedger } from "./ledger.js";
import { runVerify } from "./verify.js";
import {
	buildImpl,
	commitAll,
	git,
	makeVerifyFixture,
	writeFixtureFile,
} from "./verify.test-support.js";

/**
 * A9–A12 (dawn-verify) — the chained verify ledger.
 *
 * The ledger is what makes verification possible at all for work Dawn did not
 * run: there is no in-process "before", so the baseline has to come from the
 * previous verification's own record. These four assertions pin the chain and
 * its two failure-safety properties.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

/** A plan whose Phase 1 is honestly complete and whose Phase 2 has not started. */
function cleanPhase1Impl(): string {
	return buildImpl({
		rows: [
			{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
			{ id: "A2", asserts: "the widget renders", writableAt: 1, passesAt: 2, state: "written" },
		],
		phases: [
			{
				n: 1,
				name: "Parse",
				items: [[true, "add the parser"]],
				verification: [[true, "A1 passes"]],
			},
			{
				n: 2,
				name: "Render",
				items: [[false, "add the renderer"]],
				verification: [[false, "A2 passes"]],
			},
		],
	});
}

describe("A10 — bootstrap baseline when the plan has never been verified", () => {
	it("reports which baseline it bootstrapped from and proceeds", async () => {
		const fixture = await makeVerifyFixture({ impl: cleanPhase1Impl() });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.baseline.source).toBe("merge-base");
		expect(report.baseline.sha).toMatch(/^[0-9a-f]{7,40}$/);
	});
});

describe("A12 — a corrupt ledger refuses loudly", () => {
	it("throws naming the problem rather than silently reporting no prior verification", async () => {
		const fixture = await makeVerifyFixture({ impl: cleanPhase1Impl() });
		roots.push(fixture.root);
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "verify", "ledger.jsonl"),
			'{"plan":"demo","phase":1,"sha":"abc"}\nthis is not json\n',
		);

		await expect(readLedger(fixture.root)).rejects.toThrow(/ledger/i);
	});

	it("does not silently degrade to bootstrap mode when the ledger is unreadable", async () => {
		const fixture = await makeVerifyFixture({ impl: cleanPhase1Impl() });
		roots.push(fixture.root);
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "verify", "ledger.jsonl"),
			"{ truncated\n",
		);

		// The dangerous failure is a clean-looking report built on no baseline.
		await expect(runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 })).rejects.toThrow(
			/ledger/i,
		);
	});
});

describe("findBaselineRecord — the chain's lookup rule", () => {
	it("picks the highest phase below the one being verified, for this plan only", () => {
		const records = [
			{ plan: "demo", phase: 1, sha: "aaa", trajectory: "t1", timestamp: "t" },
			{ plan: "demo", phase: 2, sha: "bbb", trajectory: "t2", timestamp: "t" },
			{ plan: "other", phase: 3, sha: "zzz", trajectory: "t3", timestamp: "t" },
		];
		expect(findBaselineRecord(records, "demo", 3)?.sha).toBe("bbb");
		expect(findBaselineRecord(records, "demo", 2)?.sha).toBe("aaa");
		expect(findBaselineRecord(records, "demo", 1)).toBeNull();
	});
});

describe("A9 — the next phase judges against the previous verification's commit", () => {
	it("uses the recorded sha as the baseline, not the merge base", async () => {
		const fixture = await makeVerifyFixture({ impl: cleanPhase1Impl() });
		roots.push(fixture.root);
		const mergeBase = fixture.baselineSha;

		// Phase 1 verifies clean and records where the boundary sat.
		const first = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });
		expect(first.verdict).toBe("clean");

		// Phase 2's work lands on top.
		await writeFixtureFile(fixture.root, "src/renderer.js", "export const render = () => 'x';\n");
		const phase2Impl = cleanPhase1Impl()
			.replace("- [ ] add the renderer", "- [x] add the renderer")
			.replace("- [ ] A2 passes", "- [x] A2 passes")
			.replace(
				"| A2 | the widget renders |  | Phase 1 | Phase 2 | written |",
				"| A2 | the widget renders |  | Phase 1 | Phase 2 | passing |",
			)
			.replace(
				"| A2 | the widget renders | Phase 1 | Phase 2 | written |",
				"| A2 | the widget renders | Phase 1 | Phase 2 | passing |",
			);
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			phase2Impl,
		);
		const phase2Sha = await commitAll(fixture.root, "phase 2 work");

		const second = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 2 });

		expect(second.baseline.source).toBe("ledger");
		expect(second.baseline.sha).not.toBe(phase2Sha);
		// The recorded phase-1 boundary — which in this fixture is the merge base
		// only because phase 1 added no commit; the SOURCE is what distinguishes them.
		expect(second.baseline.sha).toBe(mergeBase);
	});
});

describe("A11 — a rejecting verify records nothing", () => {
	it("re-running produces the identical rejection instead of a new baseline", async () => {
		// Phase 2 checked off while Phase 1's verification gate is still open.
		const impl = buildImpl({
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
		const fixture = await makeVerifyFixture({ impl });
		roots.push(fixture.root);

		const first = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 2 });
		expect(first.verdict).toBe("rejected");
		expect(await readLedger(fixture.root)).toHaveLength(0);

		const second = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 2 });
		expect(second.verdict).toBe("rejected");
		expect(second.baseline).toEqual(first.baseline);
		expect(await readLedger(fixture.root)).toHaveLength(0);
	});

	it("appends exactly one record on a clean verdict", async () => {
		const fixture = await makeVerifyFixture({ impl: cleanPhase1Impl() });
		roots.push(fixture.root);

		await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });
		const ledger = await readLedger(fixture.root);

		expect(ledger).toHaveLength(1);
		expect(ledger[0]).toMatchObject({ plan: fixture.plan, phase: 1 });
		expect(ledger[0].sha).toBe(await git(fixture.root, "rev-parse", "HEAD"));
	});
});

describe("appendVerifyRecord — durability of the chain", () => {
	it("round-trips through the ledger file", async () => {
		const fixture = await makeVerifyFixture({ impl: cleanPhase1Impl() });
		roots.push(fixture.root);

		await appendVerifyRecord(fixture.root, {
			plan: "demo",
			phase: 1,
			sha: "abc1234",
			trajectory: "sha256:deadbeef",
			timestamp: "2026-08-05T00:00:00.000Z",
		});
		await appendVerifyRecord(fixture.root, {
			plan: "demo",
			phase: 2,
			sha: "def5678",
			trajectory: "sha256:cafebabe",
			timestamp: "2026-08-05T00:01:00.000Z",
		});

		const records = await readLedger(fixture.root);
		expect(records.map((r) => r.phase)).toEqual([1, 2]);
		expect(records[1].sha).toBe("def5678");
	});
});
