// promise: one-definition-per-shared-rule
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * admin-plan-worktrees — A26–A29 (cleanup).
 *
 * The plan left four things spelled twice or tangled: two parsers of `git
 * worktree list --porcelain`, two hand-written mappings from a plan copy to its
 * report fields (the plan tools and the admin reader), a private parse of
 * `.indusk/config.json` beside the typed reader, and one module carrying the
 * record, the resolution rules and the commands. Each pin counts a definition
 * across the source, because no behavioural test can catch a divergence that
 * has not happened yet; the behaviour rows (A1–A25) cover what each unit does.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const IGNORE = ["**/*.test.ts", "**/*.test-support.ts", "**/__tests__/**"];

function libFiles(): string[] {
	return globSync("**/*.ts", { cwd: SRC_LIB, ignore: IGNORE }).sort();
}

function read(rel: string): string {
	return readFileSync(join(REPO_ROOT, rel), "utf-8");
}

/** Lines matching `pattern` in each lib file, comment lines excluded. */
function hits(pattern: RegExp): string[] {
	const out: string[] = [];
	for (const file of libFiles()) {
		const lines = readFileSync(join(SRC_LIB, file), "utf-8").split("\n");
		lines.forEach((line, i) => {
			const code = line.trim();
			if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) return;
			if (pattern.test(line)) out.push(`${file}:${i + 1}`);
		});
	}
	return out;
}

describe("A26 — one parser of `git worktree list --porcelain`", () => {
	it("reads the `worktree <path>` lines in exactly one place, lib/git.ts, exported as parseWorktreeList", () => {
		const parsers = hits(/"worktree "|\^worktree\\s/);
		expect(parsers, parsers.join("\n")).toHaveLength(1);
		expect(parsers[0]).toMatch(/^git\.ts:/);
		expect(read("apps/indusk-mcp/src/lib/git.ts")).toMatch(/export function parseWorktreeList\(/);
	});

	it("decision.ts classifies trunk vs worktree through it", () => {
		expect(read("apps/indusk-mcp/src/lib/worktree/decision.ts")).toMatch(/parseWorktreeList/);
	});
});

describe("A27 — one derivation of where a plan was read from", () => {
	it("copySource is defined once, in the resolver", () => {
		const defs = hits(/export function copySource\(/);
		expect(defs, defs.join("\n")).toEqual([
			expect.stringMatching(/^worktree\/plan-worktrees\.ts:/),
		]);
	});

	it("the plan tools and the admin reader use it and map no copy by hand", () => {
		for (const rel of [
			"apps/indusk-mcp/src/tools/plan-tools.ts",
			"apps/indusk-admin/src/lib/planning-reader.ts",
		]) {
			const text = read(rel);
			expect(text, rel).toMatch(/copySource/);
			expect(text, rel).not.toMatch(/copy\.archivedInWorktree|copy\.problem\b/);
		}
	});
});

describe("A28 — the trunk-branch list is read by lib/config.ts", () => {
	it("getTrunkBranches is defined once, in config.ts", () => {
		const defs = hits(/export function getTrunkBranches\(/);
		expect(defs, defs.join("\n")).toEqual([expect.stringMatching(/^config\.ts:/)]);
	});

	it("no plan-worktree module parses .indusk/config.json itself", () => {
		const own = hits(/config\.json/).filter((h) => /^worktree\/plan-worktree/.test(h));
		expect(own, own.join("\n")).toEqual([]);
	});
});

describe("A29 — the record lives in one module", () => {
	it("the record's file name is spelled once, in plan-worktree-record.ts", () => {
		const names = hits(/indusk-plan-worktrees\.json/);
		expect(names, names.join("\n")).toEqual([
			expect.stringMatching(/^worktree\/plan-worktree-record\.ts:/),
		]);
	});

	it("only the record module takes the record lock or writes the record", () => {
		const writers = hits(/withLock\(|renameSync\(/).filter((h) =>
			/^worktree\/plan-worktree/.test(h),
		);
		expect(writers.length, writers.join("\n")).toBeGreaterThan(0);
		for (const h of writers) expect(h).toMatch(/^worktree\/plan-worktree-record\.ts:/);
	});
});
