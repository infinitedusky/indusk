import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { git } from "../src/__tests__/helpers/test-git.js";
import { runPersistentEval } from "../src/lib/eval/persistent-evaluator.js";
import { readUnprocessedHighlights, writeHighlight } from "../src/lib/highlights/highlights.js";

/**
 * bookkeeping-lives-where-it-is-read — A8: a real evaluator, run on a commit in
 * a plan's worktree, writes its lesson on `main` and marks the highlight
 * processed in the project's home.
 *
 * The everyday tests prove each writer resolves the main checkout and the
 * home. This asks the thing they cannot: that the evaluator, launched with its
 * named permissions (`lib/eval/permissions.ts`, no longer `bypassPermissions`),
 * still reaches InDusk's MCP tools and uses them — the April-2026 failure was
 * an evaluator whose highlight step fired into a void, and nothing errored.
 *
 * Needs the `claude` CLI on PATH and a built package (`pnpm build`); run with
 * `pnpm e2e`. It costs one evaluator run.
 *
 * promise: a-highlight-becomes-a-lesson-once
 */

const CLI = resolve(__dirname, "../dist/bin/cli.js");

function claudeOnPath(): boolean {
	return spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;
}

const root = realpathSync(mkdtempSync(join(tmpdir(), "eval-bookkeeping-e2e-")));
const home = join(root, "home");
const trunk = join(root, "proj");
const worktree = join(root, "proj-worktrees", "a-plan");
const previousHome = process.env.INDUSK_HOME;

afterAll(() => {
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	rmSync(root, { recursive: true, force: true });
});

function fixture(): { changeId: string; highlightId: string } {
	// The evaluator, its MCP server and the hooks all inherit this home.
	process.env.INDUSK_HOME = home;
	mkdirSync(trunk, { recursive: true });
	git(trunk, ["init", "-q", "-b", "main"]);
	mkdirSync(join(trunk, ".indusk"), { recursive: true });
	writeFileSync(
		join(trunk, ".indusk", "config.json"),
		`${JSON.stringify({ eval: { enabled: true } })}\n`,
	);
	writeFileSync(join(trunk, ".gitignore"), ".indusk/current.md.lock\n");
	writeFileSync(
		join(trunk, ".mcp.json"),
		`${JSON.stringify({
			mcpServers: {
				indusk: {
					type: "stdio",
					command: "node",
					args: [CLI, "serve"],
					env: { PROJECT_ROOT: "." },
				},
			},
		})}\n`,
	);
	writeFileSync(join(trunk, "CLAUDE.md"), "# proj\n\nA tiny fixture project.\n");
	writeFileSync(join(trunk, "price.js"), "export const price = (cents) => cents / 100;\n");
	git(trunk, ["add", "-A"]);
	git(trunk, ["commit", "-q", "-m", "init"]);
	git(trunk, ["worktree", "add", "-q", "-b", "plan/a-plan", worktree]);

	writeFileSync(
		join(worktree, "price.js"),
		"// Money is integer cents everywhere; format only at the edge.\nexport const price = (cents) => (cents / 100).toFixed(2);\n",
	);
	git(worktree, ["commit", "-q", "-am", "format prices with two decimals"]);
	const changeId = git(worktree, ["rev-parse", "--short", "HEAD"]);

	// Queued from the worktree, as a working session in it would.
	const highlight = writeHighlight(worktree, {
		level: "important",
		tag: "correction",
		note: "proj: the user corrected the agent — money is stored as integer cents everywhere and formatted only at the display edge; never store or compute with float dollars. This is a durable rule for every future session: write a lesson for it.",
	});
	return { changeId, highlightId: highlight.id };
}

describe.skipIf(!claudeOnPath())(
	"A8 — the real evaluator keeps InDusk's records where they are read",
	() => {
		it("a worktree commit's evaluation writes its lesson on main and marks the highlight processed in the home", async () => {
			const { changeId, highlightId } = fixture();
			const transcript = join(root, "transcript.jsonl");
			writeFileSync(transcript, "");

			const result = await runPersistentEval({
				projectRoot: worktree,
				gitRoot: worktree,
				changeId,
				transcriptPath: transcript,
				mode: "eval",
			});
			expect("error" in result ? result : null, "the evaluator run failed").toBeNull();

			// The highlight is processed in the one home, read the same from either checkout.
			expect(readUnprocessedHighlights(trunk).map((h) => h.id)).not.toContain(highlightId);
			expect(readUnprocessedHighlights(worktree).map((h) => h.id)).not.toContain(highlightId);
			expect(existsSync(join(worktree, ".indusk", "highlights.jsonl"))).toBe(false);

			// Its lesson is on main, committed, and not in the worktree.
			const lessons = readdirSync(join(trunk, ".claude", "lessons"));
			expect(lessons.length, "no lesson written in the main checkout").toBeGreaterThan(0);
			expect(git(trunk, ["log", "--format=%s", "main"])).toMatch(/^chore\(indusk\): lesson — /m);
			expect(existsSync(join(worktree, ".claude", "lessons"))).toBe(false);

			// Neither checkout is left dirty, and the evaluator changed nothing in the worktree.
			expect(git(trunk, ["status", "--porcelain"])).toBe("");
			expect(git(worktree, ["status", "--porcelain"])).toBe("");
			expect(git(worktree, ["rev-parse", "--short", "HEAD"])).toBe(changeId);
		}, 600_000);
	},
);
