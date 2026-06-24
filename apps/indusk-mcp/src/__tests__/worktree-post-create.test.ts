import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * `post_create` — commands declared in the worktree config run inside the new
 * worktree after create (+ env provisioning), so `indusk worktree create` yields
 * a runnable worktree in one shot (install/build/etc.) instead of a bare checkout.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

let fx: WorktreeFixture;
afterEach(() => fx?.cleanup());

describe("worktree post_create", () => {
	it.skipIf(SHOULD_SKIP)(
		"runs post_create commands (in order) inside the new worktree after create",
		() => {
			fx = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					base_branch: "main",
					post_create: ["echo ready > .post-create-ran", "mkdir -p .post-create-marker"],
				},
			});
			const r = spawnSync("node", [CLI_BIN, "worktree", "create", "feat-pc"], {
				cwd: fx.workbenchDir,
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
				encoding: "utf-8",
			});
			const wt = join(fx.workbenchDir, "feat-pc");
			// both commands ran, in the worktree dir
			expect(
				existsSync(join(wt, ".post-create-ran")),
				`stdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
			).toBe(true);
			expect(readFileSync(join(wt, ".post-create-ran"), "utf-8")).toMatch(/ready/);
			expect(existsSync(join(wt, ".post-create-marker"))).toBe(true);
		},
		60_000,
	);
});
