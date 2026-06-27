import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent-section-shape plan — init/update.
 *
 * Live tests:
 *   T9 — fresh init creates current.md with the section-shape template
 *     (## Project (shared) anchor + no session sections + section delimiter)
 *   T10 — update on a project carrying the OLD parent-plan template migrates
 *     to the new template (SHA-detected); user-edited content is preserved
 *   T13 — gitignore line still keeps presence files (legacy) out of a
 *     teammate's clone, in case any interim version writes there
 *
 * The pre-1.29 OLD template SHA-256 lives in update.ts as a constant.
 * Updating the template content changes the SHA — any user edit (even
 * whitespace) makes the migration leave the file alone.
 *
 * See `.indusk/planning/handoff-multi-agent-section-shape/impl.md` for the
 * full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

// The OLD parent-plan template content (SHA-256: e31a23d1...). Kept here as a
// fixture so the T10 migration test can simulate a pre-section-shape install.
const OLD_PARENT_PLAN_TEMPLATE = `# Operational State

This is the **operational layer** of project memory — what is happening on this project *right now*. The architectural layer ("what this project is") lives in [\`CLAUDE.md\`](../CLAUDE.md). The historical layer ("how we got here") lives in \`.indusk/planning/\` plans + the docs site.

Working agents edit this file in place as state solidifies during a session. \`/catchup\` reads it (pure-read, never writes). \`/retrospective\` distills sections of it into CLAUDE.md's Key Decisions or Current State on the natural cadence.

If a section is empty, that's fine — it means there's nothing currently in that state.

## In Flight

_What's actively being worked on right now. Plan names + phase + current focus. Examples: "handoff-multi-agent Phase 4 — wiring init/update", "investigating slow Graphiti queries (no plan yet)"._

(nothing yet)

## Open Questions

_Hypotheses that haven't been confirmed; design decisions that are mid-conversation; things you want the next agent to think about before continuing._

(nothing yet)

## Cursor

_Where you stopped, in enough detail that the next agent (or future-you) doesn't have to rediscover. File paths + line numbers + the next concrete step._

(nothing yet)
`;

describe.skipIf(SHOULD_SKIP)(
	"multi-agent init scaffolding — section-shape trajectory",
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

		// T9 — fresh init creates the section-shape template
		it("T9: fresh init creates current.md with Project (shared) anchor + section delimiter", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			const currentPath = join(projectDir, ".indusk/current.md");
			expect(existsSync(currentPath)).toBe(true);
			const content = readFileSync(currentPath, "utf-8");

			// Section-shape markers
			expect(content).toMatch(/^# Operational State$/m);
			expect(content).toMatch(/^## Project \(shared\)$/m);

			// Old top-level section headings are NOT present (they're now subsections inside sessions)
			expect(content).not.toMatch(/^## In Flight$/m);
			expect(content).not.toMatch(/^## Open Questions$/m);
			expect(content).not.toMatch(/^## Cursor$/m);

			// Section delimiter present
			expect(content).toMatch(/^---$/m);
		});

		it("T13: fresh teammate clone sees no leftover presence files (gitignore precaution)", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			const gi = readFileSync(join(projectDir, ".gitignore"), "utf-8");
			expect(gi).toMatch(/\.indusk\/agents\/?/);

			// Drop a phantom presence file (in case any interim version writes there)
			mkdirSync(join(projectDir, ".indusk/agents"), { recursive: true });
			writeFileSync(
				join(projectDir, ".indusk/agents/A-session-uuid.md"),
				"---\nsessionId: A-session-uuid\ntask: leftover\n---\n",
			);

			const status = spawnSync("git", ["status", "--porcelain"], {
				cwd: projectDir,
				encoding: "utf-8",
			});
			expect(status.stdout).not.toMatch(/\.indusk\/agents/);
		});

		it("init writes agents.stale_ttl_minutes default to config.json", () => {
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

		it("init does not overwrite an existing .indusk/current.md", () => {
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

		// T10 — SHA-detected migration: byte-equal old template → migrate; otherwise preserve
		it("T10: update migrates byte-equal old-parent-plan template to the new section shape", () => {
			// First init the project so all the scaffolding lands
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			// Overwrite current.md with the EXACT OLD parent-plan template content
			// (simulating a pre-section-shape install)
			writeFileSync(join(projectDir, ".indusk/current.md"), OLD_PARENT_PLAN_TEMPLATE);

			// Run update — should detect the byte-equal old template and migrate
			const updateRes = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(updateRes.status).toBe(0);
			expect(updateRes.stdout).toMatch(/migrate: \.indusk\/current\.md/);

			// Confirm new shape landed
			const content = readFileSync(join(projectDir, ".indusk/current.md"), "utf-8");
			expect(content).toMatch(/^## Project \(shared\)$/m);
			expect(content).not.toMatch(/^## In Flight$/m);
		});

		it("T10 supporting: update preserves user-edited current.md (any byte differs from old template)", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			// Write the OLD template PLUS a single user edit (one extra newline at end)
			const userEdited = `${OLD_PARENT_PLAN_TEMPLATE}\n## User Section\n\nuser-added content\n`;
			writeFileSync(join(projectDir, ".indusk/current.md"), userEdited);

			const updateRes = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(updateRes.status).toBe(0);
			expect(updateRes.stdout).toMatch(/user content preserved/);

			// User content unchanged
			const content = readFileSync(join(projectDir, ".indusk/current.md"), "utf-8");
			expect(content).toBe(userEdited);
		});

		it("T10 supporting: update is idempotent — running twice produces no extra writes", () => {
			const initRes = spawnSync("node", [CLI_BIN, "init", "--force"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(initRes.status).toBe(0);

			const updateRes1 = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(updateRes1.status).toBe(0);

			const contentAfter1 = readFileSync(join(projectDir, ".indusk/current.md"), "utf-8");

			const updateRes2 = spawnSync("node", [CLI_BIN, "update"], {
				cwd: projectDir,
				encoding: "utf-8",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
			expect(updateRes2.status).toBe(0);
			expect(updateRes2.stdout).toMatch(/user content preserved|already set/);

			const contentAfter2 = readFileSync(join(projectDir, ".indusk/current.md"), "utf-8");
			expect(contentAfter2).toBe(contentAfter1);
		});
	},
);
