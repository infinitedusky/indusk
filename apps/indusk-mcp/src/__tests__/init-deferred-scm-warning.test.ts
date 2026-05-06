import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T18 — `indusk init` warns the user when neither jj nor git is detected.
 *
 * RED AT PHASE 7 START. Today init silently omits the `scm` field when
 * `detectScm()` throws `NoScmDetectedError`; the user has no signal that
 * `getScm()` will silently default to `"jj"` until they run `indusk update`
 * after initializing the SCM. They might never realize they need to.
 *
 * Goes green after H5 — init prints a stderr block naming the recovery
 * command (`indusk update` after `git init`/`jj git init`).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;
let projectDir: string;

function pathStripped(): string {
	// Strip both jj and git from PATH so detectScm definitely throws.
	const which = (cmd: string) => {
		const r = spawnSync("which", [cmd], { encoding: "utf-8" });
		return r.status === 0 ? dirname(r.stdout.trim()) : null;
	};
	const jjDir = which("jj");
	const gitDir = which("git");
	return (process.env.PATH ?? "")
		.split(":")
		.filter((p) => p !== jjDir && p !== gitDir)
		.join(":");
}

function runCli(args: string[]): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		cwd: projectDir,
		env: {
			...process.env,
			PATH: pathStripped(),
			INDUSK_HOME: testHome,
			INDUSK_BIN: `node ${CLI_BIN}`,
			INDUSK_SKIP_SELF_UPDATE: "1",
		},
		encoding: "utf-8",
	});
	return {
		code: result.status ?? 0,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "init-deferred-scm-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "init-deferred-scm-proj-"));
	writeFileSync(
		join(projectDir, "package.json"),
		JSON.stringify({ name: "init-deferred-scm-smoke", version: "0.0.0" }, null, 2),
	);
	// Deliberately do NOT run `git init` or `jj git init` — we want detectScm to throw.
});

afterEach(() => {
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	if (existsSync(projectDir))
		rmSync(projectDir, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("indusk init deferred-SCM warning (T18)", { timeout: 60000 }, () => {
	it("prints a STDERR warning block (not just an inline stdout note) naming the recovery command", () => {
		const result = runCli(["init", "--no-index"]);
		// Init should still succeed — we don't want a hard failure when the
		// user's environment has no SCM yet (tests, bare tmpdirs, projects-in-progress).
		expect(result.code, `init failed: ${result.stderr}`).toBe(0);

		// The warning MUST land on stderr specifically — not buried as an
		// inline parenthetical in the [Config] stdout output (where it's
		// trivially missed). Pre-Phase-7 init wrote a `mode: full, scm:
		// deferred — ...` note via console.info to stdout; H5 requires a
		// distinct stderr-bound warning block.
		expect(result.stderr).toMatch(/indusk update/i);
		expect(result.stderr).toMatch(/(deferred|neither jj nor git|scm field)/i);

		// And the warning must include a visible marker — `⚠`, `warning`, or
		// `WARN` — so it's recognizable as an alert, not buried prose.
		expect(result.stderr).toMatch(/(⚠|\bwarn(ing)?\b)/i);
	});
});
