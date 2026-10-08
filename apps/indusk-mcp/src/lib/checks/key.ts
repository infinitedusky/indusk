import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { gitSync } from "../bookkeeping/git.js";
import type { WorkflowSteps } from "../config.js";

/**
 * The code a slow run covers, as one key (release-checks-run-once D3): for each
 * tracked file under `release.covers` (absent: the whole repository but
 * `.indusk/`), its path, its mode and the hash of its content, sha256 over the
 * sorted lines. Content, never the commit: the bump is a commit of its own, so
 * a key on the commit would never match. The changelog is left out, and the
 * version file is read without its `version`, so the bump and its changelog
 * entry are not a change.
 *
 * `null` when there is no honest key: a covered file has an uncommitted
 * change, an untracked file sits among them, or `covers` names something that
 * lists no tracked file (A11 — a typo there would otherwise key nothing, and a
 * key over nothing is covered by every run). A run with no key is never
 * recorded and never trusted; `whyNoKey` says which it was.
 *
 * promise: slow-checks-run-once-per-tree
 */
export function codeKey(checkout: string, steps: WorkflowSteps): string | null {
	const root = topLevel(checkout);
	if (!root || whyNoKey(root, steps)) return null;
	const { covers, counted, versionFile } = coverage(steps);
	const listed = gitSync(root, "ls-files", "-s", "-z", "--", ...covers);
	if (listed.code !== 0) return null;
	const lines: string[] = [];
	for (const entry of listed.out.split("\0").filter(Boolean)) {
		// `<mode> <blob> <stage>\t<path>`
		const tab = entry.indexOf("\t");
		const path = entry.slice(tab + 1);
		if (!counted(path)) continue;
		const [mode, blob] = entry.slice(0, tab).split(" ");
		const content = path === versionFile ? withoutVersion(join(root, path)) : blob;
		lines.push(`${path}\0${mode} ${content}`);
	}
	lines.sort();
	return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/** Why `codeKey` would give no key for this checkout, or `null` when it would give one. */
export function whyNoKey(checkout: string, steps: WorkflowSteps): string | null {
	const root = topLevel(checkout);
	if (!root) return `${checkout} is not a git checkout`;
	const { covers, counted, declared } = coverage(steps);
	if (declared && covers.length === 0) return "workflow.steps.release.covers is an empty list";
	for (const entry of declared ? covers : []) {
		const files = gitSync(root, "ls-files", "-z", "--", entry);
		if (files.code !== 0 || files.out === "") {
			return `workflow.steps.release.covers names no tracked file: ${entry}`;
		}
	}
	const changed = gitSync(root, "diff", "--name-only", "HEAD", "--", ...covers);
	const untracked = gitSync(root, "ls-files", "--others", "--exclude-standard", "--", ...covers);
	if (changed.code !== 0 || untracked.code !== 0) return "git could not read the checkout";
	const dirty = `${changed.out}\n${untracked.out}`.split("\n").filter(Boolean).filter(counted);
	if (dirty.length > 0)
		return `covered files have uncommitted changes: ${dirty.slice(0, 3).join(", ")}`;
	return null;
}

function topLevel(checkout: string): string | null {
	const top = gitSync(checkout, "rev-parse", "--show-toplevel");
	return top.code === 0 ? top.out : null;
}

/** The declared paths, normalised the way git lists them, and which listed paths count. */
function coverage(steps: WorkflowSteps) {
	const release = steps.release ?? {};
	const declared = release.covers !== undefined;
	const covers = declared ? (release.covers ?? []).map(normalise) : ["."];
	const changelog = release.changelog ? normalise(release.changelog) : undefined;
	const versionFile = release.version_file ? normalise(release.version_file) : undefined;
	const counted = (path: string) => !path.startsWith(".indusk/") && path !== changelog;
	return { declared, covers, counted, versionFile };
}

/**
 * `./apps/x/`, `apps//x` and `apps/x` are one path, as `git ls-files` prints
 * it. `normalize` collapses the separators, so at most one trailing slash is
 * left; a path's rule, written here, not the Jaeger URL's (A29 pins that one).
 */
function normalise(path: string): string {
	return posix.normalize(path).replace(/^\.\//, "").replace(/\/$/, "");
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
