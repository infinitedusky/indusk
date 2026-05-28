import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeConfig } from "../config.js";
import { getCurrentChangeId, getReachableChangeIds } from "./index.js";

/**
 * Integration tests for the SCM-aware change-ID and ancestry helpers.
 *
 * Both functions branch on `getScm(projectRoot)`:
 * - `"jj"` → delegates to `lib/semantic-graph/jj.ts` (covered separately by jj.test.ts)
 * - `"git"` → uses git binaries directly
 *
 * These tests focus on the git branch — the jj branch is already covered by
 * the existing `lib/semantic-graph/jj.test.ts` unit tests.
 */

const HAS_GIT = spawnSync("which", ["git"]).status === 0;

let projectDir: string;

beforeEach(() => {
	projectDir = mkdtempSync(join(tmpdir(), "scm-index-"));
});

afterEach(() => {
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
});

function gitInitWithCommit(): string {
	expect(spawnSync("git", ["init", "-q"], { cwd: projectDir }).status).toBe(0);
	spawnSync("git", ["config", "user.email", "test@test.invalid"], {
		cwd: projectDir,
	});
	spawnSync("git", ["config", "user.name", "Test"], { cwd: projectDir });
	const commit = spawnSync("git", ["commit", "--allow-empty", "-q", "-m", "initial"], {
		cwd: projectDir,
	});
	expect(commit.status).toBe(0);
	const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
		cwd: projectDir,
		encoding: "utf-8",
	});
	expect(sha.status).toBe(0);
	return sha.stdout.trim();
}

describe.skipIf(!HAS_GIT)("getCurrentChangeId — git mode", () => {
	it("returns short SHA when scm is 'git' and there's a HEAD", async () => {
		const expected = gitInitWithCommit();
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			scm: "git",
		});
		const id = await getCurrentChangeId(projectDir);
		expect(id).toBe(expected);
		expect(id).toMatch(/^[a-f0-9]+$/);
	});
});

describe.skipIf(!HAS_GIT)("getReachableChangeIds — git mode", () => {
	it("returns the full ancestor set as a Set of short SHAs", async () => {
		const sha1 = gitInitWithCommit();
		spawnSync("git", ["commit", "--allow-empty", "-q", "-m", "second"], {
			cwd: projectDir,
		});
		const sha2 = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
			cwd: projectDir,
			encoding: "utf-8",
		}).stdout.trim();

		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			scm: "git",
		});
		const reachable = await getReachableChangeIds(projectDir);
		expect(reachable.has(sha1)).toBe(true);
		expect(reachable.has(sha2)).toBe(true);
		expect(reachable.size).toBe(2);
	});

	it("returns empty set when there are no commits yet", async () => {
		spawnSync("git", ["init", "-q"], { cwd: projectDir });
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			scm: "git",
		});
		const reachable = await getReachableChangeIds(projectDir);
		expect(reachable.size).toBe(0);
	});
});
