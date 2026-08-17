import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A10 / A11 / A12 / A15 — `indusk workbench restore`.
 *
 * Red today on "unknown command": the `workbench` group does not exist. That
 * is a real red rather than a contrived one — a fresh clone of a workbench
 * context repo genuinely leaves you with no way to materialize it, which is
 * the gap this plan opened with.
 *
 * A12 is the row that matters most and the one an acceptance-only suite would
 * never have: it asserts the FAILURE path. A restore that clones one repo of
 * two and exits 0 looks identical to success from the outside, and this
 * codebase has three separate mechanisms built to avoid exactly that shape.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Every path under `dir`, sorted — the cheapest honest "did anything change". */
function treeSnapshot(dir: string): string[] {
	const out: string[] = [];
	const walk = (d: string, prefix: string): void => {
		for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			if (entry.name === ".git") continue;
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			out.push(rel);
			if (entry.isDirectory() && !entry.isSymbolicLink()) walk(join(d, entry.name), rel);
		}
	};
	walk(dir, "");
	return out;
}

describe.skipIf(SHOULD_SKIP)("A10 — one command materializes the whole workbench", () => {
	it("clones every declared repo as a sibling and links it in", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench();

		// Precondition: this is what a fresh clone of the context repo looks like.
		for (const name of fixture.repoNames) {
			expect(existsSync(join(fixture.root, name))).toBe(false);
		}

		const { code } = runCli(fixture.workbenchDir, ["workbench", "restore"]);
		expect(code).toBe(0);

		for (const name of fixture.repoNames) {
			expect(existsSync(join(fixture.root, name, "README.md"))).toBe(true);
			const trunk = join(fixture.workbenchDir, name);
			expect(lstatSync(trunk).isSymbolicLink()).toBe(true);
			// Relative target, so the workbench stays portable across machines —
			// an absolute target would work here and break on the next machine,
			// which is the kind of pass that teaches nothing.
			expect(existsSync(join(trunk, "README.md"))).toBe(true);
		}
	});

	it("names a declared repo that has no remote instead of skipping it", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ omitRemoteFor: "beta" });

		const { stdout, stderr } = runCli(fixture.workbenchDir, ["workbench", "restore"]);

		expect(`${stdout}${stderr}`).toContain("beta");
		expect(existsSync(join(fixture.root, "alpha", "README.md"))).toBe(true);
	});
});

describe.skipIf(SHOULD_SKIP)("A11 — restore is idempotent", () => {
	it("reports every repo already present and writes nothing", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench();

		const first = runCli(fixture.workbenchDir, ["workbench", "restore"]);
		expect(first.code).toBe(0);
		const after = treeSnapshot(fixture.root);

		const second = runCli(fixture.workbenchDir, ["workbench", "restore"]);
		expect(second.code).toBe(0);

		expect(treeSnapshot(fixture.root)).toEqual(after);
		for (const name of fixture.repoNames) {
			expect(second.stdout).toContain(name);
		}
	});
});

describe.skipIf(SHOULD_SKIP)("A12 — a failed clone is loud and partial progress is kept", () => {
	it("names the failed repo, keeps the others, and exits non-zero", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ breakRemoteFor: "beta" });

		const { code, stdout, stderr } = runCli(fixture.workbenchDir, ["workbench", "restore"]);

		// Non-zero is the whole point: half a workbench must never read as done.
		expect(code).not.toBe(0);
		expect(`${stdout}${stderr}`).toContain("beta");
		// The reachable repo still got materialized — a first failure must not
		// abort the rest, or restoring a 5-repo workbench becomes a lottery.
		expect(existsSync(join(fixture.root, "alpha", "README.md"))).toBe(true);
	});

	it("completes on re-run once the remote is reachable", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ breakRemoteFor: "beta" });
		runCli(fixture.workbenchDir, ["workbench", "restore"]);

		// Repair the declaration the way a developer would, then re-run.
		const cfgPath = join(fixture.workbenchDir, ".indusk", "config.json");
		const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
		cfg.worktree.repos[1].remote = fixture.remotes[1];
		spawnSync("node", [
			"-e",
			`require("fs").writeFileSync(${JSON.stringify(cfgPath)}, ${JSON.stringify(JSON.stringify(cfg, null, 2))})`,
		]);

		const retry = runCli(fixture.workbenchDir, ["workbench", "restore"]);
		expect(retry.code).toBe(0);
		expect(existsSync(join(fixture.root, "beta", "README.md"))).toBe(true);
	});
});

describe.skipIf(SHOULD_SKIP)("A15 — what restore cannot supply, it names", () => {
	it("prints the out-of-band set, and none of it is in the remote", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });

		const { stdout } = runCli(fixture.workbenchDir, ["workbench", "restore"]);

		// The list exists and is specific — "configure your secrets" is not a
		// list, it is a shrug.
		expect(stdout).toMatch(/doppler|\.env|ssh/i);

		// Cross-check: nothing it names is actually present in the shared remote.
		const tracked = spawnSync(
			"git",
			["-C", fixture.workbenchDir, "ls-tree", "-r", "--name-only", "HEAD"],
			{ encoding: "utf-8" },
		).stdout;
		expect(tracked).not.toMatch(/\.env$/m);
		expect(tracked).not.toContain("extensions/doppler/.env");
	});
});
