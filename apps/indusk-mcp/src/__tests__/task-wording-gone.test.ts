import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * promise: an-impl-phase-explains-itself
 * lesson: a-guard-test-over-prose-must-be-run-against-a-reworded-violation
 *
 * A5 of the impl-tasks-are-instructions impl: no file that teaches how to write
 * an impl task says a task states "what will be true" or is "one plain
 * sentence". A task is one plain instruction; a verification item one plain
 * statement of what must hold. The first pass reworded three files and a cold
 * audit found a dozen more, so this reads every place the rule is taught.
 *
 * Exempt by construction, not by a list of files: promise, brief and ADR
 * wording ("a promise ... what will be true") never mentions a task, and the
 * placeholder rule only matches a checkbox line. History (changelog, decisions,
 * lessons) and archived plans are not scanned.
 */

const PKG = resolve(__dirname, "../..");
const REPO = resolve(PKG, "../..");

/** Where the rule is taught: the package's prose and code, the docs site, the project's installed copies. */
const SCANNED = [
	{ dir: join(PKG, "skills"), skip: [] as string[] },
	{ dir: join(PKG, "templates"), skip: [] },
	{ dir: join(PKG, "hooks"), skip: [] },
	{ dir: join(PKG, "src/lib"), skip: [] },
	{ dir: join(REPO, "apps/docs/src"), skip: ["changelog.md", "decisions", "lessons"] },
	{ dir: join(REPO, ".claude"), skip: ["lessons"] },
];
const EXTENSIONS = /\.(md|js|ts)$/;

/**
 * A line that teaches a task or checklist item as an outcome:
 * - a placeholder checkbox asking for "One plain sentence";
 * - "task" within a clause of "plain sentence";
 * - "task" within a clause of "what will be true";
 * - the Shape step's written item that states what happened.
 */
function taughtAsOutcome(line: string): string | null {
	if (/^\s*- \[ \] \{One plain sentence/.test(line)) return "placeholder asks for one plain sentence";
	if (/\btasks?\b.{0,80}\bplain sentence\b|\bplain sentence\b.{0,80}\btasks?\b/i.test(line))
		return "a task is called one plain sentence";
	if (/\btasks?\b.{0,80}what will be true|what will be true.{0,80}\btasks?\b/i.test(line))
		return "a task is said to state what will be true";
	if (/Shape — reviewed a file this phase changed/.test(line))
		return "the Shape item is written as a state";
	return null;
}

function* files(dir: string, skip: string[]): Generator<string> {
	for (const name of readdirSync(dir)) {
		if (skip.includes(name) || name === "__tests__" || name === "node_modules") continue;
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* files(path, skip);
		else if (EXTENSIONS.test(name) && !/\.test\.[jt]s$/.test(name)) yield path;
	}
}

describe("A5 — the matcher flags a reworded violation and passes the current wording", () => {
	it.each([
		"- [ ] {One plain sentence saying what will be true once the fix is in.}",
		"Each task is one plain sentence saying what is now true.",
		"each task one plain sentence, and the code in a fold",
		"a task states what will be true when it is done",
		"- [x] Shape — reviewed a file this phase changed and left it as it is",
	])("flags: %s", (line) => {
		expect(taughtAsOutcome(line), line).not.toBeNull();
	});

	it.each([
		"- [ ] {One plain instruction saying what to do.}",
		"- [ ] {One plain statement of what must hold: the tests pass.}",
		"Each task is one plain instruction saying what to do.",
		"1. **`{promise-name}`** (behaviour). {The promise, in one plain sentence: what will be true.}",
		"**{One sentence. What will be true when this ADR's decisions ship that isn't true today.}**",
		"Put what you heard as promises, one plain sentence each about what will be true.",
		"- [x] Shape — review a file this phase changed and leave it as it is",
	])("passes: %s", (line) => {
		expect(taughtAsOutcome(line), line).toBeNull();
	});
});

describe("A5 — no file teaches a task as a statement of what will be true", () => {
	it("every scanned file is free of the old wording", () => {
		const hits: string[] = [];
		let scanned = 0;
		for (const { dir, skip } of SCANNED) {
			for (const path of files(dir, skip)) {
				scanned++;
				readFileSync(path, "utf-8")
					.split("\n")
					.forEach((line, i) => {
						const why = taughtAsOutcome(line);
						if (why) hits.push(`${relative(REPO, path)}:${i + 1} — ${why}: ${line.trim().slice(0, 100)}`);
					});
			}
		}
		expect(scanned, "scanned no files").toBeGreaterThan(50);
		expect(hits, `\n${hits.join("\n")}\n`).toEqual([]);
	});
});
