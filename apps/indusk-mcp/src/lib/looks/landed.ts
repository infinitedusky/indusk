import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ApprovalEntry } from "./approvals.js";
import { markedComponentsOf } from "./markup.js";
import { componentOfStory, type Mockup } from "./mockups.js";

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
 * The component names the check holds to an implementation. The exemption is
 * per component, not per mockup: a re-approval in flight by an unlanded plan
 * exempts only what it adds, never what a landed approval already bound
 * (promise: a-component-has-one-implementation).
 *
 * A mockup whose latest approval names no plan or a landed one (made in the
 * project's own checkout, before ownership, or merged) holds every component
 * its markup names. A mockup whose latest approval is an unlanded plan's holds
 * the components its most recent held approval bound (`components` keys,
 * `badge.ok` to `badge`); an entry without `components` binds none. A mockup
 * never approved is held in full, as before.
 */
export function heldComponentNames(
	root: string,
	mockups: readonly Mockup[],
	approvals: readonly ApprovalEntry[],
): Set<string> {
	const held = new Set<string>();
	const isHeld = (e: ApprovalEntry) => e.plan === undefined || planHasLanded(root, e.plan);
	for (const m of mockups) {
		const mine = approvals.filter((e) => e.mockup === m.name);
		const latest = mine[mine.length - 1];
		if (latest === undefined || isHeld(latest)) {
			for (const name of markedComponentsOf(m.html)) held.add(name);
			continue;
		}
		const bound = [...mine].reverse().find(isHeld);
		for (const story of Object.keys(bound?.components ?? {})) held.add(componentOfStory(story));
	}
	return held;
}
