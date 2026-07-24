import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * End-to-end subprocess tests for eval-trigger.js after the 1.31.7
 * workbench-mode-rail-integrity refactor.
 *
 * T4 — workbench-shaped tmpdir: eval-trigger driven from a cwd inside the
 *      wrapped repo successfully resolves the change ID (via gitPath = wrapped
 *      repo) AND writes its lifecycle markers to system.log (under statePath
 *      = workbench root). Pre-1.31.7, the hook bailed with "no git commit ID
 *      available" because findProjectRoot() landed at workbench root and
 *      `git rev-parse --short HEAD` ran against a non-git-repo directory.
 *
 * T5 — single-repo tmpdir: the existing single-project shape continues to
 *      work — no regression. The hook resolves change ID via gitPath (which
 *      equals statePath in single-repo mode) and writes lifecycle markers
 *      correctly.
 *
 * The hook spawns an evaluator subprocess in the background; in these tests
 * the spawn target won't have a real `claude` binary on PATH, so the spawn
 * itself may fail later — what we assert is that the hook got far enough to
 * START the spawn. The syslog "evaluator spawned" entry is the proof that the
 * trigger regex matched, exit_code check passed, and change ID was resolved.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");

function gitInit(dir: string): string {
	execSync("git init -q", { cwd: dir });
	execSync('git config user.email "test@example.com"', { cwd: dir });
	execSync('git config user.name "test"', { cwd: dir });
	writeFileSync(join(dir, "README.md"), "test");
	execSync("git add . && git commit -q -m 'init'", { cwd: dir });
	return execSync("git rev-parse --short HEAD", { cwd: dir, encoding: "utf-8" }).trim();
}

interface HookEvent {
	cwd: string;
	tool_name: string;
	tool_input: { command: string };
	tool_response: { exit_code: number };
}

function buildHookEvent(cwd: string, command = 'git commit -m "test"'): HookEvent {
	return {
		cwd,
		tool_name: "Bash",
		tool_input: { command },
		tool_response: { exit_code: 0 },
	};
}

function runHook(
	event: HookEvent,
	hookCwd: string,
): { stdout: string; stderr: string; status: number | null } {
	const result = spawnSync("node", [HOOK_PATH], {
		cwd: hookCwd,
		input: JSON.stringify(event),
		encoding: "utf-8",
		timeout: 10000,
	});
	return {
		stdout: result.stdout,
		stderr: result.stderr,
		status: result.status,
	};
}

function writeEvalConfig(statePath: string): void {
	mkdirSync(join(statePath, ".indusk"), { recursive: true });
	writeFileSync(
		join(statePath, ".indusk/config.json"),
		JSON.stringify({ eval: { enabled: true } }),
	);
}

describe("T4: eval-trigger fires against workbench-shaped projects", () => {
	let tmpRoot: string;
	let workbenchRoot: string;
	let wrappedRepo: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "eval-trigger-workbench-"));
		workbenchRoot = tmpRoot;
		writeEvalConfig(workbenchRoot);
		wrappedRepo = join(workbenchRoot, "numero");
		mkdirSync(wrappedRepo);
		gitInit(wrappedRepo);
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it("resolves change ID via gitPath (wrapped repo) and writes system.log under statePath (workbench root)", () => {
		const event = buildHookEvent(wrappedRepo);
		runHook(event, wrappedRepo);

		// system.log MUST be written under the workbench root (statePath), not the wrapped repo
		const systemLogPath = join(workbenchRoot, ".indusk/eval/system.log");
		expect(existsSync(systemLogPath), "system.log should exist under workbench root").toBe(true);

		const systemLog = readFileSync(systemLogPath, "utf-8");

		// Hook MUST resolve a non-empty change ID (not "no git commit ID available")
		// — this is the load-bearing assertion for the workbench-mode fix.
		expect(systemLog, "system.log content").not.toMatch(/skip — no git commit ID available/);

		// Hook MUST reach the evaluator-spawn stage (proves trigger regex + exit_code
		// check + change ID resolution all succeeded).
		expect(systemLog).toMatch(/spawning evaluator|evaluator spawned/);

		// And it should reference the wrapped repo's HEAD short SHA, not "(none)" or empty
		expect(systemLog).toMatch(/changeId: [a-f0-9]+/);
	});
});

describe("T5: eval-trigger continues to work in single-repo mode (regression)", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "eval-trigger-single-repo-"));
		writeEvalConfig(tmpRoot);
		gitInit(tmpRoot);
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it("resolves change ID and writes lifecycle markers on a single-repo project — same as pre-1.31.7", () => {
		const event = buildHookEvent(tmpRoot);
		runHook(event, tmpRoot);

		const systemLogPath = join(tmpRoot, ".indusk/eval/system.log");
		expect(existsSync(systemLogPath)).toBe(true);

		const systemLog = readFileSync(systemLogPath, "utf-8");
		expect(systemLog).not.toMatch(/skip — no git commit ID available/);
		expect(systemLog).toMatch(/spawning evaluator|evaluator spawned/);
		expect(systemLog).toMatch(/changeId: [a-f0-9]+/);
	});
});
