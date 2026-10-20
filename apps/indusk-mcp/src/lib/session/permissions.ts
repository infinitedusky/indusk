import { isAbsolute, relative, resolve } from "node:path";
import type { PermissionEvent, QuestionEvent } from "./protocol.js";

/**
 * How a build session's requests are decided, with nobody to ask
 * (admin-plan-authoring, ADR D1, A30). A build accepts edits, so what reaches
 * here is everything else Claude would have asked a person.
 *
 * - A tool given a path is allowed inside the plan's worktree and refused
 *   outside it, saying so.
 * - A tool given no path (Bash, a search, an MCP tool) is allowed: it runs
 *   in the worktree, and the project's hooks still judge it. This is a
 *   boundary on what the build is *asked* about, not a sandbox.
 * - A plain question is refused naming `ask_decision`, the tool a choice is asked
 *   through; the build stops for a judgement the plan declared or a question that holds.
 *
 * A project conversation is decided differently (`decideConfinedPermission`,
 * new-project-flow Build Phase 7): its agent runs in a draft folder under the
 * InDusk home, before any project exists, and the prompt alone cannot keep it
 * there. It is confined to its draft: Read, Write, Edit, Glob and Grep, on
 * paths inside the draft, and every other tool - a shell, the web, an MCP
 * tool - is refused with the reason, whatever the project's allow-list says.
 * Nothing it asks reaches the person. Plan conversations and builds keep the
 * rules above, unchanged.
 *
 * promise: an-unkept-project-conversation-leaves-nothing-on-disk
 */

export type Decision = { allow: true } | { allow: false; message: string };

const PATH_KEYS = ["file_path", "path", "notebook_path"] as const;

export function decideBuildPermission(ev: PermissionEvent, roots: string | string[]): Decision {
	// A workbench build has two: the root, where its plan is checked off, and
	// its code worktree (workbench-plan-authoring D5). A relative path is the
	// first root's, where the session runs.
	const all = typeof roots === "string" ? [roots] : roots;
	const inside = (target: string, root: string) => {
		const rel = relative(resolve(root), target);
		return !(rel.startsWith("..") || isAbsolute(rel));
	};
	for (const key of PATH_KEYS) {
		const value = ev.input[key];
		if (typeof value !== "string" || value === "") continue;
		const target = resolve(all[0], value);
		if (!all.some((root) => inside(target, root))) {
			return {
				allow: false,
				message: `This build writes only inside its plan's worktree, ${all.join(" and ")}; ${value} is outside it. Work inside the worktree, or record that the plan cannot continue.`,
			};
		}
	}
	return { allow: true };
}

/** The tools a confined session may use: the ones that only read and write files, each given a path. */
const CONFINED_TOOLS: readonly string[] = ["Read", "Write", "Edit", "Glob", "Grep"];

/**
 * How a confined session's requests are decided: allowed for a file tool whose
 * paths - `file_path`, `path`, and a Glob's pattern or a Grep's `glob` - stay
 * inside `root`; refused, with the reason, for anything else. Nothing is
 * forwarded to a person: there is no one watching a draft who could say yes.
 */
export function decideConfinedPermission(ev: PermissionEvent, root: string): Decision {
	const why = (what: string): Decision => ({
		allow: false,
		message: `${what} A project conversation works only inside its draft folder, ${root}, with Read, Write, Edit, Glob and Grep, because nothing is made until the person accepts your proposal. Write what you mean to ./brief.md or ./proposal.json, and say the rest in your reply.`,
	});
	if (!CONFINED_TOOLS.includes(ev.tool)) {
		return why(`${ev.tool} is not available here.`);
	}
	const inside = decideBuildPermission(ev, root);
	if (!inside.allow) return why(`${describePath(ev)} is outside the draft.`);
	const pattern = ev.tool === "Glob" ? ev.input.pattern : ev.input.glob;
	if (typeof pattern === "string" && pattern !== "") {
		const rel = relative(resolve(root), resolve(root, pattern));
		if (rel.startsWith("..") || isAbsolute(rel)) {
			return why(`The pattern ${pattern} reaches outside the draft.`);
		}
	}
	return { allow: true };
}

/** The path a request named, for the refusal's words. */
function describePath(ev: PermissionEvent): string {
	for (const key of PATH_KEYS) {
		const value = ev.input[key];
		if (typeof value === "string" && value !== "") return value;
	}
	return "That path";
}

/**
 * A plain question in a build is refused, naming the tool a choice is asked through:
 * `ask_decision` carries the recommendation, the reason, the cost and what each option
 * changes, which `AskUserQuestion` cannot (decisions-as-questions, ADR decision 12).
 */
export function refuseBuildQuestion(_ev: QuestionEvent): Decision {
	return {
		allow: false,
		message:
			"This build runs unattended and AskUserQuestion reaches no one. Ask a choice the plan does not settle with the `ask_decision` tool (options, your recommendation and reason, a cost, and what each option changes), and never record it as decided unattended.",
	};
}
