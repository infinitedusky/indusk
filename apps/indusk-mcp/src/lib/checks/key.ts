import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gitSync } from "../bookkeeping/git.js";
import type { WorkflowSteps } from "../config.js";

/**
 * The code a slow run covers, as one key (release-checks-run-once D3): for each
 * tracked file under `release.covers` (absent: the whole repository but
 * `.indusk/`), its path and the hash of its content, sha256 over the sorted
 * lines. Content, never the commit: the bump is a commit of its own, so a key
 * on the commit would never match. The changelog is left out, and the version
 * file is read without its `version`, so the bump and its changelog entry are
 * not a change.
 *
 * `null` when a covered file has an uncommitted change or an untracked file
 * sits among them: a run over that tree proves nothing about any commit, so it
 * is never recorded and never trusted.
 *
 * promise: slow-checks-run-once-per-tree
 */
export function codeKey(checkout: string, steps: WorkflowSteps): string | null {
	const top = gitSync(checkout, "rev-parse", "--show-toplevel");
	if (top.code !== 0) return null;
	const root = top.out;
	const release = steps.release ?? {};
	const covers = release.covers?.length ? release.covers : ["."];
	const counted = (path: string) => !path.startsWith(".indusk/") && path !== release.changelog;

	// Changed (staged or not) and untracked paths, bare: `status --porcelain`'s
	// prefix is unsafe here, since the runner trims the first entry's leading space.
	const changed = gitSync(root, "diff", "--name-only", "HEAD", "--", ...covers);
	const untracked = gitSync(root, "ls-files", "--others", "--exclude-standard", "--", ...covers);
	if (changed.code !== 0 || untracked.code !== 0) return null;
	const dirty = `${changed.out}\n${untracked.out}`.split("\n").filter(Boolean);
	if (dirty.some(counted)) return null;

	const listed = gitSync(root, "ls-files", "-s", "-z", "--", ...covers);
	if (listed.code !== 0) return null;
	const lines: string[] = [];
	for (const entry of listed.out.split("\0").filter(Boolean)) {
		// `<mode> <blob> <stage>\t<path>`
		const tab = entry.indexOf("\t");
		const path = entry.slice(tab + 1);
		if (!counted(path)) continue;
		const blob = entry.slice(0, tab).split(" ")[1];
		const content = path === release.version_file ? withoutVersion(join(root, path)) : blob;
		lines.push(`${path}\0${content}`);
	}
	lines.sort();
	return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/** The version file's content hash with its `version` taken out: a JSON field, or the first `version` line. */
function withoutVersion(path: string): string {
	const text = readFileSync(path, "utf-8");
	let rest: string;
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		delete parsed.version;
		rest = JSON.stringify(parsed);
	} catch {
		rest = text.replace(/^\s*version\s*[=:].*$/m, "");
	}
	return createHash("sha256").update(rest).digest("hex");
}
