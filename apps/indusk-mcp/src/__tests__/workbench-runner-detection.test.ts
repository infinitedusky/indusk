import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	commitFile,
	oneRepoAtPath,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * dawn-workbench-execution — A16 (falsification).
 *
 * Tooling detection ran once at `init`, against the project root. In a
 * workbench that is the wrapper, which holds no `vitest.config.ts`, so
 * `verify.testRunner` was never written — and a split verify without a runner
 * reports every row unverified under a clean verdict. Every fixture in this
 * plan set `verify.testCommand` by hand, which is how the gap stayed hidden.
 * Detection now runs over the declared repos, the way the health checks do,
 * and `update` writes the runner for a workbench that predates the fix.
 */

let wb: VersionedWorkbench | null = null;
let home: string;
afterEach(() => {
	wb?.cleanup();
	wb = null;
});

function config(root: string): {
	verify?: { testRunner?: { tool?: string }; testCommand?: string };
} {
	return JSON.parse(readFileSync(join(root, ".indusk", "config.json"), "utf-8"));
}

describe.skipIf(SHOULD_SKIP)("A16 — the runner is detected from the declared code repo", () => {
	it("update records verify.testRunner (vitest) from the code repo's config file", {
		timeout: 90_000,
	}, () => {
		wb = oneRepoAtPath("nested");
		home = mkdtempSync(join(tmpdir(), "runner-detect-home-"));
		const code = wb.repos[0].dir;
		commitFile(
			code,
			"package.json",
			'{"name":"alpha","version":"0.0.0","devDependencies":{"vitest":"^4"}}\n',
			"pkg",
		);
		commitFile(code, "vitest.config.ts", "export default {};\n", "vitest config");
		expect(
			config(wb.root).verify?.testRunner,
			"fixture must start without a runner",
		).toBeUndefined();

		const r = runCli(wb.root, ["update"], { INDUSK_HOME: home, INDUSK_SKIP_SELF_UPDATE: "1" });
		expect(r.code, `update failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

		expect(config(wb.root).verify?.testRunner?.tool).toBe("vitest");
	});

	it("update leaves an explicit verify.testCommand alone and writes no runner beside it", {
		timeout: 90_000,
	}, () => {
		wb = oneRepoAtPath("nested");
		home = mkdtempSync(join(tmpdir(), "runner-detect-home-"));
		const code = wb.repos[0].dir;
		commitFile(code, "vitest.config.ts", "export default {};\n", "vitest config");
		const configPath = join(wb.root, ".indusk", "config.json");
		const before = JSON.parse(readFileSync(configPath, "utf-8"));
		before.verify = { testCommand: "node --test" };
		writeFileSync(configPath, `${JSON.stringify(before, null, 2)}\n`);
		mkdirSync(join(wb.root, ".claude"), { recursive: true });

		const r = runCli(wb.root, ["update"], { INDUSK_HOME: home, INDUSK_SKIP_SELF_UPDATE: "1" });
		expect(r.code, `update failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

		const after = config(wb.root);
		expect(after.verify?.testCommand).toBe("node --test");
		expect(after.verify?.testRunner).toBeUndefined();
	});
});
