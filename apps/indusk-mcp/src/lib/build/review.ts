import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { isCleanupSkipped } from "../cleanup/gate.js";
import { getTrunkBranches } from "../config.js";
import { isFalsificationSkipped } from "../falsification/skip.js";
import { git } from "../git.js";
import { type ImplPhase, parseImplString } from "../impl-parser-core.js";
import { RITUAL_ORDER } from "../lifecycle.js";
import { parseBriefContract } from "../promises/brief-contract.js";
import { type PromiseEntry, readPromises } from "../promises/registry.js";
import { rowProofs } from "../promises/rows.js";
import { parseTrajectory } from "../trajectory/parser.js";
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

export interface Review {
	plan: string;
	promises: ReviewPromise[];
	falsification: ReviewFalsification[];
	/** Changed against the trunk branch since the plan's branch left it; empty when the plan has no worktree. */
	files: Array<{ path: string; status: string }>;
	skips: ReviewSkip[];
	/** Falsification or cleanup skipped by the plan's frontmatter, with the reason given. */
	skippedRituals: Array<{ ritual: "falsification" | "cleanup"; reason: string }>;
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
	const implPath = join(copy.dir, "impl.md");
	if (!existsSync(implPath)) throw new BuildPlanUnreadable(`${plan} has no impl.md in ${copy.dir}`);
	const implText = readFileSync(implPath, "utf-8");
	const impl = parseImplString(implText);
	const trajectory = parseTrajectory(matter(implText).content);

	const files =
		copy.source === "worktree" ? await changedFiles(copies.projectRoot, copy.worktree.branch) : [];

	return {
		plan,
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
		skippedRituals: [
			{ ritual: "falsification" as const, check: isFalsificationSkipped(implText) },
			{ ritual: "cleanup" as const, check: isCleanupSkipped(implText) },
		]
			.filter((r) => r.check.skipped)
			.map((r) => ({ ritual: r.ritual, reason: r.check.reason ?? "" })),
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
	return rowProofs(entries, plan, implText).map((p) => ({
		name: p.promise.name,
		proven: p.refusal === null,
		rows: p.rows,
		why: p.refusal,
	}));
}

async function changedFiles(trunk: string, branch: string): Promise<Review["files"]> {
	const current = await git(trunk, "branch", "--show-current");
	const trunkBranch = getTrunkBranches(trunk).includes(current) ? current : "main";
	const out = await git(trunk, "diff", "--name-status", `${trunkBranch}...${branch}`);
	return out
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [status, ...rest] = line.split("\t");
			return { status, path: rest[rest.length - 1] };
		});
}

const isFalsification = (p: ImplPhase) => new RegExp(`^${RITUAL_ORDER[0]}\\b`, "i").test(p.name);

const phaseTitle = (p: ImplPhase) =>
	`${p.kind === "test" ? "Test" : "Build"} Phase ${p.number}: ${p.name}`;

/** A gate item marked as skipped rather than done — what the review asks a person to judge. */
function isSkip(text: string): boolean {
	return /\((?:none needed|not applicable)\b/.test(text) || /skip-reason:/.test(text);
}
