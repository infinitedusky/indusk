import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { skippedRitualsOf } from "../cleanup/gate.js";
import { type ImplPhase, parseImplString } from "../impl-parser-core.js";
import { RITUAL_ORDER } from "../lifecycle.js";
import { type Amendment, amendmentOfDecision, amendmentsOf } from "../plans/amendments.js";
import { uncommittedWork } from "../plans/bookkeeping.js";
import { readHistory } from "../plans/history.js";
import { branchFileChanges } from "../plans/plan-branch.js";
import { workbenchPlan } from "../plans/workbench-plan.js";
import { parseBriefContract } from "../promises/brief-contract.js";
import { type PromiseEntry, readPromises } from "../promises/registry.js";
import { rowProofs } from "../promises/rows.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { currentTrunkBranch } from "../trunk-branch.js";
import { resolvePlanCopies } from "../worktree/plan-worktrees.js";
import { BuildPlanUnreadable } from "./read-plan.js";

/**
 * What a person needs to decide whether a built plan may ship
 * (admin-plan-authoring, ADR D6): each promise the plan makes with the rows
 * that prove it, what falsification looked for and what it fixed, the files
 * the branch changed, and every gate item the build skipped with its reason.
 *
 * Promises and rows are read through `promises/rows.ts`, the reader the
 * plan's close uses, so the review cannot call a promise proven that the
 * close would refuse.
 *
 * promise: a-review-shows-its-evidence
 */

export interface ReviewPromise {
	name: string;
	/** Every row naming it passes and names a test file — what `indusk promises confirm` asks of the rows. */
	proven: boolean;
	rows: Array<{ id: string; state: string; tests: string[] }>;
	/** Why it is not proven; null when it is. */
	why: string | null;
}

export interface ReviewFalsification {
	phase: string;
	rows: Array<{ id: string; asserts: string; state: string }>;
	items: Array<{ text: string; done: boolean }>;
}

export interface ReviewSkip {
	phase: string;
	gate: string;
	item: string;
}

/**
 * A document of the plan shown beside the approval as evidence
 * (brief-as-the-contract ADR decision 3): the person approved the brief, so
 * these carry no sign-off of their own and no field to record one.
 */
export interface ReviewEvidence {
	document: "test-plan" | "adr" | "impl";
	/** The file, relative to the plan's checkout. */
	path: string;
}

export interface Review {
	plan: string;
	/** The test plan, the ADR and the impl the plan has, in that order — read, not signed off. */
	evidence: ReviewEvidence[];
	promises: ReviewPromise[];
	falsification: ReviewFalsification[];
	/** Changed against the trunk branch since the plan's branch left it; empty when the plan has no worktree. */
	files: Array<{ path: string; status: string }>;
	skips: ReviewSkip[];
	/** A close-out ritual (falsification, cleanup, audit) skipped by the plan's frontmatter, with the reason given. */
	skippedRituals: Array<{ ritual: "falsification" | "cleanup" | "audit"; reason: string }>;
	/**
	 * Uncommitted work on the trunk, outside InDusk's own bookkeeping, on paths
	 * the plan's merge will touch — the person's to sort out before accepting,
	 * since landing refuses it (Build Phase 10).
	 */
	uncommittedOnMain: string[];
	/**
	 * What was agreed and changed (brief-as-the-contract ADR decision 6):
	 * each amendment a person approved, from the plan's history, with what it
	 * was and what it became; those still waiting; and why the waiting ones
	 * cannot be told, when they cannot. Absent from a review an older
	 * `indusk` printed, so a reader takes absence as none.
	 */
	amendments?: {
		approved: Array<Amendment & { by: string; at: string }>;
		waiting: Amendment[];
		unreadable: string | null;
	};
}

export async function buildReview(anyCheckout: string, plan: string): Promise<Review> {
	const copies = await resolvePlanCopies(anyCheckout);
	if (!copies.ok) {
		throw new BuildPlanUnreadable(
			`the worktree record ${copies.file} cannot be read: ${copies.problem}`,
		);
	}
	const copy = copies.copies.get(plan);
	if (!copy) throw new BuildPlanUnreadable(`no plan named ${plan}, on the trunk or in a worktree`);
	// A workbench plan's code is in the repo its code file names
	// (workbench-plan-authoring D6): read before anything else, so a record
	// naming a worktree that is gone is said, never worked around.
	const wp = await workbenchPlan(anyCheckout, plan).catch((err: Error) => {
		throw new BuildPlanUnreadable(err.message);
	});
	const implPath = join(copy.dir, "impl.md");
	if (!existsSync(implPath)) throw new BuildPlanUnreadable(`${plan} has no impl.md in ${copy.dir}`);
	const implText = readFileSync(implPath, "utf-8");
	const impl = parseImplString(implText);
	const trajectory = parseTrajectory(matter(implText).content);

	const files = wp
		? await branchFileChanges(wp.repoTrunk, wp.trunkBranch, wp.code.branch)
		: copy.source === "worktree"
			? await changedFiles(copies.projectRoot, copy.worktree.branch)
			: [];

	return {
		plan,
		evidence: evidenceOf(copy.root, copy.dir),
		promises: reviewPromises(copy.root, copy.dir, plan, implText),
		falsification: impl.phases.filter(isFalsification).map((phase) => ({
			phase: phaseTitle(phase),
			rows: trajectory.rows
				.filter((r) => r.passesAt === phase.number && r.passesAtKind === phase.kind)
				.map((r) => ({ id: r.id, asserts: r.asserts, state: r.state })),
			items: phase.gates
				.filter((g) => g.type === "implementation")
				.flatMap((g) => g.items.map((i) => ({ text: i.text, done: i.checked }))),
		})),
		files,
		uncommittedOnMain: await uncommittedWork(
			wp ? wp.repoTrunk : copies.projectRoot,
			files.map((f) => f.path),
		),
		skippedRituals: skippedRitualsOf(implText),
		amendments: await reviewAmendments(anyCheckout, plan, copy.dir),
		skips: impl.phases.flatMap((phase) =>
			phase.gates.flatMap((g) =>
				g.items
					.filter((i) => isSkip(i.text))
					.map((i) => ({ phase: phaseTitle(phase), gate: g.type, item: i.text })),
			),
		),
	};
}

function reviewPromises(
	root: string,
	dir: string,
	plan: string,
	implText: string,
): ReviewPromise[] {
	const briefPath = join(dir, "brief.md");
	if (!existsSync(briefPath)) return [];
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	if (brief.shape === "legacy") return [];
	const read = readPromises(root);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	const byName = new Map((registry?.promises ?? []).map((p) => [p.name, p]));
	// A promise the brief makes but the registry lacks is still reviewed, by
	// its name: the brief check refuses it, and the review must not hide it.
	const entries = brief.makes.map(
		(m) => byName.get(m.name) ?? ({ name: m.name, aliases: [] } as unknown as PromiseEntry),
	);
	return rowProofs(entries, plan, implText, registry?.promises ?? []).map((p) => ({
		name: p.promise.name,
		proven: p.refusal === null,
		rows: p.rows,
		why: p.refusal,
	}));
}

const EVIDENCE: ReviewEvidence["document"][] = ["test-plan", "adr", "impl"];

/** The documents of the plan that are evidence at review, those that exist. */
function evidenceOf(root: string, dir: string): ReviewEvidence[] {
	return EVIDENCE.filter((document) => existsSync(join(dir, `${document}.md`))).map((document) => ({
		document,
		path: relative(root, join(dir, `${document}.md`)),
	}));
}

async function reviewAmendments(
	anyCheckout: string,
	plan: string,
	dir: string,
): Promise<NonNullable<Review["amendments"]>> {
	const approved = readHistory(anyCheckout, plan).flatMap((e) => {
		const a = amendmentOfDecision(e.decision);
		return a ? [{ ...a, by: e.by, at: e.at }] : [];
	});
	try {
		return { approved, waiting: await amendmentsOf(dir), unreadable: null };
	} catch (err) {
		return { approved, waiting: [], unreadable: (err as Error).message };
	}
}

async function changedFiles(trunk: string, branch: string): Promise<Review["files"]> {
	// A trunk checked out on no trunk branch has nothing to diff against; the
	// files are listed once it is back on one.
	const { branch: trunkBranch, onTrunk } = await currentTrunkBranch(trunk);
	return onTrunk ? branchFileChanges(trunk, trunkBranch, branch) : [];
}

const isFalsification = (p: ImplPhase) => new RegExp(`^${RITUAL_ORDER[0]}\\b`, "i").test(p.name);

const phaseTitle = (p: ImplPhase) =>
	`${p.kind === "test" ? "Test" : "Build"} Phase ${p.number}: ${p.name}`;

/** A gate item marked as skipped rather than done — what the review asks a person to judge. */
function isSkip(text: string): boolean {
	return /\((?:none needed|not applicable)\b/.test(text) || /skip-reason:/.test(text);
}
