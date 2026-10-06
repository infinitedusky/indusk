import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { checkRetrospectiveReadiness } from "../cleanup/gate.js";
import { parseImplString } from "../impl-parser-core.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import type { BuildPlan } from "./next-step.js";

/**
 * A plan as the build's decisions read it, from its live copy — its worktree
 * while it has one. The decisions themselves are pure; this is the one place
 * they meet the disk.
 */

export class BuildPlanUnreadable extends Error {}

export async function readBuildPlan(
	anyCheckout: string,
	plan: string,
): Promise<BuildPlan & { dir: string }> {
	const live = await livePlanCopy(anyCheckout, plan);
	if (!live.ok)
		throw new BuildPlanUnreadable(
			`the worktree record ${live.file} cannot be read: ${live.problem}`,
		);
	const dir = live.copy.dir;
	const path = join(dir, "impl.md");
	if (!existsSync(path)) throw new BuildPlanUnreadable(`${plan} has no impl.md in ${dir}`);
	const content = readFileSync(path, "utf-8");
	return {
		dir,
		impl: parseImplString(content),
		trajectory: parseTrajectory(matter(content).content),
		readiness: checkRetrospectiveReadiness(dir, content),
	};
}
