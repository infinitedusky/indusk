import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { trustLikeProject } from "./trust.js";

/**
 * promise: a-plan-can-start-from-the-admin — admin-plan-authoring A1, a session in a plan's worktree.
 *
 * Every plan's worktree is a new path Claude Code has never trusted, so its
 * allow-list would be ignored and the person asked about everything. Sandy
 * (2026-10-06): trust is automatic — a worktree of a project Claude Code
 * already trusts is trusted like it. Never more: a project nobody trusted is
 * never trusted on their behalf, and nothing else in the config is touched.
 */

const TRUNK = "/Users/dev/code/proj";
const WORKTREE = "/Users/dev/code/proj-worktrees/seat-holds";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function config(
	projects: Record<string, Record<string, unknown>>,
	extra: Record<string, unknown> = {},
) {
	const dir = mkdtempSync(join(tmpdir(), "claude-config-"));
	dirs.push(dir);
	const path = join(dir, ".claude.json");
	writeFileSync(path, `${JSON.stringify({ numStartups: 7, ...extra, projects }, null, 2)}\n`);
	return { path, read: () => JSON.parse(readFileSync(path, "utf-8")) };
}

describe("a worktree of a trusted project is trusted like it", () => {
	it("records the worktree as trusted, and touches nothing else", () => {
		const c = config({ [TRUNK]: { hasTrustDialogAccepted: true, allowedTools: ["Bash(git:*)"] } });
		const before = c.read();
		expect(trustLikeProject(WORKTREE, TRUNK, c.path)).toBe("trusted");
		const after = c.read();
		expect(after.projects[WORKTREE]).toEqual({ hasTrustDialogAccepted: true });
		expect({ ...after, projects: { ...after.projects, [WORKTREE]: undefined } }).toEqual({
			...before,
			projects: { ...before.projects, [WORKTREE]: undefined },
		});
	});

	it("keeps what Claude Code already recorded for the worktree", () => {
		const c = config({
			[TRUNK]: { hasTrustDialogAccepted: true },
			[WORKTREE]: { hasTrustDialogAccepted: false, allowedTools: ["Read"] },
		});
		expect(trustLikeProject(WORKTREE, TRUNK, c.path)).toBe("trusted");
		expect(c.read().projects[WORKTREE]).toEqual({
			hasTrustDialogAccepted: true,
			allowedTools: ["Read"],
		});
	});

	it("a worktree already trusted is left as it is", () => {
		const c = config({
			[TRUNK]: { hasTrustDialogAccepted: true },
			[WORKTREE]: { hasTrustDialogAccepted: true },
		});
		const before = readFileSync(c.path, "utf-8");
		expect(trustLikeProject(WORKTREE, TRUNK, c.path)).toBe("already");
		expect(readFileSync(c.path, "utf-8")).toBe(before);
	});

	it("a project nobody trusted is never trusted on their behalf", () => {
		const c = config({ [TRUNK]: { hasTrustDialogAccepted: false } });
		const before = readFileSync(c.path, "utf-8");
		expect(trustLikeProject(WORKTREE, TRUNK, c.path)).toBe("untrusted");
		expect(readFileSync(c.path, "utf-8")).toBe(before);
	});

	it("a session in the project itself is not a worktree, and nothing is written", () => {
		const c = config({ [TRUNK]: { hasTrustDialogAccepted: false } });
		const before = readFileSync(c.path, "utf-8");
		expect(trustLikeProject(TRUNK, TRUNK, c.path)).toBe("untrusted");
		expect(readFileSync(c.path, "utf-8")).toBe(before);
	});

	it("a config that cannot be read is reported, never overwritten", () => {
		const c = config({});
		writeFileSync(c.path, "{ not json");
		expect(trustLikeProject(WORKTREE, TRUNK, c.path)).toBe("untrusted");
		expect(readFileSync(c.path, "utf-8")).toBe("{ not json");
	});
});
