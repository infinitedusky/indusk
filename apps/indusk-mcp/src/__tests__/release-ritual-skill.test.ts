import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * release-ritual — T8, T9: the bump belongs to the retrospective.
 *
 * The guard's own rule is "bump on main, after the branch is merged", which is
 * exactly where Step 10 leaves you. Until now the ritual said to bump and left
 * the three steps — version, changelog heading, a commit message in the format
 * the guard greps for — to be done by hand, every time.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SKILL = resolve(HERE, "../../skills/retrospective.md");
const INSTALLED_SKILL = resolve(HERE, "../../../../.claude/skills/retrospective/SKILL.md");

describe("T8 — Step 11 is in the retrospective skill", () => {
	const skill = () => readFileSync(PACKAGE_SKILL, "utf-8");

	it("has a bump step after the landing step", () => {
		const text = skill();
		const step11 = text.indexOf("Step 11");
		const step10 = text.indexOf("Step 10");
		expect(step11, "Step 11 exists").toBeGreaterThan(-1);
		expect(step11, "and comes after the landing step").toBeGreaterThan(step10);
	});

	it("names the three things a bump does, so none is left to memory", () => {
		const text = skill();
		expect(text, "the changelog heading is rolled").toMatch(/\[Unreleased\]/);
		expect(text, "the commit message the guard greps for").toContain("chore(release):");
		expect(text, "the version itself").toMatch(/package\.json/);
	});

	it("says a plan that changed no packaged paths skips it, and records that", () => {
		const text = skill();
		const from = text.indexOf("Step 11");
		const section = text.slice(from, from + 4000);
		expect(
			section,
			"skipping must be distinguishable from not running — the whole point of the gate discipline",
		).toMatch(/no packaged|nothing to release|skip/i);
	});
});

describe("T9 — the installed copy matches the package-owned one", () => {
	it("is byte-identical", () => {
		expect(readFileSync(INSTALLED_SKILL, "utf-8")).toBe(readFileSync(PACKAGE_SKILL, "utf-8"));
	});
});
