import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ApprovalEntry } from "./approvals.js";
import type { Mockup } from "./mockups.js";

/**
 * A plan has landed when its folder is under `.indusk/planning/archive/`
 * (main-suite-green; retrospective archives a plan as it lands). Approval
 * merges a plan's mockups to main before any code, so a component only an
 * unlanded plan's mockup names cannot be implemented yet and must not turn the
 * component check red until the plan lands.
 *
 * Only a folder that is active and not archived reads unlanded. A plan with
 * no folder at all (a name that never had one, or one removed) reads landed:
 * nothing says it is in flight, so the check stays strict for legacy records.
 *
 * promise: a-component-has-one-implementation
 */
export function planHasLanded(root: string, plan: string): boolean {
	const planning = join(root, ".indusk", "planning");
	if (existsSync(join(planning, "archive", plan))) return true;
	return !existsSync(join(planning, plan));
}

/**
 * The mockups whose latest approval was made in a plan that has landed, plus
 * those with no approval or an approval naming no plan (made in the project's
 * own checkout, or before ownership): those are held as strictly as before.
 */
export function mockupsOfLandedPlans(
	root: string,
	mockups: readonly Mockup[],
	approvals: readonly ApprovalEntry[],
): Mockup[] {
	return mockups.filter((m) => {
		const mine = approvals.filter((e) => e.mockup === m.name);
		const plan = mine[mine.length - 1]?.plan;
		return plan === undefined || planHasLanded(root, plan);
	});
}
