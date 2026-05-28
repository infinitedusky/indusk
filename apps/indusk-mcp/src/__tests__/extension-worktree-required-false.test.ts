import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T15 — Worktree extension posture: required: false, opt-in only.
 *
 * Two assertions:
 *  1. The shipped manifest has `required: false` (or omits the field).
 *     Catches the regression where someone accidentally flips it to true
 *     and auto-enables the extension on every project.
 *  2. `indusk init` on a project without `production/` + `worktrees/`
 *     directories does NOT auto-enable the extension. The extension
 *     should only land via explicit `indusk extensions enable worktree`.
 *
 * Both assertions guard the "opt-in for workbench-shaped projects" posture
 * the brief commits to and the ADR locks in.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const MANIFEST_PATH = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/manifest.json",
);
const SHOULD_SKIP_CLI = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

describe("worktree extension is required: false and opt-in only", () => {
	it("manifest declares required: false (or omits it)", () => {
		expect(existsSync(MANIFEST_PATH)).toBe(true);
		const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as {
			name?: string;
			required?: boolean;
		};
		expect(manifest.name).toBe("worktree");
		// Either omitted (which defaults to false in autoEnableExtensions) or
		// explicitly false. NEVER true — that would auto-enable on every project.
		expect(manifest.required ?? false).toBe(false);
	});

	describe("indusk init does not auto-enable worktree on non-workbench projects", () => {
		let testHome: string;
		let projectDir: string;

		beforeEach(() => {
			testHome = mkdtempSync(join(tmpdir(), "worktree-init-home-"));
			projectDir = mkdtempSync(join(tmpdir(), "worktree-init-proj-"));
			writeFileSync(
				join(projectDir, "package.json"),
				JSON.stringify({ name: "worktree-init-smoke", version: "0.0.0" }, null, 2),
			);
		});

		afterEach(() => {
			if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
			if (existsSync(projectDir))
				rmSync(projectDir, { recursive: true, force: true });
		});

		it.skipIf(SHOULD_SKIP_CLI)(
			"no .indusk/extensions/worktree/ after init on a project lacking production/ + worktrees/",
			{ timeout: 60_000 },
			() => {
				const result = spawnSync("node", [CLI_BIN, "init", "--no-index"], {
					cwd: projectDir,
					env: {
						...process.env,
						INDUSK_HOME: testHome,
						INDUSK_SKIP_UPDATE_CHECK: "1",
					},
					encoding: "utf-8",
					timeout: 50_000,
				});
				expect(result.status, `init failed: ${result.stderr}`).toBe(0);
				const workTreeExtDir = join(
					projectDir,
					".indusk",
					"extensions",
					"worktree",
				);
				expect(existsSync(workTreeExtDir)).toBe(false);
			},
		);
	});
});
