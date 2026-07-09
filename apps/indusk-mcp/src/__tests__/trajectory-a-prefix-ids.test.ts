import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateTrajectory } from "../lib/trajectory/validator.js";

/**
 * Cleanup-ritual Phase 0 — the trajectory validator must accept `A`-prefixed
 * test IDs (acceptance-style) in addition to `T` (test-style). Agents reach for
 * `A` naturally (assertions in the test-plan are `A`-prefixed); before this
 * change the cross-reference and rationale-completeness checks only recognized
 * `\bT\d+\b`, so an `A`-prefixed impl failed both checks spuriously.
 *
 * T14 — an all-`A` impl validates clean.
 * T15 — TS source ↔ JS hook port agree on `A`-prefixed fixtures (parity).
 * T16 — an unknown `A`-ID referenced in Verification still errors (the prefix
 *       is broadened, the existence check is NOT disabled).
 */

const HOOK_PATH = new URL("../../hooks/validate-impl-structure.js", import.meta.url).pathname;

const CLEAN_A_BODY = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | first thing | Phase 0 | Phase 0 | planned |
| A2 | second thing | Phase 1 | Phase 1 | planned |

### Trajectory Rationale

- **A2** \`Writable at: Phase 1\` — subject is a symbol authored in Phase 1.

## Checklist

### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] A1 passes
- [ ] A2 passes
`;

const UNKNOWN_A_REF_BODY = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | first thing | Phase 0 | Phase 0 | planned |

## Checklist

### Phase 1: Start

- [ ] do the thing

#### Phase 1 Verification
- [ ] A1 passes
- [ ] A99 passes
`;

const MISSING_RATIONALE_A_BODY = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | first thing | Phase 0 | Phase 0 | planned |
| A7 | later thing | Phase 3 | Phase 3 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] A1 passes

### Phase 3: Later

- [ ] do later

#### Phase 3 Verification
- [ ] A7 passes
`;

function runHook(fullContent: string): Promise<{ exitCode: number; stderr: string }> {
	const dir = mkdtempSync(join(tmpdir(), "a-prefix-parity-"));
	const implPath = join(dir, "impl.md");
	writeFileSync(implPath, fullContent);
	const event = {
		tool_name: "Write",
		tool_input: { file_path: implPath, content: fullContent },
		cwd: dir,
	};
	return new Promise((resolve, reject) => {
		const child = spawn("node", [HOOK_PATH], { stdio: ["pipe", "pipe", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ exitCode: code ?? 0, stderr }));
		child.stdin.end(JSON.stringify(event));
	});
}

describe("cleanup-ritual T14: A-prefixed IDs validate clean", () => {
	it("an all-A impl produces no cross-reference or rationale errors", () => {
		const errors = validateTrajectory(CLEAN_A_BODY, {
			rationaleRequired: true,
			rationaleBaseline: 0,
		});
		const relevant = errors.filter(
			(e) => e.rule === "cross-reference-integrity" || e.rule === "rationale-completeness",
		);
		expect(relevant).toEqual([]);
	});
});

describe("cleanup-ritual T16: unknown A-ID reference still errors", () => {
	it("A99 referenced in Verification but absent from the table is reported", () => {
		const errors = validateTrajectory(UNKNOWN_A_REF_BODY, {
			rationaleRequired: true,
			rationaleBaseline: 0,
		});
		const unknownRef = errors.find(
			(e) => e.rule === "cross-reference-integrity" && e.message.includes("A99"),
		);
		expect(unknownRef).toBeDefined();
		expect(unknownRef?.message).toContain("no such row exists");
	});
});

describe("cleanup-ritual T15: TS source ↔ JS hook port parity on A-prefixed fixtures", () => {
	const fixtures = [
		{ name: "clean A-prefix impl", body: CLEAN_A_BODY, expectPass: true },
		{ name: "A-prefix impl missing a Phase-3 rationale entry", body: MISSING_RATIONALE_A_BODY, expectPass: false },
	];

	for (const fx of fixtures) {
		it(`"${fx.name}" — TS and JS agree`, async () => {
			const frontmatter = `title: "F"
trajectory: required
rationale: required
gate_policy: ask`;
			const full = `---\n${frontmatter}\n---\n\n${fx.body}`;

			const tsErrors = validateTrajectory(fx.body, {
				rationaleRequired: true,
				rationaleBaseline: 0,
			});
			const tsRelevant = tsErrors.filter(
				(e) => e.rule === "cross-reference-integrity" || e.rule === "rationale-completeness",
			);
			const tsPasses = tsRelevant.length === 0;

			const js = await runHook(full);
			const jsPasses = js.exitCode === 0;

			expect({ tsPasses, jsPasses }).toEqual({ tsPasses: fx.expectPass, jsPasses: fx.expectPass });
		});
	}
});
