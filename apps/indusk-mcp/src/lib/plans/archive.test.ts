// clause: a-plan-document-is-written-through-its-checks/shell-write-refused
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { refusalFor } from "../../../hooks/plan-write-guard.js";
import { archivePlan } from "./archive.js";

/**
 * a-run-can-be-trusted A80: archiving a plan is a package command, so the release still
 * runs with the shell guard installed. `indusk plans archive <plan>` moves the folder
 * through `git mv` (git is an input here: a fake that records the call and moves the
 * folder, so this stays a unit test); the guard does not refuse the command; the
 * retrospective's archival step names it, never a raw `mv`.
 */

let root: string;
const calls: string[][] = [];
const fakeGit = (cwd: string, args: string[]) => {
	calls.push(args);
	if (args[0] === "mv") renameSync(join(cwd, args[1]), join(cwd, args[2]));
	return { ok: true as const };
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "plans-archive-"));
	mkdirSync(join(root, ".indusk", "planning", "demo"), { recursive: true });
	writeFileSync(join(root, ".indusk", "planning", "demo", "brief.md"), "# demo\n");
	calls.length = 0;
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("A80 — indusk plans archive moves a plan into the archive through git", () => {
	it("runs git mv from the plan's folder to archive/<plan>, creating archive/", () => {
		const r = archivePlan(root, "demo", { git: fakeGit, declaredPromises: () => [] });
		expect(r).toEqual({ ok: true, to: ".indusk/planning/archive/demo" });
		expect(calls).toEqual([["mv", ".indusk/planning/demo", ".indusk/planning/archive/demo"]]);
		expect(existsSync(join(root, ".indusk", "planning", "archive", "demo", "brief.md"))).toBe(true);
	});

	it("refuses, moving nothing, when the archive already holds the plan", () => {
		mkdirSync(join(root, ".indusk", "planning", "archive", "demo"), { recursive: true });
		const r = archivePlan(root, "demo", { git: fakeGit, declaredPromises: () => [] });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.reason).toMatch(/archive\/demo/);
		expect(calls).toEqual([]);
	});

	it("refuses, naming each one, while the plan's promises are not confirmed", () => {
		const r = archivePlan(root, "demo", { git: fakeGit, declaredPromises: () => ["a-thing"] });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.reason).toMatch(/a-thing/);
		expect(!r.ok && r.reason).toMatch(/indusk promises confirm demo/);
		expect(calls).toEqual([]);
	});

	it("refuses a plan that is not in the planning folder, and the archive folder itself", () => {
		expect(archivePlan(root, "nope", { git: fakeGit, declaredPromises: () => [] }).ok).toBe(false);
		expect(archivePlan(root, "archive", { git: fakeGit, declaredPromises: () => [] }).ok).toBe(
			false,
		);
		expect(calls).toEqual([]);
	});

	it("is not refused by the shell guard", () => {
		expect(refusalFor("indusk plans archive demo", root)).toBeNull();
	});

	it("is the retrospective's archival step, with no raw mv of a plan folder", () => {
		const skill = readFileSync(
			new URL("../../../skills/retrospective.md", import.meta.url).pathname,
			"utf8",
		);
		const step9 = skill.slice(skill.indexOf("### Step 9"), skill.indexOf("### Step 10"));
		expect(step9).toMatch(/indusk plans archive \{plan-name\}/);
		expect(step9).not.toMatch(/\bmv \.indusk\/planning/);
	});
});

// promise: a-plan-document-is-written-through-its-checks
