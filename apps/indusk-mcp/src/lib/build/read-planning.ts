import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { parsePlan } from "../plan-parser.js";
import { unapprovedMockups } from "../plans/approved-brief.js";
import { type ContractResult, checkPlanContract } from "../promises/contract.js";
import { findPlanFolder } from "../promises/plan-folder.js";
import { requiredDocuments } from "../workflow-types.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import type { PlanningDocument, PlanningState } from "./next-planning-step.js";

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
}

export interface HookInput {
	tool_name: "Write";
	tool_input: { file_path: string; content: string };
	cwd: string;
}

export interface PlanningReadDeps {
	/** Where the plan's checkout is, and its folder in it. */
	locate: (anyCheckout: string, plan: string) => Promise<{ root: string; dir: string | null }>;
	contract: (root: string, plan: string) => ContractResult;
	/** Run the shipped impl hook on a write; `status` is its exit code (0 allows). */
	runHook: (input: HookInput) => { status: number | null };
	unapprovedLooks: (root: string, briefText: string) => Promise<string[]>;
}

/** The hook the package ships, beside `dist` and `src` alike. */
const IMPL_HOOK = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"hooks",
	"validate-impl-structure.js",
);

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
		const r = spawnSync("node", [IMPL_HOOK], {
			input: JSON.stringify(input),
			cwd: input.cwd,
			encoding: "utf-8",
			timeout: 30_000,
			env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
		});
		return { status: r.status };
	},
	unapprovedLooks: unapprovedMockups,
};

const ABSENT: PlanningDocument = { exists: false, ok: false };

function textOf(dir: string | null, file: string): string | null {
	if (!dir) return null;
	const path = join(dir, file);
	return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/** A `blocker: <what>` line a planning step wrote into a document. */
function blockerIn(text: string | null): string | null {
	return text?.match(/^blocker:\s+(\S.*)$/m)?.[1].trim() ?? null;
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

	// A test plan and an ADR pass by standing: their contract is the plan's, checked below.
	const standing = (text: string | null): PlanningDocument =>
		text === null ? ABSENT : { exists: true, ok: text.trim() !== "" };
	const implDocument: PlanningDocument =
		impl === null
			? ABSENT
			: {
					exists: true,
					ok:
						deps.runHook({
							tool_name: "Write",
							tool_input: { file_path: join(dir, "impl.md"), content: impl },
							cwd: root,
						}).status === 0,
				};

	const status = impl === null ? undefined : matter(impl).data.status;
	const briefStatus = brief === null ? undefined : matter(brief).data.status;
	return {
		required,
		documents: { "test-plan": standing(testPlan), adr: standing(adr), impl: implDocument },
		implStatus: typeof status === "string" ? status : null,
		contractOk: deps.contract(root, plan).ok,
		unapprovedLooks: brief === null ? [] : await deps.unapprovedLooks(root, brief),
		blocker: blockerIn(testPlan) ?? blockerIn(adr) ?? blockerIn(impl),
		briefStatus: typeof briefStatus === "string" ? briefStatus : null,
	};
}
