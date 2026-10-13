import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { induskMcpPackageRoot } from "../package-root.js";
import type { SessionKind } from "./protocol.js";

/**
 * A draft's conversation (brief-as-the-contract, ADR decision 6): the agent
 * talks with the person in the draft's own folder — outside every checkout —
 * so it reads and writes nothing in the project's repository. The rules it
 * plans under are the planner's: the skill is copied into the folder as
 * `planner.md`, since a folder outside the project has no `/planner` of its own.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 */

export interface DraftConversation {
	cwd: string;
	kind: SessionKind;
	/** The first message the session is started with. */
	prompt: string;
	/** The `plan` a session record names: a draft is not a plan, so it is `draft:<id>`. */
	plan: string;
}

/** The session record's `plan` for draft `id`; one definition, read by the routes and the page. */
export const draftSessionPlan = (id: string): string => `draft:${id}`;

export function draftConversation(
	draft: { id: string; dir: string },
	opts: { reopened?: boolean; firstMessage?: string } = {},
): DraftConversation {
	const planner = join(draft.dir, "planner.md");
	if (!existsSync(planner)) {
		copyFileSync(join(induskMcpPackageRoot(), "skills", "planner.md"), planner);
	}
	return {
		cwd: draft.dir,
		kind: "planning",
		prompt: draftPrompt(opts),
		plan: draftSessionPlan(draft.id),
	};
}

/**
 * What the agent is told. The person has said nothing yet, or is coming back;
 * nothing is asked of them first, and the agent only proposes a name once what
 * the plan promises and how it looks are clear.
 */
export function draftPrompt(opts: { reopened?: boolean; firstMessage?: string } = {}): string {
	return [
		"This is a draft conversation: a plan has not been started, and your working directory is its own folder, outside the project's repository. Write only here; touch nothing in the project, and do not run `indusk plans start`.",
		"1. Read ./planner.md — the planner's rules — and follow them for writing the brief and for the promises, expectations and looks in it.",
		...(opts.reopened
			? [
					"2. This conversation is being reopened. Read what it already holds (./brief.md, ./research.md, ./proposal.json) and say in a sentence where it stands.",
				]
			: [
					"2. Say in one or two sentences that you are ready and ask the person to describe what they want, in their own words. Ask for no name and no type; do not guess the plan before they have described it.",
				]),
		"3. Write what the conversation settles to ./brief.md (a `description:` in its frontmatter distilling the plan in one to three sentences, then expectations, promises, looks), or to ./research.md when it is notes with no promises or looks.",
		'4. Once what the plan promises and how it looks are clear, write ./proposal.json as {"name": "<kebab-case-name>", "type": "feature|bugfix|refactor|spike"} and tell the person you have proposed it. They accept or edit it; do not start the plan yourself.',
		...(opts.firstMessage ? ["", "The person says:", opts.firstMessage] : []),
	].join("\n");
}
