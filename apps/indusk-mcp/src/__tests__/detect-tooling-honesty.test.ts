import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * An undetected test runner is recorded as absent, not guessed.
 *
 * `detected.testRunner ?? "vitest"` asserted vitest for every project where
 * detection found nothing — including Python ones, which detection cannot see at
 * all. That is a fallback standing in for a fact we do not have, and this
 * project has a lesson forbidding exactly it.
 *
 * It is worse than an absent value because `/verify` acts on it: it invokes a
 * runner that is not installed and reports the failure as the project's, not as
 * a bad guess. Absent means verify skips a check it has no basis for.
 */

let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
	root = mkdtempSync(join(tmpdir(), "detect-"));
	for (const [rel, body] of Object.entries(files)) {
		const p = join(root, rel);
		mkdirSync(join(p, ".."), { recursive: true });
		writeFileSync(p, body);
	}
	git(root, ["init", "-q", "-b", "main"]);
	git(root, ["add", "-A"]);
	git(root, ["commit", "-qm", "init"]);
	return root;
}

function verifyBlock(dir: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(dir, ".indusk", "config.json"), "utf-8")).verify ?? {};
}

describe.skipIf(SHOULD_SKIP || !existsSync(CLI_BIN))("init records what it detected", () => {
	it("omits the test runner when it detected none, rather than asserting vitest", {
		timeout: 90_000,
	}, () => {
		// A Python project: nothing detection looks for is present.
		const dir = project({
			"pyproject.toml": "[tool.pytest.ini_options]\ntestpaths = ['tests']\n",
			"main.py": "print('hi')\n",
		});
		expect(runCli(dir, ["init", "--local", "--no-index"]).code).toBe(0);

		const v = verifyBlock(dir);
		expect(
			v.testRunner,
			"a project with no detectable JS runner must not claim vitest",
		).toBeUndefined();
	});

	it("still records the runner it did detect", { timeout: 90_000 }, () => {
		// The paired positive — without it, "omit everything" would pass above.
		const dir = project({
			"vitest.config.ts": "export default {};\n",
			"package.json": '{"name":"x","version":"0.0.0"}\n',
		});
		expect(runCli(dir, ["init", "--local", "--no-index"]).code).toBe(0);
		expect((verifyBlock(dir).testRunner as { tool?: string })?.tool).toBe("vitest");
	});
});
