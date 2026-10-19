import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type PlanningReadDeps, PlanningUnreadable, readPlanningState } from "./read-planning.js";

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
