import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * workbench-trust-fixes A16 — the record no longer asserts a dead invariant.
 *
 * "The workbench root is deliberately not a git repo" was true until 1.37.0
 * and is stated, as present-tense fact, in CLAUDE.md, seven docs pages, one
 * skill, and three code comments. Historical records (decisions, lessons,
 * archives, the changelog, plan folders) are exempt for the same reason
 * `scm-rip-out-grep` exempts them: an audit that fires on the archive gets
 * switched off.
 *
 * Whole-file scan, case-insensitive, over the living record only.
 */

const REPO_ROOT = resolve(new URL("../../../../", import.meta.url).pathname);
const PATTERN = /not a git repo/i;

const EXEMPT = [
	/\/decisions\//,
	/\/lessons\//,
	/\/archive\//,
	/changelog\.md$/,
	/\/\.vitepress\//,
	/\/strategy\//,
	/\/dawn\//,
	/node_modules/,
];

function walk(dir: string, keep: (p: string) => boolean): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (EXEMPT.some((re) => re.test(`${p}/`))) continue;
		if (entry.isDirectory()) out.push(...walk(p, keep));
		else if (keep(p)) out.push(p);
	}
	return out;
}

function livingRecord(): string[] {
	const md = (p: string) => p.endsWith(".md");
	const js = (p: string) => /\.(js|ts)$/.test(p) && !/\.test\.ts$/.test(p);
	return [
		join(REPO_ROOT, "CLAUDE.md"),
		...walk(join(REPO_ROOT, "apps/indusk-mcp/skills"), md),
		...walk(join(REPO_ROOT, "apps/docs/src"), md),
		...walk(join(REPO_ROOT, "apps/indusk-mcp/hooks"), js),
		...walk(join(REPO_ROOT, "apps/indusk-mcp/src"), js),
	].filter((p) => statSync(p).isFile());
}

describe("A16 — no living document says the workbench root is not a git repo", () => {
	it("finds zero matches outside the historical record", () => {
		const hits = livingRecord()
			.filter((p) => PATTERN.test(readFileSync(p, "utf-8")))
			.map((p) => relative(REPO_ROOT, p));
		expect(hits, `still asserting the dead invariant:\n  ${hits.join("\n  ")}`).toEqual([]);
	});
});
