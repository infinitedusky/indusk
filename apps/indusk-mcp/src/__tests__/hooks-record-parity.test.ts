import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * workbench-trust-fixes A17 — the two places that describe the hook set agree
 * with the hooks on disk.
 *
 * `guide/index.md` says "Four PreToolUse hooks" above a table; the Dawn
 * master carries the keep/shed record every hook must appear in. Both were
 * written by hand and both drifted: the guide's table is missing hooks that
 * ship, and its count is a word someone typed. Parity is checked against
 * `hooks/*.js` minus the `_`-prefixed modules, which are imports, not hooks.
 */

const REPO_ROOT = resolve(new URL("../../../../", import.meta.url).pathname);
const HOOKS_DIR = join(REPO_ROOT, "apps/indusk-mcp/hooks");
const GUIDE = join(REPO_ROOT, "apps/docs/src/guide/index.md");
const DAWN_MASTER = join(REPO_ROOT, ".indusk/planning/indusk-v2-dawn/master.md");

const WORDS: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
};

function hooksOnDisk(): string[] {
	return readdirSync(HOOKS_DIR)
		.filter((f) => f.endsWith(".js") && !f.startsWith("_"))
		.map((f) => f.replace(/\.js$/, ""))
		.sort();
}

/** The hooks section: from its heading to the next `## `. */
function hooksSection(md: string): string {
	const start = md.search(/^## \d+\. Hooks/m);
	expect(start, "guide/index.md has no `## N. Hooks…` section").toBeGreaterThanOrEqual(0);
	const rest = md.slice(start + 1);
	const end = rest.search(/^## /m);
	return end === -1 ? rest : rest.slice(0, end);
}

describe("A17 — hook record parity", () => {
	it("guide/index.md's hook table lists every hook on disk, and its stated count matches its rows", () => {
		const section = hooksSection(readFileSync(GUIDE, "utf-8"));
		const rows = [...section.matchAll(/^\| `([\w-]+)`/gm)].map((m) => m[1]).sort();
		const stated =
			/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s+(?:\w+\s+)?hooks?\b/i.exec(
				section,
			);
		expect(stated, "no stated hook count in the section").not.toBeNull();
		const word = (stated as RegExpExecArray)[1].toLowerCase();
		const count = WORDS[word] ?? Number.parseInt(word, 10);

		expect(rows, "table rows vs hooks on disk").toEqual(hooksOnDisk());
		expect(count, `stated "${word}" vs ${rows.length} table rows`).toBe(rows.length);
	});

	it("the Dawn master's keep/shed record names every hook on disk", () => {
		const master = readFileSync(DAWN_MASTER, "utf-8");
		const missing = hooksOnDisk().filter((h) => !master.includes(h));
		expect(missing, "hooks the Dawn master never classifies").toEqual([]);
	});
});
