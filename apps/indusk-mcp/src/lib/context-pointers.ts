/**
 * CLAUDE.md pointer-integrity walker (indusk-makeover Phase 2).
 *
 * The 60 KB budget works by compressing every entry to a rule sentence plus a
 * pointer (docs page, decision page, archived plan doc). A dead pointer under
 * that regime means a lost rule body — so pointer integrity is a first-class
 * check (`indusk context check-pointers`, trajectory row A3).
 *
 * Path-shaped references are extracted from CLAUDE.md and verified against
 * disk. Globs and `{placeholder}` paths are documentation, not pointers, and
 * are skipped.
 *
 * The walker also refuses hand-copied version claims. A `**Version**:` line
 * carrying a literal semver is a copy of `package.json` that nothing in the
 * release flow updates — dusk's said "1.36.0 published" for twelve days and
 * four releases while npm served 1.40.3. A literal that matches today passes
 * and fails at the next bump, which is exactly when it becomes a lie; a
 * literal with no `package.json` version to check against is unverifiable and
 * fails outright. The safe resting state is a pointer, not a number.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { LESSONS_REL_DIR } from "./lessons/state.js";
import { anyTokenPattern } from "./tokens.js";
import { readWorkbenchRepos, repoDir, resolveReposRoot } from "./worktree/repos.js";

/** Directory prefixes that count as pointers when they appear in CLAUDE.md. */
const POINTER_PREFIXES = ["\\.indusk", "apps", "docker", "packages", "\\.claude"];

const POINTER_RE = new RegExp(
	`(?:^|[\\s(\`\\[])((?:${POINTER_PREFIXES.join("|")})/[A-Za-z0-9_\\-./]+)`,
	"gm",
);

/** A line that states the project's version. Only these lines are version-checked. */
const VERSION_LINE_RE = /^\s*(?:[-*]\s*)?\*\*Version\*\*\s*:/i;

const SEMVER_RE = /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/g;

export interface VersionClaim {
	/** 1-indexed line number in the scanned content. */
	line: number;
	/** The literal semver found on a `**Version**:` line. */
	claim: string;
	/** `mismatch` against package.json, or `unverifiable` when it has no version. */
	problem: "mismatch" | "unverifiable";
	/** The authoritative `package.json` version, when one exists. */
	actual?: string;
}

export interface PointerReport {
	/** Every distinct path-shaped reference found. */
	scanned: string[];
	/** The subset that does not resolve on disk. */
	dead: string[];
	/** Version literals on `**Version**:` lines that are wrong or uncheckable. */
	versionClaims: VersionClaim[];
}

function packageVersion(projectRoot: string): string | null {
	try {
		const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
		return typeof pkg.version === "string" ? pkg.version : null;
	} catch {
		return null;
	}
}

/** Scan a CLAUDE.md content string for path pointers and verify them against `projectRoot`. */
export function checkPointers(content: string, projectRoot: string): PointerReport {
	const seen = new Set<string>();
	for (const m of content.matchAll(POINTER_RE)) {
		// strip trailing punctuation the greedy char class can capture
		const p = m[1].replace(/[.,;:)\]`]+$/, "");
		seen.add(p);
	}
	const scanned = [...seen].sort();
	const dead: string[] = [];
	for (const p of scanned) {
		if (p.includes("*") || p.includes("{")) continue; // glob/placeholder — documentation, not a pointer
		if (!existsSync(join(projectRoot, p))) dead.push(p);
	}
	// A `lesson: <name>` token is a pointer too (context-tiers): under the tiers
	// a rule's body lives behind it, in `.claude/lessons/<name>.md`.
	const lessonRe = anyTokenPattern("lesson");
	for (let m = lessonRe.exec(content); m !== null; m = lessonRe.exec(content)) {
		const pointer = `lesson: ${m[1]}`;
		if (scanned.includes(pointer)) continue;
		scanned.push(pointer);
		if (!existsSync(join(projectRoot, LESSONS_REL_DIR, `${m[1]}.md`))) dead.push(pointer);
	}
	scanned.sort();

	const versionClaims: VersionClaim[] = [];
	const actual = packageVersion(projectRoot);
	const lines = content.split("\n");
	for (let i = 0; i < lines.length; i++) {
		if (!VERSION_LINE_RE.test(lines[i])) continue;
		for (const m of lines[i].matchAll(SEMVER_RE)) {
			if (actual === null) {
				versionClaims.push({ line: i + 1, claim: m[0], problem: "unverifiable" });
			} else if (m[0] !== actual) {
				versionClaims.push({ line: i + 1, claim: m[0], problem: "mismatch", actual });
			}
			// A matching literal passes today — and fails here at the next bump.
		}
	}

	return { scanned, dead, versionClaims };
}

/** Walk `<projectRoot>/CLAUDE.md`. Returns null when the file doesn't exist. */
export function checkClaudeMdPointers(projectRoot: string): PointerReport | null {
	const claudeMdPath = join(projectRoot, "CLAUDE.md");
	if (!existsSync(claudeMdPath)) return null;
	return checkPointers(readFileSync(claudeMdPath, "utf-8"), projectRoot);
}

export interface ContextFileReport extends PointerReport {
	/** Path of the context file, relative to the repository that holds it. */
	file: string;
	/** The declared repo holding the file, in a workbench; absent for the project root. */
	repo?: string;
}

/**
 * Every context file git knows about, root first: the root `CLAUDE.md` and
 * each nested one (context-tiers). Outside a git repository, the root alone.
 */
export function contextFiles(projectRoot: string): string[] {
	let tracked: string[] = [];
	try {
		tracked = execFileSync(
			"git",
			["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "ignore"],
			},
		)
			.split("\0")
			.filter((f) => f !== "" && basename(f) === "CLAUDE.md");
	} catch {
		tracked = existsSync(join(projectRoot, "CLAUDE.md")) ? ["CLAUDE.md"] : [];
	}
	return tracked.sort((a, b) =>
		a === "CLAUDE.md" ? -1 : b === "CLAUDE.md" ? 1 : a.localeCompare(b),
	);
}

/**
 * Walk every context file. Pointers in a nested file resolve against the
 * root of the repository holding it, as they do in that repository's root
 * file: a rule names `apps/x/y.ts` wherever it lives. In a workbench that is
 * the workbench root and each declared repo — the code repo's files are
 * ignored by the workbench's git, so walking the wrapper alone printed PASS
 * over files it never opened (context-tiers A22). Null when there is no
 * context file at all.
 */
export function checkAllContextPointers(projectRoot: string): ContextFileReport[] | null {
	const reposRoot = resolveReposRoot(projectRoot);
	const roots: { dir: string; repo?: string }[] = [
		{ dir: projectRoot },
		...readWorkbenchRepos(projectRoot).map((r) => ({
			dir: join(reposRoot, repoDir(r)),
			repo: r.name,
		})),
	];
	const reports: ContextFileReport[] = roots.flatMap(({ dir, repo }) =>
		contextFiles(dir).map((file) => ({
			file,
			...(repo ? { repo } : {}),
			...checkPointers(readFileSync(join(dir, file), "utf-8"), dir),
		})),
	);
	if (reports.length === 0) return null;
	const current = currentMdVersionClaims(projectRoot);
	if (current) reports.push(current);
	return reports;
}

/**
 * The version-claim rule followed the operational section out of the root
 * (context-tiers): `.indusk/current.md`'s shared region is where "what is
 * published" is written now, and a literal version there is the same copy
 * nothing updates. Only the shared region, only version claims — the session
 * sections are operational notes whose paths may rightly be stale.
 */
function currentMdVersionClaims(projectRoot: string): ContextFileReport | null {
	const file = ".indusk/current.md";
	const path = join(projectRoot, file);
	if (!existsSync(path)) return null;
	const text = readFileSync(path, "utf-8");
	const start = text.indexOf("## Project (shared)");
	if (start < 0) return null;
	const end = text.indexOf("\n---", start);
	const shared = text.slice(start, end < 0 ? undefined : end);
	const { versionClaims } = checkPointers(shared, projectRoot);
	// Line numbers are relative to the file, not the slice.
	const offset = text.slice(0, start).split("\n").length - 1;
	return {
		file,
		scanned: [],
		dead: [],
		versionClaims: versionClaims.map((v) => ({ ...v, line: v.line + offset })),
	};
}
