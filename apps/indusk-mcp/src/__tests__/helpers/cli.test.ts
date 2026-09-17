import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./cli.js";

/**
 * admin-ui-phase-progress — A31 (falsification).
 *
 * `runCli` spread `process.env` and set no `INDUSK_HOME`, so every suite that
 * spawned a registering command had to remember the pin — and the seven fixed
 * in Build Phase 6 used `??=`, which yields to a developer who exports
 * `INDUSK_HOME` in their shell. The helper is the one place every CLI-spawning
 * suite already goes through, so it pins a fresh temp home by default; an
 * explicit `env.INDUSK_HOME` from the caller still wins.
 */

let shellHome: string;
let project: string;
let saved: string | undefined;

beforeEach(() => {
	shellHome = mkdtempSync(join(tmpdir(), "shell-home-"));
	project = mkdtempSync(join(tmpdir(), "cli-helper-proj-"));
	saved = process.env.INDUSK_HOME;
	// The developer's shell exports INDUSK_HOME — the case `??=` cannot protect.
	process.env.INDUSK_HOME = shellHome;
});

afterEach(() => {
	if (saved === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = saved;
	rmSync(shellHome, { recursive: true, force: true });
	rmSync(project, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("A31 — runCli never writes the developer's registry", () => {
	it("init through the helper with no explicit INDUSK_HOME leaves the exported home untouched", () => {
		const r = runCli(project, ["init", "--local", "--no-index"]);
		expect(r.code, r.stderr).toBe(0);
		expect(
			existsSync(join(shellHome, "projects.json")),
			"the exported INDUSK_HOME received a registry",
		).toBe(false);
	});

	it("an explicit env.INDUSK_HOME from the caller is honoured", () => {
		const explicit = mkdtempSync(join(tmpdir(), "explicit-home-"));
		try {
			const r = runCli(project, ["init", "--local", "--no-index"], { INDUSK_HOME: explicit });
			expect(r.code, r.stderr).toBe(0);
			expect(existsSync(join(explicit, "projects.json"))).toBe(true);
		} finally {
			rmSync(explicit, { recursive: true, force: true });
		}
	});
});
