import { describe, expect, it } from "vitest";

/**
 * T12 — Validator surfaces malformed `.indusk/worktree-configs/<repo>.json`
 * with errors that NAME the offending field. Stack traces don't count;
 * the user needs to know which key is wrong.
 *
 * Three malformation classes covered:
 *  1. Missing required field
 *  2. Wrong type
 *  3. Unknown top-level key
 *
 * Each produces a `{ valid: false, errors: [...] }` result with at least
 * one entry whose `field` (or message) references the offending key.
 *
 * Plus one valid-config case to prove the validator accepts good input —
 * this is the foundation T11 ("worktree list status badges") relies on
 * at Phase 6.
 */

import {
	validateWorktreeConfig,
	type WorktreeConfigValidationError,
} from "../lib/worktree/validate-config.js";

const VALID_CONFIG = {
	trunk_branch: "main",
	base_branch: "main",
	copy_files: [],
	append_files: [],
	apply_commits: [],
	preflight: [],
	preflight_env: {},
	compose_project_name: "wt-demo-repo",
};

function findFieldRef(errors: WorktreeConfigValidationError[], needle: string): boolean {
	return errors.some((e) => (e.field ?? "").includes(needle) || (e.message ?? "").includes(needle));
}

describe("worktree config validator", () => {
	it("accepts a well-formed config", () => {
		const result = validateWorktreeConfig(VALID_CONFIG);
		expect(result.valid, JSON.stringify(result, null, 2)).toBe(true);
	});

	it("T12: missing required field — error names the missing field", () => {
		const { trunk_branch: _omitted, ...badConfig } = VALID_CONFIG;
		const result = validateWorktreeConfig(badConfig);
		expect(result.valid).toBe(false);
		if (result.valid) return;
		expect(findFieldRef(result.errors, "trunk_branch")).toBe(true);
	});

	it("T12: wrong type — error names the type-mismatched field", () => {
		const badConfig = { ...VALID_CONFIG, copy_files: "not-an-array" };
		const result = validateWorktreeConfig(badConfig);
		expect(result.valid).toBe(false);
		if (result.valid) return;
		expect(findFieldRef(result.errors, "copy_files")).toBe(true);
	});

	it("T12: unknown top-level key — error names the unknown key", () => {
		const badConfig = { ...VALID_CONFIG, mystery_field: "unexpected" };
		const result = validateWorktreeConfig(badConfig);
		expect(result.valid).toBe(false);
		if (result.valid) return;
		expect(findFieldRef(result.errors, "mystery_field")).toBe(true);
	});

	it("returns a stable shape — never throws on garbage input", () => {
		const garbage: unknown[] = [null, undefined, 42, "string", [], { foo: 1 }];
		for (const g of garbage) {
			expect(() => validateWorktreeConfig(g)).not.toThrow();
			const result = validateWorktreeConfig(g);
			expect(typeof result.valid).toBe("boolean");
		}
	});
});
