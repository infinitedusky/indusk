import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	blogConfig,
	commitCount,
	destinationRepo,
	headSubject,
	paper,
	paperProject,
	publishArgs,
} from "./helpers/papers-fixture.js";

/**
 * `indusk papers publish` — every way it refuses (writing-skill A10, A11,
 * A12), and the one divergence it overwrites.
 *
 * The posture is the codebase's: refuse rather than write when a precondition
 * does not hold, and say why. Each refusal asserts on its message AND on the
 * destination being byte-untouched, because a refusal that half-applied is
 * worse than none. Red today on `unknown command 'papers'`.
 */

function snapshot(dir: string): string {
	return git(dir, ["status", "--porcelain"]).stdout + git(dir, ["rev-parse", "HEAD"]).stdout;
}

describe.skipIf(SHOULD_SKIP)("indusk papers publish refusals", () => {
	it("A10: with no destination configured it refuses naming papers.destinations and writes nothing", () => {
		const p = paperProject({ docs: { "paper-1.md": paper() } });
		const before = readFileSync(join(p.planDir, "paper-1.md"), "utf-8");

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/papers\.destinations/);
		expect(readFileSync(join(p.planDir, "paper-1.md"), "utf-8")).toBe(before);
		expect(git(p.root, ["status", "--porcelain"]).stdout.trim()).toBe("");
	});

	it("A11a: a destination path that does not exist refuses naming the path", () => {
		const missing = join(mkdtempSync(join(tmpdir(), "papers-missing-")), "nowhere");
		const p = paperProject({
			docs: { "paper-1.md": paper() },
			config: {
				papers: {
					destinations: [
						{ name: "blog", path: missing, dir: "writing", index: "writing/index.md" },
					],
				},
			},
		});

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).toContain(missing);
		expect(existsSync(missing)).toBe(false);
	});

	it("A11b: a destination that is not a git repository refuses and writes nothing", () => {
		const dest = destinationRepo({ git: false });
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/not a git repo/i);
		expect(existsSync(join(dest.root, dest.dir, "the-grift.md"))).toBe(false);
	});

	it("A11c: a dirty target page refuses and leaves the hand edit in place", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);

		const page = join(dest.root, dest.dir, "the-grift.md");
		writeFileSync(page, `${readFileSync(page, "utf-8")}\nHand edit.\n`);
		const paperPath = join(p.planDir, "paper-1.md");
		writeFileSync(paperPath, `${readFileSync(paperPath, "utf-8")}\nRevised in the plan.\n`);
		git(p.root, ["commit", "-q", "-am", "revise"]);
		const before = snapshot(dest.root);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/uncommitted/i);
		expect(r.stderr).toContain("the-grift.md");
		expect(snapshot(dest.root)).toBe(before);
		expect(readFileSync(page, "utf-8")).toContain("Hand edit.");
	}, 30_000);

	it("A11d: a committed hand edit is overwritten, and the destination commit says the page had diverged", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);

		const page = join(dest.root, dest.dir, "the-grift.md");
		writeFileSync(page, `${readFileSync(page, "utf-8")}\nHand edit.\n`);
		git(dest.root, ["commit", "-q", "-am", "hand edit"]);
		const paperPath = join(p.planDir, "paper-1.md");
		writeFileSync(paperPath, `${readFileSync(paperPath, "utf-8")}\nRevised in the plan.\n`);
		git(p.root, ["commit", "-q", "-am", "revise"]);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code, r.stderr).toBe(0);
		const body = readFileSync(page, "utf-8");
		expect(body).toContain("Revised in the plan.");
		expect(body).not.toContain("Hand edit.");
		expect(git(dest.root, ["log", "-1", "--format=%B"]).stdout).toMatch(/diverged/i);
	}, 30_000);

	it("A12a: inside a workbench a destination named by declared repo resolves through the declaration", () => {
		const p = paperProject({
			docs: { "paper-1.md": paper() },
			config: {
				worktree: { shape: "workbench", repos_root: ".", repos: [{ name: "site" }] },
				papers: {
					destinations: [{ name: "blog", repo: "site", dir: "writing", index: "writing/index.md" }],
				},
			},
		});
		// The declared repo lives at <workbench>/site under repos_root ".".
		const siteRoot = join(p.root, "site");
		mkdirSync(siteRoot);
		destinationRepo({ at: siteRoot });

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code, r.stderr).toBe(0);
		expect(existsSync(join(siteRoot, "writing/the-grift.md"))).toBe(true);
		expect(headSubject(siteRoot)).toMatch(/^publish: The Grift/);
	}, 30_000);

	it("A12b: outside a workbench a destination named by repo refuses, saying only paths are accepted", () => {
		const p = paperProject({
			docs: { "paper-1.md": paper() },
			config: {
				papers: {
					destinations: [{ name: "blog", repo: "site", dir: "writing", index: "writing/index.md" }],
				},
			},
		});
		const before = commitCount(p.root);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/only paths/i);
		expect(commitCount(p.root)).toBe(before);
	});
});
