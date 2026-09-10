import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { parsePlan } from "../lib/plan-parser.js";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	blogConfig,
	commitCount,
	destinationRepo,
	headSubject,
	INDEX_MARKERS,
	paper,
	paperProject,
	publishArgs,
} from "./helpers/papers-fixture.js";

/**
 * `indusk papers publish` — the happy path and its bookkeeping (writing-skill
 * A7, A8, A9, A21).
 *
 * Every test reaches the publish step over the CLI boundary against a real
 * destination repo, so today each is red on `unknown command 'papers'` rather
 * than on a missing import. A9's staleness read goes through `parsePlan`,
 * whose `papers` field does not exist yet; the optional chain makes that an
 * assertion failure, not a load error.
 */

describe.skipIf(SHOULD_SKIP)("indusk papers publish", () => {
	it("A7: publishes the rendered page, regenerates the index between markers, and commits in the destination without pushing", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		const destCommitsBefore = commitCount(dest.root);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code, r.stderr).toBe(0);

		const page = join(dest.root, dest.dir, "the-grift.md");
		expect(existsSync(page), "expected the page at the title slug").toBe(true);
		const rendered = matter(readFileSync(page, "utf-8"));
		expect(rendered.data.title).toBe("The Grift");
		expect(rendered.data.description).toBe("A critique.");
		// Plan-only keys never travel.
		expect(rendered.data.kind).toBeUndefined();
		expect(rendered.data.status).toBeUndefined();
		expect(rendered.data.published).toBeUndefined();
		expect(rendered.content).toContain("There is real skill here.");

		const index = readFileSync(join(dest.root, dest.index), "utf-8");
		const between = index.split(INDEX_MARKERS[0])[1]?.split(INDEX_MARKERS[1])[0] ?? "";
		expect(between).toMatch(/the-grift/);
		expect(index.startsWith("# Writing")).toBe(true);

		expect(commitCount(dest.root)).toBe(destCommitsBefore + 1);
		expect(headSubject(dest.root)).toMatch(/^publish: The Grift \(source [0-9a-f]{7,}\)$/);
		expect(git(dest.root, ["status", "--porcelain"]).stdout.trim()).toBe("");
		// No remote was ever configured, and nothing tried to add one.
		expect(git(dest.root, ["remote"]).stdout.trim()).toBe("");
	}, 30_000);

	it("A8: writes provenance into the paper's frontmatter and commits it in the source repo", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		const sourceCommit = git(p.root, ["rev-parse", "HEAD"]).stdout.trim();
		const sourceCommitsBefore = commitCount(p.root);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code, r.stderr).toBe(0);

		const data = matter(readFileSync(join(p.planDir, "paper-1.md"), "utf-8")).data;
		expect(data.status).toBe("published");
		expect(data.published).toEqual({
			destination: "blog",
			path: `${dest.dir}/the-grift.md`,
			commit: git(dest.root, ["rev-parse", "--short", "HEAD"]).stdout.trim(),
			source_commit: sourceCommit.slice(0, 8),
			hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
		});

		expect(commitCount(p.root)).toBe(sourceCommitsBefore + 1);
		expect(headSubject(p.root)).toMatch(
			/^chore\(papers\): publish paper-1\.md to blog \([0-9a-f]{7,}\)$/,
		);
		expect(git(p.root, ["status", "--porcelain"]).stdout.trim()).toBe("");
	}, 30_000);

	it("A9: an edit after publishing reads stale, republishing clears it, and an unchanged republish is a no-op", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		const paperPath = join(p.planDir, "paper-1.md");

		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);
		expect(parsePlan(p.planDir).papers?.[0]?.stale).toBe(false);

		writeFileSync(paperPath, `${readFileSync(paperPath, "utf-8")}\nA new paragraph.\n`);
		git(p.root, ["commit", "-q", "-am", "revise"]);
		expect(parsePlan(p.planDir).papers?.[0]?.stale).toBe(true);

		const destBefore = commitCount(dest.root);
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);
		expect(parsePlan(p.planDir).papers?.[0]?.stale).toBe(false);
		expect(commitCount(dest.root)).toBe(destBefore + 1);

		const destAfter = commitCount(dest.root);
		const sourceAfter = commitCount(p.root);
		const again = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(again.code, again.stderr).toBe(0);
		expect(again.stdout).toMatch(/up to date|no changes/i);
		expect(commitCount(dest.root)).toBe(destAfter);
		expect(commitCount(p.root)).toBe(sourceAfter);
	}, 30_000);

	it("A21: refuses while the plan copy is uncommitted, and the destination commit names the source commit", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		const paperPath = join(p.planDir, "paper-1.md");
		writeFileSync(paperPath, `${readFileSync(paperPath, "utf-8")}\nUncommitted.\n`);
		const destBefore = commitCount(dest.root);

		const refused = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(refused.code).not.toBe(0);
		expect(refused.stderr).toMatch(/uncommitted/i);
		expect(commitCount(dest.root)).toBe(destBefore);
		expect(existsSync(join(dest.root, dest.dir, "the-grift.md"))).toBe(false);

		git(p.root, ["commit", "-q", "-am", "revise"]);
		const sourceShort = git(p.root, ["rev-parse", "--short=8", "HEAD"]).stdout.trim();
		const ok = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(ok.code, ok.stderr).toBe(0);
		expect(headSubject(dest.root)).toContain(`source ${sourceShort}`);
	}, 30_000);
});
