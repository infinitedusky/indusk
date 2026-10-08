import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bookkeepingRoots } from "../lib/bookkeeping/roots.js";
import { runHook } from "./helpers/hook-runner.js";
import { promiseProject } from "./helpers/promises-fixture.js";

/**
 * incident-recording A18 — promise: a-break-reaches-the-working-agent.
 *
 * The recorder leaves each break in the project's inbox, in its home; on the
 * next turn of a session in that project, the prompt hook puts every
 * undelivered entry in front of the agent and marks it delivered, so a later
 * turn repeats nothing. A session in another project hears nothing, and an
 * inbox that cannot be read is said rather than skipped.
 *
 * Driven through the hook's real entry point. Red today: there is no
 * `break-inbox.js` to run (a spawned process — a boundary red).
 */

let home: string;
let project: string;
let other: string;
let inbox: string;

const entry = (id: string, incident: string) =>
	`${JSON.stringify({
		id,
		at: "2026-10-08T20:00:05Z",
		kind: "break",
		promise: "seat-released",
		incident,
		owner: "seat-holds",
		phase: `Maintenance — ${incident}`,
	})}\n`;

const prompt = (cwd: string) => ({
	hook_event_name: "UserPromptSubmit",
	session_id: "s-1",
	prompt: "what is next?",
	cwd,
});

function context(stdout: string): string {
	if (!stdout.trim()) return "";
	const out = JSON.parse(stdout) as { hookSpecificOutput?: { additionalContext?: string } };
	return out.hookSpecificOutput?.additionalContext ?? "";
}

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "break-inbox-home-"));
	project = promiseProject({ domains: ["seating"] }).root;
	other = promiseProject({ domains: ["seating"] }).root;
	const dir = bookkeepingRoots(project, home).home;
	mkdirSync(dir, { recursive: true });
	inbox = join(dir, "inbox.jsonl");
	appendFileSync(inbox, entry("e1", "i-2026-10-08-seat-released"));
	appendFileSync(inbox, entry("e2", "i-2026-10-08-seat-released-2"));
	appendFileSync(inbox, entry("e0", "i-2026-10-07-seat-released"));
	appendFileSync(join(dir, "inbox-delivered.jsonl"), `${JSON.stringify({ id: "e0" })}\n`);
});
afterEach(() => {
	for (const d of [home, project, other]) rmSync(d, { recursive: true, force: true });
});

describe("A18 — the next turn hears every undelivered break, once", () => {
	it("puts both undelivered entries in front of the agent, and only those", async () => {
		const r = await runHook("break-inbox.js", prompt(project), { env: { INDUSK_HOME: home } });
		expect(r.exitCode, r.stderr).toBe(0);
		const said = context(r.stdout);
		expect(said).toContain("i-2026-10-08-seat-released");
		expect(said).toContain("i-2026-10-08-seat-released-2");
		expect(said).toContain("seat-holds");
		expect(said).not.toContain("i-2026-10-07-seat-released");
	});

	it("marks them delivered, so the turn after says nothing", async () => {
		await runHook("break-inbox.js", prompt(project), { env: { INDUSK_HOME: home } });
		const delivered = readFileSync(
			join(bookkeepingRoots(project, home).home, "inbox-delivered.jsonl"),
			"utf-8",
		);
		expect(delivered.trim().split("\n")).toHaveLength(3);
		const again = await runHook("break-inbox.js", prompt(project), { env: { INDUSK_HOME: home } });
		expect(again.exitCode, again.stderr).toBe(0);
		expect(context(again.stdout)).toBe("");
	});

	it("every session in the project hears it once: a second session's next turn is told too", async () => {
		await runHook("break-inbox.js", prompt(project), { env: { INDUSK_HOME: home } });
		const second = await runHook(
			"break-inbox.js",
			{ ...prompt(project), session_id: "s-2" },
			{ env: { INDUSK_HOME: home } },
		);
		expect(second.exitCode, second.stderr).toBe(0);
		expect(context(second.stdout)).toContain("i-2026-10-08-seat-released");
		const again = await runHook(
			"break-inbox.js",
			{ ...prompt(project), session_id: "s-2" },
			{ env: { INDUSK_HOME: home } },
		);
		expect(context(again.stdout)).toBe("");
	});

	it("a session in another project hears nothing", async () => {
		const r = await runHook("break-inbox.js", prompt(other), { env: { INDUSK_HOME: home } });
		expect(r.exitCode, r.stderr).toBe(0);
		expect(context(r.stdout)).toBe("");
	});

	it("an inbox it cannot read is said, never skipped", async () => {
		appendFileSync(inbox, "{not json\n");
		const r = await runHook("break-inbox.js", prompt(project), { env: { INDUSK_HOME: home } });
		expect(r.exitCode, r.stderr).toBe(0);
		expect(context(r.stdout)).toMatch(/inbox/i);
		expect(context(r.stdout)).toMatch(/could not|cannot|unreadable/i);
	});
});
