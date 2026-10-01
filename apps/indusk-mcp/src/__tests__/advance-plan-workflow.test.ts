import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { type PlanWorktreeProject, planWorktreeProject } from "./helpers/plan-worktree-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * admin-plan-type — A25 (falsification, found while closing A23).
 *
 * `advance_plan` is a second door onto "what comes next". It named the next
 * document in lifecycle order whatever the plan's type — a bugfix with an
 * accepted test plan was sent to the ADR its type skips — and it kept its own
 * list of the words that mean a document is finished, one word short: research
 * that says `complete`, the word research documents use, was refused.
 *
 * Each case is a plan folder in a real repository, asked through the tool.
 */

let p: PlanWorktreeProject;

beforeEach(() => {
	p = planWorktreeProject("advance-workflow");
});
afterEach(() => p.cleanup());

function planWith(name: string, documents: Record<string, string[]>): void {
	const dir = join(p.trunk, ".indusk", "planning", name);
	mkdirSync(dir, { recursive: true });
	for (const [file, frontmatter] of Object.entries(documents)) {
		writeFileSync(
			join(dir, file),
			["---", `title: "${name}"`, ...frontmatter, "---", "", `# ${name}`, ""].join("\n"),
		);
	}
}

interface Advance {
	allowed?: boolean;
	transition?: string;
	nextStage?: string;
	missing?: string[];
}

async function advance(name: string): Promise<Advance> {
	const tools = toolCaller((server) => registerPlanTools(server, p.trunk));
	return (await tools.call("advance_plan", { name })).json as Advance;
}

describe("A25 — advance_plan names the next document the plan's type requires", () => {
	it("a bugfix with an accepted test plan advances to the impl, never the ADR", async () => {
		planWith("a-bugfix", {
			"brief.md": ["status: accepted", "workflow: bugfix"],
			"test-plan.md": ["status: accepted"],
		});
		const r = await advance("a-bugfix");
		expect(r.allowed).toBe(true);
		expect(r.nextStage).toBe("Create impl");
		expect(r.transition).toBe("test-plan → impl");
	});

	it("a feature with an accepted test plan advances to the ADR", async () => {
		planWith("a-feature", {
			"brief.md": ["status: accepted", "workflow: feature"],
			"test-plan.md": ["status: accepted"],
		});
		const r = await advance("a-feature");
		expect(r.allowed).toBe(true);
		expect(r.nextStage).toBe("Create adr");
		expect(r.transition).toBe("test-plan → adr");
	});

	it("a plan with no declared type advances as it does today", async () => {
		planWith("untyped", { "brief.md": ["status: accepted"], "test-plan.md": ["status: accepted"] });
		const r = await advance("untyped");
		expect(r.nextStage).toBe("Create adr");
		expect(r.transition).toBe("test-plan → adr");
	});

	it("a brief that is not accepted is still refused", async () => {
		planWith("drafted", { "brief.md": ["status: draft", "workflow: bugfix"] });
		const r = await advance("drafted");
		expect(r.allowed).toBe(false);
		expect((r.missing ?? []).join("\n")).toContain("draft");
	});

	it("a spike whose research says complete is finished, not refused", async () => {
		planWith("a-spike", { "research.md": ["status: complete", "workflow: spike"] });
		const r = await advance("a-spike");
		expect(r.allowed).toBe(true);
		expect(r.nextStage).toBe("Done");
	});
});
