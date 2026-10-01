import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlan } from "../lib/plan-parser.js";

/**
 * admin-plan-type — A16. This repository declares a type on every active plan.
 *
 * The admin can only tell a document a plan never needed from one it should
 * have had when the plan says what kind it is. The planner is prose an agent
 * follows, so nothing executes "the planner writes `workflow:`"; this is the
 * check that notices when it did not. A plan here without a type turns the
 * suite red and is named.
 *
 * An active plan is a folder outside `archive/` that holds a brief or a
 * research document. The type is declared in the brief; a research-only plan
 * has no brief and declares it in its research document. A parent that holds
 * only a `master.md` is a grouping, not a plan with a type.
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;
const PLANNING = join(REPO_ROOT, ".indusk/planning");
const TYPES = ["feature", "bugfix", "refactor", "spike"];

interface ActivePlan {
	name: string;
	/** The document the type is read from. */
	document: string;
}

function activePlans(): ActivePlan[] {
	const plans: ActivePlan[] = [];
	for (const entry of readdirSync(PLANNING, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === "archive") continue;
		const dir = join(PLANNING, entry.name);
		if (existsSync(join(dir, "brief.md"))) plans.push({ name: entry.name, document: "brief.md" });
		else if (existsSync(join(dir, "research.md")))
			plans.push({ name: entry.name, document: "research.md" });
	}
	return plans.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The plan's type as the parser reads it — the same read the admin and the
 * plan list make. This test used to parse the frontmatter itself, a second
 * copy of where the type lives and what counts as one; once the parser
 * stopped accepting a list as a type (A19), a private read that still coerced
 * one would have passed a plan the page shows as undeclared.
 */
function declaredType(plan: ActivePlan): string | undefined {
	const summary = parsePlan(join(PLANNING, plan.name));
	return summary.workflow ?? summary.workflowDeclared;
}

describe("A16 — every active plan in this repository declares a type", () => {
	const plans = activePlans();

	it("finds active plans (sanity)", () => {
		expect(plans.length).toBeGreaterThan(2);
	});

	it("each declares one of the four types in its brief, or its research when research-only", () => {
		const undeclared = plans
			.filter((plan) => parsePlan(join(PLANNING, plan.name)).workflow === undefined)
			.map((plan) => `${plan.name} (${plan.document}: ${JSON.stringify(declaredType(plan))})`);
		expect(
			undeclared,
			`active plans without a \`workflow:\` of ${TYPES.join(" | ")}:\n  ${undeclared.join("\n  ")}`,
		).toEqual([]);
	});
});
