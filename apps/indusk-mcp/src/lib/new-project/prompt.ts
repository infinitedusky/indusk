import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { induskMcpPackageRoot } from "../package-root.js";
import type { SessionKind } from "../session/protocol.js";
import type { ProjectDraftView } from "./store.js";

/**
 * A project draft's conversation (new-project-flow, ADR decision 2): the agent
 * talks with the person in the draft's own folder, outside any project - there
 * is none yet - so it can read and write nothing but the conversation. The
 * rules it plans under are the planner's, copied in as `planner.md` as a plan
 * draft's are, since a folder under the InDusk home has no `/planner`.
 *
 * promise: an-unkept-project-conversation-leaves-nothing-on-disk
 */

export interface ProjectConversation {
	cwd: string;
	kind: SessionKind;
	/** The first message the session is started with. */
	prompt: string;
	/** The session record's `plan`: a project draft is not a plan, so it is `new-project:<id>`. */
	plan: string;
}

/** What the session record names for a session that is not in any project. */
export const NEW_PROJECT_SESSION_PROJECT = "new-project";

/** The session record's `plan` for draft `id`; one definition, read by the routes and the page. */
export const newProjectSessionPlan = (id: string): string => `new-project:${id}`;

export function newProjectConversation(
	draft: ProjectDraftView,
	opts: { reopened?: boolean; text?: string } = {},
): ProjectConversation {
	const planner = join(draft.dir, "planner.md");
	if (!existsSync(planner)) {
		copyFileSync(join(induskMcpPackageRoot(), "skills", "planner.md"), planner);
	}
	return {
		cwd: draft.dir,
		kind: "planning",
		prompt: newProjectPrompt(draft, opts),
		plan: newProjectSessionPlan(draft.id),
	};
}

/**
 * What the agent is told. The person has said what they want (and may have
 * brought documents); the agent asks only what that leaves open, in the order
 * why, what, how and where, and writes the founding brief and then the
 * proposal. It runs no command and creates nothing: the project is made only
 * when the person accepts.
 */
export function newProjectPrompt(
	draft: Pick<ProjectDraftView, "message" | "documents" | "brief" | "hasProposal">,
	opts: { reopened?: boolean; text?: string } = {},
): string {
	const documents = draft.documents.map((name) => `./documents/${name}`);
	return [
		"This is a new-project conversation: the project does not exist yet, and your working directory is this conversation's own folder. Write only here; create no project, run no `indusk` command and no `git init` - the project is made only when the person accepts your proposal.",
		"1. Read ./planner.md - the planner's rules - and follow them for writing the founding brief: its promises, expectations and looks.",
		...(documents.length > 0
			? [
					`2. The person brought documents: ${documents.join(", ")}. Read them first; they answer what they answer. Do not ask what a document already says. A newer version of a document may arrive during the conversation with the difference spelled out; work from the new one.`,
				]
			: ["2. The person brought no documents; what they say below is all you start with."]),
		"3. Ask only what the input leaves open, in this order: why (the goal and what success is), what (what it is and the milestones, in order), then how and where (the stack, where it runs, the name and the place). Ask the open questions of one step together, numbered, and none that the input already settles. Recommend, in plain words, what building it properly takes - a GitHub repository, deployment, telemetry, a docs site - and accept a refusal; a refusal is recorded, never argued.",
		"4. Write what the conversation settles to ./brief.md (a `description:` in its frontmatter distilling the project in one to three sentences, then expectations, promises, looks). Keep the person's own documents as they are; the brief is yours.",
		'5. Once why, what, how and where, the name and the place are settled, write ./proposal.json as {"name": "<kebab-case>", "location": "<absolute directory>", "repos": [{"name": "<repo>"}], "milestones": ["<kebab-case>", ...], "recommendations": [{"name": "<practice>", "title": "<the practice in a few words>", "why": "<one line on why>", "kept": true}, {"name": "<practice>", "title": "...", "why": "...", "kept": false, "reason": "<their words>"}], "documentsOff": [], "remote": {"github": false}} and tell the person you have proposed it. A recommendation named for a planning document (`adr`) that the person declines is also listed in documentsOff. The brief and the test plan are never turned off. They accept or edit it; do not create anything yourself.',
		...(opts.reopened
			? [
					"",
					"This conversation is being reopened. Read what it already holds (./brief.md, ./proposal.json, ./documents/) and say in a sentence where it stands.",
				]
			: []),
		"",
		"The person says:",
		opts.text ?? draft.message,
	].join("\n");
}
