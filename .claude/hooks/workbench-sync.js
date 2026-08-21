#!/usr/bin/env node
/**
 * workbench-sync.js — PostToolUse hook (Edit|Write).
 *
 * The trigger half of workbench sync. The mechanism lives in
 * `lib/worktree/sync.ts` and is shared with `indusk workbench sync`; this only
 * decides WHEN to call it. Keeping the two apart means the trigger can become
 * a watcher daemon later without touching the mechanism.
 *
 * THREE GUARDS, and the first is the important one:
 *
 *   1. WORKBENCH ONLY. A normal-mode project keeps `.indusk/` inside its own
 *      product repo, so auto-committing there would commit a developer's
 *      half-finished source on every edit. dusk itself is such a project. This
 *      hook must be inert anywhere `worktree.shape` is not "workbench".
 *   2. DEBOUNCED. Edit/Write fires constantly; a push per keystroke-burst is
 *      pointless network traffic. The stamp lives under the GITDIR, never the
 *      working tree — per-machine state that must not become a tracked file
 *      (the worktree extension keeps its overlay state the same way).
 *   3. NEVER BLOCKS. Always exits 0. A sync failure must not fail a developer's
 *      edit, and an unreachable remote is a normal condition, not an error.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveStateAndGitPaths } from "./_hook-paths.js";

/** Seconds between syncs. Edits burst; the remote does not need every burst. */
const DEBOUNCE_SECONDS = 20;

function isWorkbench(root) {
	try {
		const cfg = JSON.parse(readFileSync(join(root, ".indusk", "config.json"), "utf-8"));
		return cfg?.worktree?.shape === "workbench";
	} catch {
		return false;
	}
}

/** Stamp path under the gitdir — untracked by construction, not by a rule. */
function stampPath(root) {
	const r = spawnSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: root, encoding: "utf-8" });
	if (r.status !== 0) return null;
	return join(r.stdout.trim(), "indusk-sync-stamp");
}

function dueForSync(stamp) {
	if (!stamp) return false;
	if (!existsSync(stamp)) return true;
	try {
		return (Date.now() - statSync(stamp).mtimeMs) / 1000 >= DEBOUNCE_SECONDS;
	} catch {
		return true;
	}
}

function touch(stamp) {
	try {
		if (existsSync(stamp)) {
			const now = new Date();
			utimesSync(stamp, now, now);
		} else {
			writeFileSync(stamp, "workbench sync debounce stamp\n");
		}
	} catch {
		// A stamp we cannot write means we sync more often than intended —
		// noisy, never wrong. Silence is the correct response.
	}
}

async function main() {
	let event = {};
	try {
		event = JSON.parse(readFileSync(0, "utf-8") || "{}");
	} catch {
		process.exit(0);
	}

	const { statePath } = resolveStateAndGitPaths(event.cwd ?? process.cwd());
	if (!statePath) process.exit(0);

	// Guard 1 — the load-bearing one.
	if (!isWorkbench(statePath)) process.exit(0);

	// Guard 2.
	const stamp = stampPath(statePath);
	if (!dueForSync(stamp)) process.exit(0);
	touch(stamp);

	// Guard 3: spawn detached and never wait. A sync must not add latency to a
	// developer's edit, and its outcome must not decide whether the edit stood.
	const bin = process.env.INDUSK_BIN ?? "indusk";
	try {
		const child = spawnSync(bin, ["workbench", "sync"], {
			cwd: statePath,
			encoding: "utf-8",
			timeout: 25_000,
		});
		if (child.status !== 0 && child.stderr) {
			// Reported, not raised. The hook still exits 0.
			process.stderr.write(`[workbench-sync] ${child.stderr.trim().split("\n")[0]}\n`);
		}
	} catch {
		// ignore
	}
	process.exit(0);
}

main();
