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

	it("A17 — the files the branch changed against main", () => {
		const paths = review().files.map((f) => f.path);
		expect(paths).toEqual(
			expect.arrayContaining(["src/seat-release.ts", "src/seat-release.test.ts"]),
		);
		expect(paths).not.toContain("README.md");
	});
});
