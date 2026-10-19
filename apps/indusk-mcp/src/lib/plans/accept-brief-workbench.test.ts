// clause: a-brief-is-accepted-on-current-main/main-is-merged-first
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { briefText } from "../../__tests__/helpers/plan-fixture.js";
import {
	git,
	oneRepoAtPath,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import { BUILD_STEP_ENV } from "../build/step-env.js";
import { acceptBrief } from "./accept-brief.js";
import { PlanCommandRefusal } from "./plan-branch.js";
import { startPlan } from "./start.js";

/**
 * a-brief-is-accepted-on-current-main, Test Phase 1 (A16): a workbench plan's
 * documents are at the workbench root and its code on a branch in a repo; the
 * trunk of that repo is brought into the code branch at acceptance, and the
 * brief is written and committed at the root as before.
 */

const PLAN = "wb-plan";
const briefAt = (root: string) => join(root, ".indusk", "planning", PLAN, "brief.md");

let wb: VersionedWorkbench;
let previous: string | undefined;
let codeWorktree: string;
beforeEach(async () => {
	previous = process.env[BUILD_STEP_ENV];
	delete process.env[BUILD_STEP_ENV];
	wb = oneRepoAtPath();
	const started = await startPlan(wb.root, "bugfix", PLAN, new Date(), {});
	codeWorktree = resolve(wb.root, started.code?.worktree ?? "");
	// A bugfix plan starts with a draft brief at the root; make it one the contract accepts.
	writeFileSync(
		briefAt(wb.root),
		briefText(PLAN)
			.replace("status: accepted", "status: draft")
			.replace("workflow: feature", "workflow: bugfix"),
	);
	git(wb.root, ["add", "-A"]);
	git(wb.root, ["commit", "-q", "-m", "the brief"]);
});
afterEach(() => {
	if (previous === undefined) delete process.env[BUILD_STEP_ENV];
	else process.env[BUILD_STEP_ENV] = previous;
	wb.cleanup();
});

const trunk = () => wb.repos[0].dir;
function commitIn(dir: string, file: string, content: string, message: string): void {
	writeFileSync(join(dir, file), content);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-q", "-m", message]);
}

describe("accepting a workbench plan", () => {
	it("A16: the repo's trunk is brought into the code branch and the brief is committed at the root", async () => {
		commitIn(trunk(), "trunk-moved.md", "new\n", "trunk moves");
		await acceptBrief(wb.root, PLAN);
		expect(existsSync(join(codeWorktree, "trunk-moved.md"))).toBe(true);
		expect(readFileSync(briefAt(wb.root), "utf-8")).toContain("status: accepted");
		expect(git(wb.root, ["log", "-1", "--format=%s"])).toBe(`plan(${PLAN}): brief accepted`);
	});

	it("A16: a conflict in the code branch refuses, naming the file, the brief a draft and the head unchanged", async () => {
		commitIn(trunk(), "shared.md", "a\nb\nc\n", "shared");
		git(codeWorktree, ["merge", "-q", git(trunk(), ["rev-parse", "--abbrev-ref", "HEAD"])]);
		commitIn(codeWorktree, "shared.md", "a\nmine\nc\n", "mine");
		commitIn(trunk(), "shared.md", "a\ntheirs\nc\n", "theirs");
		const head = git(codeWorktree, ["rev-parse", "HEAD"]);
		const err = await acceptBrief(wb.root, PLAN).then(
			() => null,
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(PlanCommandRefusal);
		expect((err as Error).message).toContain("shared.md");
		expect(readFileSync(briefAt(wb.root), "utf-8")).toContain("status: draft");
		expect(git(codeWorktree, ["rev-parse", "HEAD"])).toBe(head);
		expect(git(codeWorktree, ["status", "--porcelain"])).toBe("");
	});

	it("A35: a rejected commit at the root leaves the brief a draft, nothing staged, and the code branch as it was", async () => {
		commitIn(trunk(), "trunk-moved.md", "new\n", "trunk moves");
		commitIn(codeWorktree, "mine.md", "mine\n", "my work");
		const head = git(codeWorktree, ["rev-parse", "HEAD"]);
		const hooks = git(wb.root, ["rev-parse", "--git-path", "hooks"]);
		const hook = join(isAbsolute(hooks) ? hooks : resolve(wb.root, hooks), "commit-msg");
		writeFileSync(hook, '#!/bin/sh\ngrep -q "brief accepted" "$1" && exit 1\nexit 0\n');
		chmodSync(hook, 0o755);
		await expect(acceptBrief(wb.root, PLAN)).rejects.toThrow();
		expect(readFileSync(briefAt(wb.root), "utf-8")).toContain("status: draft");
		expect(git(wb.root, ["status", "--porcelain"])).toBe("");
		expect(git(codeWorktree, ["rev-parse", "HEAD"])).toBe(head);
		rmSync(hook);
		await acceptBrief(wb.root, PLAN);
		expect(readFileSync(briefAt(wb.root), "utf-8")).toContain("status: accepted");
	});
});
