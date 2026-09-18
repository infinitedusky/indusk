import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
 * carries `promise: <name>`), and binary files. A code root that is not a
 * git repository throws, so the caller refuses rather than reporting an
 * empty scan as clean.
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

/** Every tracked or untracked-but-not-ignored file under the code root that the scan reads. */
export async function scannableFiles(codeRoot: string): Promise<string[]> {
	const out = await git(codeRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z");
	return out
		.split("\0")
		.map((f) => f.trim())
		.filter((f) => f !== "")
		.filter((f) => !PROSE_EXTENSIONS.has(extensionOf(f)))
		.filter((f) => !f.startsWith(`${PROMISES_REL_DIR}/`) && !f.startsWith(".indusk/"))
		.sort();
}

/** name → files that carry its token, across the code root. */
export async function citedNames(codeRoot: string): Promise<Map<string, string[]>> {
	const cited = new Map<string, string[]>();
	for (const rel of await scannableFiles(codeRoot)) {
		const abs = join(codeRoot, rel);
		if (!existsSync(abs) || !statSync(abs).isFile()) continue;
		const buf = readFileSync(abs);
		if (looksBinary(buf)) continue;
		const text = buf.toString("utf-8");
		const pattern = anyPromiseTokenPattern();
		for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
			const name = m[1];
			const files = cited.get(name) ?? [];
			if (!files.includes(rel)) files.push(rel);
			cited.set(name, files);
		}
	}
	return cited;
}
