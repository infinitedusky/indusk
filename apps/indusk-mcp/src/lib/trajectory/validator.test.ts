import { describe, expect, it } from "vitest";
import { parseTrajectory } from "./parser.js";
import {
	validateCrossReferenceIntegrity,
	validateDeferredCompleteness,
	validateRationaleCompleteness,
	validateTemporalCoherence,
	validateTrajectory,
	validateTrajectoryPresence,
} from "./validator.js";

const bodyWithTrajectory = (tableRows: string, phases = "", deferred = "") => `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${tableRows}
${deferred}

## Checklist
${phases}
`;

describe("T4: validateTrajectoryPresence rejects impl lacking ## Test Trajectory", () => {
	it("emits a trajectory-presence error when the section is missing", () => {
		const body = `# Plan\n\n## Goal\nDo a thing.\n\n## Checklist\n\n### Phase 1: Start\n- [ ] do it\n`;
		const errors = validateTrajectoryPresence(body);
		expect(errors.length).toBe(1);
		expect(errors[0].rule).toBe("trajectory-presence");
	});

	it("returns no error when the section is present", () => {
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |");
		expect(validateTrajectoryPresence(body)).toEqual([]);
	});
});

describe("T5: validateCrossReferenceIntegrity rejects orphan test ID", () => {
	it("flags a phase Verification that references an ID not in the trajectory", () => {
		const phases = `
### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] T99 passes (\`pnpm test\`)
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", phases);
		const trajectory = parseTrajectory(body);
		const errors = validateCrossReferenceIntegrity(body, trajectory);
		expect(errors.some((e) => e.message.includes("T99"))).toBe(true);
	});

	it("accepts a phase Verification that references a known ID", () => {
		const phases = `
### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] T1 passes (\`pnpm test\`)
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", phases);
		const trajectory = parseTrajectory(body);
		expect(validateCrossReferenceIntegrity(body, trajectory)).toEqual([]);
	});
});

describe("T6: validateCrossReferenceIntegrity accepts whitelisted no-tests-flip reason", () => {
	it.each([["schema-only"], ["delete"], ["refactor"], ["infra"]])("accepts reason %s", (reason) => {
		const phases = `
### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] (no tests flip at this phase — reason: ${reason})
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", phases);
		const trajectory = parseTrajectory(body);
		expect(validateCrossReferenceIntegrity(body, trajectory)).toEqual([]);
	});
});

describe("T7: validateCrossReferenceIntegrity rejects non-whitelisted no-tests-flip reason", () => {
	it.each([["lazy"], ["we-will-do-it-later"], ["bogus"]])("rejects reason %s", (reason) => {
		const phases = `
### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] (no tests flip at this phase — reason: ${reason})
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", phases);
		const trajectory = parseTrajectory(body);
		const errors = validateCrossReferenceIntegrity(body, trajectory);
		expect(errors.some((e) => e.message.includes(reason))).toBe(true);
	});

	it("flags a Verification with no test references and no declaration", () => {
		const phases = `
### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] \`pnpm check\` passes
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", phases);
		const trajectory = parseTrajectory(body);
		const errors = validateCrossReferenceIntegrity(body, trajectory);
		expect(errors.some((e) => e.message.includes("no test ID references"))).toBe(true);
	});
});

describe("T8: validateTemporalCoherence rejects Writable at > Passes at", () => {
	it("flags a row where writable is after passes", () => {
		const body = bodyWithTrajectory("| T1 | backward test | Phase 5 | Phase 3 | planned |");
		const trajectory = parseTrajectory(body);
		const errors = validateTemporalCoherence(trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].rule).toBe("temporal-coherence");
		expect(errors[0].message).toContain("T1");
	});

	it("flags invalid phase references (non-numeric)", () => {
		const body = bodyWithTrajectory("| T1 | bad ref | Phase foo | Phase 3 | planned |");
		const trajectory = parseTrajectory(body);
		const errors = validateTemporalCoherence(trajectory);
		expect(errors.some((e) => e.message.includes("Writable at"))).toBe(true);
	});
});

describe("T9: validateTemporalCoherence accepts Writable at == Passes at", () => {
	it("allows a test that becomes writable and passes in the same phase", () => {
		const body = bodyWithTrajectory("| T1 | same-phase test | Phase 1 | Phase 1 | passing |");
		const trajectory = parseTrajectory(body);
		expect(validateTemporalCoherence(trajectory)).toEqual([]);
	});

	it("allows Writable at < Passes at", () => {
		const body = bodyWithTrajectory("| T1 | forward test | Phase 1 | Phase 5 | planned |");
		const trajectory = parseTrajectory(body);
		expect(validateTemporalCoherence(trajectory)).toEqual([]);
	});
});

describe("T10: validateDeferredCompleteness rejects row missing mitigation", () => {
	it("flags a deferred row with empty mitigation", () => {
		const deferred = `
### Deferred Verification

- **Untestable thing**
  - reason: we cannot test this
  - would require: a better environment
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", "", deferred);
		const trajectory = parseTrajectory(body);
		const errors = validateDeferredCompleteness(trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].message).toContain("mitigation");
	});
});

describe("T11: validateDeferredCompleteness rejects row missing would-require", () => {
	it("flags a deferred row with empty would-require", () => {
		const deferred = `
### Deferred Verification

- **Untestable thing**
  - reason: we cannot test this
  - mitigation: manual review monthly
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", "", deferred);
		const trajectory = parseTrajectory(body);
		const errors = validateDeferredCompleteness(trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].message).toContain("would require");
	});
});

describe("T12: validateDeferredCompleteness rejects row missing reason", () => {
	it("flags a deferred row with empty reason", () => {
		const deferred = `
### Deferred Verification

- **Untestable thing**
  - would require: a better environment
  - mitigation: manual review monthly
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", "", deferred);
		const trajectory = parseTrajectory(body);
		const errors = validateDeferredCompleteness(trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].message).toContain("reason");
	});

	it("accepts a deferred row with all three fields populated", () => {
		const deferred = `
### Deferred Verification

- **Thing**
  - reason: r
  - would require: w
  - mitigation: m
`;
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |", "", deferred);
		const trajectory = parseTrajectory(body);
		expect(validateDeferredCompleteness(trajectory)).toEqual([]);
	});
});

describe("validateTrajectory composite", () => {
	it("returns only presence error when trajectory is missing", () => {
		const errors = validateTrajectory("# Plan\n\n### Phase 1\n- [ ] do");
		expect(errors.length).toBe(1);
		expect(errors[0].rule).toBe("trajectory-presence");
	});

	it("returns no errors for a fully valid trajectory", () => {
		const phases = `
### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`;
		const body = bodyWithTrajectory("| T1 | a thing | Phase 1 | Phase 1 | passing |", phases);
		expect(validateTrajectory(body)).toEqual([]);
	});

	it("does not run rationale-completeness when rationaleRequired is false (default)", () => {
		const phases = `
### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`;
		const body = bodyWithTrajectory("| T1 | a thing | Phase 1 | Phase 1 | passing |", phases);
		// No `### Trajectory Rationale` subsection — should be fine when not required
		expect(validateTrajectory(body)).toEqual([]);
	});

	it("runs rationale-completeness when rationaleRequired is true and a row needs rationale", () => {
		const phases = `
### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`;
		const body = bodyWithTrajectory("| T1 | a thing | Phase 1 | Phase 1 | passing |", phases);
		const errors = validateTrajectory(body, { rationaleRequired: true });
		expect(errors.length).toBe(1);
		expect(errors[0].rule).toBe("rationale-completeness");
		expect(errors[0].message).toContain("missing the `### Trajectory Rationale` subsection");
	});
});

describe("T13: validateRationaleCompleteness rejects missing subsection when Phase 1+ row exists", () => {
	it("emits an error when ### Trajectory Rationale is absent and at least one row is Phase 1+", () => {
		const body = bodyWithTrajectory("| T1 | x | Phase 1 | Phase 1 | planned |");
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].rule).toBe("rationale-completeness");
		expect(errors[0].message).toContain("missing the `### Trajectory Rationale` subsection");
	});

	it("does NOT emit an error when ### Trajectory Rationale is absent but every row is Phase 0", () => {
		const body = bodyWithTrajectory("| T1 | regression | Phase 0 | Phase 1 | planned |");
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory);
		expect(errors).toEqual([]);
	});
});

describe("T14: validateRationaleCompleteness rejects missing T-IDs", () => {
	it("flags trajectory rows that have no rationale entry", () => {
		const rows =
			"| T1 | a | Phase 1 | Phase 1 | planned |\n| T2 | b | Phase 1 | Phase 2 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

### Trajectory Rationale

- **T1** \`Writable at: Phase 1\` — subject lands here.

## Checklist
`;
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].message).toContain("T2");
		expect(errors[0].message).not.toContain("T1");
	});
});

describe("T15: validateRationaleCompleteness rejects stale entries", () => {
	it("flags rationale entries for IDs not present in the trajectory table", () => {
		const rows = "| T1 | a | Phase 1 | Phase 1 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

### Trajectory Rationale

- **T1** \`Writable at: Phase 1\` — subject lands here.
- **T99** \`Writable at: Phase 1\` — stale entry from a removed row.

## Checklist
`;
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory);
		expect(errors.length).toBe(1);
		expect(errors[0].message).toContain("T99");
	});
});

describe("T16: validateRationaleCompleteness accepts complete subsection", () => {
	it("returns no errors when every trajectory row has a rationale entry and there are no extras", () => {
		const rows =
			"| T1 | a | Phase 1 | Phase 1 | planned |\n| T2 | b | Phase 1 | Phase 2 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

### Trajectory Rationale

- **T1** \`Writable at: Phase 1\` — subject lands here.
- **T2** \`Writable at: Phase 1\` — bug reproducible today.

## Checklist
`;
		const trajectory = parseTrajectory(body);
		expect(validateRationaleCompleteness(body, trajectory)).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// rationale-baseline-frontmatter plan: T1–T5
// Plans declare a writable baseline via `rationale_baseline: N` frontmatter.
// Rows with `Writable at <= baseline` are exempt from the Trajectory Rationale
// subsection. Default baseline (0) preserves all existing behavior.
// ─────────────────────────────────────────────────────────────────────────────

describe("rationale-baseline T1: baseline=1 with rows all at Phase 1 and empty Rationale passes", () => {
	it("returns no errors when baseline=1, all rows Writable at Phase 1, empty Rationale subsection", () => {
		const rows =
			"| T1 | a | Phase 1 | Phase 1 | planned |\n| T2 | b | Phase 1 | Phase 2 | planned |\n| T3 | c | Phase 1 | Phase 3 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
`;
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory, { baseline: 1 });
		expect(errors).toEqual([]);
	});

	it("also passes when the Rationale subsection exists but is empty (baseline=1)", () => {
		const rows = "| T1 | a | Phase 1 | Phase 1 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

### Trajectory Rationale

## Checklist
`;
		const trajectory = parseTrajectory(body);
		expect(validateRationaleCompleteness(body, trajectory, { baseline: 1 })).toEqual([]);
	});
});

describe("rationale-baseline T2: baseline=1 with one Phase-3 row and empty Rationale fails by ID", () => {
	it("error message names the single Phase-3 row's T-ID and not the Phase-1 rows", () => {
		const rows =
			"| T1 | a | Phase 1 | Phase 1 | planned |\n| T2 | b | Phase 1 | Phase 2 | planned |\n| T7 | c | Phase 3 | Phase 4 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
`;
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory, { baseline: 1 });
		expect(errors.length).toBeGreaterThanOrEqual(1);
		const combinedMessages = errors.map((e) => e.message).join(" || ");
		expect(combinedMessages).toContain("T7");
		expect(combinedMessages).not.toMatch(/\bT1\b/);
		expect(combinedMessages).not.toMatch(/\bT2\b/);
	});
});

describe("rationale-baseline T3: backward compat — no baseline = today's behavior exactly", () => {
	it("rows at Phase 1 (no baseline option) still need rationale entries", () => {
		const rows = "| T1 | a | Phase 1 | Phase 1 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
`;
		const trajectory = parseTrajectory(body);
		// No options passed → default baseline 0 → Phase 1 rows need rationale.
		const errors = validateRationaleCompleteness(body, trajectory);
		expect(errors.length).toBeGreaterThanOrEqual(1);
		expect(errors.map((e) => e.message).join(" ")).toContain("T1");
	});

	it("rows at Phase 0 (no baseline option) do NOT need rationale (existing rule)", () => {
		const rows = "| T1 | a | Phase 0 | Phase 1 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
`;
		const trajectory = parseTrajectory(body);
		expect(validateRationaleCompleteness(body, trajectory)).toEqual([]);
	});
});

describe("rationale-baseline T4: error messages name the actual baseline value", () => {
	it("baseline=2 error reads 'later than Phase 2', not 'later than Phase 0'", () => {
		const rows = "| T1 | a | Phase 5 | Phase 5 | planned |";
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
`;
		const trajectory = parseTrajectory(body);
		const errors = validateRationaleCompleteness(body, trajectory, { baseline: 2 });
		expect(errors.length).toBeGreaterThanOrEqual(1);
		const message = errors.map((e) => e.message).join(" ");
		expect(message).toContain("Phase 2");
		// Must not falsely claim the rule is about Phase 0.
		expect(message).not.toMatch(/later than Phase 0\b/);
	});
});

describe("rationale-baseline T5: validateTrajectory plumbs rationaleBaseline through options", () => {
	it("validateTrajectory accepts rationaleBaseline option and applies it to the rationale rule", () => {
		const rows = "| T1 | a | Phase 1 | Phase 1 | planned |";
		const phases = `
### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`;
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
${phases}
`;
		const errors = validateTrajectory(body, { rationaleRequired: true, rationaleBaseline: 1 });
		// With baseline=1, the Phase 1 row is exempt; no rationale-completeness errors.
		const rationaleErrors = errors.filter((e) => e.rule === "rationale-completeness");
		expect(rationaleErrors).toEqual([]);
	});

	it("validateTrajectory without rationaleBaseline preserves default baseline=0 behavior", () => {
		const rows = "| T1 | a | Phase 1 | Phase 1 | planned |";
		const phases = `
### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes
`;
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
${rows}

## Checklist
${phases}
`;
		const errors = validateTrajectory(body, { rationaleRequired: true });
		// Default baseline=0 → Phase 1 row needs rationale → rationale-completeness error.
		const rationaleErrors = errors.filter((e) => e.rule === "rationale-completeness");
		expect(rationaleErrors.length).toBeGreaterThanOrEqual(1);
	});
});
