// clause: a-plan-document-is-written-through-its-checks/shell-write-refused
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DECISIONS_FILE, judgeDecision, PENDING_DIR } from "../lib/promises/clause-verdicts.js";
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
// The guard records each decision in the project's home: a temporary one, never the real home.
let env: NodeJS.ProcessEnv;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "plan-write-guard-"));
	const planDir = join(root, ".indusk", "planning", "demo");
	mkdirSync(planDir, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	impl = join(planDir, "impl.md");
	writeFileSync(impl, IMPL);
	env = { ...process.env, INDUSK_HOME: join(root, "home") };
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
			{ cwd: root, env },
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
			{ cwd: root, env },
		);
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/impl\.md/);
		expect(readFileSync(impl, "utf8")).toBe(IMPL);
	});
});

describe("A29 — a malformed, empty or unparsable command neither breaks the shell tool nor refuses a read", () => {
	it("an empty command exits 0", async () => {
		const r = await runHook("plan-write-guard.js", payload(""), { cwd: root, env });
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("a command that is not text exits 0", async () => {
		const r = await runHook("plan-write-guard.js", payload(null), { cwd: root, env });
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("an unparsable command (an unclosed quote) exits 0", async () => {
		const r = await runHook("plan-write-guard.js", payload("echo 'unclosed"), { cwd: root, env });
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("a read of a plan document exits 0", async () => {
		const r = await runHook(
			"plan-write-guard.js",
			payload("cat .indusk/planning/demo/impl.md | head -5"),
			{ cwd: root, env },
		);
		expect(r.exitCode, r.stderr).toBe(0);
		expect(r.stderr).not.toMatch(/refus/i);
	});
});

/**
 * Decision 8, run as Claude Code runs the hooks: the guard records its decision with the
 * plan folders' state before, the witness the state after, and the package's drain judges
 * the pair from the disk — so a write the guard let through (a script it cannot read, U1)
 * reports `shell-write-refused` broken.
 */
describe("the guard and its witness record each decision for the package to judge", () => {
	const decisionsIn = (home: string) => {
		const file = join(home, DECISIONS_FILE);
		return existsSync(file)
			? readFileSync(file, "utf8")
					.trim()
					.split("\n")
					.map((l) => JSON.parse(l))
			: [];
	};
	const homeOf = () => {
		const projects = join(root, "home", "projects");
		return join(projects, readdirSync(projects)[0]);
	};

	it("a refused write is one decision line with the state before and no after", async () => {
		const event = {
			...payload("echo x >> .indusk/planning/demo/impl.md"),
			tool_use_id: "toolu_ref",
		};
		expect((await runHook("plan-write-guard.js", event, { cwd: root, env })).exitCode).toBe(2);
		const lines = decisionsIn(homeOf());
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			kind: "decision",
			toolUseId: "toolu_ref",
			decision: "refused",
			files: [".indusk/planning/demo/impl.md"],
		});
		expect(Object.keys(lines[0].before)).toEqual([".indusk/planning/demo/impl.md"]);
	});

	it("an unnamed command that changed a plan document is recorded by the witness and judged broken", async () => {
		const event = { ...payload("./scripts/tick.sh"), tool_use_id: "toolu_script" };
		expect((await runHook("plan-write-guard.js", event, { cwd: root, env })).exitCode).toBe(0);
		expect(decisionsIn(homeOf())).toEqual([]);
		writeFileSync(impl, `${IMPL}- [x] ticked by a script\n`);
		const post = { ...event, hook_event_name: "PostToolUse", tool_response: {} };
		expect((await runHook("plan-write-witness.js", post, { cwd: root, env })).exitCode).toBe(0);
		const lines = decisionsIn(homeOf());
		expect(lines.map((l) => l.kind)).toEqual(["decision", "after"]);
		const verdict = judgeDecision(lines[0], lines[1].after);
		expect(verdict?.clause).toBe("shell-write-refused");
		expect(verdict?.broken).toMatch(/impl\.md.*tick\.sh/);
	});

	it("a named read is a decision, then an after line, judged reads-pass upheld", async () => {
		const event = { ...payload("cat .indusk/planning/demo/impl.md"), tool_use_id: "toolu_read" };
		expect((await runHook("plan-write-guard.js", event, { cwd: root, env })).exitCode).toBe(0);
		await runHook(
			"plan-write-witness.js",
			{ ...event, hook_event_name: "PostToolUse" },
			{ cwd: root, env },
		);
		const lines = decisionsIn(homeOf());
		expect(lines.map((l) => l.kind)).toEqual(["decision", "after"]);
		expect(judgeDecision(lines[0], lines[1].after)).toEqual({
			promise: "a-plan-document-is-written-through-its-checks",
			clause: "reads-pass",
		});
	});

	it("an unnamed command that changed nothing leaves no line behind", async () => {
		const event = { ...payload("ls"), tool_use_id: "toolu_ls" };
		await runHook("plan-write-guard.js", event, { cwd: root, env });
		await runHook(
			"plan-write-witness.js",
			{ ...event, hook_event_name: "PostToolUse" },
			{ cwd: root, env },
		);
		expect(decisionsIn(homeOf())).toEqual([]);
		expect(readdirSync(join(homeOf(), PENDING_DIR))).toEqual([]);
	});
});
