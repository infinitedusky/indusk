import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A8 — machine-specific residue never reaches the shared remote.
 *
 * INVERTED-FIXTURE TRAP. Run against a workbench root that is not a git repo,
 * this row passes trivially: nothing can leak into a remote that does not
 * exist. It is only meaningful against `gitInitWorkbench: true`, where the
 * root really is a repo with a real remote and the only thing standing between
 * a trunk symlink and the shared history is an ignore file that does not exist
 * yet. Anyone re-authoring this must keep the git-init, or they will pin the
 * accident instead of the guarantee.
 *
 * The ignore shape has to be a WHITELIST rather than a blacklist, and the
 * unpredicted-worktree case below is why: worktree directories appear at the
 * workbench root with names nobody listed in advance, so a deny-list is always
 * one `worktree create` behind.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function git(cwd: string, args: string[]): { code: number; stdout: string } {
	const r = spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
	});
	return { code: r.status ?? -1, stdout: r.stdout };
}

describe.skipIf(SHOULD_SKIP)("A8 — residue stays out of the shared remote", () => {
	it("keeps trunk symlinks, worktrees, and env out of the remote", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;

		// The four residue classes named in the ADR, all present on disk.
		mkdirSync(join(wb, ".indusk", "extensions", "doppler"), { recursive: true });
		writeFileSync(join(wb, ".indusk", "extensions", "doppler", ".env"), "DOPPLER_TOKEN=secret\n");
		mkdirSync(join(wb, "some-worktree"), { recursive: true });
		writeFileSync(join(wb, "some-worktree", "file.ts"), "export const x = 1;\n");
		writeFileSync(join(wb, ".env.local"), "SECRET=nope\n");

		git(wb, ["add", "-A"]);
		git(wb, ["commit", "-q", "-m", "sync"]);
		git(wb, ["push", "-q", "origin", "main"]);

		const tracked = git(wb, ["ls-tree", "-r", "--name-only", "HEAD"]).stdout;

		expect(tracked).not.toContain("doppler/.env");
		expect(tracked).not.toMatch(/^some-worktree\//m);
		expect(tracked).not.toContain(".env.local");
		// The trunk symlinks are the fixture's declared repo names at the root.
		for (const name of fixture.repoNames) {
			expect(tracked).not.toMatch(new RegExp(`^${name}(/|$)`, "m"));
		}
		// …while the context that is supposed to travel actually does. A test
		// that only asserts absence passes just as well against an ignore file
		// that excludes everything.
		expect(tracked).toContain(".indusk/planning/sample-plan/brief.md");
	});

	it("ignores a worktree directory nobody listed in advance", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;

		// The whole case for a whitelist: this name is invented at runtime, so
		// no deny-list could have contained it.
		const unpredicted = join(wb, "feature-nobody-predicted-2026");
		mkdirSync(unpredicted, { recursive: true });
		writeFileSync(join(unpredicted, "code.ts"), "export const y = 2;\n");

		const status = git(wb, ["status", "--porcelain", "--untracked-files=all"]).stdout;
		expect(status).not.toContain("feature-nobody-predicted-2026");
	});
});
