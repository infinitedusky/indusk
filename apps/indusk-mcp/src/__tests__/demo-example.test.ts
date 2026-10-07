import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: the-demo-app-starts-with-its-promise-holding — demo-app-template A3.
 *
 * The seat-holds example ships with one promise of its own. A fresh copy of it,
 * in a repository of its own as `indusk demo` makes it (the registry check
 * reads files through git), is a project whose registry InDusk accepts: its
 * promise is there, enforced, with the test and the code site that keep it.
 */

const EXAMPLE = join(REPO_ROOT, "examples", "seat-holds");
const PROMISE = "a-held-seat-is-released-in-time";

const copies: string[] = [];
afterEach(() => {
	for (const d of copies.splice(0)) rmSync(d, { recursive: true, force: true });
});

function freshCopy(): string {
	const dir = mkdtempSync(join(tmpdir(), "seat-holds-copy-"));
	copies.push(dir);
	cpSync(EXAMPLE, dir, {
		recursive: true,
		filter: (src) => !src.includes("node_modules"),
	});
	git(dir, ["init", "-q"]);
	return dir;
}

describe.skipIf(SHOULD_SKIP)("A3 — a fresh copy of the example carries its promise", () => {
	it("the example exists to be copied", () => {
		expect(existsSync(EXAMPLE), `${EXAMPLE} is the example to copy`).toBe(true);
	});

	it("its registry check passes, with its promises enforced", () => {
		const dir = freshCopy();
		const check = runCli(dir, ["promises", "check"]);
		expect(check.code, check.stderr || check.stdout).toBe(0);
		expect(check.stdout).toMatch(/\b2 promises\b/);
		expect(check.stdout).toMatch(/enforced 2\b/);
		expect(existsSync(join(dir, ".indusk", "promises", `${PROMISE}.md`))).toBe(true);
	});
});
