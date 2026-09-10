import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The `write` skill, pinned by its text (writing-skill A15, A16, A17, A20).
 *
 * The skill is prose a model reads, so nothing mechanical can check that it
 * works — but it can check that it is there and says what the ADR decided,
 * the way the planner skill's Test-Phase-1-first instruction is pinned. An
 * instruction that is absent produces the old behaviour with no error, and
 * the description is the only thing the model sees before routing to the
 * skill, so its trigger words are the sharpest pin here.
 *
 * Reads fall back to "" when the file is absent so every assertion fails on
 * its own regex rather than on ENOENT.
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;
const SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/write.md");
const SIDEBAR = join(REPO_ROOT, "apps/docs/src/.vitepress/config.ts");

const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf-8") : "");

function frontmatter(text: string): string {
	return /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
}

describe("the write skill exists and is registrable", () => {
	it("apps/indusk-mcp/skills/write.md exists with name and description", () => {
		expect(existsSync(SKILL), "skills/write.md is missing").toBe(true);
		const fm = frontmatter(read(SKILL));
		expect(fm).toMatch(/^name:\s*write\s*$/m);
		expect(fm).toMatch(/^description:\s*\S/m);
	});
});

describe("A15: the description is the routing key and names its triggers", () => {
	it("mentions drafting, outlining, revising, and publishing a paper, thesis, or essay", () => {
		const desc = /^description:\s*(.+)$/m.exec(frontmatter(read(SKILL)))?.[1] ?? "";
		expect(desc).toMatch(/draft/i);
		expect(desc).toMatch(/outlin/i);
		expect(desc).toMatch(/revis/i);
		expect(desc).toMatch(/publish/i);
		expect(desc).toMatch(/paper/i);
		expect(desc).toMatch(/thesis|essay/i);
	});
});

describe("A16: the load list replaces catchup", () => {
	const text = read(SKILL);

	it("registers presence", () => {
		expect(text).toMatch(/indusk agent register/);
	});

	it("loads the plan folder's prose documents", () => {
		expect(text).toMatch(/prose documents/i);
	});

	it("skips lessons, health, and extensions", () => {
		expect(text).toMatch(/skip[^.\n]*lessons/i);
		expect(text).toMatch(/skip[^.\n]*health/i);
		expect(text).toMatch(/skip[^.\n]*extensions/i);
	});
});

describe("A17: the craft sections exist under their names", () => {
	const text = read(SKILL);

	it.each([
		"Voice",
		"Outline",
		"Read as the reader",
		"Falsify the argument",
		"Publish",
	])("has a `## %s` section", (heading) => {
		expect(text).toMatch(new RegExp(`^## ${heading}\\b`, "m"));
	});
});

describe("A20: the docs sidebar links the skill and the command", () => {
	const sidebar = read(SIDEBAR);

	it("links /reference/skills/write", () => {
		expect(sidebar).toContain("/reference/skills/write");
	});

	it("links /reference/cli/papers", () => {
		expect(sidebar).toContain("/reference/cli/papers");
	});
});
