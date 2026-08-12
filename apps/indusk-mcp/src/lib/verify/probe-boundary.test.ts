import { afterEach, describe, expect, it } from "vitest";
import { buildImpl, makeVerifyFixture } from "./verify.test-support.js";
import { runVerify } from "./verify.js";

/**
 * A20 — `verify --phase N` must judge the boundary at phase N, including in a
 * plan that opens at `Phase 0`.
 *
 * `probePhaseClose` gained an `ordinal` parameter when phases stopped being
 * orderable by number, defaulting to `phase - 1`. That default is right only
 * when Phase 1 is the first phase. Seven impls in this repository open at
 * `### Phase 0` — prerequisite work discovered late — and in those, Phase 1
 * sits at position 1. Verifying phase 1 therefore truncates after **Phase 0**
 * and asks whether *that* phase closed, so Phase 1's own incomplete gates are
 * invisible and premature-checkoff detection stops detecting at exactly the
 * boundary it was asked about.
 *
 * `verify/detect.ts` passes no ordinal, which is what makes this reachable.
 */

const roots: string[] = [];

afterEach(async () => {
	const { rm } = await import("node:fs/promises");
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

/** A plan opening at Phase 0, with Phase 1's Verification left open. */
function phaseZeroPlan(phase1Honest: boolean): string {
	return buildImpl({
		rows: [
			{ id: "A1", asserts: "the prereq holds", writableAt: 0, passesAt: 0, state: "passing" },
			{ id: "A2", asserts: "the widget parses", writableAt: 0, passesAt: 1, state: "passing" },
		],
		phases: [
			{
				n: 0,
				name: "Prereq discovered late",
				items: [[true, "add the prereq"]],
				verification: [[true, "A1 passes"]],
			},
			{
				n: 1,
				name: "Parse",
				// Checked off — but the Verification gate below is not, unless
				// this plan is the honest control.
				items: [[true, "add the parser"]],
				verification: [[phase1Honest, "A2 passes"]],
			},
		],
	});
}

describe("A20 — the probe boundary lands on the phase being verified", () => {
	it("reports Phase 1's premature checkoff in a plan that opens at Phase 0", async () => {
		const fixture = await makeVerifyFixture({ impl: phaseZeroPlan(false) });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		// Today: truncation cuts after Phase 0, the probe asks about Phase 0
		// (which is honestly complete), and verify returns clean on a phase
		// whose Verification gate is wide open.
		expect(report.verdict).toBe("rejected");
		expect(report.findings.map((f) => f.kind)).toContain("premature-checkoff");
	}, 120_000);

	it("still reports clean when Phase 1 is honestly closed", async () => {
		// The control. A boundary fix that rejected everything would satisfy the
		// case above and be worse than the bug.
		const fixture = await makeVerifyFixture({ impl: phaseZeroPlan(true) });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("clean");
	}, 120_000);
});
