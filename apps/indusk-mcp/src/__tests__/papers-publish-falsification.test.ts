import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	blogConfig,
	commitCount,
	destinationRepo,
	headSubject,
	indexBlock,
	paper,
	paperProject,
	publishArgs,
} from "./helpers/papers-fixture.js";

/**
 * Falsification (writing-skill Phase 7): what the publish step leaves behind.
 *
 * Each test is one hypothesis formed by reading `publish.ts` against the
 * ADR's claims, with the inputs that break the claim. Authored red at phase
 * start against today's code; green when the fix items land.
 */

/** Env that pins the dates of the commits the CLI makes. */
const at = (iso: string) => ({ GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso });

describe.skipIf(SHOULD_SKIP)("publish — what it leaves behind", () => {
	it("A22: publishing a sibling reports every published paper whose page is now behind, naming the command that repairs it", () => {
		const dest = destinationRepo();
		const p = paperProject({
			docs: {
				"paper-1.md": paper({ title: "One", body: "# One\n\nSee [two](paper-2.md).\n" }),
				"paper-2.md": paper({ title: "Two", body: "# Two\n" }),
			},
			config: blogConfig(dest),
		});
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);
		const onePage = join(dest.root, dest.dir, "one.md");
		// Two is unpublished, so one's link stayed a plan filename: dead on the site.
		expect(readFileSync(onePage, "utf-8")).toContain("](paper-2.md)");

		const r = runCli(p.root, publishArgs(p.plan, "paper-2.md"));
		expect(r.code, r.stderr).toBe(0);
		expect(r.stderr).toMatch(/paper-1\.md links to this paper and is now behind/);
		expect(r.stderr).toContain(`indusk papers publish ${p.plan}/paper-1.md`);

		// The named command repairs it.
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);
		expect(readFileSync(onePage, "utf-8")).toContain("](/writing/two)");
	}, 30_000);

	it("A23: two papers whose titles slug the same cannot publish over each other", () => {
		const dest = destinationRepo();
		const p = paperProject({
			docs: {
				"a.md": paper({ title: "Same Title", body: "# A\n" }),
				"b.md": paper({ title: "Same Title", body: "# B\n" }),
			},
			config: blogConfig(dest),
		});
		expect(runCli(p.root, publishArgs(p.plan, "a.md")).code).toBe(0);
		const page = join(dest.root, dest.dir, "same-title.md");
		const before = readFileSync(page, "utf-8");
		const index = indexBlock(dest);
		const commits = commitCount(dest.root);

		const r = runCli(p.root, publishArgs(p.plan, "b.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).toContain("a.md");
		expect(readFileSync(page, "utf-8")).toBe(before);
		expect(indexBlock(dest)).toBe(index);
		expect(commitCount(dest.root)).toBe(commits);
	}, 30_000);

	it("A24: a paper hand-set back to accepted with unchanged content is republished, not reported up to date", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);
		const paperPath = join(p.planDir, "paper-1.md");
		writeFileSync(
			paperPath,
			readFileSync(paperPath, "utf-8").replace("status: published", "status: accepted"),
		);
		git(p.root, ["commit", "-q", "-am", "status reverted by hand"]);
		const destCommits = commitCount(dest.root);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout).not.toMatch(/up to date/i);
		expect(r.stderr).not.toMatch(/nothing to commit/i);
		expect(matter(readFileSync(paperPath, "utf-8")).data.status).toBe("published");
		// The page is byte-identical, so the destination gets no new commit.
		expect(commitCount(dest.root)).toBe(destCommits);
		expect(git(dest.root, ["status", "--porcelain"]).stdout.trim()).toBe("");
	}, 30_000);

	it("A25: the index orders by first publish; a hotfix republish does not move an old page up", () => {
		const dest = destinationRepo();
		const p = paperProject({
			docs: {
				"paper-1.md": paper({ title: "One", body: "# One\n" }),
				"paper-2.md": paper({ title: "Two", body: "# Two\n" }),
			},
			config: blogConfig(dest),
		});
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md"), at("2026-01-01T00:00:00Z")).code).toBe(
			0,
		);
		expect(runCli(p.root, publishArgs(p.plan, "paper-2.md"), at("2026-02-01T00:00:00Z")).code).toBe(
			0,
		);
		const first = indexBlock(dest);
		expect(first.indexOf("/writing/two")).toBeLessThan(first.indexOf("/writing/one"));

		// Hotfix the older page, then touch the newer one so the index is
		// regenerated with the hotfix commit in the older page's history. The
		// regeneration happens before each destination commit, so the effect of
		// dating by last commit shows one publish later, not on the hotfix itself.
		const one = join(p.planDir, "paper-1.md");
		writeFileSync(one, `${readFileSync(one, "utf-8")}\nA fix.\n`);
		git(p.root, ["commit", "-q", "-am", "hotfix one"]);
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md"), at("2026-03-01T00:00:00Z")).code).toBe(
			0,
		);
		const two = join(p.planDir, "paper-2.md");
		writeFileSync(two, `${readFileSync(two, "utf-8")}\nA fix.\n`);
		git(p.root, ["commit", "-q", "-am", "hotfix two"]);
		expect(runCli(p.root, publishArgs(p.plan, "paper-2.md"), at("2026-04-01T00:00:00Z")).code).toBe(
			0,
		);

		const after = indexBlock(dest);
		expect(after.indexOf("/writing/two")).toBeLessThan(after.indexOf("/writing/one"));
	}, 30_000);

	it("A26: a --push that fails after the destination commit still completes the publish and warns", () => {
		const dest = destinationRepo(); // no remote: the push cannot succeed
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md", "--push"));
		expect(r.code, r.stderr).toBe(0);
		expect(r.stderr).toMatch(/push/i);
		expect(r.stderr).not.toMatch(/\n\s+at /);
		expect(matter(readFileSync(join(p.planDir, "paper-1.md"), "utf-8")).data.status).toBe(
			"published",
		);
		expect(headSubject(p.root)).toMatch(/^chore\(papers\): publish/);

		const again = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(again.code, again.stderr).toBe(0);
		expect(again.stdout).toMatch(/up to date/i);
		expect(git(dest.root, ["log", "-1", "--format=%B"]).stdout).not.toMatch(/diverged/i);
	}, 30_000);

	it("A27: republishing a retitled paper moves its page to the new slug", () => {
		const dest = destinationRepo();
		const p = paperProject({
			docs: { "paper-1.md": paper({ title: "The Grift" }) },
			config: blogConfig(dest),
		});
		expect(runCli(p.root, publishArgs(p.plan, "paper-1.md")).code).toBe(0);
		const paperPath = join(p.planDir, "paper-1.md");
		writeFileSync(
			paperPath,
			readFileSync(paperPath, "utf-8").replace(/^title: .*$/m, 'title: "The Grift, Revisited"'),
		);
		git(p.root, ["commit", "-q", "-am", "retitle"]);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code, r.stderr).toBe(0);
		expect(existsSync(join(dest.root, dest.dir, "the-grift.md"))).toBe(false);
		expect(existsSync(join(dest.root, dest.dir, "the-grift-revisited.md"))).toBe(true);
		const block = indexBlock(dest);
		expect(block).toContain("/writing/the-grift-revisited");
		expect(block).not.toMatch(/\/writing\/the-grift\)/);
		expect(git(dest.root, ["status", "--porcelain"]).stdout.trim()).toBe("");
	}, 30_000);

	it("A28a: a destination commit that fails leaves the destination clean and refuses with the reason", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		// No identity anywhere: not in env, not in a global or system config.
		const noIdentity = {
			HOME: mkdtempSync(join(tmpdir(), "papers-nohome-")),
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "",
			GIT_AUTHOR_EMAIL: "",
			GIT_COMMITTER_NAME: "",
			GIT_COMMITTER_EMAIL: "",
		};

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"), noIdentity);
		expect(r.code).not.toBe(0);
		expect(r.stderr).toMatch(/destination commit failed/i);
		expect(r.stderr).not.toMatch(/\n\s+at /);
		expect(git(dest.root, ["status", "--porcelain"]).stdout.trim()).toBe("");
		expect(existsSync(join(dest.root, dest.dir, "the-grift.md"))).toBe(false);
	}, 30_000);

	it("A28b: a source commit that fails names the destination commit and leaves the provenance written", () => {
		const dest = destinationRepo();
		const p = paperProject({ docs: { "paper-1.md": paper() }, config: blogConfig(dest) });
		const hook = join(p.root, ".git/hooks/pre-commit");
		writeFileSync(hook, "#!/bin/sh\nexit 1\n");
		chmodSync(hook, 0o755);

		const r = runCli(p.root, publishArgs(p.plan, "paper-1.md"));
		expect(r.code).not.toBe(0);
		expect(r.stderr).not.toMatch(/\n\s+at /);
		const destHead = git(dest.root, ["rev-parse", "--short", "HEAD"]).stdout.trim();
		expect(r.stderr).toContain(destHead);
		expect(r.stderr).toMatch(/provenance/i);
		expect(readFileSync(join(p.planDir, "paper-1.md"), "utf-8")).toContain("published:");
	}, 30_000);
});
