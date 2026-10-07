import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	markProcessed,
	readUnprocessedHighlights,
	writeHighlight,
} from "../highlights/highlights.js";
import { type Fixture, makeFixture } from "./fixture.test-support.js";
import { bookkeepingRoots, evalDir } from "./roots.js";

/**
 * promise: indusk-leaves-main-clean — bookkeeping-lives-where-it-is-read A3, A11.
 * promise: a-highlight-becomes-a-lesson-once — A7.
 * promise: every-commit-evaluated — A10.
 *
 * InDusk's machine state lives in one home per project, outside every
 * checkout: the same from the main checkout and from any plan worktree, so a
 * highlight processed in one is processed in all, and no checkout is dirtied.
 */

let f: Fixture;
beforeEach(() => {
	f = makeFixture();
});
afterEach(() => f.cleanup());

const HOOK_PATHS = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"hooks",
	"_hook-paths.js",
);

describe("one home per project", () => {
	it("A3: highlights and their marks from a worktree land in the project's home; no checkout is dirtied", () => {
		const roots = bookkeepingRoots(f.worktree);
		expect(roots.home.startsWith(join(f.home, "projects"))).toBe(true);
		expect(bookkeepingRoots(f.main)).toEqual(roots);
		const h = writeHighlight(f.worktree, { tag: "t", note: "from a worktree", level: "note" });
		markProcessed(f.worktree, h.id, "skipped");
		expect(existsSync(join(roots.home, "highlights.jsonl"))).toBe(true);
		expect(existsSync(join(roots.home, "highlights-processed.jsonl"))).toBe(true);
		expect(f.git(f.main, "status", "--porcelain")).toBe("");
		expect(f.git(f.worktree, "status", "--porcelain")).toBe("");
	});

	it("A7: a highlight processed for a worktree's commit is not offered again in the main checkout", () => {
		const h = writeHighlight(f.main, { tag: "t", note: "once", level: "note" });
		markProcessed(f.worktree, h.id, "skipped");
		expect(readUnprocessedHighlights(f.main).map((x) => x.id)).not.toContain(h.id);
		expect(readUnprocessedHighlights(f.worktree).map((x) => x.id)).not.toContain(h.id);
	});

	it("A10: evaluation results are read and written in the same place from every checkout", () => {
		expect(evalDir(f.worktree)).toBe(evalDir(f.main));
		expect(evalDir(f.main).startsWith(bookkeepingRoots(f.main).home)).toBe(true);
	});

	it("A11: a hook resolves the same main checkout and home as the package, from either checkout", () => {
		for (const cwd of [f.main, f.worktree]) {
			const out = execFileSync(
				"node",
				[
					"--input-type=module",
					"-e",
					`import(${JSON.stringify(HOOK_PATHS)}).then((m) => console.log(JSON.stringify({ trunk: m.mainCheckout(process.cwd()), home: m.projectHome(process.cwd()) })))`,
				],
				{ cwd, encoding: "utf-8", env: { ...process.env, INDUSK_HOME: f.home } },
			);
			expect(JSON.parse(out)).toEqual(bookkeepingRoots(cwd));
		}
		expect(bookkeepingRoots(f.worktree).trunk).toBe(f.main);
	});
});
