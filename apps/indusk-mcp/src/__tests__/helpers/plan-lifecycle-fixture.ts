import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { git } from "./test-git.js";

/**
 * A project for the `indusk plans` verbs (admin-plan-authoring): a trunk on
 * `main` with InDusk configured and one promise domain declared, and room
 * beside it for the plan worktrees the verbs create.
 *
 *   <tmp>/
 *   ├── proj/              trunk, on main
 *   └── proj-worktrees/    where `worktree create` and `plans start` put a plan
 *
 * The verbs are reached over the CLI, so the fixture is a real repository.
 * Every step throws on failure: a half-built fixture proves nothing.
 */

export const DOMAIN = "seating";

export interface PlanLifecycleProject {
	base: string;
	trunk: string;
	/** Where `<plan>`'s worktree lives once one is made. */
	worktreeOf(plan: string): string;
	/** Make `<plan>`'s worktree on `plan/<plan>` and assign it, independent of `plans start`. */
	makeWorktree(plan: string): string;
	/** Write `files` (relative path → content) in `checkout` and commit them there. */
	commit(checkout: string, files: Record<string, string>, message: string): void;
	/** The paths `main` holds, as git sees them. */
	onMain(): string[];
	/** `main`'s commit. */
	mainSha(): string;
	cleanup(): void;
}

export function planLifecycleProject(prefix = "plans"): PlanLifecycleProject {
	const base = realpathSync(mkdtempSync(join(tmpdir(), `${prefix}-`)));
	const trunk = join(base, "proj");
	mkdirSync(join(trunk, ".indusk", "promises"), { recursive: true });
	mkdirSync(join(trunk, ".indusk", "planning"), { recursive: true });
	git(trunk, ["init", "-q", "-b", "main"]);
	writeFileSync(
		join(trunk, ".indusk", "config.json"),
		`${JSON.stringify({ mode: "full", otel: { role: "library" }, promises: { domains: [DOMAIN] } }, null, "\t")}\n`,
	);
	writeFileSync(join(trunk, ".indusk", "planning", "master.md"), "# Plans\n");
	writeFileSync(join(trunk, "README.md"), "proj\n");
	git(trunk, ["add", "-A"]);
	git(trunk, ["commit", "-q", "-m", "init"]);

	const worktreeOf = (plan: string) => join(base, "proj-worktrees", plan);

	return {
		base,
		trunk,
		worktreeOf,
		makeWorktree(plan) {
			// By hand, not `indusk worktree create`: that command assigns only a
			// plan whose folder is already on the trunk, and a plan written on its
			// own branch has none there until approval. The record is written in
			// the shape `plan-worktree-record.ts` reads.
			const path = worktreeOf(plan);
			git(trunk, ["worktree", "add", "-q", path, "-b", `plan/${plan}`, "main"]);
			if (!existsSync(path)) throw new Error(`fixture: no worktree at ${path}`);
			const common = git(trunk, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
			const record = {
				version: 1,
				assignments: [
					{ plan, path: realpathSync(path), branch: `plan/${plan}`, at: new Date().toISOString() },
				],
			};
			writeFileSync(
				join(common, "indusk-plan-worktrees.json"),
				`${JSON.stringify(record, null, 2)}\n`,
			);
			return realpathSync(path);
		},
		commit(checkout, files, message) {
			for (const [rel, content] of Object.entries(files)) {
				const path = join(checkout, rel);
				mkdirSync(dirname(path), { recursive: true });
				writeFileSync(path, content);
			}
			git(checkout, ["add", "-A"]);
			git(checkout, ["commit", "-q", "-m", message]);
		},
		onMain() {
			return git(trunk, ["ls-tree", "-r", "--name-only", "main"]).split("\n").filter(Boolean);
		},
		mainSha() {
			return git(trunk, ["rev-parse", "main"]);
		},
		cleanup() {
			rmSync(base, { recursive: true, force: true });
		},
	};
}
