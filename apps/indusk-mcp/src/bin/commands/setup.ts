import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * `indusk setup <cloned-repo-path>` — one-shot workbench creation.
 *
 * Turns an already-cloned git repo into an InDusk workbench in a single
 * command, collapsing the four-step manual Flow A (mkdir, package.json,
 * symlink, `init --workbench --wrapped-repo X --sibling-parent Y`).
 *
 * Topology is non-destructive symlink-in-place: the repo stays exactly where
 * it was cloned and the workbench gets a `<repo> -> ../<repo>` trunk symlink.
 * The workbench dir is the repo's sibling, named `<repo>-workbench`.
 *
 * This delegates to `init(workbenchDir, { workbench: true, ... })` — `init`
 * already IS the workbench-init flow (trunk symlink + worktree config block +
 * worktree-extension enable), so delegation keeps a single code path with no
 * drift. See `.indusk/planning/workbench-setup-command/`.
 */
export async function setup(repoPathInput: string): Promise<void> {
	const repoPath = resolve(repoPathInput);

	// Validate the target is an existing git repo (T4).
	if (!existsSync(repoPath)) {
		console.error(`Error: no such path: ${repoPath}`);
		process.exit(1);
	}
	if (!existsSync(join(repoPath, ".git"))) {
		console.error(`Error: ${repoPath} is not a git repository (no .git/ there).`);
		console.error("  `indusk setup` wraps an already-cloned repo — clone it first, then re-run.");
		process.exit(1);
	}

	const wrappedRepo = basename(repoPath);
	const siblingParent = dirname(repoPath);
	const workbenchDir = join(siblingParent, `${wrappedRepo}-workbench`);

	// Never clobber an existing directory. Distinguish a real workbench (has
	// `.indusk/config.json`) from a partial/foreign dir — advising `indusk
	// update` only makes sense for the former (T5 / T8).
	if (existsSync(workbenchDir)) {
		if (existsSync(join(workbenchDir, ".indusk", "config.json"))) {
			console.error(`Error: a workbench already exists at ${workbenchDir}.`);
			console.error("  To refresh it, run `indusk update` from there.");
			console.error("  To recreate it, remove that directory first.");
		} else {
			console.error(`Error: ${workbenchDir} exists but is not an InDusk workbench.`);
			console.error("  Remove it and re-run `indusk setup`.");
		}
		process.exit(1);
	}

	// All guards passed — scaffold the workbench dir + minimal package.json
	// (the file the manual flow required you to hand-write), then delegate to
	// the single workbench-init flow. Wrapped so a failure during init leaves
	// no partial `<repo>-workbench` behind (T9): the collision guard above
	// proved the dir did not pre-exist, so setup created it this run and can
	// safely remove it on failure. `rmSync` removes the trunk symlink as a link
	// (it does not recurse into `../<repo>`), so the wrapped repo is untouched.
	mkdirSync(workbenchDir, { recursive: true });
	try {
		writeFileSync(
			join(workbenchDir, "package.json"),
			`${JSON.stringify({ name: `${wrappedRepo}-workbench`, version: "0.0.1", private: true }, null, 2)}\n`,
		);
		console.info(`[Setup] scaffolded workbench: ${workbenchDir}`);

		const { init } = await import("./init.js");
		await init(workbenchDir, { workbench: true, wrappedRepo, siblingParent });
	} catch (err) {
		rmSync(workbenchDir, { recursive: true, force: true });
		const msg = err instanceof Error ? err.message : String(err);
		console.error(
			`Error: setup failed during init — removed the partial workbench at ${workbenchDir}.`,
		);
		console.error(`  ${msg}`);
		process.exit(1);
	}
}
