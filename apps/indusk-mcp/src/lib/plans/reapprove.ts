import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { checkPlanContract } from "../promises/contract.js";
import { contractDir } from "../promises/registry.js";
import {
	type Amendment,
	AmendmentsUnreadable,
	amendmentDecision,
	amendmentsOf,
	reapprovalSubject,
} from "./amendments.js";
import {
	approvalFrontmatter,
	approvedBy,
	briefHash,
	briefStandingOf,
	unapprovedMockups,
} from "./approved-brief.js";
import { appendDecision } from "./history.js";
import { PlanCommandRefusal, planBranch, setFrontmatterKeys } from "./plan-branch.js";
import { commitAtRoot, workbenchPlan } from "./workbench-plan.js";

/**
 * `indusk plans reapprove <name>` (brief-as-the-contract ADR decision 6): a
 * person approves the amendments an approved plan waits on. Refused before
 * approval — that is `plans approve`'s, which also merges, and refuses a
 * branch past approval. The brief check and the looks gate run again, as at
 * approval; then the brief is recorded as the one approved (`approved_brief`,
 * `approved_by`, `approved_at`), committed on the plan's branch with the
 * brief and the promises it changed under `plan(<plan>): amendment approved`
 * — the commit `amendmentsOf` reads what was approved from next — and each
 * amendment is appended to the plan's history on `main`.
 *
 * Run from a terminal it is the person's by convention, as `plans approve`
 * is; the cockpit's route admits only the person's browser.
 *
 * promise: a-change-to-what-was-agreed-needs-the-person
 */

export interface ReapprovedPlan {
	plan: string;
	/** The hash of the brief now approved. */
	approvedBrief: string;
	/** The amendments the person approved; empty when none waited. */
	amendments: Amendment[];
}

export async function reapprovePlan(
	anyCheckout: string,
	plan: string,
	now: Date = new Date(),
): Promise<ReapprovedPlan> {
	const wp = await workbenchPlan(anyCheckout, plan);
	const where = wp
		? { root: wp.root, dir: wp.dir, repo: wp.root }
		: await planBranch(anyCheckout, plan).then((pb) => ({
				root: pb.worktree,
				dir: pb.dir,
				repo: pb.worktree,
			}));
	const implFile = join(where.dir, "impl.md");
	const briefFile = join(where.dir, "brief.md");
	if (!existsSync(implFile)) throw new PlanCommandRefusal(`${plan} has no impl.md in ${where.dir}`);
	const status = matter(readFileSync(implFile, "utf-8")).data.status;
	if (status === undefined || status === "draft") {
		throw new PlanCommandRefusal(
			`${plan} is not approved yet, so it has no amendments — approve it with \`indusk plans approve ${plan}\``,
		);
	}
	if (!existsSync(briefFile)) {
		throw new PlanCommandRefusal(`${plan} has no brief.md, so there is nothing to reapprove`);
	}

	const contract = checkPlanContract(where.root, plan);
	if (!contract.ok) {
		throw new PlanCommandRefusal(
			[
				`${plan}'s amendments cannot be approved; its brief check refuses:`,
				...contract.refusals.map((r) => `  ${r.message}`),
			].join("\n"),
		);
	}
	const brief = readFileSync(briefFile, "utf-8");
	const looks = await unapprovedMockups(where.root, brief);
	if (looks.length > 0) {
		throw new PlanCommandRefusal(
			[
				`${plan}'s amendments cannot be approved; its brief's looks are not approved yet:`,
				...looks.map((r) => `  ${r}`),
			].join("\n"),
		);
	}

	let amendments: Amendment[];
	try {
		amendments = await amendmentsOf(where.dir);
	} catch (err) {
		if (err instanceof AmendmentsUnreadable) throw new PlanCommandRefusal(err.message);
		throw err;
	}
	const standing = briefStandingOf(where.dir);
	if (amendments.length === 0 && standing.state === "unchanged") {
		return { plan, approvedBrief: standing.approved, amendments };
	}

	const by = await approvedBy(where.repo);
	writeFileSync(
		implFile,
		setFrontmatterKeys(readFileSync(implFile, "utf-8"), approvalFrontmatter(brief, by, now)),
	);
	const promises = contractDir(where.root, plan);
	const changedPromises = amendments
		.filter((a) => a.part === "promise")
		.map((a) => join(promises, `${a.name}.md`));
	const paths = [implFile, briefFile, ...changedPromises]
		.map((p) => relative(where.repo, p))
		.filter((p) => !p.startsWith(".."));
	await commitAtRoot(where.repo, paths, reapprovalSubject(plan));

	const at = now.toISOString();
	for (const a of amendments) {
		appendDecision(anyCheckout, plan, {
			decision: amendmentDecision(a),
			answer: "Approve",
			by,
			at,
		});
	}
	return { plan, approvedBrief: briefHash(brief), amendments };
}
