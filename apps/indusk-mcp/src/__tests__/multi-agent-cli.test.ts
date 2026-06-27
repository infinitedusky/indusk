import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent-section-shape plan — CLI rows.
 *
 * After the section-shape rework, the bulletin lives as per-agent sections
 * inside .indusk/current.md. Tests exercise the `indusk agent` CLI end-to-end
 * against a tmp project.
 *
 *   T3, T7, T8 — live (Phase 2). Exercise register/done/list/prune against
 *     sections in current.md.
 *   T12 — live regression: path-traversal session IDs rejected at the CLI
 *     boundary (sanitizer in the lib helpers).
 *
 *   T1, T2 — `.skip()` until Phase 3 (skill rewrites unlock the catchup
 *     integration where two simulated agents interact).
 *
 * See `.indusk/planning/handoff-multi-agent-section-shape/impl.md` for the
 * full trajectory.
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

function readCurrentMd(project: TestProject): string {
	return readFileSync(join(project.dir, ".indusk/current.md"), "utf-8");
}

function backdateSectionTimestamp(
	project: TestProject,
	sessionId: string,
	isoTimestamp: string,
): void {
	const path = join(project.dir, ".indusk/current.md");
	const content = readFileSync(path, "utf-8");
	// Find the section block by session ID, replace its **Last updated**: line.
	const sessionIdPattern = new RegExp(
		`(\\*\\*Session ID\\*\\*:\\s*${sessionId.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\n\\*\\*Last updated\\*\\*:\\s*)([^\\n]+)`,
		"m",
	);
	const updated = content.replace(sessionIdPattern, `$1${isoTimestamp}`);
	writeFileSync(path, updated);
}

describe.skipIf(SHOULD_SKIP)("multi-agent CLI — section-shape trajectory", () => {
	let project: TestProject;

	beforeEach(() => {
		project = makeProject("session-A-uuid");
	});

	afterEach(() => {
		rmSync(project.dir, { recursive: true, force: true });
	});

	// T3-CLI — register-then-list shows the registered task in the bulletin
	it("T3-CLI: registering as an agent makes you visible within 5 seconds", () => {
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

	// T7 — Phase 2 end-to-end: `agent done` removes the section
	it("T7: an agent that ends cleanly disappears from the bulletin", () => {
		runCli(project, ["agent", "register", "--task", "transient"]);
		const before = runCli(project, ["agent", "list"]);
		expect(before.stdout).toMatch(/transient/);

		const done = runCli(project, ["agent", "done"]);
		expect(done.status).toBe(0);

		const after = runCli(project, ["agent", "list"]);
		expect(after.stdout).not.toMatch(/transient/);
		expect(after.stdout).toMatch(/no agents currently registered/);
	});

	// T8 — Phase 2 end-to-end: stale section filtered from `list`, prune removes it
	it("T8: a section with stale Last updated is filtered from list and removed by prune", () => {
		runCli(project, ["agent", "register", "--task", "ghost"]);
		const fresh = runCli(project, ["agent", "list"]);
		expect(fresh.stdout).toMatch(/ghost/);

		// Backdate the section's Last updated to 2h ago — exceeds the 60min TTL.
		// (Use a different session for the list call so it doesn't self-heartbeat the ghost.)
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		backdateSectionTimestamp(project, "session-A-uuid", twoHoursAgo);

		const observerB: TestProject = {
			dir: project.dir,
			env: { ...process.env, CLAUDE_CODE_SESSION_ID: "session-B-observer" },
		};
		const staleList = runCli(observerB, ["agent", "list"]);
		expect(staleList.stdout).not.toMatch(/ghost/);
	});

	it("T8 supporting: prune removes stale sections unconditionally", () => {
		runCli(project, ["agent", "register", "--task", "ghost"]);
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		backdateSectionTimestamp(project, "session-A-uuid", twoHoursAgo);

		const prune = runCli(project, ["agent", "prune"]);
		expect(prune.status).toBe(0);
		expect(prune.stdout).toMatch(/Pruned 1/);

		const content = readCurrentMd(project);
		expect(content).not.toMatch(/ghost/);
	});

	// `list` empty-bulletin behavior
	it("list returns no-agents-message when nothing is registered", () => {
		const list = runCli(project, ["agent", "list"]);
		expect(list.status).toBe(0);
		expect(list.stdout).toMatch(/no agents currently registered/);
	});

	// `done` silent no-op when section is already gone
	it("done is a silent no-op when no section exists for this session", () => {
		const done = runCli(project, ["agent", "done"]);
		expect(done.status).toBe(0);
		expect(done.stdout).toMatch(/already done/);
	});

	// T12 — path-traversal session IDs rejected at the CLI boundary
	it("T12: poisoned $CLAUDE_CODE_SESSION_ID with `..` is rejected", () => {
		const evilProject: TestProject = {
			dir: project.dir,
			env: { ...process.env, CLAUDE_CODE_SESSION_ID: "../escaped" },
		};
		const reg = runCli(evilProject, ["agent", "register", "--task", "evil"]);
		expect(reg.status).not.toBe(0);
		expect((reg.stderr + reg.stdout).toLowerCase()).toMatch(/session id|invalid|sanitiz/);
	});

	it("T12 supporting: --session-id with `..` is rejected by done", () => {
		const done = runCli(project, ["agent", "done", "--session-id", "../sentinel"]);
		expect(done.status).not.toBe(0);
		expect((done.stderr + done.stdout).toLowerCase()).toMatch(/session id|invalid|sanitiz/);
	});

	it("T12 supporting: normal UUID session IDs still work end-to-end", () => {
		const uuidProject: TestProject = {
			dir: project.dir,
			env: { ...process.env, CLAUDE_CODE_SESSION_ID: "2c87e7b6-702a-4dcd-876f-a31820e0df3e" },
		};
		const reg = runCli(uuidProject, ["agent", "register", "--task", "real work"]);
		expect(reg.status).toBe(0);
		const list = runCli(uuidProject, ["agent", "list"]);
		expect(list.stdout).toMatch(/real work/);
	});

	// T1 — Phase 3 unlock: two concurrent catchup flows both complete cleanly
	it.skip("T1: two agents starting catchup at the same time both complete", () => {
		// Intended shape (un-skip in Phase 3):
		//   const [a, b] = await Promise.all([runCatchupFlow(workbench, "A"), runCatchupFlow(workbench, "B")]);
		//   expect(a.exitCode).toBe(0);
		//   expect(b.exitCode).toBe(0);
		expect.fail("Phase 3 unlock — concurrent catchup flow requires skill rewrite");
	});

	// T2 — Phase 3 unlock: catchup output lists other agents' sections
	it.skip("T2: a new agent's catchup sees other working agents' sections", () => {
		// Intended shape (un-skip in Phase 3):
		//   register agent A and B with distinct sessionIds
		//   read catchup output as a third session — assert both task names appear
		expect.fail("Phase 3 unlock — catchup-reads-sections behavior lands with skill rewrite");
	});
});
