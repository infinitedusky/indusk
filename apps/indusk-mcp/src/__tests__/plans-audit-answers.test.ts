import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	PLAN,
	type PlanWorktreeProject,
	planWorktreeProject,
} from "./helpers/plan-worktree-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";

/**
 * promise: an-audit-concern-gets-a-solution
 * clause: an-audit-concern-gets-a-solution/the-plan-answers — A39: the answers command checks a
 * signal answer's clause against the registry of the plan's own copy, not the directory it ran in.
 */

let project: PlanWorktreeProject;
afterEach(() => project?.cleanup());

const QUESTIONS = [
	"Does each row prove its promise's sentence, or something narrower?",
	"What does the diff change that no row touches?",
	"What does the code do that the brief never promised?",
	"Which rejected ADR alternative does the code quietly take?",
];

describe.skipIf(SHOULD_SKIP)("indusk plans audit-answers", () => {
	it("A39 — reads the clause registry from the plan's worktree, not the trunk it was run from", () => {
		project = planWorktreeProject("audit-answers");
		const wt = project.addWorktree("demo-wt", "plan/demo");
		project.writeRecord([{ plan: PLAN, path: wt, branch: "plan/demo" }]);
		// The plan's promise, with its clause, exists only on the plan's branch.
		const promises = join(wt, ".indusk", "promises");
		mkdirSync(promises, { recursive: true });
		writePromise(promises, {
			name: "only-on-the-plan",
			kind: "state",
			state: "declared",
			domain: "planning",
			owner: PLAN,
			raw: `---\nname: only-on-the-plan\nkind: state\nlifetime: holds\nstate: declared\ndomain: planning\nowner: ${PLAN}\nsites: []\ntests: []\nincidents: []\nclauses:\n  - name: holds\n    kind: split\n    statement: it holds\n---\n\nIt holds.\n`,
		});
		const audit = QUESTIONS.map((q, i) =>
			i === 0
				? `## ${q}\n- \`a.ts:1\` — x\n  - breaks when: y\n  - answer: signal — inv; here; daily; clause: only-on-the-plan/holds\n`
				: `## ${q}\n- nothing\n`,
		).join("\n");
		writeFileSync(
			join(wt, ".indusk", "planning", PLAN, "audit.md"),
			`${audit}\n## What let these through?\n- no process gap — a one-off\n`,
		);
		const r = runCli(project.trunk, ["plans", "audit-answers", PLAN]);
		expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
	});
});
