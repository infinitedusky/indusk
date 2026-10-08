import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * small-fixes — A4, A5: a plan builds only after approval.
 *
 * A planning session set its plan `in-progress` by hand and started building,
 * so `plans approve` (the brief and promise checks) never ran. `check-gates.js`
 * refuses the two edits that did it: a `draft` plan's status changed by hand,
 * and a build item checked off on a plan that is not approved. `plans approve`
 * writes `approved` itself, without a tool event, so from `approved` the same
 * edits land.
 *
 * promise: a-plan-builds-only-after-approval
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function impl(status: string): string {
	return [
		"---",
		'title: "p"',
		`status: ${status}`,
		"trajectory: required",
		"test_phases: required",
		"---",
		"",
		"# p",
		"",
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State |",
		"|----|---------|-------------|-----------|-------|",
		"| T1 | it holds | Test Phase 1 | Build Phase 1 | written |",
		"",
		"## Checklist",
		"",
		"### Test Phase 1: Red",
		"",
		"- [x] T1 written red",
		"",
		"#### Test Phase 1 Verification",
		"",
		"- [x] T1 fails on its assertion",
		"",
		"### Build Phase 1: The fix",
		"",
		"- [ ] make it hold",
		"",
		"#### Build Phase 1 Verification",
		"",
		"- [ ] T1 passes",
		"",
	].join("\n");
}

function project(status: string): { root: string; implPath: string } {
	const root = mkdtempSync(join(tmpdir(), "approval-gate-"));
	dirs.push(root);
	mkdirSync(join(root, ".indusk", "planning", "p"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ mode: "local" }));
	const implPath = join(root, ".indusk", "planning", "p", "impl.md");
	writeFileSync(implPath, impl(status));
	return { root, implPath };
}

const edit = (root: string, implPath: string, oldString: string, newString: string) =>
	runHook(
		"check-gates.js",
		{
			tool_name: "Edit",
			tool_input: { file_path: implPath, old_string: oldString, new_string: newString },
			cwd: root,
		},
		{ cwd: root },
	);

describe("A4 — a plan leaves draft only through plans approve", () => {
	it("a hand edit of a draft's status to in-progress is refused, naming the lesson", async () => {
		const { root, implPath } = project("draft");
		const r = await edit(root, implPath, "status: draft", "status: in-progress");
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain("lesson: a-plan-builds-only-after-approval");
	});

	it("from approved (what plans approve writes) the same edit lands", async () => {
		const { root, implPath } = project("approved");
		const r = await edit(root, implPath, "status: approved", "status: in-progress");
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("A5 — no build item is checked off on a plan that is not approved", () => {
	it("on a draft plan the checkoff is refused", async () => {
		const { root, implPath } = project("draft");
		const r = await edit(root, implPath, "- [ ] make it hold", "- [x] make it hold");
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain("lesson: a-plan-builds-only-after-approval");
	});

	it("on an approved plan it lands", async () => {
		const { root, implPath } = project("approved");
		const r = await edit(root, implPath, "- [ ] make it hold", "- [x] make it hold");
		expect(r.exitCode, r.stderr).toBe(0);
	});
});
