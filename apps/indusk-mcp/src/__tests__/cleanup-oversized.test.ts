import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { listOversizedChangedFiles } from "../lib/cleanup/oversized.js";

/**
 * Cleanup-ritual Phase 2 — the file-flagging lib. `listOversizedChangedFiles`
 * diffs the working branch against its merge-base, counts LOC, and returns the
 * changed files over their resolved cap.
 *
 * T6 — a file inside a tighter scope is flagged at the scope cap; the same size
 *      outside every scope is judged against the global default (not flagged).
 * T8 — only files changed vs the merge-base are considered; an over-threshold
 *      untouched legacy file is never flagged.
 */

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function makeRepo(cleanup: Record<string, unknown>): string {
	const dir = mkdtempSync(join(tmpdir(), "cleanup-oversized-"));
	git(dir, "init", "-b", "main");
	git(dir, "config", "user.email", "t@example.com");
	git(dir, "config", "user.name", "Test");
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	writeFileSync(join(dir, ".indusk", "config.json"), JSON.stringify({ cleanup }));
	return dir;
}

function writeLines(dir: string, rel: string, n: number): void {
	const p = join(dir, rel);
	mkdirSync(dirname(p), { recursive: true });
	writeFileSync(p, `${Array.from({ length: n }, (_, i) => `line ${i}`).join("\n")}\n`);
}

describe("cleanup-ritual T6: per-scope threshold resolution", () => {
	it("flags a 300-line file inside a 200-cap scope but not the same size outside every scope", () => {
		const dir = makeRepo({
			max_file_loc: 400,
			scopes: [{ include: "packages/*/src/components/**", max_file_loc: 200 }],
		});
		writeLines(dir, "README.md", 1);
		git(dir, "add", "-A");
		git(dir, "commit", "-m", "base");

		git(dir, "checkout", "-b", "feature");
		writeLines(dir, "packages/ui/src/components/Big.tsx", 300); // inside scope, 300 > 200
		writeLines(dir, "apps/web/util.ts", 300); // outside scope, 300 < 400
		git(dir, "add", "-A");
		git(dir, "commit", "-m", "changes");

		const flagged = listOversizedChangedFiles(dir, "main");
		const paths = flagged.map((f) => f.path);
		expect(paths).toContain("packages/ui/src/components/Big.tsx");
		expect(paths).not.toContain("apps/web/util.ts");

		const big = flagged.find((f) => f.path.endsWith("Big.tsx"));
		expect(big?.cap).toBe(200);
		expect(big?.loc).toBe(300);
		expect(big?.isNew).toBe(true);
	});
});

describe("cleanup-ritual T8: only merge-base-changed files are considered", () => {
	it("never flags an over-threshold file that the branch did not touch", () => {
		const dir = makeRepo({ max_file_loc: 400, scopes: [] });
		writeLines(dir, "legacy/huge.ts", 800); // 800 > 400, but committed at base
		git(dir, "add", "-A");
		git(dir, "commit", "-m", "base with huge legacy file");

		git(dir, "checkout", "-b", "feature");
		writeLines(dir, "small.ts", 10); // the only change, under cap
		git(dir, "add", "-A");
		git(dir, "commit", "-m", "small change");

		const flagged = listOversizedChangedFiles(dir, "main");
		expect(flagged.map((f) => f.path)).not.toContain("legacy/huge.ts");
		expect(flagged).toEqual([]);
	});
});
