import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * context-tiers — A9, A15: the skills route by tier.
 *
 * A skill is prose the model follows, so the test reads the prose: the
 * package copy and the installed copy both, because a routing change that
 * reaches only one of them reaches no session.
 */

function copies(name: string): [label: string, text: string][] {
	return [
		[
			`package ${name}`,
			readFileSync(join(REPO_ROOT, "apps/indusk-mcp/skills", `${name}.md`), "utf-8"),
		],
		[
			`installed ${name}`,
			readFileSync(join(REPO_ROOT, ".claude/skills", name, "SKILL.md"), "utf-8"),
		],
	];
}

describe("A9 — catchup skims advisory lessons and states both counts", () => {
	it.each(copies("catchup"))("%s", (_label, text) => {
		expect(text, "names the guarded state").toMatch(/guarded/i);
		expect(text, "names the advisory state").toMatch(/advisory/i);
		expect(text, "the skim is limited to advisory titles").toMatch(/skim[^.\n]*advisory/i);
		expect(text, "the summary states both counts").toMatch(
			/guarded[^.\n]*advisory[^.\n]*count|count[^.\n]*guarded/i,
		);
	});
});

describe("A17 — /planner reads the master before it writes a plan's first file", () => {
	it.each(copies("planner"))("%s", (_label, text) => {
		const steps = text.slice(text.indexOf("## What to Do When Asked to Plan"));
		const first = steps.slice(0, steps.indexOf("1. **Determine the workflow type**"));
		expect(first, "a step before the first, reading the master").toMatch(
			/Read `\.indusk\/planning\/master\.md` first/,
		);
	});
});

describe("A15 — a Context gate item names its tier and destination", () => {
	it.each([...copies("planner"), ...copies("claude-md")])("%s", (_label, text) => {
		expect(text, "the tier vocabulary is present").toMatch(/\btier\b/i);
		expect(text, "an item names its destination").toMatch(/destination/i);
		expect(text, "an item aimed at the root says why it must be always-on").toMatch(/always-on/i);
	});
});
