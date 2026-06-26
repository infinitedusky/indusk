import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAgentsDir, getPresenceFilePath, resolveProjectRoot } from "../paths.js";

/**
 * Path-resolution tests for the multi-agent presence bulletin.
 *
 * These are not on the formal trajectory — they cover the supporting walk-up
 * + path-join helpers that T9 and the Phase 2 CLI build on top of.
 */
describe("getAgentsDir / getPresenceFilePath", () => {
	it("returns <projectRoot>/.indusk/agents/", () => {
		expect(getAgentsDir("/tmp/myproj")).toBe("/tmp/myproj/.indusk/agents");
	});

	it("returns <projectRoot>/.indusk/agents/<sessionId>.md", () => {
		expect(getPresenceFilePath("/tmp/myproj", "abc-123")).toBe(
			"/tmp/myproj/.indusk/agents/abc-123.md",
		);
	});
});

describe("resolveProjectRoot — walk-up from subdirectories", () => {
	let projectDir: string;

	beforeEach(() => {
		projectDir = mkdtempSync(join(tmpdir(), "agents-paths-"));
		mkdirSync(join(projectDir, ".indusk"), { recursive: true });
		writeFileSync(join(projectDir, ".indusk/config.json"), "{}");
	});

	afterEach(() => {
		rmSync(projectDir, { recursive: true, force: true });
	});

	it("finds the root when called from the root directly", () => {
		expect(resolveProjectRoot(projectDir)).toBe(projectDir);
	});

	it("finds the root when called from a deep subdirectory", () => {
		const deep = join(projectDir, "apps/some-app/src/lib");
		mkdirSync(deep, { recursive: true });
		expect(resolveProjectRoot(deep)).toBe(projectDir);
	});

	it("returns null when no .indusk/config.json exists up the chain", () => {
		const orphan = mkdtempSync(join(tmpdir(), "agents-orphan-"));
		try {
			expect(resolveProjectRoot(orphan)).toBeNull();
		} finally {
			rmSync(orphan, { recursive: true, force: true });
		}
	});

	it("normalizes the returned path (no trailing slash, resolved)", () => {
		const noisy = join(projectDir, "./apps/../apps/some-app");
		mkdirSync(noisy, { recursive: true });
		const root = resolveProjectRoot(noisy);
		expect(root).not.toBeNull();
		expect(resolvePath(root as string)).toBe(resolvePath(projectDir));
	});
});
