import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * small-fixes — A11: this repository's installed hooks are the package's.
 *
 * `skill-sync-parity` pins `.claude/skills/` to `skills/`; nothing pinned
 * `.claude/hooks/`, so a hook changed in the package reached this repository
 * only when someone ran `indusk update` (found at 1.66.0's install: three
 * hooks stale). Same rule, same shape: byte-identical, both directions.
 *
 * promise: installed-hooks-match-the-package
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;
const HOOKS_SOURCE = join(REPO_ROOT, "apps/indusk-mcp/hooks");
const HOOKS_INSTALLED = join(REPO_ROOT, ".claude/hooks");

const js = (dir: string) =>
	readdirSync(dir)
		.filter((f) => f.endsWith(".js"))
		.sort();

describe("A11 — installed hooks match package sources", () => {
	const sources = js(HOOKS_SOURCE);

	it("finds package hook sources (sanity)", () => {
		expect(sources.length).toBeGreaterThan(3);
	});

	it("every package hook has a byte-identical installed copy", () => {
		const problems: string[] = [];
		for (const file of sources) {
			const installed = join(HOOKS_INSTALLED, file);
			if (!existsSync(installed)) {
				problems.push(`${file}: not installed (.claude/hooks/${file} missing)`);
				continue;
			}
			if (readFileSync(join(HOOKS_SOURCE, file), "utf-8") !== readFileSync(installed, "utf-8")) {
				problems.push(
					`${file}: STALE — resync with: cp apps/indusk-mcp/hooks/${file} .claude/hooks/${file}`,
				);
			}
		}
		expect(problems, "lesson: installed-hooks-match-the-package").toEqual([]);
	});

	it("an installed hook with no package source is reported by name", () => {
		const strays = js(HOOKS_INSTALLED).filter((f) => !sources.includes(f));
		expect(strays, "installed hooks the package does not ship").toEqual([]);
	});
});
