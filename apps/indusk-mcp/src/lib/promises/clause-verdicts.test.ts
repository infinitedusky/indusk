// clause: a-plan-document-is-written-through-its-checks/shell-write-refused
// clause: a-plan-document-is-written-through-its-checks/reads-pass
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureTracer, outcomesByClause } from "./capture-tracer.js";
import {
	appendDecision,
	DECISIONS_FILE,
	drainPlanWriteDecisions,
	judgeDecision,
	type PlanWriteLine,
	rewriteDecisionFile,
} from "./clause-verdicts.js";

/**
 * a-run-can-be-trusted A78, A79: the package judges the shell guard's decisions from two
 * sources the guard never uses — the plan folders on disk before and after the command,
 * and a real shell parser (`shell-quote`) — and reports both clauses of
 * `a-plan-document-is-written-through-its-checks` from them, never the hook.
 */

const ROOT = "/repo";
const IMPL = `${ROOT}/.indusk/planning/p/impl.md`;
const BEFORE = { ".indusk/planning/p/impl.md": [100, 1000] as [number, number] };

const decision = (over: Partial<PlanWriteLine> = {}): PlanWriteLine => ({
	kind: "decision",
	toolUseId: "t1",
	at: new Date("2026-10-19T12:00:00Z").toISOString(),
	command: "cat .indusk/planning/p/impl.md",
	cwd: ROOT,
	decision: "allowed",
	files: [IMPL],
	before: BEFORE,
	...over,
});

describe("A78 — shell-write-refused is judged from the parser and the disk", () => {
	it("a refused command the parser reads as a write to a plan path is upheld", () => {
		for (const command of [
			"sed -i 's/a/b/' .indusk/planning/p/impl.md",
			"echo x >> .indusk/planning/p/impl.md",
			"cd .indusk/planning/p && tee impl.md < /tmp/x",
			"git mv .indusk/planning/p/impl.md .indusk/planning/p/old.md",
			`node -e "require('fs').writeFileSync('.indusk/planning/p/impl.md','')"`,
			"bash -c 'rm .indusk/planning/p/impl.md'",
		]) {
			expect(judgeDecision(decision({ command, decision: "refused" })), command).toEqual({
				promise: "a-plan-document-is-written-through-its-checks",
				clause: "shell-write-refused",
			});
		}
	});

	it("an allowed command after which a plan document changed is broken, naming the file and the command", () => {
		const v = judgeDecision(decision({ command: "./scripts/tick.sh" }), {
			".indusk/planning/p/impl.md": [104, 2000],
		});
		expect(v?.clause).toBe("shell-write-refused");
		expect(v?.broken).toMatch(/\.indusk\/planning\/p\/impl\.md/);
		expect(v?.broken).toMatch(/\.\/scripts\/tick\.sh/);
	});

	it("a plan document created or removed by an allowed command is a change too", () => {
		expect(
			judgeDecision(decision({ command: "./x.sh" }), {
				...BEFORE,
				".indusk/planning/p/new.md": [1, 1],
			})?.broken,
		).toMatch(/new\.md/);
		expect(judgeDecision(decision({ command: "./x.sh" }), {})?.broken).toMatch(/impl\.md/);
	});

	it("an indusk command, or a git command that moves between committed states, is never judged a write", () => {
		const changed = { ".indusk/planning/p/impl.md": [104, 2000] as [number, number] };
		for (const command of [
			"indusk plans approve p",
			"git merge main",
			"git pull --rebase",
			"git checkout plan/p",
			"git switch main",
			"git reset --hard HEAD~1",
			"git stash pop",
		]) {
			expect(judgeDecision(decision({ command }), changed), command).toBeNull();
		}
	});
});

describe("A79 — reads-pass is judged from the parser and the disk", () => {
	it("a refused command the parser reads as only reading is reads-pass broken, naming the command", () => {
		const command = "grep -n x .indusk/planning/p/impl.md 2>&1 | head";
		const v = judgeDecision(decision({ command, decision: "refused" }));
		expect(v).toMatchObject({
			promise: "a-plan-document-is-written-through-its-checks",
			clause: "reads-pass",
		});
		expect(v?.broken).toContain(command);
	});

	it("an allowed command that named a plan path and changed nothing is reads-pass upheld", () => {
		expect(judgeDecision(decision(), BEFORE)).toEqual({
			promise: "a-plan-document-is-written-through-its-checks",
			clause: "reads-pass",
		});
	});
});

describe("A78, A79 — the drain reports each judged decision and removes what it sent", () => {
	let home: string;
	beforeEach(() => {
		home = mkdtempSync(join(tmpdir(), "clause-verdicts-"));
	});
	afterEach(() => rmSync(home, { recursive: true, force: true }));

	it("pairs a decision with its after line, reports both clauses, and keeps an unpaired fresh decision", async () => {
		const now = new Date("2026-10-19T12:01:00Z");
		appendDecision(home, decision({ toolUseId: "read" }));
		appendDecision(home, { kind: "after", toolUseId: "read", after: BEFORE });
		appendDecision(
			home,
			decision({
				toolUseId: "ref",
				command: "sed -i s/a/b/ .indusk/planning/p/impl.md",
				decision: "refused",
			}),
		);
		appendDecision(home, decision({ toolUseId: "wait", at: now.toISOString() }));
		const { tracer, spans } = captureTracer();
		const r = await drainPlanWriteDecisions(ROOT, { home, tracer, now, live: () => true });
		expect(outcomesByClause(spans)).toEqual({
			"reads-pass": "upheld",
			"shell-write-refused": "upheld",
		});
		expect(r).toEqual({ sent: 2, kept: 1 });
		const left = readFileSync(join(home, DECISIONS_FILE), "utf8").trim().split("\n");
		expect(left.map((l) => JSON.parse(l).toolUseId)).toEqual(["wait"]);
	});

	it("reports a broken write with the file and the command as the symptom", async () => {
		appendDecision(home, decision({ command: "./tick.sh" }));
		appendDecision(home, {
			kind: "after",
			toolUseId: "t1",
			after: { ".indusk/planning/p/impl.md": [104, 2000] },
		});
		const { tracer, spans } = captureTracer();
		await drainPlanWriteDecisions(ROOT, { home, tracer, live: () => true });
		expect(outcomesByClause(spans)).toEqual({ "shell-write-refused": "broken" });
		const symptom = JSON.stringify(spans[0].events);
		expect(symptom).toMatch(/impl\.md/);
		expect(symptom).toMatch(/tick\.sh/);
	});

	it("sends nothing and keeps every line when no daemon is there to receive it", async () => {
		appendDecision(
			home,
			decision({ decision: "refused", command: "rm .indusk/planning/p/impl.md" }),
		);
		const r = await drainPlanWriteDecisions(ROOT, { home, live: () => false });
		expect(r).toEqual({ sent: 0, kept: 1 });
		expect(readFileSync(join(home, DECISIONS_FILE), "utf8")).toMatch(/rm \.indusk/);
	});

	it("drops a decision whose command never finished after ten minutes, reporting nothing", async () => {
		appendDecision(home, decision({ at: "2026-10-19T11:00:00Z" }));
		const { tracer, spans } = captureTracer();
		const r = await drainPlanWriteDecisions(ROOT, {
			home,
			tracer,
			now: new Date("2026-10-19T12:00:00Z"),
			live: () => true,
		});
		expect(spans).toEqual([]);
		expect(r).toEqual({ sent: 0, kept: 0 });
	});

	it("reads no file as nothing to do, and skips a line that is not JSON without losing the rest", async () => {
		expect(await drainPlanWriteDecisions(ROOT, { home, live: () => true })).toEqual({
			sent: 0,
			kept: 0,
		});
		writeFileSync(join(home, DECISIONS_FILE), "{not json\n");
		appendDecision(
			home,
			decision({ decision: "refused", command: "rm .indusk/planning/p/impl.md" }),
		);
		const { tracer } = captureTracer();
		expect(await drainPlanWriteDecisions(ROOT, { home, tracer, live: () => true })).toEqual({
			sent: 1,
			kept: 0,
		});
		expect(existsSync(join(home, DECISIONS_FILE))).toBe(false);
	});
});

/**
 * A100 (a-run-can-be-trusted, Build Phase 7, falsification): Claude Code runs one turn's tool
 * calls at once, so an Edit of impl.md beside a long `pnpm test` changes a plan document between
 * the shell command's before and after. The witness records each editing-tool write under a plan
 * folder; the drain leaves out a change such a write accounts for, and blames the rest.
 */
describe("A100 — a plan document the Edit or Write tool changed during a shell command is not blamed on it", () => {
	let home: string;
	beforeEach(() => {
		home = mkdtempSync(join(tmpdir(), "clause-verdicts-tool-write-"));
	});
	afterEach(() => rmSync(home, { recursive: true, force: true }));

	const toolWrite = (stat: [number, number], at = "2026-10-19T12:00:30Z") =>
		({
			kind: "tool-write",
			at,
			root: ROOT,
			file: ".indusk/planning/p/impl.md",
			stat,
		}) as unknown as PlanWriteLine;

	it("an Edit recorded during the command, matching what the after snapshot holds, is left out", async () => {
		appendDecision(home, decision({ command: "pnpm test", files: [] }));
		appendDecision(home, toolWrite([104, 2000]));
		appendDecision(home, {
			kind: "after",
			toolUseId: "t1",
			after: { ".indusk/planning/p/impl.md": [104, 2000] },
		});
		const { tracer, spans } = captureTracer();
		await drainPlanWriteDecisions(ROOT, {
			home,
			tracer,
			now: new Date("2026-10-19T12:01:00Z"),
			live: () => true,
		});
		expect(outcomesByClause(spans)["shell-write-refused"]).toBeUndefined();
	});

	it("a change no tool write accounts for is still broken", async () => {
		appendDecision(home, decision({ command: "pnpm test", files: [] }));
		// the Edit wrote one size; the file now holds another: something else wrote it after
		appendDecision(home, toolWrite([104, 2000]));
		appendDecision(home, {
			kind: "after",
			toolUseId: "t1",
			after: { ".indusk/planning/p/impl.md": [110, 2500] },
		});
		const { tracer, spans } = captureTracer();
		await drainPlanWriteDecisions(ROOT, {
			home,
			tracer,
			now: new Date("2026-10-19T12:01:00Z"),
			live: () => true,
		});
		expect(outcomesByClause(spans)).toEqual({ "shell-write-refused": "broken" });
	});

	it("a tool write recorded before the command began does not excuse a change during it", async () => {
		appendDecision(home, toolWrite([104, 2000], "2026-10-19T11:59:00Z"));
		appendDecision(home, decision({ command: "./tick.sh", files: [] }));
		appendDecision(home, {
			kind: "after",
			toolUseId: "t1",
			after: { ".indusk/planning/p/impl.md": [104, 2000] },
		});
		const { tracer, spans } = captureTracer();
		await drainPlanWriteDecisions(ROOT, {
			home,
			tracer,
			now: new Date("2026-10-19T12:01:00Z"),
			live: () => true,
		});
		expect(outcomesByClause(spans)).toEqual({ "shell-write-refused": "broken" });
	});
});

describe("rewriting the decision file keeps what a hook appended while the drain ran", () => {
	let home: string;
	beforeEach(() => {
		home = mkdtempSync(join(tmpdir(), "clause-verdicts-rewrite-"));
	});
	afterEach(() => rmSync(home, { recursive: true, force: true }));

	it("writes the kept lines, then the appended ones; removes the file when nothing is left", () => {
		const path = join(home, DECISIONS_FILE);
		const read = `${JSON.stringify(decision({ toolUseId: "old" }))}\n`;
		writeFileSync(path, read);
		appendDecision(home, decision({ toolUseId: "late" }));
		rewriteDecisionFile(path, read, [decision({ toolUseId: "kept" })]);
		const ids = readFileSync(path, "utf8")
			.trim()
			.split("\n")
			.map((l) => JSON.parse(l).toolUseId);
		expect(ids).toEqual(["kept", "late"]);
		rewriteDecisionFile(path, readFileSync(path, "utf8"), []);
		expect(existsSync(path)).toBe(false);
	});
});
