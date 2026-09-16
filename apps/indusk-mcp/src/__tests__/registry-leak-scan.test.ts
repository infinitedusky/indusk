import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * admin-ui-phase-progress — A22.
 *
 * `init`, `update`, `setup` (which delegates to `init`) and `ui` write
 * `${INDUSK_HOME ?? ~/.indusk}/projects.json`.
 * A test that spawns one of them without setting `INDUSK_HOME` registers its
 * temp directory in the developer's real registry — which is how it reached
 * 1,588 entries, 1,577 of them dead. A one-time prune (`indusk ui prune`)
 * clears the backlog; this scan closes the leak: every test file that spawns
 * one of those commands must set `INDUSK_HOME`.
 *
 * Grep-based, like `component-reuse-audit`: simple beats clever until it is
 * wrong. It looks for the CLI-spawn shapes the suites use — `runCli(cwd,
 * ["init", …])`, `[CLI_BIN, "update", …]`, `cli.js", "ui"` — and the presence
 * of `INDUSK_HOME` anywhere in the same file.
 */

const SPAWN_SHAPES: RegExp[] = [
	/runCli\(\s*[^,]+,\s*\[\s*"(init|update|ui|setup)"/,
	/\[\s*CLI_BIN\s*,\s*"(init|update|ui|setup)"/,
	/cli\.js"?\s*,\s*"(init|update|ui|setup)"/,
	/CLI_BIN\s*,\s*"(init|update|ui|setup)"/,
];

function testFiles(): string[] {
	// `nodir`: the admin's screenshot baselines live in directories NAMED like
	// test files (`__screenshots__/X.test.tsx/`), and reading one is EISDIR.
	return globSync("apps/*/src/**/*.test.{ts,tsx}", {
		cwd: REPO_ROOT,
		absolute: true,
		nodir: true,
		ignore: ["**/node_modules/**"],
	}).sort();
}

describe("A31 — the scan recognizes every registering command", () => {
	it("a `setup` spawn is a registering spawn: setup delegates to init", () => {
		const fixture = 'const r = runCli(dir, ["setup", target]);';
		expect(
			SPAWN_SHAPES.some((re) => re.test(fixture)),
			"setup registers the project through init and must be scanned like init",
		).toBe(true);
	});
});

describe("A22 — no test writes the developer's real registry", () => {
	it("every test that spawns init, update or ui sets INDUSK_HOME", () => {
		const self = __filename;
		const offenders = testFiles()
			.filter((f) => f !== self)
			.filter((f) => {
				const source = readFileSync(f, "utf-8");
				const spawns = SPAWN_SHAPES.some((re) => re.test(source));
				return spawns && !/INDUSK_HOME/.test(source);
			})
			.map((f) => relative(REPO_ROOT, f));
		expect(offenders, "these tests spawn a registry-writing command without INDUSK_HOME").toEqual(
			[],
		);
	});
});
