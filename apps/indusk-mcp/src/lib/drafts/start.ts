import { rmSync } from "node:fs";
import { PlanCommandRefusal } from "../plans/plan-branch.js";
import { type StartedPlan, startPlan } from "../plans/start.js";
import { WORKFLOW_TYPES } from "../workflow-types.js";
import { type Draft, readDraftDocument, readProposal } from "./store.js";

/**
 * Accepting a draft's proposal (brief-as-the-contract, ADR decision 6): the
 * plan is made on its own branch and worktree through `startPlan`, with the
 * draft's document as its first one, and the draft is spent. A conversation
 * that made a brief becomes a plan with a brief; one that made research alone
 * becomes a research-only plan (`spike`) with no brief. Refused while the name
 * is taken, and the draft is kept so another name can be asked for. A draft
 * holding both documents gives the plan both: the brief as its first document,
 * the research beside it.
 *
 * promise: a-plan-starts-as-a-conversation
 */
export async function startFromDraft(
	anyCheckout: string,
	draft: Draft,
	now: Date = new Date(),
): Promise<StartedPlan> {
	const proposal = readProposal(draft);
	if (!proposal) {
		throw new PlanCommandRefusal(`draft ${draft.id} has no proposal yet — it has no name or type`);
	}
	if (!(WORKFLOW_TYPES as readonly string[]).includes(proposal.type)) {
		throw new PlanCommandRefusal(
			`${proposal.type} is not a workflow type (${WORKFLOW_TYPES.join(", ")})`,
		);
	}
	const brief = readDraftDocument(draft, "brief");
	const research = readDraftDocument(draft, "research");
	if (brief === null && research === null) {
		throw new PlanCommandRefusal(`draft ${draft.id} has said nothing yet — it holds no document`);
	}
	// A conversation that made no promises or looks has no brief to keep.
	const type = brief === null ? "spike" : proposal.type;
	const document = type === "spike" ? (research ?? brief) : brief;
	try {
		const started = await startPlan(anyCheckout, type, proposal.name, now, {
			...(proposal.repo ? { repo: proposal.repo } : {}),
			...(document ? { document } : {}),
			// A brief and the research behind it: both reach the plan.
			...(type !== "spike" && research ? { research } : {}),
		});
		rmSync(draft.dir, { recursive: true, force: true });
		return started;
	} catch (err) {
		if (err instanceof PlanCommandRefusal && /already/.test(err.message)) {
			throw new PlanCommandRefusal(`${err.message} — choose another name for this draft`);
		}
		throw err;
	}
}
