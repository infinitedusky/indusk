import { afterEach, describe, expect, it } from "vitest";
import { type ImplFixture, runHook, writeImpl } from "./helpers/hook-runner.js";

/**
 * workbench-trust-fixes A1 + A2 — the gate reminder must actually reach the
 * model.
 *
 * `gate-reminder.js` is a PostToolUse hook. Its whole purpose is to put a
 * sentence in front of the agent when a phase closes: "the next phase opens
 * with these tests to author." A PostToolUse hook reaches the model in exactly
 * one way at exit 0 — a JSON envelope on stdout carrying
 * `hookSpecificOutput.additionalContext`. stderr goes to the debug log.
 *
 * So the assertion is on stdout, parsed, and on nothing else. A hook that
 * prints the right words to the wrong stream is indistinguishable from one
 * that prints nothing, which is what this hook has been for its whole life
 * (research.md, F9).
 */

const TRAJECTORY_LEGACY = `| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | the first phase's thing works | Phase 1 | Phase 1 | passing |
| T2 | the second phase writes a thing | Phase 2 | Phase 2 | planned |
| T3 | and reads it back | Phase 2 | Phase 2 | planned |`;

/** Legacy headings and cells: `### Phase N`, `Phase N`. Isolates the channel. */
const LEGACY_PHASE_1_JUST_CLOSED = `---
title: "Demo"
status: in-progress
trajectory: required
---

# Demo

## Test Trajectory

${TRAJECTORY_LEGACY}

## Checklist

### Phase 1: First

- [x] build the first thing

#### Phase 1 Verification

- [x] T1 passes

### Phase 2: Second

- [ ] build the second thing

#### Phase 2 Verification

- [ ] T2 passes
- [ ] T3 passes
`;

/** The shape every impl has had since test-phase-structure (2026-08-12). */
const MODERN_BUILD_1_JUST_CLOSED = `---
title: "Demo"
status: in-progress
trajectory: required
test_phases: required
---

# Demo

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | the first phase's thing works | Test Phase 1 | Build Phase 1 | passing |
| T2 | the second phase writes a thing | Build Phase 2 | Build Phase 2 | planned |
| T3 | and reads it back | Build Phase 2 | Build Phase 2 | planned |

## Checklist

### Test Phase 1: Author

- [x] author T1 red

#### Test Phase 1 Verification

- [x] T1 red

### Build Phase 1: First

- [x] build the first thing

#### Build Phase 1 Verification

- [x] T1 passes

### Build Phase 2: Second

- [ ] build the second thing

#### Build Phase 2 Verification

- [ ] T2 passes
- [ ] T3 passes
`;

/** Phase 2 mid-flight with rows that must pass before it can close. */
const LEGACY_PHASE_2_MID_FLIGHT = LEGACY_PHASE_1_JUST_CLOSED.replace(
	"- [ ] build the second thing",
	"- [x] build the second thing",
);

function editEvent(fixture: ImplFixture, filePath = fixture.implPath) {
	return {
		tool_name: "Edit",
		tool_input: { file_path: filePath, old_string: "- [ ]", new_string: "- [x]" },
		cwd: fixture.dir,
	};
}

function envelopeOf(stdout: string): { hookEventName: string; additionalContext: string } {
	expect(stdout.trim(), "the hook wrote nothing to stdout").not.toBe("");
	const parsed = JSON.parse(stdout) as {
		hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
	};
	expect(parsed.hookSpecificOutput, "no hookSpecificOutput in the envelope").toBeDefined();
	expect(parsed.hookSpecificOutput?.additionalContext, "no additionalContext").toBeTypeOf("string");
	return parsed.hookSpecificOutput as { hookEventName: string; additionalContext: string };
}

describe("A1 — closing a phase puts the next phase's rows in front of the model", () => {
	let fixture: ImplFixture | null = null;
	afterEach(() => {
		fixture?.dispose();
		fixture = null;
	});

	it("legacy `Phase N` shape: stdout carries additionalContext naming T2 and T3", async () => {
		fixture = writeImpl(LEGACY_PHASE_1_JUST_CLOSED, "gate-reminder-");
		const r = await runHook("gate-reminder.js", editEvent(fixture), { cwd: fixture.dir });
		expect(r.exitCode).toBe(0);
		const out = envelopeOf(r.stdout);
		expect(out.hookEventName).toBe("PostToolUse");
		expect(out.additionalContext).toContain("T2");
		expect(out.additionalContext).toContain("T3");
		expect(out.additionalContext).not.toContain("T1");
	});

	it("modern `Test Phase` / `Build Phase` shape: the same nudge, for Build Phase 2's rows", async () => {
		fixture = writeImpl(MODERN_BUILD_1_JUST_CLOSED, "gate-reminder-");
		const r = await runHook("gate-reminder.js", editEvent(fixture), { cwd: fixture.dir });
		expect(r.exitCode).toBe(0);
		const out = envelopeOf(r.stdout);
		expect(out.additionalContext).toContain("T2");
		expect(out.additionalContext).toContain("T3");
	});

	it("mid-phase: rows that block the phase's close are named on stdout too", async () => {
		fixture = writeImpl(LEGACY_PHASE_2_MID_FLIGHT, "gate-reminder-");
		const r = await runHook("gate-reminder.js", editEvent(fixture), { cwd: fixture.dir });
		expect(r.exitCode).toBe(0);
		const out = envelopeOf(r.stdout);
		expect(out.additionalContext).toContain("T2");
		expect(out.additionalContext).toContain("T3");
	});
});

describe("A2 — regression guard: a non-impl edit stays silent", () => {
	it("a `.ts` edit produces no stdout and exits 0", async () => {
		const fixture = writeImpl(LEGACY_PHASE_1_JUST_CLOSED, "gate-reminder-");
		try {
			const r = await runHook("gate-reminder.js", editEvent(fixture, `${fixture.dir}/src/a.ts`), {
				cwd: fixture.dir,
			});
			expect(r.exitCode).toBe(0);
			expect(r.stdout.trim()).toBe("");
		} finally {
			fixture.dispose();
		}
	});
});

/** Build Phase 1 half done: its item checked, its verification open, T1 still `written`. */
const MODERN_BUILD_1_MID_FLIGHT = MODERN_BUILD_1_JUST_CLOSED.replace(
	"- [x] T1 passes",
	"- [ ] T1 passes",
).replace(
	"| T1 | the first phase's thing works | Test Phase 1 | Build Phase 1 | passing |",
	"| T1 | the first phase's thing works | Test Phase 1 | Build Phase 1 | written |",
);

describe("A19 — a phase in progress gets its own blockers, not the previous phase's send-off", () => {
	it("names Build Phase 1's blocking rows and does not repeat that Test Phase 1 is complete", async () => {
		const fixture = writeImpl(MODERN_BUILD_1_MID_FLIGHT, "gate-reminder-");
		try {
			const r = await runHook("gate-reminder.js", editEvent(fixture), { cwd: fixture.dir });
			expect(r.exitCode).toBe(0);
			const out = envelopeOf(r.stdout);
			expect(out.additionalContext).toContain("T1");
			expect(out.additionalContext).toMatch(/still not passing/);
			expect(out.additionalContext).not.toMatch(/fully complete/);
		} finally {
			fixture.dispose();
		}
	});
});
