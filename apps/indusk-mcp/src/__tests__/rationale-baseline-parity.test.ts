import { describe, expect, it } from "vitest";
import { validateTrajectory } from "../lib/trajectory/validator.js";
import { validateWrite } from "./helpers/hook-runner.js";

/**
 * T5: parity check between TS source (validator.ts) and JS hook port
 * (validate-impl-structure.js). Same impl.md → identical pass/fail decision.
 *
 * The brief calls this "load-bearing" because the JS port is a manual mirror
 * of the TS source. Without parity coverage, drift between them is the most
 * likely future bug class. The CLAUDE.md gotcha already names this risk;
 * this test exercises both code paths against a shared fixture set.
 */

interface Fixture {
	name: string;
	frontmatter: string;
	body: string;
}

const fixtures: Fixture[] = [
	{
		name: "baseline=1 with all Phase-1 rows passes",
		frontmatter: `title: "F"
trajectory: required
rationale: required
rationale_baseline: 1
gate_policy: ask`,
		body: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | planned |
| T2 | b | Phase 1 | Phase 1 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
- [ ] T2 passes
`,
	},
	{
		name: "baseline=1 with one Phase-3 row missing rationale fails",
		frontmatter: `title: "F"
trajectory: required
rationale: required
rationale_baseline: 1
gate_policy: ask`,
		body: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | planned |
| T7 | g | Phase 3 | Phase 3 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes

### Phase 3: Later

- [ ] do later

#### Phase 3 Verification
- [ ] T7 passes
`,
	},
	{
		name: "no baseline frontmatter, all Phase-0 rows passes (regression)",
		frontmatter: `title: "F"
trajectory: required
rationale: required
gate_policy: ask`,
		body: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 0 | Phase 1 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`,
	},
	{
		name: "no baseline, Phase-1 row missing rationale fails (regression)",
		frontmatter: `title: "F"
trajectory: required
rationale: required
gate_policy: ask`,
		body: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`,
	},
	{
		name: "baseline=2 with Phase-2 row passes",
		frontmatter: `title: "F"
trajectory: required
rationale: required
rationale_baseline: 2
gate_policy: ask`,
		body: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 2 | Phase 2 | planned |

## Checklist

### Phase 2: Start

- [ ] do

#### Phase 2 Verification
- [ ] T1 passes
`,
	},
];

describe("rationale-baseline T5: TS source ↔ JS hook port parity", () => {
	for (const fx of fixtures) {
		it(`fixture "${fx.name}" produces identical pass/fail decision in both implementations`, async () => {
			const fullContent = `---\n${fx.frontmatter}\n---\n\n${fx.body}`;

			// TS source verdict — pull rationale_baseline from frontmatter the same
			// way the JS port does, then call validateTrajectory.
			const baselineMatch = fx.frontmatter.match(/rationale_baseline:\s*(\d+)/);
			const baseline = baselineMatch ? Number.parseInt(baselineMatch[1], 10) : 0;
			const tsErrors = validateTrajectory(fx.body, {
				rationaleRequired: true,
				rationaleBaseline: baseline,
			});
			const tsPasses = tsErrors.filter((e) => e.rule === "rationale-completeness").length === 0;

			// JS hook verdict — the shared runner writes the fixture to a temp
			// project and spawns the validator with a Write event; exit 0 = pass,
			// 2 = block.
			const result = await validateWrite(fullContent);
			const jsBlockedOnRationale =
				result.exitCode === 2 && result.stderr.includes("rationale-completeness");
			const jsPasses = !jsBlockedOnRationale;

			expect({ jsPasses, tsPasses, fixture: fx.name }).toEqual({
				jsPasses: tsPasses,
				tsPasses,
				fixture: fx.name,
			});
		});
	}
});
