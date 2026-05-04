import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeConfig } from "../config.js";
import { NoScmDetectedError, detectScm, getScm } from "./detect.js";

/**
 * Unit tests for `detectScm()` and `getScm()`.
 *
 * `detectScm` is async — it shells out to jj/git. Tested against real tmpdirs
 * with actual `git init` / `jj git init`. Skipped on machines without the
 * relevant binary on PATH (graceful — CI must have at least git).
 *
 * `getScm` is sync — it reads `.indusk/config.json`. Tested by writing the
 * config file directly.
 */

let projectDir: string;

beforeEach(() => {
	projectDir = mkdtempSync(join(tmpdir(), "scm-detect-"));
});

afterEach(() => {
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
});

function pathWithoutJj(): string {
	const which = spawnSync("which", ["jj"], { encoding: "utf-8" });
	if (which.status !== 0) return process.env.PATH ?? "";
	const jjDir = dirname(which.stdout.trim());
	return (process.env.PATH ?? "")
		.split(":")
		.filter((p) => p !== jjDir)
		.join(":");
}

const HAS_JJ = spawnSync("which", ["jj"]).status === 0;
const HAS_GIT = spawnSync("which", ["git"]).status === 0;

describe("detectScm", () => {
	it.skipIf(!HAS_GIT)("returns 'git' for a plain git repo (no jj)", async () => {
		const init = spawnSync("git", ["init", "-q"], { cwd: projectDir });
		expect(init.status).toBe(0);
		// Force jj off PATH so detection cannot pick it up
		const originalPath = process.env.PATH;
		process.env.PATH = pathWithoutJj();
		try {
			const scm = await detectScm(projectDir);
			expect(scm).toBe("git");
		} finally {
			process.env.PATH = originalPath;
		}
	});

	it.skipIf(!HAS_JJ)("returns 'jj' for a colocated jj+git repo", async () => {
		const init = spawnSync("jj", ["git", "init"], { cwd: projectDir });
		expect(init.status).toBe(0);
		const scm = await detectScm(projectDir);
		expect(scm).toBe("jj");
	});

	it("throws NoScmDetectedError when neither jj nor git is initialized", async () => {
		// Bare tmpdir with no SCM
		await expect(detectScm(projectDir)).rejects.toThrow(NoScmDetectedError);
	});
});

describe("getScm", () => {
	it("returns 'git' when config has scm: 'git'", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			scm: "git",
		});
		expect(getScm(projectDir)).toBe("git");
	});

	it("returns 'jj' when config has scm: 'jj'", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			scm: "jj",
		});
		expect(getScm(projectDir)).toBe("jj");
	});

	it("defaults to 'jj' when scm field is missing (pre-1.28.x project)", () => {
		writeConfig(projectDir, { mode: "full", verify: {}, detected: {} });
		expect(getScm(projectDir)).toBe("jj");
	});

	it("defaults to 'jj' when config doesn't exist (no .indusk dir)", () => {
		expect(getScm(projectDir)).toBe("jj");
	});

	it("treats unexpected scm values as the jj default (forward-compat)", () => {
		// Hand-edit a malformed value into config.json
		const path = join(projectDir, ".indusk/config.json");
		const dir = join(projectDir, ".indusk");
		spawnSync("mkdir", ["-p", dir]);
		writeFileSync(path, JSON.stringify({ mode: "full", verify: {}, detected: {}, scm: "fossil" }, null, 2));
		expect(getScm(projectDir)).toBe("jj");
	});
});
