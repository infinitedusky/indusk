import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitOut, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * incident-recording A15, A16 — promise: a-reopened-plan-can-be-worked.
 *
 * `watch` reopens an archived plan by appending a Maintenance phase to its
 * impl, and `list_plans` counts it active — but `worktree create` and
 * `assign` looked only under `.indusk/planning/` and refused "no plan named
 * day-monitor" (2026-10-03). A reopened plan gets a worktree like any other
 * (A15); a closed one does not, and the refusal says how a plan reopens
 * (A16). Red today: both refused as unknown.
 */

const REOPENED = "seat-holds";
const CLOSED = "lab-v0";
const ID = "i-2026-10-08-seat-released";

const impl = (plan: string, open: boolean) => `---
title: "${plan}"
status: completed
---

# ${plan}

## Checklist

### Build Phase 1: The build

- [x] built it

### Build Phase 2: Maintenance — ${ID}

- [${open ? " " : "x"}] Find why the seat stayed held
`;

const record = (p: PlanLifecycleProject): string => {
	const common = gitOut(p.trunk, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
	const file = join(common, "indusk-plan-worktrees.json");
	return existsSync(file) ? readFileSync(file, "utf-8") : "";
};

let p: PlanLifecycleProject;
beforeEach(() => {
	p = planLifecycleProject("reopened-worktree");
	p.commit(
		p.trunk,
		{
			[`.indusk/planning/archive/${REOPENED}/impl.md`]: impl(REOPENED, true),
			[`.indusk/planning/archive/${CLOSED}/impl.md`]: impl(CLOSED, false),
		},
		"two archived plans, one reopened",
	);
});
afterEach(() => p.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

describe.skipIf(SHOULD_SKIP)("A15 — a reopened archived plan gets a worktree like any other", () => {
	it("`worktree create` makes its worktree and records the assignment", () => {
		const r = runCli(p.trunk, ["worktree", "create", REOPENED]);
		expect(r.code, out(r)).toBe(0);
		expect(existsSync(p.worktreeOf(REOPENED))).toBe(true);
		expect(record(p)).toContain(`"plan": "${REOPENED}"`);
	});

	it("`worktree assign` accepts a worktree made another way", () => {
		const path = p.worktreeOf(REOPENED);
		git(p.trunk, ["worktree", "add", "-q", path, "-b", `plan/${REOPENED}`, "main"]);
		const r = runCli(p.trunk, ["worktree", "assign", REOPENED, path]);
		expect(r.code, out(r)).toBe(0);
		expect(record(p)).toContain(`"plan": "${REOPENED}"`);
	});
});

describe.skipIf(SHOULD_SKIP)("A16 — a closed archived plan is refused, and told how a plan reopens", () => {
	it("names the archive and the incident route, and creates nothing", () => {
		const r = runCli(p.trunk, ["worktree", "create", CLOSED]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toMatch(/archive/i);
		expect(out(r)).toMatch(/incident/i);
		expect(out(r)).not.toMatch(/no plan named/);
		expect(existsSync(p.worktreeOf(CLOSED))).toBe(false);
	});
});
