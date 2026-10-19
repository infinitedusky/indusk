// clause: a-plan-document-is-written-through-its-checks/shell-write-refused
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * a-run-can-be-trusted A29, A30: the shell guard run as Claude Code runs it, an event
 * on stdin and an exit code and stderr read back. A file that starts the hook as a process
 * is a system-tier file.
 *
 * The hook does not exist until Build Phase 3. A missing hook is the spawned process's
 * non-zero exit, so each assertion below reads that exit and fails on its own assertion,
 * never on an import.
 */

const IMPL = "# demo — Impl\n\n- [ ] Write the thing.\n";

let root: string;
let impl: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "plan-write-guard-"));
	const planDir = join(root, ".indusk", "planning", "demo");
	mkdirSync(planDir, { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ otel: { role: "library" } }));
	impl = join(planDir, "impl.md");
	writeFileSync(impl, IMPL);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

// The shape of a captured Claude Code PreToolUse event for the shell tool.
const payload = (command: unknown) => ({
	session_id: "test-session",
	transcript_path: join(root, "transcript.jsonl"),
	cwd: root,
	hook_event_name: "PreToolUse",
	tool_name: "Bash",
	tool_input: { command },
});

describe("A30 — given a real shell-tool payload the hook refuses a write and the file is unchanged", () => {
	it("a sed -i on impl.md exits 2 naming impl.md and the Edit tool, and leaves the file as it was", async () => {
		const r = await runHook(
			"plan-write-guard.js",
			payload("sed -i '' 's/- \\[ \\]/- [x]/' .indusk/planning/demo/impl.md"),
			{ cwd: root },
		);
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/impl\.md/);
		expect(r.stderr).toMatch(/Edit tool/);
		expect(readFileSync(impl, "utf8")).toBe(IMPL);
	});

	it("a redirect into impl.md is refused the same way", async () => {
		const r = await runHook(
			"plan-write-guard.js",
			payload("echo '- [x] done' >> .indusk/planning/demo/impl.md"),
			{ cwd: root },
		);
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/impl\.md/);
		expect(readFileSync(impl, "utf8")).toBe(IMPL);
	});
});

describe("A29 — a malformed, empty or unparsable command neither breaks the shell tool nor refuses a read", () => {
	it("an empty command exits 0", async () => {
		const r = await runHook("plan-write-guard.js", payload(""), { cwd: root });
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("a command that is not text exits 0", async () => {
		const r = await runHook("plan-write-guard.js", payload(null), { cwd: root });
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("an unparsable command (an unclosed quote) exits 0", async () => {
		const r = await runHook("plan-write-guard.js", payload("echo 'unclosed"), { cwd: root });
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("a read of a plan document exits 0", async () => {
		const r = await runHook(
			"plan-write-guard.js",
			payload("cat .indusk/planning/demo/impl.md | head -5"),
			{ cwd: root },
		);
		expect(r.exitCode, r.stderr).toBe(0);
		expect(r.stderr).not.toMatch(/refus/i);
	});
});
