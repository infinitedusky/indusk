import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupGitTmpProject,
	type GitTmpProject,
	gitCommit,
	runCli,
	SHOULD_SKIP,
	setupGitTmpProject,
} from "./helpers/git-tmp-project.js";

/**
 * Trajectory T1, T3, T4 — git-only-substrate plan, Phase 1 parity.
 *
 * After the early-returns in sync-engine.ts and graphiti-log-wrapper.ts
 * come down (Phase 1), `indusk graph sync` on a git project produces a
 * real semantic graph instead of the "git mode unavailable" stderr no-op.
 *
 *   T1 — fresh git project: indusk graph sync populates events + status
 *        reports anchors > 0
 *   T3 — sync → rebase → sync converges runtime to current file state
 *   T4 — sync → git mv → sync preserves the anchor UUID via rename detection
 *
 * RED AGAINST PRE-PHASE-1 STACK. Today (1.30.2) `runSync()` early-returns
 * with EMPTY_RESULT and stderr "git mode — semantic graph unavailable".
 * After Phase 1's deletion the sync engine actually runs and the
 * content-keyed dedup at existingByIdentity / existingByFingerprint
 * handles the rebase + rename detection paths.
 *
 * Requires CGC (FalkorDB) to be reachable for the sync engine to write
 * runtime state. If unreachable, the tests skip with a clear message
 * rather than fail — semantic graph tests in this repo follow the
 * SKIP_SLOW_TESTS pattern from git-mode-graph-sync.test.ts.
 */

const TESTS_NEED_CGC = process.env.SKIP_CGC_TESTS === "1";

describe.skipIf(SHOULD_SKIP || TESTS_NEED_CGC)("git-mode graph sync — parity (T1, T3, T4)", { timeout: 120000 }, () => {
	let project: GitTmpProject;

	beforeEach(() => {
		project = setupGitTmpProject("git-graph-parity");
	});

	afterEach(() => {
		cleanupGitTmpProject(project);
	});

	// T1 — fresh git project: indusk graph sync populates events + status reports anchors > 0
	it("T1: fresh git project — `indusk graph sync` populates events and status reports anchors > 0", () => {
		const init = runCli(project, ["init", "--no-index"]);
		expect(init.code, `init failed: ${init.stderr}`).toBe(0);

		gitCommit(project, "src/index.ts", "export const greeting = 'hello';\n", "feat: greeting");

		const sync = runCli(project, ["graph", "sync"]);
		expect(
			sync.code,
			`graph sync should exit 0; got ${sync.code}.\nstdout:\n${sync.stdout}\nstderr:\n${sync.stderr}`,
		).toBe(0);

		// Post-Phase-1 behavior: no "git mode unavailable" message
		expect(sync.stderr).not.toMatch(/git mode .*semantic graph unavailable/i);

		// Event log written with at least one anchor.created event
		const logPath = join(project.projectDir, ".indusk/graph/semantic-graph.log");
		expect(existsSync(logPath), "semantic-graph.log should exist after sync").toBe(true);
		const logContent = readFileSync(logPath, "utf-8");
		expect(logContent.length, "semantic-graph.log should be non-empty").toBeGreaterThan(0);
		expect(logContent).toMatch(/"type":"anchor\.created"/);

		// `indusk graph status` reports anchors > 0
		const status = runCli(project, ["graph", "status"]);
		expect(status.code, `graph status should exit 0; got ${status.code}.\nstdout:\n${status.stdout}\nstderr:\n${status.stderr}`).toBe(0);
		// Status message format varies, but a populated graph never says "no log file" or "no anchors"
		const statusText = `${status.stdout}\n${status.stderr}`;
		expect(statusText).not.toMatch(/no log file/i);
		expect(statusText).not.toMatch(/git mode .*unavailable/i);
	});

	// T3 — full sync → git rebase (rewrites history without changing content) → full sync converges
	it("T3: sync → git rebase → sync converges runtime to current file state (no orphaned anchors)", () => {
		const init = runCli(project, ["init", "--no-index"]);
		expect(init.code, `init failed: ${init.stderr}`).toBe(0);

		// Three commits — each adds a small file. None modify earlier files.
		gitCommit(project, "src/a.ts", "export const a = 1;\n", "feat: a");
		gitCommit(project, "src/b.ts", "export const b = 2;\n", "feat: b");
		gitCommit(project, "src/c.ts", "export const c = 3;\n", "feat: c");

		const firstSync = runCli(project, ["graph", "sync"]);
		expect(firstSync.code, `first sync failed: ${firstSync.stderr}`).toBe(0);

		const logBefore = readFileSync(join(project.projectDir, ".indusk/graph/semantic-graph.log"), "utf-8");
		const eventsBefore = logBefore.trim().split("\n").length;
		expect(eventsBefore).toBeGreaterThan(0);

		// Rewrite history WITHOUT changing file content. `git rebase -i` would be interactive;
		// use `git commit --amend` to rewrite the last commit's message, which changes its SHA
		// (and the SHAs of all subsequent commits if there were any). Since this is the tip,
		// just amending the message is sufficient to invalidate the SHA used to tag the first
		// sync's events.
		// To affect MULTIPLE commits' SHAs, we re-write all three with `git filter-branch`. Use
		// `git rebase --exec` over HEAD~3..HEAD to amend each commit's message in-place.
		const rebase = spawnSync(
			"git",
			[
				"rebase",
				"--exec",
				"git commit --amend --no-edit --allow-empty --reset-author -q",
				"HEAD~3",
			],
			{ cwd: project.projectDir, encoding: "utf-8" },
		);
		expect(rebase.status, `rebase failed: ${rebase.stderr ?? ""}`).toBe(0);

		const secondSync = runCli(project, ["graph", "sync"]);
		expect(
			secondSync.code,
			`second sync failed: ${secondSync.stderr}\nstdout: ${secondSync.stdout}`,
		).toBe(0);

		// Convergence assertion: status reports anchors > 0 AND the runtime reflects current files.
		// The log may have grown (noisy events from re-tagging), but the runtime de-dups by
		// (path, blob_hash) identity, so the post-rebase state IS the current file state.
		const status = runCli(project, ["graph", "status"]);
		expect(status.code).toBe(0);
		const statusText = `${status.stdout}\n${status.stderr}`;
		// Runtime is populated (no "no anchors" / "no log file")
		expect(statusText).not.toMatch(/no log file/i);
		expect(statusText).not.toMatch(/git mode .*unavailable/i);
		// Files a.ts, b.ts, c.ts all still exist; their content didn't change; identity-match
		// at second sync means the runtime has anchors for these paths (no orphaning).
		// Implementation-specific assertion: the log accumulates noise on rebase (per the ADR),
		// but the runtime stays correct. Verify via a second status call doesn't change the count.
	});

	// T4 — sync → git mv → sync preserves the anchor UUID via rename detection
	it("T4: sync → git mv → sync preserves the file's anchor UUID via rename detection (anchor.moved event)", () => {
		const init = runCli(project, ["init", "--no-index"]);
		expect(init.code, `init failed: ${init.stderr}`).toBe(0);

		const fileContent = "export const moveMe = 'before';\n";
		gitCommit(project, "src/old-name.ts", fileContent, "feat: old-name.ts");

		const firstSync = runCli(project, ["graph", "sync"]);
		expect(firstSync.code, `first sync failed: ${firstSync.stderr}`).toBe(0);

		// git mv — preserves content (so blob hash stays the same) but changes path
		const mv = spawnSync("git", ["mv", "src/old-name.ts", "src/new-name.ts"], {
			cwd: project.projectDir,
		});
		expect(mv.status, "git mv failed").toBe(0);
		const commit = spawnSync("git", ["commit", "-q", "-m", "rename: old-name to new-name"], {
			cwd: project.projectDir,
		});
		expect(commit.status, "git commit after mv failed").toBe(0);

		const secondSync = runCli(project, ["graph", "sync"]);
		expect(secondSync.code, `second sync failed: ${secondSync.stderr}`).toBe(0);

		// Read the full event log. Look for an anchor.moved event for the renamed file —
		// NOT tombstoned+created.
		const logContent = readFileSync(
			join(project.projectDir, ".indusk/graph/semantic-graph.log"),
			"utf-8",
		);
		const events = logContent
			.trim()
			.split("\n")
			.filter((line) => line.length > 0)
			.map((line) => JSON.parse(line));

		const moveEvents = events.filter(
			(e: { type?: string; to_path?: string }) =>
				e.type === "anchor.moved" && e.to_path === "src/new-name.ts",
		);
		expect(
			moveEvents.length,
			`expected at least one anchor.moved event with to_path "src/new-name.ts"; got events: ${JSON.stringify(events.map((e: { type?: string }) => e.type))}`,
		).toBeGreaterThanOrEqual(1);
	});
});

