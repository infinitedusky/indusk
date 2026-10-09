import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText } from "./helpers/plan-fixture.js";
import {
	DOMAIN,
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { testFile, writePromise } from "./helpers/promises-fixture.js";

/**
 * promise: a-review-shows-its-evidence — admin-plan-authoring A15, A16, A17.
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A30, the review's half.
 * promise: a-review-shows-its-evidence — plan-review-subagent A11: audit.md is not review evidence.
 * promise: a-review-shows-its-evidence — plan-review-subagent A19: a skipped audit is review evidence.
 *
 * When a build stops for review, `indusk plans review <plan>` assembles what
 * the person needs to decide: each promise the plan makes with the passing
 * tests that name it (and a promise none proves, marked unproven), what
 * falsification looked for and what it fixed, and the files the branch
 * changed. Through the CLI, over a plan built on its own branch.
 */

const PLAN = "seat-holds";
const PROVEN = "seat-released-on-timeout";
const UNPROVEN = "seat-never-double-held";
const planDir = `.indusk/planning/${PLAN}`;

const IMPL = `---
title: "${PLAN}"
status: completed
trajectory: required
test_phases: required
test_purpose: required
---

# ${PLAN}

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | For | Test |
|----|---------|-------------|-----------|-------|-----|------|
| A1 | A held seat is released when its hold runs out | Test Phase 1 | Build Phase 1 | passing | promise: ${PROVEN} | src/seat-release.test.ts |
| A2 | Two players cannot hold one seat | Test Phase 1 | Build Phase 1 | written | promise: ${UNPROVEN} | src/seat-hold.test.ts |
| A3 | A hold whose clock goes backwards still expires | Build Phase 2 | Build Phase 2 | passing | promise: ${PROVEN} | src/seat-release.test.ts |

## Checklist

### Test Phase 1: Red

- [x] write the tests

#### Test Phase 1 Verification

- [x] A1, A2 fail on their assertions

### Build Phase 1: Seats

- [x] build seats

#### Build Phase 1 Verification

- [x] A1 passes

#### Build Phase 1 Document

- [x] (none needed — seats have no public page yet)

### Build Phase 2: Falsification — holds that never expire

- [x] read the hold's expiry from a monotonic clock

#### Build Phase 2 Verification

- [x] A3 passes
`;

let p: PlanLifecycleProject;
let wt: string;
beforeEach(() => {
	p = planLifecycleProject("plans-review");
	wt = p.makeWorktree(PLAN);
	for (const name of [PROVEN, UNPROVEN]) {
		writePromise(join(wt, ".indusk", "promises"), {
			name,
			kind: "state",
			state: "declared",
			domain: DOMAIN,
			owner: PLAN,
			statement: `${name} holds.`,
		});
	}
	p.commit(
		wt,
		{
			[`${planDir}/brief.md`]: briefText(PLAN, {
				makes: [
					{ name: PROVEN, sentence: `${PROVEN} holds.` },
					{ name: UNPROVEN, sentence: `${UNPROVEN} holds.` },
				],
			}),
			[`${planDir}/impl.md`]: IMPL,
			"src/seat-release.ts": "export const release = 1;\n",
			"src/seat-release.test.ts": testFile(PROVEN),
			"src/seat-hold.test.ts": testFile(UNPROVEN),
		},
		"the build",
	);
});
afterEach(() => p.cleanup());

interface Review {
	promises: Array<{ name: string; proven: boolean; rows: Array<{ id: string; state: string }> }>;
	falsification: Array<{
		phase: string;
		rows: Array<{ id: string; asserts: string; state: string }>;
		items: Array<{ text: string; done: boolean }>;
	}>;
	files: Array<{ path: string }>;
	skips: Array<{ phase: string; gate: string; item: string }>;
	skippedRituals: Array<{ ritual: string; reason: string }>;
	uncommittedOnMain: string[];
}

function review(): Review {
	const r = runCli(p.trunk, ["plans", "review", PLAN, "--json"]);
	expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
	return JSON.parse(r.stdout);
}

describe.skipIf(SHOULD_SKIP)("indusk plans review", () => {
	it("A15 — each promise with the passing rows that name it; one with none is unproven", () => {
		const { promises } = review();
		const proven = promises.find((x) => x.name === PROVEN);
		const unproven = promises.find((x) => x.name === UNPROVEN);
		expect(proven).toMatchObject({ proven: true });
		expect(proven?.rows.map((r) => r.id).sort()).toEqual(["A1", "A3"]);
		expect(unproven).toMatchObject({ proven: false, rows: [{ id: "A2", state: "written" }] });
	});

	it("A16 — what falsification looked for, and what it fixed", () => {
		const { falsification } = review();
		expect(falsification).toHaveLength(1);
		expect(falsification[0].phase).toContain("holds that never expire");
		expect(falsification[0].rows).toEqual([
			expect.objectContaining({
				id: "A3",
				state: "passing",
				asserts: expect.stringContaining("clock goes backwards"),
			}),
		]);
		expect(falsification[0].items).toEqual([
			{ text: "read the hold's expiry from a monotonic clock", done: true },
		]);
	});

	it("A30 — every gate item the build skipped, with its reason", () => {
		expect(review().skips).toEqual([
			{
				phase: "Build Phase 1: Seats",
				gate: "document",
				item: "(none needed — seats have no public page yet)",
			},
		]);
	});

	it("A16 — a skipped ritual is shown with its reason", () => {
		// Found in Build Phase 9's live check: an unattended falsification that
		// formed no surviving hypothesis skips with its reason, and the review
		// showed nothing of it.
		p.commit(
			wt,
			{
				[`${planDir}/impl.md`]: IMPL.replace(
					"test_purpose: required\n",
					'test_purpose: required\ncleanup: skipped\ncleanup_reason: "one small file; nothing to decompose"\n',
				),
			},
			"cleanup skipped",
		);
		expect(review().skippedRituals).toEqual([
			{ ritual: "cleanup", reason: "one small file; nothing to decompose" },
		]);
	});

	it("A19 — a skipped audit is shown among the skipped rituals with its reason", () => {
		// promise: a-review-shows-its-evidence — the audit's skip pair was invisible to the person accepting.
		p.commit(
			wt,
			{
				[`${planDir}/impl.md`]: IMPL.replace(
					"test_purpose: required\n",
					'test_purpose: required\naudit: skipped\naudit_reason: "one file; the diff is the whole plan"\n',
				),
			},
			"audit skipped",
		);
		expect(review().skippedRituals).toEqual([
			{ ritual: "audit", reason: "one file; the diff is the whole plan" },
		]);
	});

	it("A33 — uncommitted work on main where the plan will land is listed; InDusk's own notes are not", () => {
		mkdirSync(join(p.trunk, "src"), { recursive: true });
		writeFileSync(join(p.trunk, "src", "seat-release.ts"), "// someone's work in progress\n");
		writeFileSync(join(p.trunk, ".indusk", "current.md"), "# eval notes\n");
		writeFileSync(join(p.trunk, "unrelated.txt"), "not a path this plan touches\n");
		expect(review().uncommittedOnMain).toEqual(["src/seat-release.ts"]);
	});

	it("A17 — the files the branch changed against main", () => {
		const paths = review().files.map((f) => f.path);
		expect(paths).toEqual(
			expect.arrayContaining(["src/seat-release.ts", "src/seat-release.test.ts"]),
		);
		expect(paths).not.toContain("README.md");
	});
	it("A11 (plan-review-subagent) — the same evidence with and without audit.md in the plan folder", () => {
		const without = runCli(p.trunk, ["plans", "review", PLAN, "--json"]);
		expect(without.code, `${without.stdout}\n${without.stderr}`).toBe(0);
		writeFileSync(
			join(wt, planDir, "audit.md"),
			"## Findings\n\n- src/seat-release.ts:1 — a finding\n",
		);
		const withAudit = runCli(p.trunk, ["plans", "review", PLAN, "--json"]);
		expect(withAudit.code, `${withAudit.stdout}\n${withAudit.stderr}`).toBe(0);
		expect(JSON.parse(withAudit.stdout)).toEqual(JSON.parse(without.stdout));
		const textWith = runCli(p.trunk, ["plans", "review", PLAN]).stdout;
		rmSync(join(wt, planDir, "audit.md"));
		expect(textWith).toBe(runCli(p.trunk, ["plans", "review", PLAN]).stdout);
	});
});
