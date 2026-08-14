import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

/**
 * A1 / A2 / A5 (jj-residue-rip-out) — the jj rip-out audit.
 *
 * This replaces the `git-only-substrate` Phase 4 audit, which was green for
 * seven weeks while `apps/indusk-admin/src/lib/vcs.ts` shelled out to jj on
 * every scorecard render. It was green for three structural reasons, and all
 * three are corrected here:
 *
 *  1. **Path scope.** `SRC_ROOT` resolved to `apps/indusk-mcp`, so
 *     `apps/indusk-admin/` was never scanned. That is where the violation was.
 *  2. **Pattern scope.** All five patterns were TypeScript *identifiers*
 *     (`getScm`, `NotAJjRepoError`, …). The surviving violation was the string
 *     `"jj"` in an `execFileSync` argument list, which no identifier matches.
 *  3. **Line-at-a-time matching.** The old audit tested each line in isolation.
 *     The real call site is formatted across lines —
 *
 *         const out = execFileSync(
 *           "jj",
 *
 *     — so even a correct argv pattern would still have missed it. Patterns
 *     here are matched against whole-file content, and `\s*` spans newlines.
 *
 * Negative-assertion strings inside test files remain allowed, and the
 * preserved historical record is exempt by construction (see A2).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

/**
 * Paths that deliberately keep jj and must never be flagged.
 *
 * The decision record (`git-or-jj-substrate`) and the three bundled community
 * lessons that use jj as their worked example are evidence, not residue —
 * stripping jj from them would leave them asserting that something happened
 * without saying what. An audit that fires on these gets switched off, which
 * is the failure this audit exists to correct.
 */
const PRESERVED_HISTORY = [
	".indusk/planning/**",
	"apps/docs/src/decisions/**",
	"apps/docs/src/lessons/**",
	"apps/docs/src/guide/scm.md",
	"apps/indusk-mcp/lessons/**",
];

/** Live source across BOTH apps — the scope the predecessor was missing. */
const SCAN = ["apps/indusk-mcp/**/*.ts", "apps/indusk-admin/**/*.ts", "apps/indusk-admin/**/*.tsx"];

const IGNORE = [
	"**/node_modules/**",
	"**/dist/**",
	"**/.next/**",
	"**/__tests__/**",
	"**/*.test.ts",
	"**/*.test.tsx",
	...PRESERVED_HISTORY,
];

/**
 * jj as an *executed command* and as a *configured option* — the two shapes
 * that mean the substrate is still live. Identifier patterns from the
 * predecessor are kept: they still hold, they were just never sufficient.
 */
const FORBIDDEN_PATTERNS = [
	// argv-level: the class the predecessor could not see
	/execFileSync\s*\(\s*["'`]jj["'`]/,
	/execFile\s*\(\s*["'`]jj["'`]/,
	/spawnSync\s*\(\s*["'`]jj["'`]/,
	/spawn\s*\(\s*["'`]jj["'`]/,
	// config-level: jj offered as a choice
	/\bscm\s*\??\s*:\s*["'`]jj["'`]/,
	// identifier-level: the predecessor's five, still valid
	/import\s+[^;]*\bgetScm\b/,
	/from\s+["'][^"']*lib\/scm\/detect/,
	/from\s+["'][^"']*semantic-graph\/jj/,
	/\bNotAJjRepoError\b/,
	/\bgetJjReachable\b/,
];

/** Files the audit actually inspects. Exported shape so A2 can assert on it. */
function auditedFiles(): string[] {
	return globSync(SCAN, { cwd: REPO_ROOT, ignore: IGNORE, absolute: true });
}

interface Violation {
	file: string;
	line: number;
	text: string;
}

/**
 * Every pattern that matches in whole-file content, with line numbers.
 *
 * Whole-file rather than line-at-a-time is the load-bearing part: the call site
 * this audit exists to catch spans two lines, so a per-line scan misses it even
 * with a correct pattern. Shared by A1 and A5 — they differ on globs, ignores
 * and reporting, but this mechanic must not drift between them.
 *
 * Returns *all* matching patterns, not the first. Reporting one violation per
 * file would converge (fix, re-run, see the next), but it would also hide a
 * second distinct violation behind the first — and no file currently matches
 * two patterns, so that narrowing would look identical today and bite later.
 */
function matchesIn(content: string, patterns: RegExp[]): { line: number; match: string }[] {
	const hits: { line: number; match: string }[] = [];
	for (const pattern of patterns) {
		const found = pattern.exec(content);
		if (found) {
			hits.push({
				line: content.slice(0, found.index).split("\n").length,
				match: found[0].replace(/\s+/g, " ").trim(),
			});
		}
	}
	return hits;
}

function findViolations(): Violation[] {
	const violations: Violation[] = [];
	for (const file of auditedFiles()) {
		for (const hit of matchesIn(readFileSync(file, "utf-8"), FORBIDDEN_PATTERNS)) {
			violations.push({ file: relative(REPO_ROOT, file), line: hit.line, text: hit.match });
		}
	}
	return violations;
}

describe("jj rip-out audit", () => {
	it("A1 — no live source executes jj or offers it as a config option", () => {
		const violations = findViolations();
		expect(
			violations,
			`jj is still live in:\n${violations
				.map((v) => `  ${v.file}:${v.line} — ${v.text}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("A2 — the audit does not inspect the preserved historical record", () => {
		const audited = auditedFiles().map((f) => relative(REPO_ROOT, f));

		// The exemption must be load-bearing, not decorative: this lesson really
		// does contain jj, and really must not be flagged.
		const lesson =
			"apps/indusk-mcp/lessons/community/community-anchor-shell-trigger-patterns-no-substring.md";
		expect(existsSync(resolve(REPO_ROOT, lesson)), `${lesson} should exist`).toBe(true);
		expect(readFileSync(resolve(REPO_ROOT, lesson), "utf-8")).toContain("jj describe");
		expect(audited).not.toContain(lesson);

		// And no audited path may fall inside a preserved-history root.
		const preservedRoots = [
			".indusk/planning/",
			"apps/docs/src/decisions/",
			"apps/docs/src/lessons/",
			"apps/indusk-mcp/lessons/",
		];
		const leaked = audited.filter((f) => preservedRoots.some((r) => f.startsWith(r)));
		expect(leaked, `audit reached preserved history: ${leaked.join(", ")}`).toEqual([]);
	});

	it("A5 — no admin UI copy instructs the reader to run a jj command", () => {
		const tsxFiles = globSync("apps/indusk-admin/**/*.tsx", {
			cwd: REPO_ROOT,
			ignore: ["**/node_modules/**", "**/.next/**", "**/*.test.tsx"],
			absolute: true,
		});
		const offenders: Violation[] = [];
		for (const file of tsxFiles) {
			const content = readFileSync(file, "utf-8");
			for (const hit of matchesIn(content, [/\bjj\b/])) {
				offenders.push({
					file: relative(REPO_ROOT, file),
					line: hit.line,
					// The whole source line, not the bare match — "jj" alone says nothing.
					text: content.split("\n")[hit.line - 1].trim(),
				});
			}
		}
		expect(
			offenders,
			`admin UI still names jj:\n${offenders
				.map((v) => `  ${v.file}:${v.line} — ${v.text}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("lib/semantic-graph/jj.ts does not exist", () => {
		expect(existsSync(resolve(REPO_ROOT, "apps/indusk-mcp/src/lib/semantic-graph/jj.ts"))).toBe(
			false,
		);
	});

	it("lib/scm/detect.ts does not exist", () => {
		expect(existsSync(resolve(REPO_ROOT, "apps/indusk-mcp/src/lib/scm/detect.ts"))).toBe(false);
	});
});
