import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * release-checks-run-once — A8, A9: a project's landing and release steps are
 * its own. `indusk checks show` names what it declares under
 * `workflow.steps`, and says plainly what not declaring means.
 *
 * promise: landing-and-release-name-the-projects-commands
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function project(config: object): string {
	const root = mkdtempSync(join(tmpdir(), "checks-show-"));
	dirs.push(root);
	mkdirSync(join(root, ".indusk"));
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify(config));
	git(root, ["init", "-q", "-b", "main"]);
	return root;
}

describe.skipIf(SHOULD_SKIP)("indusk checks show", () => {
	it("A8: names back the slow tests, the release command, the version file and the changelog a project declares", () => {
		const root = project({
			workflow: {
				steps: {
					land: { slow_tests: "pytest -m slow" },
					release: {
						command: "fly deploy",
						version_file: "pyproject.toml",
						changelog: "CHANGES.md",
					},
				},
			},
		});
		const r = runCli(root, ["checks", "show"]);
		expect(r.code, r.stderr).toBe(0);
		for (const declared of ["pytest -m slow", "fly deploy", "pyproject.toml", "CHANGES.md"]) {
			expect(r.stdout).toContain(declared);
		}
	});

	it("A9: a project that declares none is told landing runs no slow tests and release has nothing to publish", () => {
		const root = project({});
		const r = runCli(root, ["checks", "show"]);
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout).toMatch(/no slow tests/i);
		expect(r.stdout).toMatch(/nothing to publish/i);
		expect(r.stdout).not.toMatch(/pnpm|test:system/);
	});

	// A13, found by falsification: a value that is not a fact is refused naming
	// the key (ADR D5) — in one line, with exit 2, not under a stack trace.
	it("A13: a value that is not a command, a path or a name is refused in one line naming the key, exit 2", () => {
		const root = project({ workflow: { steps: { release: { covers: "apps" } } } });
		for (const args of [
			["checks", "show"],
			["checks", "slow"],
		]) {
			const r = runCli(root, args);
			expect(r.code, `${args.join(" ")}: ${r.stderr}`).toBe(2);
			expect(r.stderr).toContain("workflow.steps.release.covers");
			expect(r.stderr, "a stack trace").not.toMatch(/\n\s+at /);
		}
	});
});
