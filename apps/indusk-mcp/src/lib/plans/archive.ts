import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, relative } from "node:path";
import { isUsableSegment } from "../path-segment.js";
import { planFolderPath, planFolderStatus } from "../promises/plan-folder.js";
import { readPromises } from "../promises/registry.js";

/**
 * `indusk plans archive <plan>` (a-run-can-be-trusted A80): the retrospective's
 * archival step as a package command. The shell guard refuses a raw `mv` of a
 * plan's folder, so the release archives through here: `git mv` of
 * `.indusk/planning/<plan>` to `.indusk/planning/archive/<plan>`, run by the
 * package. Refused, moving nothing, when the folder is not an active plan's,
 * when the archive already holds one by the name, or while a promise the plan
 * owns is still `declared` — the retrospective confirms them first (Step 8a),
 * and a declared promise whose plan is archived fails `promises check`.
 *
 * `plans archive-dead`'s mover renames with `fs` and was not reused: this one
 * must move through git, so the archive is one staged rename.
 *
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 */

export type ArchiveResult = { ok: true; to: string } | { ok: false; reason: string };

export type GitRun = (cwd: string, args: string[]) => { ok: true } | { ok: false; error: string };

export interface ArchiveDeps {
	/** Runs git in the project root; default the real `git`. */
	git?: GitRun;
	/** The promises the plan owns that are still `declared`; default read from the registry. */
	declaredPromises?: (root: string, plan: string) => string[];
}

const realGit: GitRun = (cwd, args) => {
	try {
		execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		return { ok: true };
	} catch (err) {
		const e = err as { stderr?: Buffer; message: string };
		return { ok: false, error: e.stderr?.toString().trim() || e.message };
	}
};

/** The plan's own promises not yet confirmed: owned by it and still `declared`. */
export function declaredPromisesOf(root: string, plan: string): string[] {
	const read = readPromises(root);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	if (!registry) return [];
	return registry.promises
		.filter((p) => p.owner === plan && p.state === "declared")
		.map((p) => p.name)
		.sort();
}

export function archivePlan(root: string, plan: string, deps: ArchiveDeps = {}): ArchiveResult {
	if (!isUsableSegment(plan) || plan === "archive") {
		return { ok: false, reason: `"${plan}" is not a plan's name` };
	}
	const from = planFolderPath(root, plan);
	const to = planFolderPath(root, plan, true);
	const rel = (p: string) => relative(root, p).split("\\").join("/");
	if (existsSync(to)) {
		return { ok: false, reason: `${rel(to)} already exists; nothing was moved` };
	}
	if (planFolderStatus(root, plan) !== "active") {
		return { ok: false, reason: `${rel(from)} is not a plan's folder; nothing was moved` };
	}
	const declared = (deps.declaredPromises ?? declaredPromisesOf)(root, plan);
	if (declared.length > 0) {
		return {
			ok: false,
			reason: `${plan} still owns declared promises (${declared.join(", ")}); run \`indusk promises confirm ${plan}\` first`,
		};
	}
	mkdirSync(dirname(to), { recursive: true });
	const moved = (deps.git ?? realGit)(root, ["mv", rel(from), rel(to)]);
	if (!moved.ok) return { ok: false, reason: `git mv refused: ${moved.error}` };
	return { ok: true, to: rel(to) };
}
