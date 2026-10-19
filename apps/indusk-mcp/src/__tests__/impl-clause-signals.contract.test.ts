// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN } from "./helpers/cli.js";
import { CLAUSES, clausePlanProject, PLAN, PROMISE, testOf } from "./helpers/clause-plan-fixture.js";
import { runHook } from "./helpers/hook-runner.js";
import { implText } from "./helpers/plan-fixture.js";
import type { PromiseProject } from "./helpers/promises-fixture.js";

/**
 * a-run-can-be-trusted A41: a draft impl for a brief that states clauses, where no task
 * names a clause's signal, is refused by the save check, and what reaches the person is
 * that check's message. Nothing is saved over it. Starts the real hook as a process (which
 * runs `indusk promises contract`), so this is a system-tier file.
 *
 * The project is the clause-plan fixture: a real brief with `clauses: required`, its
 * registry, and test files carrying the clause tokens, so the only reason to refuse the
 * draft below is the missing signal tasks.
 */

const DEV_CLI = { INDUSK_BIN: `node ${CLI_BIN}`, INDUSK_SKIP_UPDATE_CHECK: "1" };

let project: PromiseProject | null = null;
afterEach(() => {
	if (project) rmSync(project.root, { recursive: true, force: true });
	project = null;
});

const draftImpl = () =>
	implText(PLAN, {
		status: "draft",
		keys: ["test_purpose: required"],
		columns: ["For", "Test"],
		rows: CLAUSES.map((c, i) => ({
			id: `A${i + 1}`,
			state: "planned",
			cells: { For: `clause: ${PROMISE}/${c.name}`, Test: testOf(c.name) },
		})),
	});

describe("A41 — a refused impl reaches the person as the save check's message", () => {
	it("a Write of a draft impl with no signal task is refused, listing each clause as promise/clause, and nothing is saved", async () => {
		project = clausePlanProject();
		const implPath = join(project.planRoot, ".indusk", "planning", PLAN, "impl.md");
		const before = readFileSync(implPath, "utf8");
		const r = await runHook(
			"validate-impl-structure.js",
			{
				tool_name: "Write",
				cwd: project.root,
				tool_input: { file_path: implPath, content: draftImpl() },
			},
			{ env: DEV_CLI },
		);
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain(`${PROMISE}/a-clause`);
		expect(r.stderr).toContain(`${PROMISE}/b-clause`);
		expect(existsSync(implPath)).toBe(true);
		expect(readFileSync(implPath, "utf8")).toBe(before);
	});
});
