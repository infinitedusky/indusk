import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression for /falsify hypothesis 1 (fix-in-scope, Phase 4).
 *
 * The original JS hook port regex `/rationale_baseline:\s*(\d+)/` was not
 * line-anchored. It matched the substring anywhere in the frontmatter block,
 * including inside quoted YAML string values — so a plan with a title that
 * mentioned the key (e.g., a documentation plan about the key itself) silently
 * inherited the baseline from the title's substring.
 *
 * The fix: `/^rationale_baseline:\s*(\d+)/m` — the `m` flag + `^` anchor
 * require the key to appear at the start of a line (i.e., as a top-level
 * YAML key, not embedded in a quoted value).
 *
 * These tests pin both halves of the corrected behavior:
 *
 *  1. **Substring-only attack must be rejected.** A frontmatter where the
 *     YAML field is NOT set but the title contains `rationale_baseline: 1`
 *     must default to baseline=0, requiring rationale for the Phase-1 row.
 *  2. **Legitimate top-level key must still be honored.** A frontmatter
 *     with `rationale_baseline: 1` as a real top-level YAML key must
 *     exempt the Phase-1 row.
 */

const HOOK_PATH = new URL("../../hooks/validate-impl-structure.js", import.meta.url).pathname;

function runHook(implPath: string, fullContent: string): Promise<{ exitCode: number; stderr: string }> {
	const event = {
		tool_name: "Write",
		tool_input: { file_path: implPath, content: fullContent },
		cwd: implPath.replace(/\/[^/]+$/, ""),
	};
	return new Promise((resolve, reject) => {
		const child = spawn("node", [HOOK_PATH], { stdio: ["pipe", "pipe", "pipe"] });
		let err = "";
		child.stderr.on("data", (d) => {
			err += d.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ exitCode: code ?? 0, stderr: err }));
		child.stdin.end(JSON.stringify(event));
	});
}

describe("rationale-baseline T8: substring-in-string-value attack is rejected", () => {
	it("does NOT inherit baseline from a substring inside a quoted title value", async () => {
		const fullContent = `---
title: "Documenting rationale_baseline: 1 semantics for the trajectory guide"
trajectory: required
rationale: required
workflow: bugfix
gate_policy: ask
---

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a thing | Phase 1 | Phase 1 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes

#### Phase 1 Document
- [ ] write the docs page
`;
		const dir = mkdtempSync(join(tmpdir(), "falsify-substring-"));
		const implPath = join(dir, "impl.md");
		writeFileSync(implPath, fullContent);
		const { exitCode, stderr } = await runHook(implPath, fullContent);

		// Post-fix expectation: regex is line-anchored, so the title's substring
		// is ignored. Baseline defaults to 0, T1 (Writable at: Phase 1) needs
		// rationale, validator exits 2 with rationale-completeness error.
		expect(exitCode, `stderr was: ${stderr}`).toBe(2);
		expect(stderr).toContain("rationale-completeness");
	});
});

describe("rationale-baseline: legitimate top-level rationale_baseline key is honored", () => {
	it("treats rationale_baseline: 1 as a real top-level YAML key (exempts Phase-1 row)", async () => {
		const fullContent = `---
title: "Migration plan with explicit baseline"
trajectory: required
rationale: required
rationale_baseline: 1
workflow: bugfix
gate_policy: ask
---

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a thing | Phase 1 | Phase 1 | planned |

## Checklist

### Phase 1: Start

- [ ] do

#### Phase 1 Verification
- [ ] T1 passes

#### Phase 1 Document
- [ ] docs
`;
		const dir = mkdtempSync(join(tmpdir(), "falsify-positive-"));
		const implPath = join(dir, "impl.md");
		writeFileSync(implPath, fullContent);
		const { exitCode, stderr } = await runHook(implPath, fullContent);

		// With baseline=1 set as a real top-level key, T1 (Writable at: Phase 1)
		// is exempt from the rationale rule. Validator should exit 0.
		expect(exitCode, `stderr was: ${stderr}`).toBe(0);
		expect(stderr).not.toContain("rationale-completeness");
	});
});
