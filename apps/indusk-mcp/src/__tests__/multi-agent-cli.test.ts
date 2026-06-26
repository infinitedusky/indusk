import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent plan — CLI surface rows.
 *
 * T3, T4, T5 — live (Phase 2). Exercise the `indusk agent register/done/list/prune`
 * surface end-to-end against a tmp project.
 *
 * T1, T2 — `.skip()` until Phase 3 (skill rewrites unlock the catchup integration).
 *
 * See `.indusk/planning/handoff-multi-agent/impl.md` for the full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

interface TestProject {
	dir: string;
	env: NodeJS.ProcessEnv;
}

function makeProject(sessionId: string): TestProject {
	const dir = mkdtempSync(join(tmpdir(), "ma-cli-"));
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	writeFileSync(
		join(dir, ".indusk/config.json"),
		JSON.stringify({ mode: "normal", agents: { stale_ttl_minutes: 60 } }),
	);
	const env = { ...process.env, CLAUDE_CODE_SESSION_ID: sessionId };
	return { dir, env };
}

function runCli(
	project: TestProject,
	args: string[],
): { stdout: string; stderr: string; status: number | null } {
	const res = spawnSync("node", [CLI_BIN, ...args], {
		cwd: project.dir,
		env: project.env,
		encoding: "utf-8",
	});
	return {
		stdout: res.stdout ?? "",
		stderr: res.stderr ?? "",
		status: res.status,
	};
}

describe.skipIf(SHOULD_SKIP)("multi-agent CLI — handoff-multi-agent trajectory", () => {
	let project: TestProject;

	beforeEach(() => {
		project = makeProject("session-A-uuid");
	});

	afterEach(() => {
		rmSync(project.dir, { recursive: true, force: true });
	});

	// T3 — Phase 2: register-then-list shows the registered task within 5s
	it("T3: registering as an agent makes you visible within 5 seconds", () => {
		const start = Date.now();
		const reg = runCli(project, ["agent", "register", "--task", "auth refactor"]);
		expect(reg.status).toBe(0);
		expect(reg.stdout).toMatch(/Registered agent/);
		const list = runCli(project, ["agent", "list"]);
		const elapsed = Date.now() - start;
		expect(list.status).toBe(0);
		expect(list.stdout).toMatch(/auth refactor/);
		expect(elapsed).toBeLessThan(5000);
	});

	// T4 — Phase 2: `agent done` removes the current session's presence file
	it("T4: an agent that ends cleanly disappears from the bulletin", () => {
		runCli(project, ["agent", "register", "--task", "transient"]);
		const before = runCli(project, ["agent", "list"]);
		expect(before.stdout).toMatch(/transient/);

		const done = runCli(project, ["agent", "done"]);
		expect(done.status).toBe(0);

		const after = runCli(project, ["agent", "list"]);
		expect(after.stdout).not.toMatch(/transient/);
		expect(after.stdout).toMatch(/no agents currently registered/);
	});

	// T5 — Phase 2: mtime older than stale_ttl_minutes is filtered from `agent list`
	// (verified from a *different* session than the stale one — T13's Phase 6 fix
	// makes `agent list` self-heartbeat the caller, so an in-process stale check
	// against the same session would defeat the staleness filter by refreshing mtime.)
	it("T5: a stale presence file stops appearing after the TTL elapses (cross-session)", () => {
		// Session A registers as "ghost"
		runCli(project, ["agent", "register", "--task", "ghost"]);

		// Different session B observes the bulletin — sees ghost while fresh
		const observerB: TestProject = {
			dir: project.dir,
			env: { ...process.env, CLAUDE_CODE_SESSION_ID: "session-B-observer" },
		};
		const fresh = runCli(observerB, ["agent", "list"]);
		expect(fresh.stdout).toMatch(/ghost/);

		// Backdate session A's presence file to two hours ago (> default 60min TTL).
		// Session A is the "ghost" — it never calls list itself again (would
		// self-heartbeat), so it stays stale.
		const ghostPath = join(project.dir, ".indusk/agents/session-A-uuid.md");
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
		utimesSync(ghostPath, twoHoursAgo, twoHoursAgo);

		// Session B observes again — ghost has aged out
		const stale = runCli(observerB, ["agent", "list"]);
		expect(stale.stdout).not.toMatch(/ghost/);
	});

	// T5 supporting: `agent prune` removes stale files unconditionally
	it("T5 supporting: prune removes stale files unconditionally", () => {
		runCli(project, ["agent", "register", "--task", "ghost"]);
		const presencePath = join(project.dir, ".indusk/agents/session-A-uuid.md");
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
		utimesSync(presencePath, twoHoursAgo, twoHoursAgo);

		const prune = runCli(project, ["agent", "prune"]);
		expect(prune.status).toBe(0);
		expect(prune.stdout).toMatch(/Pruned 1/);
		expect(existsSync(presencePath)).toBe(false);
	});

	// `list` is well-defined on an empty bulletin
	it("list returns no-agents-message cleanly when nothing is registered", () => {
		const list = runCli(project, ["agent", "list"]);
		expect(list.status).toBe(0);
		expect(list.stdout).toMatch(/no agents currently registered/);
	});

	// `done` is silent on an already-gone presence file
	it("done is a silent no-op when the presence file is already gone", () => {
		const done = runCli(project, ["agent", "done"]);
		expect(done.status).toBe(0);
		expect(done.stdout).toMatch(/already done/);
	});

	// T12 — Phase 6 (falsification): sessionId path-traversal cannot escape .indusk/agents/
	it("T12: poisoned $CLAUDE_CODE_SESSION_ID with `..` cannot write outside .indusk/agents/", () => {
		const evilProject: TestProject = {
			dir: project.dir,
			env: { ...process.env, CLAUDE_CODE_SESSION_ID: "../escaped" },
		};
		const reg = runCli(evilProject, ["agent", "register", "--task", "evil"]);

		// Expected post-fix: register either exits non-zero with a sanitizer error
		// OR sanitizes the ID so the file lands inside agents/. Either way:
		// no file outside the agents directory.
		const escaped = join(project.dir, ".indusk/escaped.md");
		const insideEscaped = join(project.dir, ".indusk/agents/..", "escaped.md");
		expect(existsSync(escaped)).toBe(false);
		expect(existsSync(insideEscaped)).toBe(false);

		// And the command surfaces the failure (non-zero exit + error message)
		expect(reg.status).not.toBe(0);
		expect((reg.stderr + reg.stdout).toLowerCase()).toMatch(/session id|invalid|sanitiz/);
	});

	it("T12 supporting: --session-id with `..` cannot delete outside .indusk/agents/", () => {
		// Drop a sentinel file at <projectDir>/.indusk/sentinel.md that a traversal-escaping
		// agent done would otherwise wipe out via rmSync(..., { force: true }).
		writeFileSync(join(project.dir, ".indusk/sentinel.md"), "do not delete me");
		const done = runCli(project, ["agent", "done", "--session-id", "../sentinel"]);

		// Expected post-fix: done rejects the traversal-bearing session id; sentinel survives.
		expect(existsSync(join(project.dir, ".indusk/sentinel.md"))).toBe(true);
		expect(done.status).not.toBe(0);
		expect((done.stderr + done.stdout).toLowerCase()).toMatch(/session id|invalid|sanitiz/);
	});

	it("T12 supporting: normal UUID/pid session IDs still work end-to-end", () => {
		const uuidProject: TestProject = {
			dir: project.dir,
			env: { ...process.env, CLAUDE_CODE_SESSION_ID: "2c87e7b6-702a-4dcd-876f-a31820e0df3e" },
		};
		expect(runCli(uuidProject, ["agent", "register", "--task", "ok"]).status).toBe(0);
		const list = runCli(uuidProject, ["agent", "list"]);
		expect(list.stdout).toMatch(/ok/);
	});

	// T13 — Phase 6 (falsification): agent list self-heartbeats the caller's own presence file
	it("T13: `agent list` refreshes the caller's own presence-file mtime (implicit heartbeat)", () => {
		runCli(project, ["agent", "register", "--task", "long running"]);
		const presencePath = join(project.dir, ".indusk/agents/session-A-uuid.md");

		// Backdate to T-90min (older than the default 60min TTL — would be stale)
		const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000);
		utimesSync(presencePath, ninetyMinAgo, ninetyMinAgo);

		// Same session calls `agent list` — should self-heartbeat
		const beforeMtimeMs = statSync(presencePath).mtimeMs;
		runCli(project, ["agent", "list"]);

		const afterMtimeMs = statSync(presencePath).mtimeMs;

		// Post-fix: list touches own file mtime to "now"
		expect(afterMtimeMs).toBeGreaterThan(beforeMtimeMs);
		expect(Date.now() - afterMtimeMs).toBeLessThan(5000);

		// And: subsequent list calls now see the entry (no longer stale)
		const listAgain = runCli(project, ["agent", "list"]);
		expect(listAgain.stdout).toMatch(/long running/);
	});

	// T1 — Phase 3 unlock: two concurrent catchup flows both complete cleanly
	it.skip("T1: two agents starting catchup at the same time both complete", () => {
		// Intended shape (un-skip in Phase 3):
		//   const [a, b] = await Promise.all([
		//     runCatchupFlow(workbenchRoot, "agent-A"),
		//     runCatchupFlow(workbenchRoot, "agent-B"),
		//   ]);
		//   expect(a.exitCode).toBe(0);
		//   expect(b.exitCode).toBe(0);
		expect.fail("Phase 3 unlock — concurrent catchup flow requires register + skill rewrite");
	});

	// T2 — Phase 3 unlock: catchup output lists other agents' tasks
	it.skip("T2: a new agent's catchup sees other working agents' tasks", () => {
		// Intended shape (un-skip in Phase 3):
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "auth"], { cwd, env: sessionAEnv });
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "telemetry"], { cwd, env: sessionBEnv });
		//   const list = spawnSync(CLI_BIN, ["agent", "list"], { cwd });
		//   expect(list.stdout.toString()).toMatch(/auth/);
		//   expect(list.stdout.toString()).toMatch(/telemetry/);
		expect.fail("Phase 3 unlock — bulletin visibility surface lands with skill rewrite");
	});
});
