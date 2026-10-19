import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// promise: a-promise-is-upheld-or-broken

/**
 * A30 of mark-first: the telemetry a promise's clause carries is called its
 * signal, never a mark. The skills, the tool descriptions and comments in
 * `src/`, and the guide and reference pages say signal; the Day 4b entry in
 * the root `CLAUDE.md`, the archived plans and the decisions pages are history
 * and are not scanned. Identifiers (`markPromise`, `PROMISE_MARK`,
 * `parseMarkedSpan`) keep their names this release, so the pattern reads
 * prose, not code: it looks for the phrase, not the substring.
 */

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const docs = join(pkg, "..", "docs", "src");

/** A promise's telemetry called a mark: "a promise mark", "marks the promise", "marked span", "an application's marks". */
const OLD_WORD =
	/\b(?:promise|promise's|its own|own|application's|app's|production|clause's)\s+marks?\b|\bmarks?\s+(?:a|the|each|every|one|its)\s+promise\b|\bmarked spans?\b|\bmarking a promise\b|\bmarked\s+(?:upheld|broken)\b/i;

function files(dir: string, ext: RegExp, skip: (p: string) => boolean): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (skip(path)) continue;
		if (statSync(path).isDirectory()) out.push(...files(path, ext, skip));
		else if (ext.test(name)) out.push(path);
	}
	return out;
}

const skipTests = (p: string) => /\.test\.ts$/.test(p) || /[\\/]__tests__[\\/]/.test(p);

function offenders(): string[] {
	const found: string[] = [];
	const scan = [
		...files(join(pkg, "skills"), /\.md$/, () => false),
		...files(join(pkg, "src"), /\.(ts|tsx)$/, skipTests),
		...files(join(docs, "guide"), /\.md$/, () => false),
		...files(join(docs, "reference"), /\.md$/, () => false),
	];
	for (const file of scan) {
		readFileSync(file, "utf-8")
			.split("\n")
			.forEach((line, i) => {
				if (OLD_WORD.test(line))
					found.push(`${relative(pkg, file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
			});
	}
	return found;
}

describe("A30 — a promise's telemetry is called a signal", () => {
	it("no skill, tool description, comment or page calls it a mark", () => {
		expect(offenders()).toEqual([]);
	});

	it("the pattern catches the phrases it exists for", () => {
		for (const bad of [
			"the promise mark",
			"an application's marks",
			"it marks the promise on its span",
			"every marked span",
		]) {
			expect(OLD_WORD.test(bad), bad).toBe(true);
		}
		expect(OLD_WORD.test("markdown, bookmarks and a signal"), "not prose about marks").toBe(false);
	});
});
