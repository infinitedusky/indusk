import { describe, expect, it } from "vitest";
import { CLAUDE_CODE_SESSION_ENV_VAR, getSessionId } from "../session.js";

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
});
