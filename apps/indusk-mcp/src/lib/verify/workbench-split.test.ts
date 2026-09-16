import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../__tests__/helpers/cli.js";
import { git, headOf } from "../../__tests__/helpers/test-git.js";
import {
	commitFile,
	LAYOUTS,
	oneRepoAtPath,
	twoRepos,
	type VersionedWorkbench,
	writePlan,
} from "../../__tests__/helpers/versioned-workbench.js";
import { ledgerPath } from "./ledger.js";
import { exitCodeForReport, runVerify } from "./verify.js";
import { buildImpl, nodeTestScript } from "./verify.test-support.js";

/**
 * dawn-workbench-execution — A1–A5 (verify), A13 (verify part).
 *
 * In a workbench the plan's documents and its code are two repositories.
 * `verify` refused every workbench on purpose (workbench-trust-fixes), because
 * judging a phase against the plan repo's diff reports every honest checkoff
 * as phantom. These tests are the lift: a one-repo workbench gets a verdict,
 * and every detection looks at the repository it is actually about.
 *
 * Every test drives `runVerify` at the WORKBENCH root — the way a user runs
 * it — with the plan in the workbench and the code in the declared repo.
 */

const GATE_SCRIPTS = ["validate-impl-structure.js", "check-gates.js", "claude-md-budget.js"].map(
	(name) => join(REPO_ROOT, "apps/indusk-mcp/hooks", name),
);

const PLAN = "demo";
const TEST_FILE = "test/demo.test.mjs";

let wb: VersionedWorkbench | null = null;
afterEach(() => {
	wb?.cleanup();
	wb = null;
});

/** `verify.testCommand: node` so `node test/demo.test.mjs` is the whole runner. */
function enableNodeRunner(root: string): void {
	const configPath = join(root, ".indusk", "config.json");
	const config = JSON.parse(readFileSync(configPath, "utf-8"));
	config.verify = { testCommand: "node" };
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

interface PhaseShape {
	/** Phase 2 present — the phantom and chaining scenarios need a phase after the first. */
	withPhase2?: boolean;
	/** Whether phase 2's one item starts checked. The phantom scenario checks it AFTER the phase 1 verdict. */
	phase2Checked?: boolean;
}

const PHASE2_ITEM = "do the second thing";

function demoImpl(shape: PhaseShape = {}): string {
	return buildImpl({
		withTestColumn: true,
		rows: [
			{
				id: "T1",
				asserts: "the demo test passes",
				test: TEST_FILE,
				writableAt: 0,
				passesAt: 1,
				state: "passing",
			},
		],
		phases: [
			{
				n: 1,
				name: "Demo",
				items: [[true, "implement the demo module"]],
				verification: [[true, "T1 passes (`node test/demo.test.mjs`)"]],
			},
			...(shape.withPhase2
				? [
						{
							n: 2,
							name: "Second thing",
							items: [[shape.phase2Checked ?? true, PHASE2_ITEM] as [boolean, string]],
							verification: [
								[true, "(no tests flip at this phase — reason: infra)"] as [boolean, string],
							],
						},
					]
				: []),
		],
	});
}

/** Plan in the workbench, code in the declared repo, both committed. */
function honestPhase(
	workbench: VersionedWorkbench,
	opts: { testPasses?: boolean; shape?: PhaseShape } = {},
) {
	enableNodeRunner(workbench.root);
	writePlan(workbench, PLAN, demoImpl(opts.shape));
	git(workbench.root, ["add", "-A"]);
	git(workbench.root, ["commit", "-qm", "plan: demo phase 1"]);

	const code = workbench.repos[0].dir;
	commitFile(code, TEST_FILE, nodeTestScript(opts.testPasses ?? true), "tests: demo");
	const codeHead = commitFile(
		code,
		"src/demo.mjs",
		"export const demo = 1;\n",
		"feat: demo module",
	);
	return { code, codeHead };
}

const verifyAt = (root: string, phase: number) =>
	runVerify({ root, plan: PLAN, phase, scripts: GATE_SCRIPTS });

describe("dawn-workbench-execution — verify across the split", () => {
	it("A1: an honest phase in a one-repo workbench verifies clean from the workbench root", async () => {
		wb = oneRepoAtPath("nested");
		honestPhase(wb);

		const report = await verifyAt(wb.root, 1);
		expect(report.findings, JSON.stringify(report.findings, null, 2)).toEqual([]);
		// A clean verdict with the row UNVERIFIED would be "could not check"
		// reported as "checked" — the test actually ran, in the code repo.
		expect(report.unverifiedRows, "T1 was not actually run").toEqual([]);
		expect(report.verdict).toBe("clean");
		expect(exitCodeForReport(report)).toBe(0);
	}, 60_000);

	it("A2: a red test living in the code repo is reported from the workbench root, naming the row", async () => {
		wb = oneRepoAtPath("nested");
		honestPhase(wb, { testPasses: false });

		const report = await verifyAt(wb.root, 1);
		const red = report.findings.filter((f) => f.kind === "red-test");
		expect(red.length, JSON.stringify(report.findings, null, 2)).toBeGreaterThan(0);
		expect(red.map((f) => f.message).join("\n")).toMatch(/T1/);
		expect(exitCodeForReport(report)).toBe(1);
	}, 60_000);

	it("A3: a checkoff with no code change since the baseline is reported as phantom work", async () => {
		wb = oneRepoAtPath("nested");
		honestPhase(wb, { shape: { withPhase2: true, phase2Checked: false } });

		// Phase 1 is honest and records the baseline (both repos' HEADs).
		const first = await verifyAt(wb.root, 1);
		expect(first.verdict, JSON.stringify(first.findings)).toBe("clean");

		// Phase 2's item is checked off in the plan repo; the code repo did not move.
		const implPath = join(wb.root, ".indusk", "planning", PLAN, "impl.md");
		writeFileSync(
			implPath,
			readFileSync(implPath, "utf-8").replace(`- [ ] ${PHASE2_ITEM}`, `- [x] ${PHASE2_ITEM}`),
		);
		git(wb.root, ["add", "-A"]);
		git(wb.root, ["commit", "-qm", "plan: phase 2 checked off; ledger"]);

		const second = await verifyAt(wb.root, 2);
		const phantom = second.findings.filter((f) => f.kind === "phantom");
		expect(phantom.length, JSON.stringify(second.findings, null, 2)).toBeGreaterThan(0);
		expect(second.verdict).toBe("rejected");
	}, 60_000);

	it("A4: a pre-split ledger line is never a code baseline; the first cross-repo verify bootstraps, the next chains", async () => {
		wb = oneRepoAtPath("nested");
		const { code } = honestPhase(wb, { shape: { withPhase2: true } });

		// A record written before this plan: plan-repo sha only, no codeSha.
		mkdirSync(join(wb.root, ".indusk", "verify"), { recursive: true });
		appendFileSync(
			ledgerPath(wb.root),
			`${JSON.stringify({
				plan: PLAN,
				phase: 0,
				sha: headOf(wb.root),
				trajectory: "legacy",
				timestamp: "2026-09-01T00:00:00.000Z",
			})}\n`,
		);

		const first = await verifyAt(wb.root, 1);
		expect(first.verdict, JSON.stringify(first.findings)).toBe("clean");
		expect(first.baseline.source).toBe("merge-base");
		const codeHeadAtFirstVerdict = headOf(code);

		// Real work for phase 2 so nothing is phantom, then the chained verify.
		commitFile(code, "src/second.mjs", "export const second = 2;\n", "feat: second thing");
		git(wb.root, ["add", "-A"]);
		git(wb.root, ["commit", "-qm", "plan: phase 2; ledger"]);

		const second = await verifyAt(wb.root, 2);
		expect(second.verdict, JSON.stringify(second.findings)).toBe("clean");
		expect(second.baseline.source).toBe("ledger");
		expect(second.baseline.sha).toBe(codeHeadAtFirstVerdict);
	}, 60_000);

	it("A5 (verify): a workbench declaring two repos still refuses, naming both", async () => {
		wb = twoRepos("nested");
		writePlan(wb, PLAN, demoImpl());
		await expect(verifyAt(wb.root, 1)).rejects.toThrow(/alpha.*beta|beta.*alpha/);
	});
});

describe.each(
	LAYOUTS,
)("A13 (verify) — an honest phase verifies clean on the %s layout", (_label, build) => {
	it("verifies clean from the workbench root", async () => {
		wb = build();
		honestPhase(wb);
		const report = await verifyAt(wb.root, 1);
		expect(report.findings, JSON.stringify(report.findings, null, 2)).toEqual([]);
		expect(report.verdict).toBe("clean");
	}, 60_000);
});
