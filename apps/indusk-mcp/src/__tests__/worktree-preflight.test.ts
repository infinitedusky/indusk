import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWorktreeFixture, type WorktreeFixture } from "./helpers/worktree-fixture.js";

/**
 * T9 / T10 / T17 — preflight.sh end-to-end.
 *
 *   T9:  `indusk worktree preflight <slug>` exits non-zero on a real biome
 *        violation; stderr surfaces the violation.
 *   T10: Exit 0 in <2s when the diff touches only out-of-scope files
 *        (skip-fast path when no preflight rule matches).
 *   T17: `preflight_env{}` declarative path filters export consistent
 *        truthy env vars per per-config declaration.
 *
 * The fixture builds a workbench + canonical clone; setup-worktree.sh
 * creates the worktree; tests then write a worktree config + (optionally)
 * mutate files on the worktree branch + run preflight.
 *
 * Base branch for preflight is the local `main` (vs origin/main, which
 * isn't fetched in the fixture).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SETUP_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh",
);
const PREFLIGHT_SCRIPT = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/scripts/preflight.sh",
);

let fixture: WorktreeFixture;

afterEach(() => {
	fixture?.cleanup();
});

function run(
	script: string,
	cwd: string,
	args: string[],
	env?: Record<string, string>,
): { code: number; stdout: string; stderr: string } {
	const r = spawnSync(script, args, {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, ...env },
	});
	return {
		code: r.status ?? -1,
		stdout: r.stdout,
		stderr: r.stderr,
	};
}

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

describe("preflight.sh", () => {
	describe("T9: exits non-zero on a real violation; stderr surfaces it", () => {
		it("uses a stub preflight command that exits non-zero with a marker; preflight propagates the failure", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight: [
						{
							name: "stub-violation",
							command: "echo 'STUB_VIOLATION_MARKER on '$CHANGED_FILES_BIOME >&2; false",
						},
					],
				},
			});
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
			expect(setup.code, setup.stderr).toBe(0);
			// Commit a .ts change in the worktree so CHANGED_FILES_BIOME is non-empty.
			const tsPath = join(fixture.workbenchDir, "alpha", "src", "x.ts");
			spawnSync("mkdir", ["-p", join(fixture.workbenchDir, "alpha", "src")]);
			writeFileSync(tsPath, "export const x = 1;\n");
			git(join(fixture.workbenchDir, "alpha"), ["add", "-A"]);
			git(join(fixture.workbenchDir, "alpha"), ["commit", "-m", "add x.ts"]);

			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["alpha", "main"]);
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/STUB_VIOLATION_MARKER/);
			expect(r.stderr).toContain("preflight FAILED on: stub-violation");
		});
	});

	describe("T10: exit 0 in <2s when the diff touches only out-of-scope files", () => {
		it("preflight skips a `when`-gated check when CHANGED_FILES_BIOME is empty (markdown-only diff)", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight: [
						{
							name: "biome",
							command: "echo 'SHOULD_NOT_RUN'; exit 1",
							when: "CHANGED_FILES_BIOME",
						},
					],
				},
			});
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
			expect(setup.code, setup.stderr).toBe(0);

			// Commit a markdown-only change — CHANGED_FILES is non-empty but
			// CHANGED_FILES_BIOME is empty, so the biome check should skip.
			const mdPath = join(fixture.workbenchDir, "alpha", "NOTES.md");
			writeFileSync(mdPath, "# notes\n");
			git(join(fixture.workbenchDir, "alpha"), ["add", "-A"]);
			git(join(fixture.workbenchDir, "alpha"), ["commit", "-m", "add notes"]);

			const t0 = Date.now();
			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["alpha", "main"]);
			const elapsedMs = Date.now() - t0;

			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).not.toContain("SHOULD_NOT_RUN");
			expect(r.stdout).toMatch(/biome \(skipped — \$CHANGED_FILES_BIOME is empty\)/);
			// T10's <2s budget. Allow some headroom for vitest harness overhead.
			expect(elapsedMs).toBeLessThan(2000);
		});

		it("preflight exits 0 fast when the diff is empty (no changes vs base)", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight: [{ name: "should-not-run", command: "echo SHOULD_NOT_RUN; exit 1" }],
				},
			});
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
			expect(setup.code, setup.stderr).toBe(0);

			const t0 = Date.now();
			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["alpha", "main"]);
			const elapsedMs = Date.now() - t0;

			expect(r.code, r.stderr).toBe(0);
			expect(r.stdout).toContain("no changed files");
			expect(r.stdout).not.toContain("SHOULD_NOT_RUN");
			expect(elapsedMs).toBeLessThan(2000);
		});
	});

	describe("T17: preflight_env declarative path filters", () => {
		it("config-A: MIGRATIONS_RELEVANT triggers on packages/db/migrations/** matches", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight_env: {
						MIGRATIONS_RELEVANT: ["packages/db/migrations/**"],
					},
					preflight: [
						{
							name: "echo-env",
							// Use ${VAR:-} for any key not declared by THIS config's
							// preflight_env (set -u would otherwise complain).
							command: "echo 'MIG=' $MIGRATIONS_RELEVANT 'HAM=' \"${HAMMING_RELEVANT:-}\"",
						},
					],
				},
			});
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
			expect(setup.code, setup.stderr).toBe(0);

			// Commit a migration-relevant file.
			spawnSync("mkdir", ["-p", join(fixture.workbenchDir, "alpha", "packages/db/migrations")]);
			writeFileSync(
				join(fixture.workbenchDir, "alpha", "packages/db/migrations/001.sql"),
				"SELECT 1;\n",
			);
			git(join(fixture.workbenchDir, "alpha"), ["add", "-A"]);
			git(join(fixture.workbenchDir, "alpha"), ["commit", "-m", "add migration"]);

			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["alpha", "main"]);
			expect(r.code, r.stderr).toBe(0);
			// Bash echo with multiple args separates with single space; empty
			// vars word-split-disappear. So MIG=1 set → `MIG= 1 HAM=`.
			expect(r.stdout).toContain("MIG= 1 HAM=");
		});

		it("config-B: HAMMING_RELEVANT triggers on different glob; MIGRATIONS_RELEVANT empty", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight_env: {
						HAMMING_RELEVANT: ["apps/web/lib/integrations/hamming*.ts"],
					},
					preflight: [
						{
							name: "echo-env",
							command: "echo 'MIG=' \"${MIGRATIONS_RELEVANT:-}\" 'HAM=' $HAMMING_RELEVANT",
						},
					],
				},
			});
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
			expect(setup.code, setup.stderr).toBe(0);

			spawnSync("mkdir", ["-p", join(fixture.workbenchDir, "alpha", "apps/web/lib/integrations")]);
			writeFileSync(
				join(fixture.workbenchDir, "alpha", "apps/web/lib/integrations/hamming-client.ts"),
				"export const x = 1;\n",
			);
			git(join(fixture.workbenchDir, "alpha"), ["add", "-A"]);
			git(join(fixture.workbenchDir, "alpha"), ["commit", "-m", "add hamming file"]);

			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["alpha", "main"]);
			expect(r.code, r.stderr).toBe(0);
			// MIG is quoted-empty (kept as arg, adds space); HAM is 1.
			// Output: `MIG=  HAM= 1` (double space from empty quoted arg).
			expect(r.stdout).toMatch(/MIG=\s+HAM= 1\b/);
		});

		it("config-A applied to a diff that doesn't match: MIGRATIONS_RELEVANT empty", () => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight_env: {
						MIGRATIONS_RELEVANT: ["packages/db/migrations/**"],
					},
					preflight: [
						{
							name: "echo-env",
							command: "echo 'MIG=' $MIGRATIONS_RELEVANT",
						},
					],
				},
			});
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["alpha"]);
			expect(setup.code, setup.stderr).toBe(0);

			// Commit something that doesn't match the migrations glob.
			writeFileSync(join(fixture.workbenchDir, "alpha", "x.ts"), "1;\n");
			git(join(fixture.workbenchDir, "alpha"), ["add", "-A"]);
			git(join(fixture.workbenchDir, "alpha"), ["commit", "-m", "add x"]);

			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["alpha", "main"]);
			expect(r.code, r.stderr).toBe(0);
			// MIG empty; output is `MIG=` (echo's empty-var word-split drops it).
			expect(r.stdout).toMatch(/^MIG=\s*$/m);
		});
	});

	describe("safety: trunk and unknown slugs are rejected", () => {
		beforeEach(() => {
			fixture = buildWorktreeFixture({
				worktreeConfig: {
					trunk_branch: "main",
					preflight: [{ name: "noop", command: "true" }],
				},
			});
		});

		it("rejects preflight against the trunk", () => {
			// Fixture's wrapped repo is 'clone' — that's also the trunk symlink name.
			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["clone", "main"]);
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/preflight cannot target the trunk/);
		});

		it("rejects unknown slugs with the available targets listed", () => {
			const setup = run(SETUP_SCRIPT, fixture.workbenchDir, ["real-one"]);
			expect(setup.code, setup.stderr).toBe(0);
			const r = run(PREFLIGHT_SCRIPT, fixture.workbenchDir, ["nope", "main"]);
			expect(r.code).not.toBe(0);
			expect(r.stderr).toMatch(/no worktree matching slug 'nope'/);
		});
	});
});
