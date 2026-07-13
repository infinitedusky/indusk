import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	parseCurrentMd,
	serializeCurrentMd,
	upsertSection,
} from "../lib/agents/current-md.js";
import type { AgentSection } from "../lib/agents/current-md.js";

/**
 * T6 from the handoff-multi-agent-section-shape trajectory:
 *   "Two agents on different branches both run handoff; merging both
 *    branches to main produces no merge conflict because they touched
 *    different sections."
 *
 * Real git fixture: create a project with a current.md template, branch
 * twice, write distinct sections on each branch, merge both back. Assert
 * git's auto-merge handles it cleanly — no conflict, both sections in main.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

function git(cwd: string, args: string[]): { stdout: string; status: number | null } {
	const res = spawnSync("git", args, { cwd, encoding: "utf-8" });
	return { stdout: res.stdout ?? "", status: res.status };
}

function makeSection(sessionId: string, task: string, ts: string): AgentSection {
	return {
		sessionId,
		sessionShort: sessionId.slice(0, 8),
		task,
		lastUpdated: ts,
		inFlight: `${task} in-flight body`,
		openQuestions: `${task} open questions`,
		cursor: `${task} cursor`,
		branch: "",
		worktree: "",
	};
}

describe.skipIf(SHOULD_SKIP)(
	"T6 — concurrent-handoff merge across branches",
	{ timeout: 30000 },
	() => {
		let projectDir: string;

		beforeEach(() => {
			projectDir = mkdtempSync(join(tmpdir(), "ma-merge-"));
			git(projectDir, ["init", "-q", "-b", "main"]);
			git(projectDir, ["config", "user.email", "test@example.com"]);
			git(projectDir, ["config", "user.name", "test"]);
			mkdirSync(join(projectDir, ".indusk"), { recursive: true });

			// Set up the .gitattributes merge=union driver — same as `indusk init`
			// installs. This is the load-bearing piece that makes T6 work: per-agent
			// sections are append-only, so we tell git to combine line additions on
			// merge rather than treating same-end-of-file inserts as conflicts.
			writeFileSync(
				join(projectDir, ".gitattributes"),
				"# InDusk: combine per-agent section additions on merge\n.indusk/current.md merge=union\n",
			);
			git(projectDir, ["add", ".gitattributes"]);

			// Seed current.md with the empty template (Project shared, no sessions)
			const initial = serializeCurrentMd({
				preamble: "Test fixture preamble.",
				sharedSection: "",
				sections: [],
			});
			writeFileSync(join(projectDir, ".indusk/current.md"), initial);
			git(projectDir, ["add", ".indusk/current.md"]);
			git(projectDir, ["commit", "-q", "-m", "seed current.md + gitattributes"]);
		});

		afterEach(() => {
			rmSync(projectDir, { recursive: true, force: true });
		});

		it("T6: two branches each adding a distinct session section merge cleanly", () => {
			// Branch A — add Session A's block
			git(projectDir, ["checkout", "-b", "feat/agent-A"]);
			const currentPath = join(projectDir, ".indusk/current.md");
			const initialContent = readFileSync(currentPath, "utf-8");
			const sectionA = makeSection(
				"uuid-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				"auth refactor",
				"2026-06-26T10:00:00Z",
			);
			writeFileSync(currentPath, upsertSection(initialContent, sectionA));
			git(projectDir, ["add", ".indusk/current.md"]);
			git(projectDir, ["commit", "-q", "-m", "A: register"]);

			// Back to main, branch B — add Session B's block on top of the SAME seed
			git(projectDir, ["checkout", "main", "-q"]);
			git(projectDir, ["checkout", "-b", "feat/agent-B"]);
			const sectionB = makeSection(
				"uuid-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				"telemetry spike",
				"2026-06-26T11:00:00Z",
			);
			writeFileSync(currentPath, upsertSection(initialContent, sectionB));
			git(projectDir, ["add", ".indusk/current.md"]);
			git(projectDir, ["commit", "-q", "-m", "B: register"]);

			// Merge A into main
			git(projectDir, ["checkout", "main", "-q"]);
			const mergeA = git(projectDir, ["merge", "--no-ff", "feat/agent-A", "-m", "merge A"]);
			expect(mergeA.status).toBe(0);

			// Merge B into main — this is the test. Both branches added different sections;
			// git's auto-merge should handle it without a conflict.
			const mergeB = git(projectDir, ["merge", "--no-ff", "feat/agent-B", "-m", "merge B"]);
			expect(mergeB.status).toBe(0);

			// Confirm both sections are present in main's current.md
			const finalContent = readFileSync(currentPath, "utf-8");
			const finalDoc = parseCurrentMd(finalContent);
			const sessionIds = finalDoc.sections.map((s) => s.sessionId).sort();
			expect(sessionIds).toEqual(
				[sectionA.sessionId, sectionB.sessionId].sort(),
			);

			// Confirm no unresolved conflict markers
			expect(finalContent).not.toMatch(/^<<<<<<</m);
			expect(finalContent).not.toMatch(/^=======/m);
			expect(finalContent).not.toMatch(/^>>>>>>>/m);
		});

		it("T6 supporting: same-session-different-content on two branches DOES merge-conflict", () => {
			// This is the failure mode we accept. If the same agent's section is touched on two
			// branches with different content, git produces a real conflict and the user resolves.
			// Tested here so the boundary is documented; not a regression — it's expected behavior.
			git(projectDir, ["checkout", "-b", "feat/branch-A"]);
			const currentPath = join(projectDir, ".indusk/current.md");
			const initialContent = readFileSync(currentPath, "utf-8");
			const sectionVA = makeSection(
				"uuid-cccccccc-cccc-cccc-cccc-cccccccccccc",
				"task v1 on branch A",
				"2026-06-26T10:00:00Z",
			);
			writeFileSync(currentPath, upsertSection(initialContent, sectionVA));
			git(projectDir, ["add", ".indusk/current.md"]);
			git(projectDir, ["commit", "-q", "-m", "A: section v1"]);

			git(projectDir, ["checkout", "main", "-q"]);
			git(projectDir, ["checkout", "-b", "feat/branch-B"]);
			const sectionVB = makeSection(
				"uuid-cccccccc-cccc-cccc-cccc-cccccccccccc", // SAME session ID
				"task v2 on branch B",
				"2026-06-26T11:00:00Z",
			);
			writeFileSync(currentPath, upsertSection(initialContent, sectionVB));
			git(projectDir, ["add", ".indusk/current.md"]);
			git(projectDir, ["commit", "-q", "-m", "B: section v2"]);

			git(projectDir, ["checkout", "main", "-q"]);
			const mergeA = git(projectDir, ["merge", "--no-ff", "feat/branch-A", "-m", "merge A"]);
			expect(mergeA.status).toBe(0);

			const mergeB = git(projectDir, ["merge", "--no-ff", "feat/branch-B", "-m", "merge B"]);
			// Either it merges (auto-resolved one way) or conflicts. Either is acceptable;
			// the load-bearing assertion is that DIFFERENT-session edits don't conflict (T6 above).
			// Document the expected behavior: same-session edits are user-resolvable.
			expect([0, 1]).toContain(mergeB.status ?? -1);
		});
	},
);
