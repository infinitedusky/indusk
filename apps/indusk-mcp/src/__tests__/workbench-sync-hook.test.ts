import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, gitOut, REPO_ROOT, SHOULD_SKIP } from "./helpers/cli.js";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * The sync TRIGGER, and the guard that keeps it off everything else.
 *
 * Discovered work, not a trajectory row: choosing a PostToolUse hook as the
 * trigger introduced a risk the plan's assertions do not cover — a hook that
 * auto-commits would, in a NORMAL-MODE project, commit a developer's
 * half-finished source on every edit. dusk itself is such a project, so the
 * blast radius includes this repository.
 *
 * The guard is one `worktree.shape === "workbench"` check, which is exactly
 * the kind of line that survives review and then gets refactored away. These
 * assert it from the outside: run the hook, see whether a commit appeared.
 */

const HOOK = join(REPO_ROOT, "apps/indusk-mcp/hooks/workbench-sync.js");

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

/**
 * A real executable standing in for `indusk` on PATH.
 *
 * `INDUSK_BIN` is spawned as a single program, not a shell string — an earlier
 * version of this helper passed "node /path/cli.js", which spawn treats as one
 * impossible filename. The hook then silently did nothing and the guard test
 * passed for the wrong reason. A shim is what a real install looks like.
 */
function makeShim(dir: string): string {
	const shim = join(dir, "indusk-shim.sh");
	writeFileSync(shim, `#!/usr/bin/env bash\nexec "${process.execPath}" "${CLI_BIN}" "$@"\n`);
	chmodSync(shim, 0o755);
	return shim;
}

function fireHook(cwd: string, shimDir: string): number {
	const r = spawnSync("node", [HOOK], {
		input: JSON.stringify({ tool_name: "Write", cwd }),
		encoding: "utf-8",
		env: { ...process.env, INDUSK_BIN: makeShim(shimDir), INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return r.status ?? -1;
}

describe.skipIf(SHOULD_SKIP)("the sync trigger is inert outside a workbench", () => {
	it("creates no commit in a normal-mode project", { timeout: 30_000 }, () => {
		// A normal-mode project: `.indusk/` with NO workbench shape, sitting in
		// a git repo — precisely dusk's own layout.
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const root = fixture.workbenchDir;
		const cfgPath = join(root, ".indusk", "config.json");
		const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
		cfg.worktree.shape = "normal";
		writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
		spawnSync("git", ["-C", root, "add", "-A"], { encoding: "utf-8" });
		spawnSync(
			"git",
			["-C", root, "-c", "user.email=t@t.l", "-c", "user.name=t", "commit", "-q", "-m", "baseline"],
			{ encoding: "utf-8" },
		);

		const before = gitOut(root, ["rev-parse", "HEAD"]).trim();
		writeFileSync(join(root, ".indusk", "planning", "sample-plan", "wip.md"), "half a thought\n");

		expect(fireHook(root, fixture.root)).toBe(0);

		// The edit is untouched and uncommitted — the developer's tree is theirs.
		expect(gitOut(root, ["rev-parse", "HEAD"]).trim()).toBe(before);
		expect(gitOut(root, ["status", "--porcelain"])).toContain("wip.md");
	});

	it("does commit in a real workbench, so the guard is not just always-off", {
		timeout: 30_000,
	}, () => {
		// The paired positive. Without it, a guard that refuses EVERYWHERE would
		// pass the test above and look correct.
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const root = fixture.workbenchDir;

		const before = gitOut(root, ["rev-parse", "HEAD"]).trim();
		writeFileSync(join(root, ".indusk", "planning", "sample-plan", "note.md"), "a thought\n");

		expect(fireHook(root, fixture.root)).toBe(0);

		expect(gitOut(root, ["rev-parse", "HEAD"]).trim()).not.toBe(before);
		expect(gitOut(root, ["log", "-1", "--pretty=%s"])).toMatch(/sync \d{4}-\d{2}-\d{2}/);
	});

	it("never fails an edit, even when the sync itself cannot run", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const root = fixture.workbenchDir;
		writeFileSync(join(root, ".indusk", "planning", "sample-plan", "note.md"), "x\n");

		const r = spawnSync("node", [HOOK], {
			input: JSON.stringify({ tool_name: "Write", cwd: root }),
			encoding: "utf-8",
			env: { ...process.env, INDUSK_BIN: "definitely-not-a-real-binary-xyz" },
		});
		// A sync that cannot run must not decide whether the developer's edit stood.
		expect(r.status).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)("A25 — the trigger works before the repo exists", () => {
	it("syncs a workbench that is not yet a git repo", { timeout: 30_000 }, () => {
		// Chicken-and-egg: the debounce stamp lives under the gitdir, so
		// `stampPath` returns null on a workbench that has never been
		// git-initialized, `dueForSync` says no, and the hook exits 0. But the
		// only thing that git-inits a workbench is `sync` itself — so such a
		// workbench is silently never synced, forever.
		fixture = buildTwoRepoWorkbench(); // deliberately NOT gitInitWorkbench
		const root = fixture.workbenchDir;
		expect(existsSync(join(root, ".git"))).toBe(false);

		writeFileSync(join(root, ".indusk", "planning", "sample-plan", "note.md"), "a thought\n");

		expect(fireHook(root, fixture.root)).toBe(0);

		// The hook must have driven a sync, which initializes the repo and
		// commits — not exited quietly because no repo existed yet.
		expect(existsSync(join(root, ".git"))).toBe(true);
		expect(gitOut(root, ["log", "-1", "--pretty=%s"])).toMatch(/sync \d{4}-\d{2}-\d{2}/);
	});
});
