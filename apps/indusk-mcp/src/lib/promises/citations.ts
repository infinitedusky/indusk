import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { git } from "../git.js";
import { anyPromiseTokenPattern, PROMISES_REL_DIR } from "./vocabulary.js";

/**
 * The reverse scan: which promise names does the code root cite, and where?
 * (day-promises cleanup, A33.)
 *
 * Three concerns, three modules — `registry.ts` reads the registry,
 * this file scans the code root, `check.ts` judges the two against each
 * other. The scan reads every file git knows about or would add
 * (`ls-files --cached --others --exclude-standard`), except prose (a guide or
 * a plan document mentions names in examples and is never a code site),
 * everything under `.indusk/` (the registry's own incident frontmatter
 * carries `promise: <name>`), and binary files. The promise scan also leaves
 * out the hooks this package installed under `.claude/hooks/`: they are the
 * package's files, and name the promises of the repository that ships them.
 * A code root that is not a git repository throws, so the caller refuses
 * rather than reporting an empty scan as clean.
 */

/** Files the reverse scan never reads: prose mentions names; code sites and tests are not prose. */
export const PROSE_EXTENSIONS: ReadonlySet<string> = new Set([".md", ".mdx", ".txt", ".rst"]);

function looksBinary(buf: Buffer): boolean {
	const head = buf.subarray(0, 8192);
	return head.includes(0);
}

function extensionOf(file: string): string {
	const base = file.slice(file.lastIndexOf("/") + 1);
	const dot = base.lastIndexOf(".");
	return dot < 0 ? "" : base.slice(dot);
}

const INSTALLED_HOOKS_DIR = ".claude/hooks/";

/**
 * The hook files this package installs into a project. A project's own hook
 * in the same folder is still read: only these names are the package's.
 * Found by planner-promises' live check, where a new project's first
 * `promises check` failed on `check-gates.js`.
 *
 * Only the promise scan skips them. The lesson scan must not: an installed
 * hook is the enforcer that delivers its lesson, in every project.
 */
function packageHookFiles(): ReadonlySet<string> {
	// `src/lib/promises/` and `dist/lib/promises/` are the same depth below the package root.
	const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks");
	return new Set(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".js")) : []);
}

const NESTED_PROJECT_CONFIG = /^(.+)\/\.indusk\/config\.json$/;

/**
 * Every tracked or untracked-but-not-ignored file under the code root that the
 * scan reads. A folder holding its own `.indusk/config.json` is another InDusk
 * project with its own registry (the seat-holds example in InDusk's
 * repository, demo-app-template), so nothing under it is read here.
 */
export async function scannableFiles(codeRoot: string): Promise<string[]> {
	const out = await git(codeRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z");
	const files = out
		.split("\0")
		.map((f) => f.trim())
		.filter((f) => f !== "");
	const nested = files.flatMap((f) => NESTED_PROJECT_CONFIG.exec(f)?.[1] ?? []).map((d) => `${d}/`);
	return files
		.filter((f) => !nested.some((d) => f.startsWith(d)))
		.filter((f) => !PROSE_EXTENSIONS.has(extensionOf(f)))
		.filter((f) => !f.startsWith(`${PROMISES_REL_DIR}/`) && !f.startsWith(".indusk/"))
		.sort();
}

/** name → files that carry its promise token, across the code root. */
export async function citedNames(codeRoot: string): Promise<Map<string, string[]>> {
	const installed = packageHookFiles();
	return await citedTokens(
		codeRoot,
		anyPromiseTokenPattern,
		(rel) =>
			rel.startsWith(INSTALLED_HOOKS_DIR) && installed.has(rel.slice(INSTALLED_HOOKS_DIR.length)),
	);
}

/**
 * name → files that carry a token the pattern matches, across the code root.
 * The one scan loop: promises read it with their pattern, lessons with theirs
 * (`lib/lessons/state.ts`), so the file set and the binary rule cannot drift.
 */
export async function citedTokens(
	codeRoot: string,
	pattern: () => RegExp,
	/** Files this scan leaves out, by code-root-relative path. */
	skip: (rel: string) => boolean = () => false,
): Promise<Map<string, string[]>> {
	const cited = new Map<string, string[]>();
	for (const rel of await scannableFiles(codeRoot)) {
		if (skip(rel)) continue;
		const abs = join(codeRoot, rel);
		if (!existsSync(abs) || !statSync(abs).isFile()) continue;
		const buf = readFileSync(abs);
		if (looksBinary(buf)) continue;
		const text = buf.toString("utf-8");
		const re = pattern();
		for (let m = re.exec(text); m !== null; m = re.exec(text)) {
			const name = m[1];
			const files = cited.get(name) ?? [];
			if (!files.includes(rel)) files.push(rel);
			cited.set(name, files);
		}
	}
	return cited;
}
