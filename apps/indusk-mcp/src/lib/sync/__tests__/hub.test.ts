import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promoteLesson, pullLessons } from "../hub.js";

/**
 * indusk-makeover Phase 5 — hub push/pull.
 *
 *   A13 — a rule promoted from one project is received by a second project via
 *         the pull flow, with provenance (the e2e CLI smoke complements this)
 *   A14 — pulling twice changes nothing the second time; local (personal)
 *         lessons are never overwritten
 *
 * Supporting: promote refusals (not-found / conflict / already-promoted).
 */

const NOW = new Date("2026-07-23T12:00:00.000Z");

describe("hub promote/pull", () => {
	let home: string;
	let projectA: string;
	let projectB: string;

	function writeLesson(projectRoot: string, name: string, content: string): void {
		const dir = join(projectRoot, ".claude/lessons");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, `${name}.md`), content);
	}

	beforeEach(() => {
		home = mkdtempSync(join(tmpdir(), "indusk-hub-home-"));
		projectA = mkdtempSync(join(tmpdir(), "indusk-hub-a-"));
		projectB = mkdtempSync(join(tmpdir(), "indusk-hub-b-"));
		process.env.INDUSK_HOME = home;
	});

	afterEach(() => {
		delete process.env.INDUSK_HOME;
		for (const d of [home, projectA, projectB]) rmSync(d, { recursive: true, force: true });
	});

	it("A13: a promoted rule reaches a second project via pull, with provenance", () => {
		writeLesson(projectA, "always-pin-versions", "# Always pin versions\n\nBecause drift bites.\n");

		const promoted = promoteLesson(projectA, "always-pin-versions", NOW);
		expect(promoted.status).toBe("promoted");
		expect(promoted.hubVersion).toBe(1);

		const pulled = pullLessons(projectB);
		expect(pulled.pulled).toEqual(["community-always-pin-versions.md"]);

		const received = readFileSync(
			join(projectB, ".claude/lessons/community-always-pin-versions.md"),
			"utf-8",
		);
		expect(received).toContain("Always pin versions");
		expect(received).toContain("promoted from"); // provenance travels
		expect(received).toContain(NOW.toISOString());
	});

	it("A14: pull is idempotent — second pull changes nothing", () => {
		writeLesson(projectA, "rule-one", "# Rule one\n\nbody\n");
		promoteLesson(projectA, "rule-one", NOW);

		const first = pullLessons(projectB);
		expect(first.pulled).toHaveLength(1);

		const second = pullLessons(projectB);
		expect(second.pulled).toEqual([]);
		expect(second.skippedSame).toBe(1);
		expect(second.conflicts).toEqual([]);
	});

	it("A14: local lessons are never overwritten — conflict reported, local wins", () => {
		writeLesson(projectA, "shared-name", "# Hub version\n\nhub body\n");
		promoteLesson(projectA, "shared-name", NOW);
		writeLesson(projectB, "community-shared-name", "# Local version\n\nmy own take\n");

		const result = pullLessons(projectB);

		expect(result.pulled).toEqual([]);
		expect(result.conflicts).toEqual(["community-shared-name.md"]);
		const local = readFileSync(join(projectB, ".claude/lessons/community-shared-name.md"), "utf-8");
		expect(local).toContain("my own take");
	});

	it("pull merges the package's bundled channel alongside the hub", () => {
		const pkgDir = mkdtempSync(join(tmpdir(), "indusk-hub-pkg-"));
		writeFileSync(join(pkgDir, "community-bundled.md"), "# Bundled rule\n\nfrom the package\n");
		try {
			const result = pullLessons(projectB, pkgDir);
			expect(result.pulled).toContain("community-bundled.md");
		} finally {
			rmSync(pkgDir, { recursive: true, force: true });
		}
	});

	it("promote refuses a non-existent lesson", () => {
		expect(promoteLesson(projectA, "ghost", NOW).status).toBe("not-found");
	});

	it("promote is idempotent for identical content, refuses different content", () => {
		writeLesson(projectA, "rule-two", "# Rule two\n\nsame body\n");
		expect(promoteLesson(projectA, "rule-two", NOW).status).toBe("promoted");
		expect(promoteLesson(projectA, "rule-two", NOW).status).toBe("already-promoted");

		writeLesson(projectB, "rule-two", "# Rule two\n\nDIFFERENT body\n");
		const conflicted = promoteLesson(projectB, "rule-two", NOW);
		expect(conflicted.status).toBe("conflict");
	});

	it("manifest version bumps monotonically per promote", () => {
		writeLesson(projectA, "one", "# One\n\nx\n");
		writeLesson(projectA, "two", "# Two\n\ny\n");
		expect(promoteLesson(projectA, "one", NOW).hubVersion).toBe(1);
		expect(promoteLesson(projectA, "two", NOW).hubVersion).toBe(2);
		expect(pullLessons(projectB).hubVersion).toBe(2);
	});
});
