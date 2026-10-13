import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bookkeepingRoots } from "../lib/bookkeeping/roots.js";
import { createDraft, listDrafts } from "../lib/drafts/index.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";

/**
 * promise: a-plan-starts-as-a-conversation
 *
 * brief-as-the-contract, Build Phase 5: `indusk plans start <type> <name>
 * --from-draft <id>` over the CLI — the draft becomes the plan's brief and is
 * spent; a name taken is refused with the draft kept; without the flag the
 * command is unchanged.
 */

let project: PlanLifecycleProject;
let indusk: string;
beforeEach(() => {
	project = planLifecycleProject("drafts-cli");
	indusk = mkdtempSync(join(tmpdir(), "drafts-cli-home-"));
});
afterEach(() => {
	project.cleanup();
	rmSync(indusk, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("plans start --from-draft", () => {
	it("makes the plan from the draft, spends it, and refuses a taken name keeping it", () => {
		const home = bookkeepingRoots(project.trunk, indusk).home;
		const env = { INDUSK_HOME: indusk };
		const draft = createDraft(home, { brief: "# a conversation\n" });

		const made = runCli(
			project.trunk,
			["plans", "start", "feature", "from-talk", "--from-draft", draft.id],
			env,
		);
		expect(made.code, made.stderr).toBe(0);
		const brief = join(project.worktreeOf("from-talk"), ".indusk/planning/from-talk/brief.md");
		expect(readFileSync(brief, "utf-8")).toContain("# a conversation");
		expect(listDrafts(home)).toEqual([]);

		const again = createDraft(home, { brief: "# another\n" });
		const refused = runCli(
			project.trunk,
			["plans", "start", "feature", "from-talk", "--from-draft", again.id],
			env,
		);
		expect(refused.code).not.toBe(0);
		expect(refused.stderr).toMatch(/already.*another name/s);
		expect(listDrafts(home).map((d) => d.id)).toEqual([again.id]);
	});

	it("refuses a draft that does not exist, and without the flag starts a plan as before", () => {
		const env = { INDUSK_HOME: indusk };
		const missing = runCli(
			project.trunk,
			["plans", "start", "feature", "x-plan", "--from-draft", "nope"],
			env,
		);
		expect(missing.code).not.toBe(0);
		expect(missing.stderr).toContain("no draft nope");
		const plain = runCli(project.trunk, ["plans", "start", "feature", "plain-plan"], env);
		expect(plain.code, plain.stderr).toBe(0);
		expect(
			existsSync(join(project.worktreeOf("plain-plan"), ".indusk/planning/plain-plan/brief.md")),
		).toBe(true);
	});
});
