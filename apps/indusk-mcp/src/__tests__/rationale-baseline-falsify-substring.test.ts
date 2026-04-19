import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Falsification hypothesis 1: the JS hook port's frontmatter regex
 *
 *   /rationale_baseline:\s*(\d+)/
 *
 * is not anchored to a YAML key context. It matches the substring anywhere
 * in the frontmatter block — including inside quoted string values.
 *
 * Concrete attack: a plan with a title that incidentally mentions the key
 * (e.g., a documentation plan about the key itself) silently inherits the
 * baseline from string content, never having set the YAML field.
 *
 * Test: a frontmatter where the YAML field is NOT set, but the title
 * contains the substring `rationale_baseline: 1`. With one Phase-1 row
 * and an empty Trajectory Rationale subsection, the validator SHOULD
 * fail (default baseline=0, Phase 1 > 0, rationale required for T1).
 *
 * The hypothesis predicts: the validator silently treats baseline=1 and
 * passes — a bug.
 */

const HOOK_PATH = new URL("../../hooks/validate-impl-structure.js", import.meta.url).pathname;

describe("rationale-baseline falsification: substring-in-string-value attack", () => {
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
		const event = {
			tool_name: "Write",
			tool_input: { file_path: implPath, content: fullContent },
			cwd: dir,
		};

		const { exitCode, stderr } = await new Promise<{ exitCode: number; stderr: string }>(
			(resolve, reject) => {
				const child = spawn("node", [HOOK_PATH], { stdio: ["pipe", "pipe", "pipe"] });
				let err = "";
				child.stderr.on("data", (d) => {
					err += d.toString();
				});
				child.on("error", reject);
				child.on("close", (code) => resolve({ exitCode: code ?? 0, stderr: err }));
				child.stdin.end(JSON.stringify(event));
			},
		);

		// Hypothesis: the regex picks up "rationale_baseline: 1" from inside the
		// quoted title, sets baseline=1, exempts T1, and exits 0 (false pass).
		// Correct behavior: baseline should default to 0 (the YAML field is not
		// actually set), T1 needs rationale, the validator should exit 2.
		expect(exitCode, `stderr was: ${stderr}`).toBe(2);
		expect(stderr).toContain("rationale-completeness");
	});
});
