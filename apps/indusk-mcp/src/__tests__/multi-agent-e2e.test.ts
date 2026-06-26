import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * End-to-end multi-agent flow — handoff-multi-agent Phase 5.
 *
 * Two simulated Claude Code sessions on the same project (different
 * CLAUDE_CODE_SESSION_ID env vars) exercising the register / list / done
 * cycle. This is the CLI-level concurrency check; the worktree-level check
 * (two real worktrees, two real Claude Code sessions) is T10's manual smoke
 * at apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md.
 *
 * Each call spawns the published CLI from dist/, so the test exercises the
 * exact code path consumers run.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

interface Session {
	id: string;
	env: NodeJS.ProcessEnv;
}

function makeSession(projectDir: string, id: string): Session {
	const env = { ...process.env, CLAUDE_CODE_SESSION_ID: id };
	return { id, env };
}

function runAs(session: Session, projectDir: string, args: string[]) {
	const res = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: session.env,
		encoding: "utf-8",
	});
	return {
		stdout: res.stdout ?? "",
		stderr: res.stderr ?? "",
		status: res.status,
	};
}

describe.skipIf(SHOULD_SKIP)("multi-agent end-to-end — two simulated sessions on one project", () => {
	let projectDir: string;

	beforeEach(() => {
		projectDir = mkdtempSync(join(tmpdir(), "ma-e2e-"));
		mkdirSync(join(projectDir, ".indusk"), { recursive: true });
		writeFileSync(
			join(projectDir, ".indusk/config.json"),
			JSON.stringify({ mode: "normal", agents: { stale_ttl_minutes: 60 } }),
		);
	});

	afterEach(() => {
		rmSync(projectDir, { recursive: true, force: true });
	});

	it("two sessions register, both visible in `agent list`, both can come and go independently", () => {
		const sessionA = makeSession(projectDir, "session-A-uuid");
		const sessionB = makeSession(projectDir, "session-B-uuid");

		// Both register — order shouldn't matter
		expect(runAs(sessionA, projectDir, ["agent", "register", "--task", "auth refactor"]).status).toBe(0);
		expect(runAs(sessionB, projectDir, ["agent", "register", "--task", "telemetry spike"]).status).toBe(0);

		// `agent list` from either session sees both
		const listFromA = runAs(sessionA, projectDir, ["agent", "list"]);
		expect(listFromA.stdout).toMatch(/auth refactor/);
		expect(listFromA.stdout).toMatch(/telemetry spike/);

		const listFromB = runAs(sessionB, projectDir, ["agent", "list"]);
		expect(listFromB.stdout).toMatch(/auth refactor/);
		expect(listFromB.stdout).toMatch(/telemetry spike/);

		// A ends — B still visible
		expect(runAs(sessionA, projectDir, ["agent", "done"]).status).toBe(0);
		const afterA = runAs(sessionB, projectDir, ["agent", "list"]);
		expect(afterA.stdout).not.toMatch(/auth refactor/);
		expect(afterA.stdout).toMatch(/telemetry spike/);

		// B ends — bulletin empty
		expect(runAs(sessionB, projectDir, ["agent", "done"]).status).toBe(0);
		const final = runAs(sessionB, projectDir, ["agent", "list"]);
		expect(final.stdout).toMatch(/no agents currently registered/);
	});

	it("concurrent register calls from two sessions do not corrupt each other's presence files", async () => {
		const sessionA = makeSession(projectDir, "session-concurrent-A");
		const sessionB = makeSession(projectDir, "session-concurrent-B");

		// Spawn both registers in parallel
		const [resA, resB] = await Promise.all([
			Promise.resolve(runAs(sessionA, projectDir, ["agent", "register", "--task", "task A"])),
			Promise.resolve(runAs(sessionB, projectDir, ["agent", "register", "--task", "task B"])),
		]);
		expect(resA.status).toBe(0);
		expect(resB.status).toBe(0);

		// Both files exist
		expect(existsSync(join(projectDir, ".indusk/agents/session-concurrent-A.md"))).toBe(true);
		expect(existsSync(join(projectDir, ".indusk/agents/session-concurrent-B.md"))).toBe(true);

		// Each carries its own task
		const list = runAs(sessionA, projectDir, ["agent", "list"]);
		expect(list.stdout).toMatch(/task A/);
		expect(list.stdout).toMatch(/task B/);
	});

	it("session A's `agent done` does not affect session B's presence file", () => {
		const sessionA = makeSession(projectDir, "iso-A");
		const sessionB = makeSession(projectDir, "iso-B");

		runAs(sessionA, projectDir, ["agent", "register", "--task", "A's task"]);
		runAs(sessionB, projectDir, ["agent", "register", "--task", "B's task"]);

		runAs(sessionA, projectDir, ["agent", "done"]);

		// B's file untouched
		expect(existsSync(join(projectDir, ".indusk/agents/iso-A.md"))).toBe(false);
		expect(existsSync(join(projectDir, ".indusk/agents/iso-B.md"))).toBe(true);
	});

	it("registering twice in the same session overwrites the previous presence file (no duplicates)", () => {
		const session = makeSession(projectDir, "rerun-session");

		runAs(session, projectDir, ["agent", "register", "--task", "initial"]);
		runAs(session, projectDir, ["agent", "register", "--task", "updated"]);

		const list = runAs(session, projectDir, ["agent", "list"]);
		expect(list.stdout).toMatch(/updated/);
		expect(list.stdout).not.toMatch(/initial/);
	});
});
