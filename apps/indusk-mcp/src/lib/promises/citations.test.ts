import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { citedNames } from "./citations.js";

/**
 * promise: the-demo-app-starts-with-its-promise-holding — demo-app-template,
 * found building the seat-holds example. A folder with its own
 * `.indusk/config.json` is another InDusk project, with its own registry: the
 * repository around it does not read its promise tokens as its own. Without
 * this, InDusk's own check refused the example's promise as unknown.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "citations-"));
	roots.push(root);
	for (const [rel, body] of Object.entries(files)) {
		mkdirSync(join(root, rel, ".."), { recursive: true });
		writeFileSync(join(root, rel), body);
	}
	execFileSync("git", ["init", "-q"], { cwd: root });
	return root;
}

describe("a nested InDusk project is its own", () => {
	it("its files are not read for the outer repository's tokens", async () => {
		const root = repo({
			"src/a.ts": "// promise: outer-one\n",
			"examples/demo/.indusk/config.json": "{}\n",
			"examples/demo/src/b.ts": "// promise: inner-one\n",
		});
		const cited = await citedNames(root);
		expect([...cited.keys()]).toContain("outer-one");
		expect([...cited.keys()]).not.toContain("inner-one");
	});

	it("a folder without its own config is still read", async () => {
		const root = repo({
			"src/a.ts": "// promise: outer-one\n",
			"examples/plain/src/b.ts": "// promise: inner-one\n",
		});
		expect([...(await citedNames(root)).keys()]).toContain("inner-one");
	});
});
