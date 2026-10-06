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
 * - A question is answered with a refusal that tells the session to decide on
 *   its own judgement and record the decision, because the build stops only
 *   for a judgement the plan declared.
 */

export type Decision = { allow: true } | { allow: false; message: string };

const PATH_KEYS = ["file_path", "path", "notebook_path"] as const;

export function decideBuildPermission(ev: PermissionEvent, worktree: string): Decision {
	for (const key of PATH_KEYS) {
		const value = ev.input[key];
		if (typeof value !== "string" || value === "") continue;
		const target = resolve(worktree, value);
		const rel = relative(resolve(worktree), target);
		if (rel.startsWith("..") || isAbsolute(rel)) {
			return {
				allow: false,
				message: `This build writes only inside its plan's worktree, ${worktree}; ${value} is outside it. Work inside the worktree, or record that the plan cannot continue.`,
			};
		}
	}
	return { allow: true };
}

/** A build asks no one: the reply to its question tells it to decide and record why. */
export function refuseBuildQuestion(_ev: QuestionEvent): Decision {
	return {
		allow: false,
		message:
			"This build runs unattended and stops only for a judgement the plan declared. Decide on your own judgement, record the decision and its reason in the plan, and continue.",
	};
}
