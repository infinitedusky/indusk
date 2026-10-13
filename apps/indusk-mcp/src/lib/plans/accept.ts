import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseBriefContract } from "../promises/brief-contract.js";
import {
	describeInterfaceFiles,
	interfaceFilesAmong,
	listsALook,
} from "../promises/interface-files.js";
import { storiesWaiting } from "./approved-brief.js";
import {
	branchFileChanges,
	implPath,
	PlanCommandRefusal,
	planBranch,
	refuseInsideBuildStep,
	setFrontmatterKeys,
	setImplKeys,
} from "./plan-branch.js";
import { commitAtRoot, workbenchPlan } from "./workbench-plan.js";

/**
 * `indusk plans accept <name>` (admin-plan-authoring, ADR D3): the person, or
 * a workflow set to accept on its own, says the build may ship. Recorded in
 * the impl's frontmatter and committed on the plan's branch, where `plans
 * land` reads it.
 *
 * Refused, with nothing written, when the branch changed files under an app's
 * declared interface while its brief lists no look (brief-as-the-contract ADR
 * D2): approval caught the plan that said what it would change; this catches
 * the one that changed more than it said.
 *
 * Refused too while a new component the brief names has not ended in an
 * approved story, or a mockup it names still draws one inline or composes one
 * not approved (ADR decision 4a).
 *
 * promise: a-brief-lists-its-looks
 * promise: a-new-component-ends-its-plan-with-a-story
 */

export type AcceptedBy = "person" | "auto";

export interface AcceptedPlan {
	plan: string;
	accepted: string;
	acceptedBy: AcceptedBy;
}

export async function acceptPlan(
	anyCheckout: string,
	plan: string,
	by: AcceptedBy = "person",
	now: Date = new Date(),
): Promise<AcceptedPlan> {
	refuseInsideBuildStep("accepted", plan);
	const accepted = now.toISOString();
	const message = `plan(${plan}): accepted${by === "auto" ? " by its workflow" : ""}`;
	// A workbench plan's impl lives at the workbench root, committed there.
	const wp = await workbenchPlan(anyCheckout, plan);
	if (wp) {
		// The same checks a normal plan meets, against the workbench's pieces: the
		// code repo's branch for the diff, the root's mockups for the looks.
		const where: LooksWhere = {
			plan,
			dir: wp.dir,
			mockups: wp.root,
			trunk: wp.repoTrunk,
			trunkBranch: wp.trunkBranch,
			branch: wp.code.branch,
		};
		await refuseUnlistedInterfaceChanges(where);
		await refuseStoriesWaiting(where);
		const impl = join(wp.dir, "impl.md");
		writeFileSync(
			impl,
			setFrontmatterKeys(readFileSync(impl, "utf-8"), { accepted, accepted_by: by }),
		);
		await commitAtRoot(wp.root, [relative(wp.root, impl)], message);
		return { plan, accepted, acceptedBy: by };
	}
	const pb = await planBranch(anyCheckout, plan);
	const where: LooksWhere = {
		plan,
		dir: pb.dir,
		mockups: pb.worktree,
		trunk: pb.trunk,
		trunkBranch: pb.trunkBranch,
		branch: pb.branch,
	};
	await refuseUnlistedInterfaceChanges(where);
	await refuseStoriesWaiting(where);
	await setImplKeys(pb, implPath(pb), { accepted, accepted_by: by }, message);
	return { plan, accepted, acceptedBy: by };
}

/**
 * Where the accept-time looks checks read: the plan's folder, the checkout
 * whose mockups hold its looks, and the branch whose diff is its code. A normal
 * plan has one worktree for all of it; a workbench plan has the root for the
 * documents and mockups and the code repo for the diff.
 */
interface LooksWhere {
	plan: string;
	dir: string;
	mockups: string;
	trunk: string;
	trunkBranch: string;
	branch: string;
}

/**
 * The branch's real diff against the trunk, held to the brief: a file under an
 * app's interface changed while the brief lists no look is refused, naming the
 * files. The way forward is an amendment — the brief gains the look and a
 * person approves it — not accepting over the gap. A brief written before
 * promises were part of one is not held to it, as at approval.
 */
async function refuseUnlistedInterfaceChanges(where: LooksWhere): Promise<void> {
	const briefPath = join(where.dir, "brief.md");
	if (!existsSync(briefPath)) return;
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	if (brief.shape !== "contract" || listsALook(brief.looks)) return;
	const changed = await branchFileChanges(where.trunk, where.trunkBranch, where.branch);
	const files = interfaceFilesAmong(
		where.mockups,
		changed.map((f) => f.path),
	);
	if (files.length === 0) return;
	const said = brief.looks === null ? "has no Looks section" : "says None for its looks";
	throw new PlanCommandRefusal(
		`${where.plan} changed ${describeInterfaceFiles(files)}, which changes how something looks, and its brief ${said} — amend the brief to list each look the change makes, changes or replaces, and have a person approve the amendment, before the plan is accepted`,
	);
}

/**
 * A plan whose brief names a new component is accepted only once the
 * component's story is approved and every mockup the brief names composes
 * approved stories by name: the build made the component, so its look is held
 * by the story from here on. Each refusal is named; the way forward is the
 * Looks page and `<indusk-component>`.
 */
async function refuseStoriesWaiting(where: LooksWhere): Promise<void> {
	const briefPath = join(where.dir, "brief.md");
	if (!existsSync(briefPath)) return;
	const waiting = await storiesWaiting(where.mockups, readFileSync(briefPath, "utf-8"));
	if (waiting.length === 0) return;
	throw new PlanCommandRefusal(
		[
			`${where.plan} cannot be accepted; a new component it names has not ended in an approved story:`,
			...waiting.map((r) => `  ${r}`),
			"Approve each story on the cockpit's Looks page, then place the component with <indusk-component> in each mockup that draws it, and have those mockups approved again.",
		].join("\n"),
	);
}
