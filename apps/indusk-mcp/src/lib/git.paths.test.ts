import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { git as gitCli } from "../__tests__/helpers/cli.js";
import { restorePaths, snapshotPaths } from "./git.js";

/**
 * A31 (writing-skill cleanup): `restorePaths` puts back exactly what
 * `snapshotPaths` took — a tracked path's prior content, an untracked path's
 * absence, a staged rename's old name — and leaves nothing staged. The
 * publish step's rollback depends on all three; A28 proves it from outside,
 * this proves the primitive on its own.
 */
describe("snapshotPaths / restorePaths (A31)", () => {
	it("restores content, absence, and a staged rename, with nothing left staged", async () => {
		const root = mkdtempSync(join(tmpdir(), "git-paths-"));
		gitCli(root, ["init", "-q", "-b", "main"]);
		writeFileSync(join(root, "a.md"), "A1\n");
		writeFileSync(join(root, "c.md"), "C1\n");
		gitCli(root, ["add", "-A"]);
		gitCli(root, ["commit", "-q", "-m", "base"]);

		const taken = snapshotPaths(root, ["a.md", "b.md", "c.md", "d.md"]);
		expect([...taken.entries()]).toEqual([
			["a.md", "A1\n"],
			["b.md", null],
			["c.md", "C1\n"],
			["d.md", null],
		]);

		// A tracked change staged, an untracked file created, a rename staged.
		writeFileSync(join(root, "a.md"), "A2\n");
		gitCli(root, ["add", "a.md"]);
		writeFileSync(join(root, "b.md"), "B\n");
		gitCli(root, ["mv", "c.md", "d.md"]);
		expect(gitCli(root, ["status", "--porcelain"]).stdout.trim()).not.toBe("");

		await restorePaths(root, taken);

		expect(readFileSync(join(root, "a.md"), "utf-8")).toBe("A1\n");
		expect(existsSync(join(root, "b.md"))).toBe(false);
		expect(readFileSync(join(root, "c.md"), "utf-8")).toBe("C1\n");
		expect(existsSync(join(root, "d.md"))).toBe(false);
		expect(gitCli(root, ["status", "--porcelain"]).stdout.trim()).toBe("");
	}, 30_000);
});
