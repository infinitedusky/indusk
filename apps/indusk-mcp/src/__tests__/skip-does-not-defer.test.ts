import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

/**
 * A15 — `.skip()` is not a way to defer a test whose subject does not exist.
 *
 * This is a **regression guard, green on arrival**, and declared as such: it
 * asserts a fact about the runner rather than about our code, so it has no red
 * phase and should not be given one.
 *
 * It exists because that fact is load-bearing. `/work` currently advises: "if
 * the test cannot yet run against a compiled symbol, use `.skip()` with a
 * comment naming the unlock phase." If module resolution precedes test
 * collection, that advice fails for exactly the case it targets — and this
 * plan corrects the guidance on the strength of that claim. A claim that
 * changes shipped instructions should be executed, not reasoned about.
 *
 * Asserts the exit code only. Deliberately not *why* it failed — classifying a
 * runner's output is the coupling `atdawn verify` refused.
 */

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe("A15 — skipping does not rescue an unresolvable import", () => {
	it("a file whose import cannot resolve fails even with every test skipped", async () => {
		const root = await mkdtemp(join(tmpdir(), "skip-defer-"));
		roots.push(root);

		// Every test skipped. The only live line is the import.
		await writeFile(
			join(root, "subject.test.ts"),
			[
				'import { describe, it } from "vitest";',
				'import { doesNotExist } from "./nowhere.js";',
				"",
				'describe("all skipped", () => {',
				'\tit.skip("never runs", () => {',
				"\t\tdoesNotExist();",
				"\t});",
				"});",
				"",
			].join("\n"),
			"utf8",
		);

		let exitCode = 0;
		try {
			await execFileAsync("npx", ["vitest", "run", "--root", root, "subject.test.ts"], {
				cwd: root,
				timeout: 60_000,
			});
		} catch (err) {
			exitCode = (err as { code?: number }).code ?? 1;
		}

		// Non-zero: the file never loaded, so skipping protected nothing.
		expect(exitCode).not.toBe(0);
	}, 120_000);
});
