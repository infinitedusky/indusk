import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent plan — init/update scaffolding.
 *
 * T11 — live (Phase 4). Asserts `indusk init` lands the multi-agent scaffolding
 * artifacts so that a freshly cloned teammate machine doesn't see leftover
 * presence files: .indusk/agents/ in gitignore, .indusk/current.md template,
 * agents.stale_ttl_minutes config default.
 *
 * The "fresh teammate clone" framing is realized as: init writes the gitignore
 * line → a presence file dropped under .indusk/agents/ does not appear in
 * `git status --porcelain` output.
 *
 * See `.indusk/planning/handoff-multi-agent/impl.md` for the full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

describe.skipIf(SHOULD_SKIP)(
	"multi-agent init scaffolding — handoff-multi-agent trajectory",
	{ timeout: 60000 },
	() => {
		let projectDir: string;

		beforeEach(() => {
			projectDir = mkdtempSync(join(tmpdir(), "ma-init-"));
			spawnSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
		});

		afterEach(() => {
			rmSync(projectDir, { recursive: true, force: true });
		});

		// T11 — Phase 4: init scaffolds .indusk/agents/ gitignore + current.md + config default
		it("T11: fresh teammate clone sees no leftover presence files", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			// .gitignore explicitly mentions .indusk/agents/
			const gi = readFileSync(join(projectDir, ".gitignore"), "utf-8");
			expect(gi).toMatch(/\.indusk\/agents\/?/);

			// Simulate the "developer A's machine" state — drop a presence file
			mkdirSync(join(projectDir, ".indusk/agents"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/agents/A-session-uuid.md"),
				"---\nsessionId: A-session-uuid\ntask: leftover\n---\n",
			);

			// `git status --porcelain` must NOT report the presence file as untracked —
			// the gitignore line is what makes a teammate's clone clean.
			const status = spawnSync("git", ["status", "--porcelain"], {
				cwd: projectDir,
				encoding: "utf-8",
			});
			expect(status.stdout).not.toMatch(/\.indusk\/agents/);
		});

		it("T11 supporting: init creates .indusk/current.md from template", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			const currentPath = join(projectDir, ".indusk/current.md");
			expect(existsSync(currentPath)).toBe(true);
			const content = readFileSync(currentPath, "utf-8");
			expect(content).toMatch(/Operational State/);
			expect(content).toMatch(/In Flight/);
			expect(content).toMatch(/Open Questions/);
			expect(content).toMatch(/Cursor/);
		});

		it("T11 supporting: init writes agents.stale_ttl_minutes default to config.json", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			const configRaw = readFileSync(join(projectDir, ".indusk/config.json"), "utf-8");
			const config = JSON.parse(configRaw);
			expect(config.agents?.stale_ttl_minutes).toBe(60);
		});

		it("T11 supporting: init does not overwrite an existing .indusk/current.md", () => {
			// Pre-seed a custom current.md as if the user already edited it
			mkdirSync(join(projectDir, ".indusk"), { recursive: true });
			writeFileSync(join(projectDir, ".indusk/current.md"), "USER CONTENT\n");

			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			const content = readFileSync(join(projectDir, ".indusk/current.md"), "utf-8");
			expect(content).toBe("USER CONTENT\n");
		});

		it("T11 supporting: update on a pre-1.29 project migrates the three new artifacts idempotently", () => {
			// Simulate a pre-1.29 project: init it, then strip the new artifacts
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			// Strip current.md + agents config + gitignore line to simulate pre-1.29
			rmSync(join(projectDir, ".indusk/current.md"), { force: true });
			const cfg = JSON.parse(readFileSync(join(projectDir, ".indusk/config.json"), "utf-8"));
			cfg.agents = undefined;
			writeFileSync(join(projectDir, ".indusk/config.json"), JSON.stringify(cfg, null, 2));
			const giPath = join(projectDir, ".gitignore");
			const giStripped = readFileSync(giPath, "utf-8").replace(/^.*\.indusk\/agents.*$\n?/gm, "");
			writeFileSync(giPath, giStripped);

			// Now run update — should migrate idempotently
			const updateRes = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(updateRes.status).toBe(0);

			expect(existsSync(join(projectDir, ".indusk/current.md"))).toBe(true);
			const updatedCfg = JSON.parse(readFileSync(join(projectDir, ".indusk/config.json"), "utf-8"));
			expect(updatedCfg.agents?.stale_ttl_minutes).toBe(60);
			const updatedGi = readFileSync(giPath, "utf-8");
			expect(updatedGi).toMatch(/\.indusk\/agents\/?/);

			// Running update a second time must be a no-op (idempotent)
			const updateRes2 = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(updateRes2.status).toBe(0);
			expect(updateRes2.stdout).toMatch(/already exists, preserving user state/);
			expect(updateRes2.stdout).toMatch(/agents\.stale_ttl_minutes: 60 \(already set\)/);
		});
	},
);
