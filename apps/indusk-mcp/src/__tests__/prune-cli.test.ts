import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Phase 2 of context-budget. CLI integration tests for `indusk prune`.
 *
 * T6: prune CLI invokes measureProjectContext and prints the report; --dry-run
 *     is the default; no file modifications
 * T7: --help lists --dry-run as default + states "no destructive action in this version"
 * T8: against a bloated CLAUDE.md (one section > 4000 chars), prints the
 *     section name + recommended cleanup
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const INDUSK_BIN = resolve(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

function runIndusk(
	args: string[],
	cwd: string,
): { stdout: string; stderr: string; status: number | null } {
	const r = spawnSync("node", [INDUSK_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		timeout: 15000,
	});
	return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function writeInduskProject(projectRoot: string, claudeMdSections?: Record<string, string>): void {
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
	writeFileSync(join(projectRoot, ".indusk/config.json"), JSON.stringify({ project_name: "test" }));
	if (claudeMdSections) {
		const body = [
			"# Test — CLAUDE.md",
			"",
			...Object.entries(claudeMdSections).flatMap(([t, c]) => [`## ${t}`, "", c, ""]),
		].join("\n");
		writeFileSync(join(projectRoot, "CLAUDE.md"), body);
	}
}

describe("Phase 2: indusk prune CLI", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "prune-cli-"));
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	describe("T6: prune CLI invokes measureProjectContext and prints the report", () => {
		it("runs against a clean project, exits 0, prints report sections, makes no file changes", () => {
			writeInduskProject(tmpRoot, {
				"What This Is": "small",
				Architecture: "small",
			});

			const before = readFileChecksums(tmpRoot);
			const r = runIndusk(["prune"], tmpRoot);
			const after = readFileChecksums(tmpRoot);

			expect(r.status, r.stderr).toBe(0);
			expect(r.stdout).toContain("[indusk prune --dry-run]");
			expect(r.stdout).toContain("CLAUDE.md sections:");
			expect(r.stdout).toContain("Lessons");
			expect(r.stdout).toContain("Summary:");
			// No file changes
			expect(after).toEqual(before);
		});
	});

	describe("T7: --help documents the default mode + 'no destructive action' disclaimer", () => {
		it("indusk prune --help mentions --dry-run as default and 'no destructive action'", () => {
			const r = runIndusk(["prune", "--help"], tmpRoot);
			expect(r.status).toBe(0);
			const out = r.stdout + r.stderr;
			expect(out).toMatch(/--dry-run/);
			expect(out).toMatch(/default|only mode/i);
			expect(out).toMatch(/no destructive action/i);
		});
	});

	describe("T8: bloated CLAUDE.md surfaces the offender + recommended cleanup", () => {
		it("flags an oversized Current State section with a recommendation", () => {
			const bigBody = "x".repeat(5000);
			writeInduskProject(tmpRoot, {
				"What This Is": "small",
				"Current State": bigBody,
			});

			const r = runIndusk(["prune"], tmpRoot);

			expect(r.status, r.stderr).toBe(0);
			expect(r.stdout).toContain("Current State");
			expect(r.stdout).toMatch(/⚠/);
			expect(r.stdout).toMatch(/collapse|distill|one-line/i);
			expect(r.stdout).toContain("context-budget");
		});
	});
});

function readFileChecksums(root: string): Map<string, number> {
	const sums = new Map<string, number>();
	const fs = require("node:fs") as typeof import("node:fs");
	function walk(dir: string): void {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name === ".git") continue;
				walk(full);
			} else if (entry.isFile()) {
				const stat = fs.statSync(full);
				sums.set(full, stat.mtimeMs);
			}
		}
	}
	walk(root);
	return sums;
}
