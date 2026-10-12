import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, runCli } from "./helpers/cli.js";

/**
 * promise: a-component-has-one-implementation — storybook-components A2.
 *
 * Every component the admin's approved mockups name has an implementation in
 * the admin; one with none is reported by name. The nineteen are read from the
 * mockups themselves — a `data-component` element, or an `<indusk-component
 * name>` once Build Phase 6 composes them — and an implementation is a
 * non-test, non-story file under `apps/indusk-admin/src` whose element carries
 * that `data-component`.
 *
 * Two assertions: the CLI's `unimplemented component: <name>` lines are
 * exactly the components with no implementation (red today: the line does not
 * exist and ten are unmarked), and none is left (red until Build Phase 5).
 */

const MOCKUPS = join(REPO_ROOT, ".indusk/mockups/admin/screens");
const ADMIN_SRC = join(REPO_ROOT, "apps/indusk-admin/src");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

/** The component names the admin's mockups name, sorted. */
function mockupComponents(): string[] {
	const names = new Set<string>();
	for (const file of readdirSync(MOCKUPS).filter((f) => f.endsWith(".html"))) {
		const html = readFileSync(join(MOCKUPS, file), "utf-8");
		for (const m of html.matchAll(/\bdata-component\s*=\s*["']([^"']+)["']/g)) names.add(m[1]);
		for (const m of html.matchAll(/<indusk-component\b[^>]*\bname\s*=\s*["']([^"']+)["']/g)) {
			names.add(m[1]);
		}
	}
	return [...names].sort();
}

/** The components the admin's source implements: a marker in a file that is neither a test nor a story. */
function implemented(): Set<string> {
	const names = new Set<string>();
	for (const file of walk(ADMIN_SRC)) {
		if (!/\.(tsx|jsx)$/.test(file) || /\.(test|stories)\./.test(file)) continue;
		if (file.includes("__tests__")) continue;
		const text = readFileSync(file, "utf-8");
		for (const m of text.matchAll(/\bdata-component\s*=\s*\{?\s*["'`]([^"'`\s]+)["'`]/g)) {
			names.add(m[1]);
		}
	}
	return names;
}

describe("the admin implements every component its mockups name", () => {
	it("A2 each of the mockups' components has an implementation; one with none is reported by name", () => {
		const named = mockupComponents();
		expect(named, "the admin's mockups name nineteen components").toHaveLength(19);
		const have = implemented();
		const missing = named.filter((n) => !have.has(n));

		const { stdout, stderr } = runCli(REPO_ROOT, ["looks", "coverage", "admin"]);
		const reported = `${stdout}\n${stderr}`
			.split("\n")
			.map((l) => l.match(/unimplemented component:\s*(\S+)/)?.[1])
			.filter((n): n is string => n !== undefined)
			.sort();

		expect(
			reported,
			`coverage must report each component with no implementation by name; ${missing.length} have none: ${missing.join(", ")}`,
		).toEqual(missing);
		expect(missing, "components the mockups name with no implementation in the admin").toEqual([]);
	});
});
