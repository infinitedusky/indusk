import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

/**
 * A1 / A2 / A5 / A8–A11 (jj-residue-rip-out) — the jj rip-out audit.
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
	// Reached only once prose came into scope. The changelog records changes as
	// they were made; strategy and dawn record analysis at a point in time; the
	// semantic-graph reference documents a subsystem the makeover removed and is
	// a separate plan's problem. Rewriting any of them would falsify a record.
	"apps/docs/src/changelog.md",
	"apps/docs/src/strategy/**",
	"apps/docs/src/dawn/**",
	"apps/docs/src/reference/semantic-graph/**",
];

/**
 * Code surfaces — jj as an executed command or a configured option.
 *
 * Hooks are `.js` and extension manifests are `.json`; both are copied into
 * every consumer's project, and neither is TypeScript. Scanning only `.ts`/
 * `.tsx` was this audit's own blind spot, found by falsification: it is the
 * same failure as the predecessor's (scope narrower than the codebase), in a
 * third dimension after path and pattern.
 */
const CODE_SCAN = [
	"apps/indusk-mcp/**/*.ts",
	"apps/indusk-admin/**/*.ts",
	"apps/indusk-admin/**/*.tsx",
	"apps/indusk-mcp/hooks/**/*.js",
	"apps/indusk-mcp/extensions/**/*.json",
];

/**
 * Prose surfaces — skills instruct agents which commands to run, guides
 * instruct users. A dead instruction here is as live a defect as dead code:
 * `getting-started.md` advertised `/jj` for seven weeks after the skill file
 * was deleted, and nothing could see it.
 */
const PROSE_SCAN = ["apps/indusk-mcp/skills/**/*.md", "apps/docs/src/**/*.md"];

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

/**
 * jj as an *instruction* — the only shape that means residue in prose.
 *
 * A bare `/\bjj\b/` cannot be used here: `guide/context-budget.md` links to
 * `/lessons/git-or-jj-substrate`, and `-jj-` has word boundaries on both sides,
 * so the bare token flags a legitimate cross-reference to a page this plan
 * deliberately preserved. Same A1-vs-A2 tension as the code scan, one level up.
 */
const PROSE_PATTERNS = [/\bjj\s+(describe|log|new|git|status|diff|init)\b/, /`\/jj`/];

function codeFiles(): string[] {
	return globSync(CODE_SCAN, { cwd: REPO_ROOT, ignore: IGNORE, absolute: true });
}

function proseFiles(): string[] {
	return globSync(PROSE_SCAN, { cwd: REPO_ROOT, ignore: IGNORE, absolute: true });
}

/** Everything the audit inspects. A2, A8 and A11 assert on this set. */
function auditedFiles(): string[] {
	return [...codeFiles(), ...proseFiles()];
}

/** Admin files that produce user-facing text. A9 asserts on this set. */
const ADMIN_COPY_GLOBS = [
	"apps/indusk-admin/**/*.tsx",
	// markdown-export.ts generates markdown a user reads — user-facing text
	// that happens not to be JSX.
	"apps/indusk-admin/src/lib/markdown-export.ts",
];

function adminCopyFiles(): string[] {
	return globSync(ADMIN_COPY_GLOBS, {
		cwd: REPO_ROOT,
		ignore: ["**/node_modules/**", "**/.next/**", "**/*.test.tsx", "**/*.test.ts"],
		absolute: true,
	});
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
		// Patterns are module-level and reused across every scanned file. A
		// pattern carrying /g keeps `lastIndex` between calls, so the next file
		// resumes mid-string and silently reports nothing — the audit would
		// under-report without ever failing. Falsification proved it: two calls
		// with the same /g pattern returned 1 match, then 0.
		pattern.lastIndex = 0;
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
	const scans: [string[], RegExp[]][] = [
		[codeFiles(), FORBIDDEN_PATTERNS],
		[proseFiles(), PROSE_PATTERNS],
	];
	for (const [files, patterns] of scans) {
		for (const file of files) {
			for (const hit of matchesIn(readFileSync(file, "utf-8"), patterns)) {
				violations.push({ file: relative(REPO_ROOT, file), line: hit.line, text: hit.match });
			}
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
		const offenders: Violation[] = [];
		for (const file of adminCopyFiles()) {
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

	it("A8 — the audit inspects the surfaces that ship to consumers, not only .ts/.tsx", () => {
		const audited = auditedFiles().map((f) => relative(REPO_ROOT, f));

		// Hooks and skills are copied into every consumer's .claude/ directory,
		// and skills are what tell an agent which commands to run — the highest-
		// risk place for a jj instruction to reappear. Extension manifests carry
		// shell command strings. None of the three is TypeScript.
		const mustBeCovered = [
			"apps/indusk-mcp/hooks/eval-trigger.js",
			"apps/indusk-mcp/skills/work.md",
			"apps/indusk-mcp/extensions/local-telemetry/manifest.json",
			"apps/docs/src/guide/getting-started.md",
		];
		const uncovered = mustBeCovered.filter((f) => !audited.includes(f));
		expect(
			uncovered,
			`the audit cannot see these consumer-facing surfaces: ${uncovered.join(", ")}`,
		).toEqual([]);
	});

	it("A9 — the admin copy audit reaches every file that produces user-facing text", () => {
		const covered = adminCopyFiles().map((f) => relative(REPO_ROOT, f));
		// markdown-export.ts generates markdown a user reads; it is not .tsx.
		expect(covered).toContain("apps/indusk-admin/src/lib/markdown-export.ts");
	});

	it("A10 — a global-flagged pattern finds a violation in every file, not every other one", () => {
		// FORBIDDEN_PATTERNS are module-level and reused across every scanned
		// file. `exec` on a /g regex advances lastIndex, so the second file
		// silently reports nothing — the audit under-reports without failing.
		const global = /needle/g;
		const first = matchesIn("a needle here", [global]);
		const second = matchesIn("a needle here", [global]);
		expect(first).toHaveLength(1);
		expect(second, "second call missed the match — lastIndex leaked between files").toHaveLength(1);
	});

	it("A11 — the widened audit still leaves the preserved record alone", () => {
		const audited = auditedFiles().map((f) => relative(REPO_ROOT, f));
		// Ruled preserved in Build Phase 2 (changelog) and at brief time (the
		// rest). Encoded here because prose is now in scope.
		const preserved = [
			"apps/docs/src/changelog.md",
			"apps/docs/src/guide/scm.md",
			"apps/docs/src/decisions/git-or-jj-substrate.md",
			"apps/docs/src/lessons/git-or-jj-substrate.md",
			"apps/indusk-mcp/lessons/community/community-graceful-degrade-architecture-trap.md",
		];
		const leaked = preserved.filter((f) => audited.includes(f));
		expect(leaked, `audit reached preserved history: ${leaked.join(", ")}`).toEqual([]);
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
