// lesson: choices-are-asked-as-questions
// clause: a-decision-is-a-question/never-decided-silently
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * decisions-as-questions T3: a document an unattended run saves that records a
 * choice as "decided unattended" with no question reference is refused naming
 * the line; the same line citing a question the plan's record holds saves; a
 * made-up id is refused; review and acceptance text is not checked.
 *
 * The hook is run as a process (the convention for the JS hook ports). Until
 * Build Phase 4 writes `validate-decided-unattended.js` the spawn finds no
 * script, so the exit code is not 2 and the first assertion fails on its own.
 */

const HOOK = "validate-decided-unattended.js" as never;
const unattended = { INDUSK_GATE_POLICY: "auto" };

let root: string;
let doc: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "decided-unattended-"));
	mkdirSync(join(root, ".indusk", "planning", "demo"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ otel: { role: "library" } }));
	doc = join(root, ".indusk", "planning", "demo", "adr.md");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const save = (content: string, file = doc, env: NodeJS.ProcessEnv = unattended) =>
	runHook(
		HOOK,
		{ tool_name: "Write", tool_input: { file_path: file, content }, cwd: root },
		{ cwd: root, env },
	);

describe("T3 — a choice is never recorded as decided unattended without a question", () => {
	it("refuses the line, naming it, and names the lesson", async () => {
		const r = await save("# ADR\n\n1. Use SQLite. Decided unattended: it is simplest.\n");
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/decided unattended/i);
		expect(r.stderr).toMatch(/adr\.md/);
		expect(r.stderr).toMatch(/:3\b/);
		expect(r.stderr).toMatch(/lesson: choices-are-asked-as-questions/);
	});

	it("saves the same line when it cites a question the plan's record holds", async () => {
		mkdirSync(join(root, ".indusk", "plan-history"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "plan-history", "demo.md"),
			"## question q-7\n\nstate: answered\n",
		);
		const r = await save("# ADR\n\n1. Use SQLite. Decided unattended (question: q-7).\n");
		expect(r.exitCode).toBe(0);
	});

	it("refuses an id the plan's record does not hold", async () => {
		const r = await save("# ADR\n\n1. Use SQLite. Decided unattended (question: q-999).\n");
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/q-999/);
	});

	it("does not check review or acceptance text, or a run with a person present", async () => {
		const review = join(root, ".indusk", "planning", "demo", "plan-review.md");
		expect((await save("The agent decided unattended here.\n", review)).exitCode).toBe(0);
		expect((await save("Decided unattended: x\n", doc, { INDUSK_GATE_POLICY: "ask" })).exitCode).toBe(
			0,
		);
	});
});
