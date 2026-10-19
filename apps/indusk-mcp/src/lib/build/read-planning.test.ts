// clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check
// clause: an-accepted-brief-is-planned-unasked/decides-and-records
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextPlanningStep } from "./next-planning-step.js";
import {
	type PlanningReadDeps,
	PlanningUnreadable,
	readPlanningState,
	realPlanningReads,
} from "./read-planning.js";

/**
 * promise: an-accepted-brief-is-planned-unasked — the reader that turns a plan
 * on disk into what `nextPlanningStep` decides from. The checks it asks (the
 * contract, the impl hook, the looks) are fakes here; their own rules are
 * tested where they live. What is pinned is which documents the workflow
 * needs, which exist, and that each answer is read from the right check.
 */

const PLAN = "a-plan";
let root: string;
let dir: string;

const doc = (status: string, workflow = "feature") =>
	`---\ntitle: x\nstatus: ${status}\nworkflow: ${workflow}\n---\n\nbody\n`;
const write = (file: string, text: string) => writeFileSync(join(dir, file), text);

function fakes(over: Partial<PlanningReadDeps> = {}): PlanningReadDeps & { hooked: string[] } {
	const hooked: string[] = [];
	return {
		hooked,
		locate: async () => ({ root, dir }),
		contract: () => ({ ok: true, summary: {} as never }),
		runHook: (input) => {
			hooked.push(input.tool_input.file_path);
			return { status: 0 };
		},
		unapprovedLooks: async () => [],
		...over,
	};
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "read-planning-"));
	dir = join(root, ".indusk", "planning", PLAN);
	mkdirSync(dir, { recursive: true });
	write("brief.md", doc("accepted"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("readPlanningState", () => {
	it("reads a brief alone: the workflow's documents needed, none written", async () => {
		const s = await readPlanningState(root, PLAN, fakes());
		expect(s.required).toContain("test-plan");
		expect(s.required).toContain("adr");
		expect(s.documents["test-plan"].exists).toBe(false);
		expect(s.documents.adr.exists).toBe(false);
		expect(s.documents.impl.exists).toBe(false);
		expect(s.implStatus).toBeNull();
		expect(s.briefStatus).toBe("accepted");
	});

	it("reads which documents exist and the impl's status", async () => {
		write("test-plan.md", doc("accepted"));
		write("impl.md", doc("draft"));
		const s = await readPlanningState(root, PLAN, fakes());
		expect(s.documents["test-plan"]).toEqual({ exists: true, ok: true });
		expect(s.documents.adr.exists).toBe(false);
		expect(s.documents.impl.exists).toBe(true);
		expect(s.implStatus).toBe("draft");
	});

	it("runs the impl hook on the impl's content and reads its exit as the structure check", async () => {
		write("impl.md", doc("draft"));
		const passing = fakes();
		expect((await readPlanningState(root, PLAN, passing)).documents.impl.ok).toBe(true);
		expect(passing.hooked).toEqual([join(dir, "impl.md")]);
		const failing = fakes({ runHook: () => ({ status: 2 }) });
		expect((await readPlanningState(root, PLAN, failing)).documents.impl.ok).toBe(false);
	});

	it("does not run the hook when there is no impl", async () => {
		const f = fakes();
		await readPlanningState(root, PLAN, f);
		expect(f.hooked).toEqual([]);
	});

	it("reads the contract check and the looks the brief names", async () => {
		const s = await readPlanningState(
			root,
			PLAN,
			fakes({
				contract: () => ({ ok: false, refusals: [] }),
				unapprovedLooks: async (_r, briefText) =>
					briefText.includes("accepted") ? ["a look"] : [],
			}),
		);
		expect(s.contractOk).toBe(false);
		expect(s.unapprovedLooks).toEqual(["a look"]);
	});

	it("reads a blocker line from any of the three documents", async () => {
		write("adr.md", `${doc("proposed")}\nblocker: which store to use\n`);
		const s = await readPlanningState(root, PLAN, fakes());
		expect(s.blocker).toBe("which store to use");
	});

	it("leaves out a document the project turned off", async () => {
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({ planning: { documents_off: ["adr"] } }),
		);
		const s = await readPlanningState(root, PLAN, fakes());
		expect(s.required).not.toContain("adr");
	});

	it("refuses a plan with no folder, and one with no workflow type", async () => {
		await expect(
			readPlanningState(root, PLAN, fakes({ locate: async () => ({ root, dir: null }) })),
		).rejects.toBeInstanceOf(PlanningUnreadable);
		write("brief.md", "---\nstatus: accepted\n---\n\nno workflow\n");
		await expect(readPlanningState(root, PLAN, fakes())).rejects.toThrow(/workflow/);
	});
});

describe("A13 — a test plan the contract refuses is the test-plan step again", () => {
	it("A13 reads a test plan the contract check refuses as not ok", async () => {
		write("test-plan.md", doc("accepted"));
		const s = await readPlanningState(
			root,
			PLAN,
			fakes({
				contract: () => ({
					ok: false,
					refusals: [
						{
							file: `.indusk/planning/${PLAN}/test-plan.md`,
							message: "a promise clause has no clause plan",
						},
					],
				}),
			}),
		);
		expect(s.documents["test-plan"].ok).toBe(false);
		expect(nextPlanningStep(s).step).toBe("plan-test-plan");
	});

	it("A13 leaves the test plan ok when the refusal is about another document", async () => {
		write("test-plan.md", doc("accepted"));
		const s = await readPlanningState(
			root,
			PLAN,
			fakes({
				contract: () => ({
					ok: false,
					refusals: [{ file: `.indusk/planning/${PLAN}/brief.md`, message: "x" }],
				}),
			}),
		);
		expect(s.documents["test-plan"].ok).toBe(true);
	});
});

describe("A14 — the reader judges the impl under the policy the session wrote it under", () => {
	it("A14 passes an impl whose gate is skipped with a reason, as the build's session does", async () => {
		const impl = [
			"---",
			"title: x",
			"status: draft",
			"gate_policy: ask",
			"---",
			"",
			"# x",
			"",
			"### Phase 1: Work",
			"",
			"- [ ] do the thing",
			"",
			"#### Phase 1 Verification",
			"",
			"skip-reason: nothing to run for a prose change",
			"",
			"#### Phase 1 OTel",
			"",
			"- [ ] a span for it",
			"",
			"#### Phase 1 Context",
			"",
			"- [ ] note it",
			"",
			"#### Phase 1 Document",
			"",
			"- [ ] document it",
			"",
		].join("\n");
		write("impl.md", impl);
		const result = realPlanningReads.runHook({
			tool_name: "Write",
			tool_input: { file_path: join(dir, "impl.md"), content: impl },
			cwd: root,
		});
		expect(result.status).toBe(0);
	});
});

describe("A15 — a check that could not run is not an impl that failed", () => {
	it("A15 ends the read when the hook cannot run, saying so", async () => {
		write("impl.md", doc("draft"));
		for (const broken of [
			{ status: null, error: "spawn node ENOENT" },
			{ status: 1, stderr: "Error: Cannot find module validate-impl-structure.js" },
			{ status: null, signal: "SIGTERM" },
		]) {
			await expect(readPlanningState(root, PLAN, fakes({ runHook: () => broken }))).rejects.toThrow(
				PlanningUnreadable,
			);
		}
	});

	it("A15 keeps a refusal's words, and the run's stop reason carries them", async () => {
		write("impl.md", doc("draft"));
		const s = await readPlanningState(
			root,
			PLAN,
			fakes({ runHook: () => ({ status: 2, stderr: "Phase 1 is missing: Verification" }) }),
		);
		expect(s.documents.impl.ok).toBe(false);
		const stop = nextPlanningStep(s, {
			last: { progressed: false, error: null },
			previous: { progressed: false, error: null },
		});
		expect(stop).toMatchObject({ step: "cannot-continue" });
		expect(JSON.stringify(stop)).toContain("Phase 1 is missing: Verification");
	});
});

describe("A18 — a blocker line in a code block is not a blocker", () => {
	it("A18 ignores a blocker line inside a fenced code block", async () => {
		write(
			"adr.md",
			`${doc("proposed")}\nThe protocol:\n\n\`\`\`\nblocker: <what is blocked>\n\`\`\`\n`,
		);
		const s = await readPlanningState(root, PLAN, fakes());
		expect(s.blocker).toBeNull();
	});

	it("A18 still reads a blocker line outside any fence", async () => {
		write("adr.md", `${doc("proposed")}\n\`\`\`\ncode\n\`\`\`\n\nblocker: real one\n`);
		const s = await readPlanningState(root, PLAN, fakes());
		expect(s.blocker).toBe("real one");
	});
});
