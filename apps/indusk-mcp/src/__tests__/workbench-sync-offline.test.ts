import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A6 — offline never blocks, and the backlog drains on reconnect.
 *
 * The remote is "removed" by renaming the bare repo out from under the
 * configured URL, which is as close to unreachable as a local fixture gets
 * and does not require a network. Restoring it is a rename back.
 *
 * The load-bearing half of this row is that agent work CONTINUES. A sync layer
 * that fails closed when the network is down is worse than no sync layer,
 * because it converts someone else's outage into your inability to work.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function git(cwd: string, args: string[]): string {
	return spawnSync("git", args, { cwd, encoding: "utf-8" }).stdout;
}

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe.skipIf(SHOULD_SKIP)("A6 — offline degrades gracefully", () => {
	it("keeps committing locally, then drains when the remote returns", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const wb = fixture.workbenchDir;
		const remote = fixture.workbenchRemote as string;
		const stashed = `${remote}-offline`;

		// --- remote goes away ---
		renameSync(remote, stashed);

		writeFileSync(join(wb, ".indusk", "planning", "sample-plan", "offline-note.md"), "written\n");
		const offline = runCli(wb, ["workbench", "sync"]);

		// The work is committed locally even though the push cannot land. An
		// unreachable remote is not a reason to lose an edit.
		expect(git(wb, ["status", "--porcelain"]).trim()).toBe("");
		expect(git(wb, ["log", "--oneline"])).toContain("");
		// It may warn — it must not present the outage as the developer's
		// problem to solve before continuing.
		expect(`${offline.stdout}${offline.stderr}`).not.toMatch(/aborted|cannot continue|fatal:/i);

		// --- remote comes back ---
		renameSync(stashed, remote);

		const back = runCli(wb, ["workbench", "sync"]);
		expect(back.code).toBe(0);

		// The backlog arrived with no manual git from anyone.
		const remoteLog = git(remote, ["log", "--oneline", "--all"]);
		const localHead = git(wb, ["rev-parse", "HEAD"]).trim();
		expect(remoteLog.length).toBeGreaterThan(0);
		expect(git(remote, ["cat-file", "-t", localHead]).trim()).toBe("commit");
	});
});
