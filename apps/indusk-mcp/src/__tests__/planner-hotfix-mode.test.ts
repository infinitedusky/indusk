import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * planner-hotfix-mode Phase 1: T1-T5.
 *
 * T1-T3 exercise validate-impl-structure.js's write-time gate check.
 * T4-T5 exercise check-gates.js's phase-close (Gate A/B) check.
 *
 * All fixtures are written to a fresh tmpdir per test — no `.indusk/config.json`
 * exists there, so `shouldEmitOtelGate` defaults to true (config missing → true),
 * matching a real project without an explicit `otel.role`.
 */

const VALIDATE_HOOK = new URL("../../hooks/validate-impl-structure.js", import.meta.url).pathname;
const CHECK_GATES_HOOK = new URL("../../hooks/check-gates.js", import.meta.url).pathname;

function runHook(hookPath: string, event: unknown): Promise<{ exitCode: number; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn("node", [hookPath], { stdio: ["pipe", "pipe", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ exitCode: code ?? 0, stderr }));
		child.stdin.end(JSON.stringify(event));
	});
}

function writeFixture(dir: string, content: string): string {
	const implPath = join(dir, "impl.md");
	writeFileSync(implPath, content);
	return implPath;
}

const SHIP_PHASE_SKIP_REASONED = `---
title: "Fixture"
workflow: hotfix
gate_policy: auto
---

# Fixture

## Checklist

### Phase 1: Ship

- [x] fix already shipped

#### Phase 1 Verification
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)

#### Phase 1 Document
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)
`;

describe("planner-hotfix-mode T1: Ship phase skip-reasoned gates accepted under gate_policy: auto", () => {
	it("is accepted (exit 0) once `hotfix` is a recognized workflow", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hotfix-t1-"));
		const implPath = writeFixture(dir, SHIP_PHASE_SKIP_REASONED);
		const result = await runHook(VALIDATE_HOOK, {
			tool_name: "Write",
			tool_input: { file_path: implPath, content: SHIP_PHASE_SKIP_REASONED },
			cwd: dir,
		});
		expect(result.exitCode).toBe(0);
	});
});

const SHIP_PHASE_SKIP_REASONED_ASK = SHIP_PHASE_SKIP_REASONED.replace(
	"gate_policy: auto",
	"gate_policy: ask",
);

describe("planner-hotfix-mode T2: identical content blocked under gate_policy: ask/strict", () => {
	it("is blocked (exit 2), naming the opt-out restriction", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hotfix-t2-"));
		const implPath = writeFixture(dir, SHIP_PHASE_SKIP_REASONED_ASK);
		const result = await runHook(VALIDATE_HOOK, {
			tool_name: "Write",
			tool_input: { file_path: implPath, content: SHIP_PHASE_SKIP_REASONED_ASK },
			cwd: dir,
		});
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("cannot use opt-outs at write time");
	});
});

const SHIP_PHASE_REAL_CONTENT_NO_OTEL_CONTEXT = `---
title: "Fixture"
workflow: hotfix
gate_policy: ask
---

# Fixture

## Checklist

### Phase 1: Ship

- [x] fix already shipped

#### Phase 1 Verification
- [x] confirmed the fix resolves the reported symptom manually

#### Phase 1 Document
- [x] noted the fix in the PR description
`;

describe("planner-hotfix-mode T3: hotfix's lighter gate set (no otel/context required)", () => {
	it("is accepted (exit 0) once `hotfix` is a recognized workflow, despite omitting OTel/Context entirely", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hotfix-t3-"));
		const implPath = writeFixture(dir, SHIP_PHASE_REAL_CONTENT_NO_OTEL_CONTEXT);
		const result = await runHook(VALIDATE_HOOK, {
			tool_name: "Write",
			tool_input: { file_path: implPath, content: SHIP_PHASE_REAL_CONTENT_NO_OTEL_CONTEXT },
			cwd: dir,
		});
		expect(result.exitCode).toBe(0);
	});
});

function shipBackfillFixture(): string {
	return `---
title: "T4 Fixture"
workflow: hotfix
gate_policy: auto
trajectory: required
---

# T4 Fixture

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | regression test | Phase 0 | Phase 2 | written |

## Checklist

### Phase 1: Ship
- [x] fix already shipped
#### Phase 1 Verification
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)
#### Phase 1 Document
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)

### Phase 2: Backfill
- [ ] author regression test
#### Phase 2 Verification
- [ ] T1 passes
#### Phase 2 Document
- [ ] write docs
`;
}

describe("planner-hotfix-mode T4: Ship phase with zero rows targeting it closes freely", () => {
	it("allows checking Backfill's own implementation item (exit 0) — pre-existing check-gates.js behavior, workflow-independent", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hotfix-t4-"));
		const content = shipBackfillFixture();
		const implPath = writeFixture(dir, content);
		const result = await runHook(CHECK_GATES_HOOK, {
			tool_name: "Edit",
			tool_input: {
				file_path: implPath,
				old_string: "- [ ] author regression test",
				new_string: "- [x] author regression test",
			},
			cwd: dir,
		});
		expect(result.exitCode).toBe(0);
	});
});

function shipBackfillCloseFixture(t1State: string): string {
	return `---
title: "T5 Fixture"
workflow: hotfix
gate_policy: auto
trajectory: required
---

# T5 Fixture

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | regression test | Phase 0 | Phase 2 | ${t1State} |

## Checklist

### Phase 1: Ship
- [x] fix already shipped
#### Phase 1 Verification
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)
#### Phase 1 Document
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)

### Phase 2: Backfill
- [x] author regression test
#### Phase 2 Verification
- [x] T1 passes
#### Phase 2 Document
- [x] write docs

### Phase 3: Close
- [ ] confirm all Phase 2 trajectory rows are terminal
#### Phase 3 Verification
- [ ] (none needed — skip-reason: n/a, this phase has no tests of its own)
#### Phase 3 Document
- [ ] (none needed — skip-reason: n/a)
`;
}

describe("planner-hotfix-mode T5: Close's item-check triggers Gate B against Backfill's rows", () => {
	it("blocks (exit 2, naming the row) while Backfill's row is unresolved", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hotfix-t5-blocked-"));
		const content = shipBackfillCloseFixture("written");
		const implPath = writeFixture(dir, content);
		const result = await runHook(CHECK_GATES_HOOK, {
			tool_name: "Edit",
			tool_input: {
				file_path: implPath,
				old_string: "- [ ] confirm all Phase 2 trajectory rows are terminal",
				new_string: "- [x] confirm all Phase 2 trajectory rows are terminal",
			},
			cwd: dir,
		});
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("T1");
		expect(result.stderr).toContain("written");
	});

	it("allows (exit 0) once Backfill's row reaches passing", async () => {
		const dir = mkdtempSync(join(tmpdir(), "hotfix-t5-allowed-"));
		const content = shipBackfillCloseFixture("passing");
		const implPath = writeFixture(dir, content);
		const result = await runHook(CHECK_GATES_HOOK, {
			tool_name: "Edit",
			tool_input: {
				file_path: implPath,
				old_string: "- [ ] confirm all Phase 2 trajectory rows are terminal",
				new_string: "- [x] confirm all Phase 2 trajectory rows are terminal",
			},
			cwd: dir,
		});
		expect(result.exitCode).toBe(0);
	});
});
