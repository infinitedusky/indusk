import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addProject } from "../lib/admin/registry.js";

/**
 * T16 — Bare `indusk ui` from inside a registered project's directory
 * opens the browser to `/p/{this-project}/` (cwd-aware). From outside any
 * registered project, opens to `/`.
 *
 * The daemon always serves `/` in the same way; what changes is the URL
 * the CLI invokes `open`/`xdg-open` against. We assert on stdout — uiStart
 * prints `Opening ${url}` with the computed URL so this test can verify
 * the branch without mocking the browser opener.
 *
 * SLOW — each case boots the daemon (~5s). Skipped when SKIP_SLOW_TESTS=1.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1";

let testHome: string;
let testProject: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
	testProject = mkdtempSync(join(tmpdir(), "t16-proj-"));
	mkdirSync(join(testProject, ".indusk"), { recursive: true });
});

afterEach(() => {
	if (existsSync(join(testHome, "admin-ui.pid"))) {
		spawnSync("node", [CLI_BIN, "ui", "stop"], {
			env: { ...process.env, INDUSK_HOME: testHome },
			encoding: "utf-8",
		});
	}
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(testProject)) rmSync(testProject, { recursive: true, force: true });
});

function runCli(
	args: string[],
	opts: { cwd?: string } = {},
): { code: number; stdout: string; stderr: string } {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		env: { ...process.env, INDUSK_HOME: testHome },
		cwd: opts.cwd ?? process.cwd(),
		encoding: "utf-8",
	});
	return {
		code: result.status ?? -1,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

describe("T16 — bare `indusk ui` is cwd-aware", () => {
	it.skipIf(SHOULD_SKIP)(
		"from inside a registered project, opens /p/{name}/",
		async () => {
			// Register the project under a known name
			process.env.INDUSK_HOME = testHome;
			try {
				const entry = addProject(testProject);
				const result = runCli(
					["ui", "--no-open", "--port", "0"],
					{ cwd: testProject },
				);
				await new Promise((r) => setTimeout(r, 6000));
				expect(result.stdout).toContain(`/p/${entry.name}/`);
			} finally {
				delete process.env.INDUSK_HOME;
			}
		},
		30_000,
	);

	it.skipIf(SHOULD_SKIP)(
		"from an unregistered directory, opens /",
		async () => {
			const unregistered = mkdtempSync(join(tmpdir(), "t16-unreg-"));
			try {
				const result = runCli(
					["ui", "--no-open", "--port", "0"],
					{ cwd: unregistered },
				);
				await new Promise((r) => setTimeout(r, 6000));
				// Must print the bare localhost URL WITHOUT a /p/ prefix
				expect(result.stdout).toMatch(/http:\/\/localhost:\d+\/\s/);
				expect(result.stdout).not.toMatch(/\/p\//);
			} finally {
				if (existsSync(unregistered)) {
					rmSync(unregistered, { recursive: true, force: true });
				}
			}
		},
		30_000,
	);
});
