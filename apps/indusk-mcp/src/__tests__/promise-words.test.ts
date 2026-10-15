import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// promise: a-promise-is-upheld-or-broken

/**
 * A10 of one-promise-language: the word scan. The pages, skills, templates and
 * descriptions a person reads carry no `violated`, `violation` or
 * `known-violated`, and do not call a promise's telemetry a mark — it is a
 * signal. A file that says either is reported as `file:line`.
 *
 * The scan reads only text people read: the docs' guide and reference pages,
 * the skills, the planning template, the deploy files, the demo's README, and
 * the string literals of the CLI and the MCP tool descriptions. Plans, ADRs,
 * lessons and retrospectives are history and are not scanned.
 */

const ROOT = resolve(__dirname, "../../../..");

/** Every file under `dir` (relative to the repo) with one of `exts`, recursively. */
function filesUnder(dir: string, exts: string[]): string[] {
	const abs = join(ROOT, dir);
	if (!existsSync(abs)) return [];
	const out: string[] = [];
	for (const name of readdirSync(abs)) {
		const rel = join(dir, name);
		if (statSync(join(ROOT, rel)).isDirectory()) out.push(...filesUnder(rel, exts));
		else if (exts.some((e) => name.endsWith(e))) out.push(rel);
	}
	return out;
}

/** The string literals of a source file, one entry per line that holds any, joined. */
function stringLiterals(source: string): { line: number; text: string }[] {
	const found: { line: number; text: string }[] = [];
	const literal = /(["'`])((?:\\.|(?!\1).)*)\1/g;
	source.split("\n").forEach((text, i) => {
		const parts = [...text.matchAll(literal)].map((m) => m[2] ?? "");
		if (parts.length > 0) found.push({ line: i + 1, text: parts.join(" ") });
	});
	return found;
}

type Scanned = { file: string; line: number; text: string };

function scanned(): Scanned[] {
	const docs = [
		...filesUnder("apps/docs/src/guide", [".md"]),
		...filesUnder("apps/docs/src/reference", [".md"]),
		...filesUnder("apps/indusk-mcp/skills", [".md"]),
		...filesUnder("apps/indusk-mcp/extensions", ["skill.md"]),
		"docker/Dockerfile.always-on",
		"docker/fly.always-on.toml",
		"apps/indusk-mcp/templates/planning/CLAUDE.md",
		"apps/indusk-mcp/templates/server/Dockerfile",
		"apps/indusk-mcp/templates/server/fly.toml",
		"examples/seat-holds/README.md",
	].filter((f) => existsSync(join(ROOT, f)));
	const lines: Scanned[] = docs.flatMap((file) =>
		readFileSync(join(ROOT, file), "utf-8")
			.split("\n")
			.map((text, i) => ({ file, line: i + 1, text })),
	);
	for (const file of [
		"apps/indusk-mcp/src/bin/cli.ts",
		"apps/indusk-mcp/src/tools/promise-tools.ts",
	]) {
		const source = readFileSync(join(ROOT, file), "utf-8");
		for (const l of stringLiterals(source)) lines.push({ file, ...l });
	}
	return lines;
}

/**
 * What stays, each with its reason. A line is scanned after these are cut out.
 */
const ALLOWED: { why: string; pattern: RegExp }[] = [
	{
		why: "the span event's name is wire vocabulary an application already sets",
		pattern: /indusk\.promise\.violated/g,
	},
	{
		why: "the outcome attribute's name carries no old word, but a snippet that sets its value `violated` must, this release",
		pattern: /(indusk\.promise\.outcome[^\n]*?)["'`]?violated["'`]?/g,
	},
	{
		why: "the sentence beside the value, saying an old signal is read as broken",
		pattern:
			/[^.\n]*\bviolated\b[^.\n]*\bread as broken\b[^.\n]*|[^.\n]*\bread as broken\b[^.\n]*\bviolated\b[^.\n]*/gi,
	},
];

/**
 * Where `mark` means something else: the admin's nav draws a glyph and calls it
 * its mark, which is no promise's telemetry.
 */
const MARK_ALLOWED: { why: string; pattern: RegExp }[] = [
	{ why: "a nav item's glyph is its mark", pattern: /\(a mark, a name and a count/g },
	{ why: "a nav row's glyph is its mark", pattern: /keeps its mark \(a drawer/g },
];

const OLD_WORDS = /\bviolat\w*|known-violated/i;
/**
 * The promise sense of mark: `a mark`, `its mark`, `the mark`, `every mark`,
 * `marked the promise`, and the senses a page reaches for without the article:
 * `production marks`, `a promise's mark`, `sends marks`, `mark a promise`,
 * `has been marked`, `run, mark,`.
 */
const MARK_SENSE =
	/\b(a|its|the|every) marks?\b|\bmarked the promise\b|\b(promise|promise's|production|one|that) marks?\b|\bsends? marks?\b|\bmarks? (a|the) promise\b|\bhas been marked\b|\brun, mark,/i;

describe("A10 — the pages, skills, templates and descriptions carry no old promise word", () => {
	const rows = scanned();

	it("the scan reads something (a scan of nothing proves nothing)", () => {
		expect(new Set(rows.map((r) => r.file)).size).toBeGreaterThan(20);
	});

	it("none says violated, violation or known-violated outside the allowed list", () => {
		const hits = rows
			.filter((r) => OLD_WORDS.test(ALLOWED.reduce((t, a) => t.replace(a.pattern, ""), r.text)))
			.map((r) => `${relative(".", r.file)}:${r.line}`);
		expect(hits, `${hits.length} lines say an old word`).toEqual([]);
	});

	it("none calls a promise's telemetry a mark", () => {
		const hits = rows
			.filter((r) =>
				MARK_SENSE.test(MARK_ALLOWED.reduce((t, a) => t.replace(a.pattern, ""), r.text)),
			)
			.map((r) => `${r.file}:${r.line}`);
		expect(hits, `${hits.length} lines call a signal a mark`).toEqual([]);
	});
});

describe("A19 — the scan reads the extension skills, the image's deploy files and every promise sense of mark", () => {
	const rows = scanned();
	const files = new Set(rows.map((r) => r.file));

	it("reads the installed extension skills and the always-on image's files", () => {
		expect(
			[...files].filter((f) => /^apps\/indusk-mcp\/extensions\/[^/]+\/skill\.md$/.test(f)),
		).not.toEqual([]);
		expect(files.has("apps/indusk-mcp/extensions/testing/skill.md")).toBe(true);
		expect(files.has("docker/Dockerfile.always-on")).toBe(true);
		expect(files.has("docker/fly.always-on.toml")).toBe(true);
	});

	it("refuses mark in each promise sense, and lets the nav glyph stand", () => {
		for (const said of [
			"the server reads production marks",
			"a promise's mark lands in Jaeger",
			"the app sends marks to the server",
			"it will mark a promise broken",
			"what has been marked broken",
			"run, mark, and record",
			"the mark under a promise",
		]) {
			expect(MARK_SENSE.test(said), said).toBe(true);
		}
		expect(MARK_SENSE.test("the Postmark service")).toBe(false);
	});

	it("none of the scanned lines uses mark in a promise sense", () => {
		const hits = rows
			.filter((r) =>
				MARK_SENSE.test(MARK_ALLOWED.reduce((t, a) => t.replace(a.pattern, ""), r.text)),
			)
			.map((r) => `${r.file}:${r.line}`);
		expect(hits, `${hits.length} lines call a signal a mark`).toEqual([]);
	});
});

/**
 * A20: until the writers switch (the next plan, `mark-first`), InDusk's own
 * signals and the demo's are written `violated` and read as broken. A page
 * says that; it does not say they are marked, written or set to `broken`.
 */
const WRITES_BROKEN =
	/\b(marked|marks|mark|written|writes|set to|sets|sends?|carrying|carries)\b[^.]*`broken`|`broken`[^.]*\b(is|are) (marked|written|set)\b/i;

describe("A20 — no page says InDusk's own signals or the demo's are written broken this release", () => {
	it("no sentence on a page says a signal is marked, written or set to `broken`", () => {
		const paragraphs: { file: string; line: number; text: string }[] = [];
		for (const r of scanned().filter((x) => x.file.endsWith(".md"))) {
			const last = paragraphs[paragraphs.length - 1];
			if (r.text.trim() === "") paragraphs.push({ file: r.file, line: r.line + 1, text: "" });
			else if (last && last.file === r.file && last.text !== "") last.text += ` ${r.text}`;
			else if (last && last.file === r.file && last.text === "") {
				last.line = r.line;
				last.text = r.text;
			} else paragraphs.push({ file: r.file, line: r.line, text: r.text });
		}
		const hits: string[] = [];
		for (const p of paragraphs) {
			for (const sentence of p.text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)) {
				if (/\bread (as broken|the same)\b/i.test(sentence)) continue;
				if (WRITES_BROKEN.test(sentence))
					hits.push(`${p.file}:${p.line} — ${sentence.slice(0, 80)}`);
			}
		}
		expect(hits, `${hits.length} sentences say a writer sends broken`).toEqual([]);
	});
});
