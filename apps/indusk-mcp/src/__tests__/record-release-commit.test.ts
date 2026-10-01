import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { git, headOf, initRepoWithCommit } from "./helpers/test-git.js";

/**
 * release-ritual — T11: the release note names the release commit.
 *
 * `record-release.js` runs after `pnpm publish` and appends a line to
 * `.indusk/current.md`'s shared region. It labelled `git rev-parse HEAD` the
 * release commit, so the 1.54.0 note credited `d7e0061a` — a plan commit five
 * publish attempts had moved HEAD to — instead of `b185e375`.
 *
 * Driven over the boundary: the real script is copied into a fixture monorepo
 * whose `dist/` links to this package's build, and run as a process. The
 * fixture commits once more after the release commit — where the two coincide,
 * the old behaviour is indistinguishable from the right one.
 */

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function fixture(): { root: string; fixturePkg: string } {
	const root = mkdtempSync(join(tmpdir(), "record-release-"));
	roots.push(root);
	initRepoWithCommit(root);
	const fixturePkg = join(root, "apps", "indusk-mcp");
	mkdirSync(join(fixturePkg, "scripts"), { recursive: true });
	mkdirSync(join(root, ".indusk"), { recursive: true });
	copyFileSync(
		join(pkgDir, "scripts", "record-release.js"),
		join(fixturePkg, "scripts", "record-release.js"),
	);
	symlinkSync(join(pkgDir, "dist"), join(fixturePkg, "dist"));
	writeFileSync(join(root, ".gitignore"), "apps/indusk-mcp/dist\n");
	writeFileSync(
		join(root, ".indusk", "current.md"),
		"# Operational State\n\n## Project (shared)\n\n- an existing note\n\n---\n",
	);
	writeFileSync(join(fixturePkg, "package.json"), '{"name":"p","version":"9.9.9"}\n');
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "chore(release): 9.9.9 — the bump"]);
	return { root, fixturePkg };
}

describe("T11 — the release note names the release commit, not HEAD", () => {
	it("credits the chore(release) commit when HEAD has moved past it", () => {
		const { root, fixturePkg } = fixture();
		const release = headOf(root).slice(0, 7);
		writeFileSync(join(root, ".indusk", "notes.md"), "moved on\n");
		git(root, ["add", "-A"]);
		git(root, ["commit", "-q", "-m", "plan(x): a commit after the release"]);
		const head = headOf(root).slice(0, 7);
		expect(head, "the fixture must separate HEAD from the release commit").not.toBe(release);

		const r = spawnSync("node", [join("scripts", "record-release.js")], {
			cwd: fixturePkg,
			encoding: "utf-8",
		});
		expect(r.status, r.stderr).toBe(0);

		const note = readFileSync(join(root, ".indusk", "current.md"), "utf-8")
			.split("\n")
			.find((l) => l.includes("9.9.9 published"));
		expect(note, "the script must append a note for the version").toBeDefined();
		expect(note).toContain(release);
		expect(note).not.toContain(head);
	});
});
