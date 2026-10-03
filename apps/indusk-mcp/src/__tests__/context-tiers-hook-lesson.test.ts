import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";
import { edit, removeTrunkProjects, trunkProject } from "./helpers/trunk-guard-fixture.js";

/**
 * context-tiers — A6: a hook refusal names its lesson, in the same form a
 * failing test does.
 *
 * One grammar for both: `lesson: <name>` at the start of a line in the
 * refusal, where the agent reads it at the moment the rule bit. The two
 * refusals here are the ones an agent meets most: trunk-guard on a code edit
 * on `main`, and check-gates on closing a phase over a row still `planned`.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
	removeTrunkProjects();
});

/** The token the refusal carries, and the lesson it names must exist in this repository. */
function expectLesson(stderr: string, name: string): void {
	expect(stderr, `the refusal names its lesson`).toMatch(new RegExp(`^lesson: ${name}\\b`, "m"));
	expect(
		existsSync(join(REPO_ROOT, ".claude/lessons", `${name}.md`)),
		`lesson "${name}" is a file in .claude/lessons/`,
	).toBe(true);
}

describe("A6 — trunk-guard's edit-on-main refusal", () => {
	it("names the lesson that says to use a worktree, never a shell workaround", async () => {
		const root = trunkProject();
		const r = await runHook("trunk-guard.js", edit(root, "src/a.ts"));
		expect(r.exitCode).toBe(2);
		expectLesson(r.stderr, "trunk-guard-edit-refusal-is-not-a-bash-workaround");
	});
});

const IMPL = `---
title: "p"
status: in-progress
trajectory: required
test_phases: required
---

# p

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | the thing holds | Test Phase 1 | Build Phase 1 | planned |

## Checklist

### Test Phase 1: Author T1 red

- [ ] Author T1

#### Test Phase 1 Verification

- [ ] T1 is red on its own assertion

#### Test Phase 1 Context

- [ ] (none needed — asked: "skip?" — user: "yes")

#### Test Phase 1 Document

- [ ] (none needed — asked: "skip?" — user: "yes")

### Build Phase 1: Make it hold

- [ ] Make the thing hold

#### Build Phase 1 Verification

- [ ] T1 passes
`;

describe("A6 — check-gates' test-first refusal", () => {
	it("names the lesson that tests go red at the earliest writable phase", async () => {
		const root = mkdtempSync(join(tmpdir(), "context-tiers-gates-"));
		roots.push(root);
		mkdirSync(join(root, ".indusk/planning/p"), { recursive: true });
		writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local" }));
		const impl = join(root, ".indusk/planning/p/impl.md");
		writeFileSync(impl, IMPL);
		const r = await runHook("check-gates.js", {
			tool_name: "Edit",
			tool_input: { file_path: impl, old_string: "- [ ] Author T1", new_string: "- [x] Author T1" },
			cwd: root,
		});
		expect(r.exitCode, `closing over a planned row is refused — ${r.stderr}`).toBe(2);
		expect(r.stderr).toMatch(/test-first violation/);
		expectLesson(r.stderr, "test-red-at-earliest-writable-phase");
	});
});
