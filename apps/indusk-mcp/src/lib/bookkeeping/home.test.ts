import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * promise: indusk-leaves-main-clean — bookkeeping-lives-where-it-is-read A3, A11, A20.
 * promise: a-highlight-becomes-a-lesson-once — A7, A13, A14, A18.
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

const HIGHLIGHTS = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"highlights",
	"highlights.ts",
);
const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** A separate clone named `name` under its own temporary folder, with `config` as its InDusk config. */
function otherClone(name: string, config?: object): { root: string; cleanup(): void } {
	const base = realpathSync(mkdtempSync(join(tmpdir(), "bookkeeping-clone-")));
	const root = join(base, name);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
	if (config) writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify(config));
	return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

describe("one shared home, read by many at once", () => {
	it("A13: an evaluator holding a highlight keeps it from a second evaluator until it is marked or the hold lapses", () => {
		const h = writeHighlight(f.main, { tag: "t", note: "held", level: "important" });
		const now = new Date("2026-10-08T10:00:00Z");
		const ids = (root: string, holder: string, at: Date) =>
			readUnprocessedHighlights(root, { holder, now: at }).map((x) => x.id);
		expect(ids(f.worktree, "eval-a", now)).toContain(h.id);
		expect(ids(f.main, "eval-b", now)).not.toContain(h.id);
		expect(ids(f.main, "eval-a", now)).toContain(h.id);
		const later = new Date(now.getTime() + 31 * 60_000);
		expect(ids(f.main, "eval-b", later)).toContain(h.id);
		markProcessed(f.main, h.id, "skipped");
		expect(ids(f.main, "eval-c", later)).not.toContain(h.id);
	});

	it("A14: highlights written at the same moment from both checkouts all get distinct ids", async () => {
		const writer = (root: string) =>
			new Promise<void>((resolve, reject) => {
				const script = `import(${JSON.stringify(HIGHLIGHTS)}).then((m) => { for (let i = 0; i < 25; i++) m.writeHighlight(${JSON.stringify(root)}, { tag: "t", note: String(i), level: "note" }); })`;
				const child = spawn(process.execPath, ["--import", "tsx", "-e", script], {
					cwd: PACKAGE,
					env: { ...process.env, INDUSK_HOME: f.home },
					stdio: ["ignore", "ignore", "pipe"],
				});
				let err = "";
				child.stderr.on("data", (d) => {
					err += d;
				});
				child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err))));
			});
		await Promise.all([writer(f.main), writer(f.worktree), writer(f.main), writer(f.worktree)]);
		const all = readUnprocessedHighlights(f.main);
		expect(new Set(all.map((h) => h.id)).size).toBe(100);
	}, 30_000);

	it("A18: two clones of one project, by folder name or by groupId, have different homes", () => {
		const sameName = otherClone("proj");
		const a = otherClone("one", { graphiti: { groupId: "shared" } });
		const b = otherClone("two", { graphiti: { groupId: "shared" } });
		try {
			expect(bookkeepingRoots(sameName.root).home).not.toBe(bookkeepingRoots(f.main).home);
			expect(bookkeepingRoots(a.root).home).not.toBe(bookkeepingRoots(b.root).home);
			const h = writeHighlight(f.main, { tag: "t", note: "only proj's", level: "note" });
			expect(readUnprocessedHighlights(sameName.root).map((x) => x.id)).not.toContain(h.id);
		} finally {
			for (const c of [sameName, a, b]) c.cleanup();
		}
	});
});

describe("a home given, not taken from the environment", () => {
	it("A20: resolves a project's home under a given InDusk home without changing the environment, the same as through it", () => {
		const other = join(f.home, "elsewhere");
		const before = process.env.INDUSK_HOME;
		const given = bookkeepingRoots(f.worktree, other);
		expect(process.env.INDUSK_HOME).toBe(before);
		expect(given.home.startsWith(join(other, "projects"))).toBe(true);
		expect(evalDir(f.worktree, other)).toBe(join(given.home, "eval"));
		process.env.INDUSK_HOME = other;
		try {
			expect(bookkeepingRoots(f.worktree)).toEqual(given);
		} finally {
			process.env.INDUSK_HOME = before;
		}
	});
});
