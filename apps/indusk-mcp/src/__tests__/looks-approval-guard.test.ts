import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * ui-promises A3 (hook half) — promise: a-mockup-is-approved-by-a-person.
 *
 * Only the cockpit's Approve makes a mockup the reference. An agent's Write or
 * Edit to an app's `approved.json` is refused before it lands, naming the
 * cockpit's Approve; the mockups themselves, and every other file beside the
 * record, stay the agent's to draw. The hook is driven as a process, the way
 * Claude Code runs it: an event on stdin, the exit code and stderr read back.
 *
 * The project root is a path that never exists: the guard judges the path an
 * agent names, never the file's contents, so nothing is written for it to read.
 */

const ROOT = "/tmp/looks-approval-guard-project";
const RECORD = ".indusk/mockups/demo/approved.json";

const write = (rel: string) => ({
	tool_name: "Write",
	tool_input: { file_path: join(ROOT, rel), content: '{ "approvals": [] }\n' },
	cwd: ROOT,
});

const edit = (rel: string) => ({
	tool_name: "Edit",
	tool_input: { file_path: join(ROOT, rel), old_string: "a", new_string: "b" },
	cwd: ROOT,
});

describe("A3 — an agent's write to approved.json is refused, naming the cockpit's Approve", () => {
	it("refuses a Write to .indusk/mockups/<app>/approved.json", async () => {
		const r = await runHook("looks-approval-guard.js", write(RECORD));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/cockpit/i);
		expect(r.stderr).toMatch(/Approve/);
	});

	it("refuses an Edit of the same file", async () => {
		const r = await runHook("looks-approval-guard.js", edit(RECORD));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/cockpit/i);
	});

	it("refuses it under any app, and under a relative path", async () => {
		const other = await runHook(
			"looks-approval-guard.js",
			write(".indusk/mockups/admin/approved.json"),
		);
		expect(other.exitCode, other.stderr).toBe(2);
		const relative = await runHook("looks-approval-guard.js", {
			...edit(RECORD),
			tool_input: { file_path: RECORD, old_string: "a", new_string: "b" },
		});
		expect(relative.exitCode, relative.stderr).toBe(2);
	});

	it("lets a mockup, the foundation and the devices be written — drawing is the agent's", async () => {
		for (const rel of [
			".indusk/mockups/demo/screens/home.empty.html",
			".indusk/mockups/demo/foundation.tokens.json",
			".indusk/mockups/demo/devices.json",
			"src/approved.json",
		]) {
			const r = await runHook("looks-approval-guard.js", write(rel));
			expect(r.exitCode, `${rel}: ${r.stderr}`).toBe(0);
		}
	});

	it("leaves every other tool alone", async () => {
		const r = await runHook("looks-approval-guard.js", {
			tool_name: "Bash",
			tool_input: { command: "git status" },
			cwd: ROOT,
		});
		expect(r.exitCode, r.stderr).toBe(0);
	});
});
