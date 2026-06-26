import { describe, expect, it } from "vitest";
import { CLAUDE_CODE_SESSION_ENV_VAR, getSessionId, sanitizeSessionId } from "../session.js";

/**
 * T9 from the handoff-multi-agent trajectory:
 *   "On a system where Claude Code's session ID env var is unset, agent
 *    registration still works and uses a stable per-session identifier."
 *
 * Tests both branches of `getSessionId`:
 *   - env-var-present: returns the value verbatim
 *   - env-var-absent: falls back to a stable `pid-<n>` identifier
 *
 * The `env` and `pid` parameters of `getSessionId` exist precisely to make
 * these branches testable without mutating `process.env`.
 */
describe("getSessionId — handoff-multi-agent T9", () => {
	it("returns the env-var value when CLAUDE_CODE_SESSION_ID is set", () => {
		const env = { [CLAUDE_CODE_SESSION_ENV_VAR]: "abc-123-uuid" };
		expect(getSessionId(env)).toBe("abc-123-uuid");
	});

	it("trims surrounding whitespace from the env-var value", () => {
		const env = { [CLAUDE_CODE_SESSION_ENV_VAR]: "  spaced-id  " };
		expect(getSessionId(env)).toBe("spaced-id");
	});

	it("falls back to pid-<n> when env var is unset (T9 primary assertion)", () => {
		const env: NodeJS.ProcessEnv = {};
		expect(getSessionId(env, 4242)).toBe("pid-4242");
	});

	it("falls back to pid-<n> when env var is the empty string", () => {
		const env = { [CLAUDE_CODE_SESSION_ENV_VAR]: "" };
		expect(getSessionId(env, 99)).toBe("pid-99");
	});

	it("falls back to pid-<n> when env var is whitespace-only", () => {
		const env = { [CLAUDE_CODE_SESSION_ENV_VAR]: "   " };
		expect(getSessionId(env, 7)).toBe("pid-7");
	});

	it("the same env/pid input yields the same identifier across calls (stability)", () => {
		const env = { [CLAUDE_CODE_SESSION_ENV_VAR]: "stable" };
		expect(getSessionId(env)).toBe(getSessionId(env));
		const env2: NodeJS.ProcessEnv = {};
		expect(getSessionId(env2, 1234)).toBe(getSessionId(env2, 1234));
	});

	// Phase 6 falsification fix — getSessionId routes through sanitizeSessionId
	it("throws when env var contains '..' (path traversal)", () => {
		const env = { [CLAUDE_CODE_SESSION_ENV_VAR]: "../escaped" };
		expect(() => getSessionId(env)).toThrow(/path-traversal|invalid/i);
	});

	it("throws when env var contains '/' or '\\\\'", () => {
		expect(() => getSessionId({ [CLAUDE_CODE_SESSION_ENV_VAR]: "a/b" })).toThrow();
		expect(() => getSessionId({ [CLAUDE_CODE_SESSION_ENV_VAR]: "a\\b" })).toThrow();
	});

	it("throws when env var starts with '.' (hidden-file / dotdot prefix)", () => {
		expect(() => getSessionId({ [CLAUDE_CODE_SESSION_ENV_VAR]: ".hidden" })).toThrow();
	});
});

// Phase 6 falsification fix — direct unit tests for sanitizeSessionId helper
describe("sanitizeSessionId — handoff-multi-agent T12 (falsification)", () => {
	it("accepts a UUID v4", () => {
		expect(sanitizeSessionId("2c87e7b6-702a-4dcd-876f-a31820e0df3e")).toBe(
			"2c87e7b6-702a-4dcd-876f-a31820e0df3e",
		);
	});

	it("accepts pid-<n> fallback identifiers", () => {
		expect(sanitizeSessionId("pid-1234")).toBe("pid-1234");
	});

	it("accepts alphanumeric + underscore + dash", () => {
		expect(sanitizeSessionId("abc_def-123")).toBe("abc_def-123");
	});

	it("trims surrounding whitespace before validation", () => {
		expect(sanitizeSessionId("  uuid  ")).toBe("uuid");
	});

	it("rejects empty input", () => {
		expect(() => sanitizeSessionId("")).toThrow(/empty/i);
		expect(() => sanitizeSessionId("   ")).toThrow(/empty/i);
	});

	it("rejects '..' anywhere in the id", () => {
		expect(() => sanitizeSessionId("..")).toThrow(/path-traversal|invalid/i);
		expect(() => sanitizeSessionId("foo..bar")).toThrow();
		expect(() => sanitizeSessionId("../escape")).toThrow();
		expect(() => sanitizeSessionId("foo/../bar")).toThrow();
	});

	it("rejects '/' and '\\\\' anywhere in the id", () => {
		expect(() => sanitizeSessionId("a/b")).toThrow();
		expect(() => sanitizeSessionId("a\\b")).toThrow();
		expect(() => sanitizeSessionId("/etc/passwd")).toThrow();
	});

	it("rejects leading '.'", () => {
		expect(() => sanitizeSessionId(".hidden")).toThrow(/leading.*\.|invalid/i);
		expect(() => sanitizeSessionId(".gitignore")).toThrow();
	});

	it("rejects input longer than 128 characters", () => {
		const tooLong = "a".repeat(129);
		expect(() => sanitizeSessionId(tooLong)).toThrow(/exceeds|invalid/i);
		// boundary: exactly 128 is accepted
		const justRight = "a".repeat(128);
		expect(sanitizeSessionId(justRight)).toBe(justRight);
	});
});
