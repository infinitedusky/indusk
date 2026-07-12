import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureCleanupConfig, getCleanupConfig } from "../lib/config.js";

/**
 * Cleanup-ritual trajectory tests that are writable at Phase 0.
 *
 * T5  — a hand-authored `### Phase N: Cleanup` phase passes the EXISTING
 *       validate-impl-structure.js hook unchanged (proving the ritual needs no
 *       new gate type). Passes today.
 * T9  — the /cleanup skill defers to the enabled domain extensions for
 *       "what to extract". Subject (skills/cleanup.md) is authored in Phase 4;
 *       skipped until then.
 * T12 — `indusk update` adds the cleanup config block idempotently. Subject
 *       (the update migration step) is authored in Phase 1; skipped until then.
 */

const HOOK_PATH = new URL("../../hooks/validate-impl-structure.js", import.meta.url).pathname;

const CLEANUP_PHASE_IMPL = `---
title: "Fixture"
trajectory: required
rationale: required
gate_policy: ask
---

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | the extraction preserves behavior | Phase 0 | Phase 1 | planned |

## Checklist

### Phase 1: Cleanup — decompose the oversized table

- [ ] extract the Chip markup into its own component file

#### Phase 1 Verification
- [ ] T1 passes

#### Phase 1 Context
- [ ] note the new Chip component in CLAUDE.md

#### Phase 1 Document
- [ ] document the Chip component in the reference
`;

describe("cleanup-ritual T5: a Cleanup phase passes the existing hooks unchanged", () => {
	it("validate-impl-structure.js accepts `### Phase N: Cleanup` with normal gates (exit 0)", async () => {
		// A workbench-less project with otel.role: library so the OTel gate is
		// silenced — the only variable under test is the "Cleanup" phase name.
		const dir = mkdtempSync(join(tmpdir(), "cleanup-phase-"));
		mkdirSync(join(dir, ".indusk"), { recursive: true });
		writeFileSync(
			join(dir, ".indusk", "config.json"),
			JSON.stringify({ otel: { role: "library" } }),
		);
		const planDir = join(dir, ".indusk", "planning", "fixture");
		mkdirSync(planDir, { recursive: true });
		const implPath = join(planDir, "impl.md");
		writeFileSync(implPath, CLEANUP_PHASE_IMPL);

		const event = {
			tool_name: "Write",
			tool_input: { file_path: implPath, content: CLEANUP_PHASE_IMPL },
			cwd: dir,
		};
		const result = await new Promise<{ exitCode: number; stderr: string }>((resolve, reject) => {
			const child = spawn("node", [HOOK_PATH], { stdio: ["pipe", "pipe", "pipe"] });
			let stderr = "";
			child.stderr.on("data", (d) => {
				stderr += d.toString();
			});
			child.on("error", reject);
			child.on("close", (code) => resolve({ exitCode: code ?? 0, stderr }));
			child.stdin.end(JSON.stringify(event));
		});

		expect(result.stderr).not.toContain("Cleanup");
		expect(result.exitCode).toBe(0);
	});
});

describe("cleanup-ritual T9: skill defers to enabled domain extensions", () => {
	const skill = readFileSync(
		new URL("../../skills/cleanup.md", import.meta.url).pathname,
		"utf-8",
	);

	it("cleanup.md directs the agent to the enabled domain extensions for what-to-extract", () => {
		expect(skill).toMatch(/enabled domain extension/i);
		// the concrete domain idioms come from the extensions, named as examples
		expect(skill).toMatch(/nextjs/i);
		expect(skill).toMatch(/react/i);
	});

	it("cleanup.md does not hardcode framework assumptions", () => {
		expect(skill.toLowerCase()).toContain("do not hardcode");
	});
});

function cleanupProject(config: Record<string, unknown>): string {
	const dir = mkdtempSync(join(tmpdir(), "cleanup-migrate-"));
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	writeFileSync(join(dir, ".indusk", "config.json"), JSON.stringify(config, null, "\t"));
	return dir;
}

describe("cleanup-ritual T12: the update migration adds cleanup config idempotently", () => {
	it("adds the block on first run, reports already-set on re-run, preserves user content", () => {
		const dir = cleanupProject({ mode: "full", otel: { role: "library" } });

		expect(ensureCleanupConfig(dir)).toBe("added");
		expect(getCleanupConfig(dir).max_file_loc).toBe(400);

		// idempotent — second run makes no change
		expect(ensureCleanupConfig(dir)).toBe("already-set");

		// user content preserved through the migration
		const cfg = JSON.parse(readFileSync(join(dir, ".indusk", "config.json"), "utf-8"));
		expect(cfg.otel.role).toBe("library");
		expect(cfg.mode).toBe("full");
	});

	it("preserves a user-customized max_file_loc (reports already-set, never overwrites)", () => {
		const dir = cleanupProject({ mode: "full", cleanup: { max_file_loc: 250, scopes: [] } });
		expect(ensureCleanupConfig(dir)).toBe("already-set");
		expect(getCleanupConfig(dir).max_file_loc).toBe(250);
	});

	it("returns no-config when there is no .indusk/config.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "cleanup-nocfg-"));
		expect(ensureCleanupConfig(dir)).toBe("no-config");
	});
});
