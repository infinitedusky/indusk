import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { isAnswered, PLAN_REVIEW_QUESTIONS, readAuditAnswers } from "../audit/answers.js";
import { fencedLineMask } from "../impl-headings.js";
import { induskMcpPackageRoot } from "../package-root.js";
import { parsePlan } from "../plan-parser.js";
import { unapprovedMockups } from "../plans/approved-brief.js";
import { type ContractResult, checkPlanContract } from "../promises/contract.js";
import { findPlanFolder } from "../promises/plan-folder.js";
import { requiredDocuments } from "../workflow-types.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import { GATE_POLICY_FOR_BUILDS } from "./build-session.js";
import type { PlanningDocument, PlanningReview, PlanningState } from "./next-planning-step.js";

/**
 * A plan as the planning run decides from it (a-brief-is-planned-unasked): the
 * one place `nextPlanningStep`'s pure input meets the disk, as `readBuildPlan`
 * is for the build. Every check is the project's own: the contract check, the
 * shipped impl hook's structure check, the looks' approval. This reads their
 * answers and decides nothing.
 *
 * Reads the plan's live copy (its worktree while it has one), so a document
 * the last step committed there is seen at once.
 *
 * promise: an-accepted-brief-is-planned-unasked
 */

export class PlanningUnreadable extends Error {}

/** The planning state, plus what the host needs to know before it starts a run. */
export interface PlanningRead extends PlanningState {
	/** The brief's `status:`, or null when it has none or no brief exists. */
	briefStatus: string | null;
	/** When the brief was accepted (`accepted_at`, ISO), or null for one accepted by hand. */
	acceptedAt: string | null;
}

export interface HookInput {
	tool_name: "Write";
	tool_input: { file_path: string; content: string };
	cwd: string;
}

/**
 * What running the impl hook gave. Exit 0 allows and exit 2 refuses, with the
 * reason on stderr; anything else (a spawn error, a signal or timeout, node
 * failing to load the hook) means the check did not run.
 */
export interface HookResult {
	status: number | null;
	stderr?: string;
	error?: string;
	signal?: string | null;
}

export interface PlanningReadDeps {
	/** Where the plan's checkout is, and its folder in it. */
	locate: (anyCheckout: string, plan: string) => Promise<{ root: string; dir: string | null }>;
	contract: (root: string, plan: string) => ContractResult;
	/** Run the shipped impl hook on a write; `status` is its exit code (0 allows). */
	runHook: (input: HookInput) => HookResult;
	unapprovedLooks: (root: string, briefText: string) => Promise<string[]>;
}

/**
 * The hook the package ships, asked of the package root when the reader runs: the
 * admin bundles this module, and its bundler tries to resolve a path built from
 * `import.meta.url` when the module loads (admin-builds-with-the-planning-reader).
 */
const implHookPath = (): string =>
	join(induskMcpPackageRoot(), "hooks", "validate-impl-structure.js");

export const realPlanningReads: PlanningReadDeps = {
	locate: async (anyCheckout, plan) => {
		const live = await livePlanCopy(anyCheckout, plan);
		if (!live.ok)
			throw new PlanningUnreadable(
				`the worktree record ${live.file} cannot be read: ${live.problem}`,
			);
		return { root: live.copy.root, dir: findPlanFolder(live.copy.root, plan) };
	},
	contract: checkPlanContract,
	runHook: (input) => {
		const r = spawnSync(process.execPath, [implHookPath()], {
			input: JSON.stringify(input),
			cwd: input.cwd,
			encoding: "utf-8",
			timeout: 30_000,
			// The policy the planning session wrote the impl under, or its skips read as failures.
			env: { ...process.env, ...GATE_POLICY_FOR_BUILDS, INDUSK_SKIP_UPDATE_CHECK: "1" },
		});
		return { status: r.status, stderr: r.stderr, error: r.error?.message, signal: r.signal };
	},
	unapprovedLooks: unapprovedMockups,
};

const ABSENT: PlanningDocument = { exists: false, ok: false };

function textOf(dir: string | null, file: string): string | null {
	if (!dir) return null;
	const path = join(dir, file);
	return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/** A `blocker: <what>` line a planning step wrote into a document, outside any code block. */
function blockerIn(text: string | null): string | null {
	if (text === null) return null;
	const lines = text.split("\n");
	const fenced = fencedLineMask(lines);
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const found = lines[i].match(/^blocker:\s+(\S.*)$/);
		if (found) return found[1].trim();
	}
	return null;
}

/**
 * The impl's structure check. A check that refused keeps its words; one that
 * could not run is not a refusal and ends the read (lesson
 * `detectors-must-distinguish-could-not-check-from-checked-and-failed`).
 */
function judgeImpl(
	dir: string,
	root: string,
	impl: string,
	deps: PlanningReadDeps,
): PlanningDocument {
	const ran = deps.runHook({
		tool_name: "Write",
		tool_input: { file_path: join(dir, "impl.md"), content: impl },
		cwd: root,
	});
	if (ran.error || ran.signal || (ran.status !== 0 && ran.status !== 2)) {
		const why = ran.error ?? (ran.signal ? `killed by ${ran.signal}` : `exit ${ran.status}`);
		const said = ran.stderr?.trim();
		throw new PlanningUnreadable(
			`the impl's structure check could not run (${why})${said ? `: ${said}` : ""}`,
		);
	}
	if (ran.status === 0) return { exists: true, ok: true };
	const refusal = ran.stderr?.trim();
	return { exists: true, ok: false, ...(refusal ? { refusal } : {}) };
}

/** The plan review as the run reads it: absent is not complete, and neither is a file with an open finding. */
function readReview(text: string | null): PlanningReview {
	if (text === null) return { exists: false, complete: false, dismissals: [], amendments: [] };
	const read = readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS, causes: false });
	return {
		exists: true,
		complete: isAnswered(read),
		dismissals: read.dismissals,
		amendments: read.amendments,
	};
}

export async function readPlanningState(
	anyCheckout: string,
	plan: string,
	deps: PlanningReadDeps = realPlanningReads,
): Promise<PlanningRead> {
	const { root, dir } = await deps.locate(anyCheckout, plan);
	if (!dir) throw new PlanningUnreadable(`${plan} has no plan folder in ${root}`);
	const summary = parsePlan(dir);
	if (!summary.workflow) {
		throw new PlanningUnreadable(
			`${plan} declares no workflow type${summary.workflowDeclared ? ` (${summary.workflowDeclared} is not one)` : ""}, so the documents it needs are not known`,
		);
	}
	const required = requiredDocuments(summary.workflow, summary.documentsOff ?? []);

	const brief = textOf(dir, "brief.md");
	const testPlan = textOf(dir, "test-plan.md");
	const adr = textOf(dir, "adr.md");
	const impl = textOf(dir, "impl.md");
	const reviewText = textOf(dir, "plan-review.md");

	// An ADR passes by standing; a test plan passes by standing unless the plan's
	// contract check refuses it (a promise clause with no clause plan), which is
	// the test-plan step again — the impl step cannot fix it.
	const contract = deps.contract(root, plan);
	const testPlanRefused =
		!contract.ok && contract.refusals.some((r) => /(^|\/)test-plan\.md$/.test(r.file));
	const standing = (text: string | null): PlanningDocument =>
		text === null ? ABSENT : { exists: true, ok: text.trim() !== "" };
	const implDocument = impl === null ? ABSENT : judgeImpl(dir, root, impl, deps);

	const status = impl === null ? undefined : matter(impl).data.status;
	const briefData = brief === null ? {} : matter(brief).data;
	const briefStatus = briefData.status;
	const acceptedAt = briefData.accepted_at;
	return {
		required,
		documents: {
			"test-plan": testPlanRefused ? { exists: testPlan !== null, ok: false } : standing(testPlan),
			adr: standing(adr),
			impl: implDocument,
		},
		implStatus: typeof status === "string" ? status : null,
		contractOk: contract.ok,
		unapprovedLooks: brief === null ? [] : await deps.unapprovedLooks(root, brief),
		blocker: blockerIn(testPlan) ?? blockerIn(adr) ?? blockerIn(impl) ?? blockerIn(reviewText),
		review: readReview(reviewText),
		briefStatus: typeof briefStatus === "string" ? briefStatus : null,
		// A bare timestamp is a Date to YAML; `acceptBrief` quotes it, a hand edit may not.
		acceptedAt:
			acceptedAt instanceof Date
				? acceptedAt.toISOString()
				: typeof acceptedAt === "string"
					? acceptedAt
					: null,
	};
}
