import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../../__tests__/helpers/test-git.js";
import { codeKey } from "./key.js";

/**
 * release-checks-run-once — A11, A12, A14, found by falsification: the ways a
 * declared `covers`, `changelog` or `version_file` can quietly defeat the key.
 *
 * promise: slow-checks-run-once-per-tree
 */

let root: string;
beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "code-key-")));
	git(root, ["init", "-q", "-b", "main"]);
	mkdirSync(join(root, "apps"));
	writeFileSync(join(root, "apps", "code.js"), "export const a = 1;\n");
	writeFileSync(join(root, "run.sh"), "echo hi\n");
	writeFileSync(join(root, "package.json"), '{\n  "name": "p",\n  "version": "1.0.0"\n}\n');
	writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n");
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "init"]);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("A11 — a `covers` that lists no tracked file gives no key", () => {
	it("a typo'd entry: no key, never a key over nothing", () => {
		expect(codeKey(root, { release: { covers: ["app"] } })).toBeNull();
	});
	it("an entry that is fine beside one that is not: still no key", () => {
		expect(codeKey(root, { release: { covers: ["apps", "pakages"] } })).toBeNull();
	});
	it("an empty list: no key", () => {
		expect(codeKey(root, { release: { covers: [] } })).toBeNull();
	});
	it("a list that covers files: a key", () => {
		expect(codeKey(root, { release: { covers: ["apps"] } })).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("A12 — a changelog or version file declared with a `./` prefix is still recognised", () => {
	it("the bump does not change the key", () => {
		const steps = { release: { version_file: "./package.json", changelog: "./CHANGELOG.md" } };
		const before = codeKey(root, steps);
		writeFileSync(join(root, "package.json"), '{\n  "name": "p",\n  "version": "1.1.0"\n}\n');
		writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n## [1.1.0]\n");
		git(root, ["commit", "-q", "-am", "chore(release): 1.1.0"]);
		expect(codeKey(root, steps)).toBe(before);
	});
});

describe("A14 — a covered script's executable bit is part of the key", () => {
	it("chmod +x changes the key", () => {
		const before = codeKey(root, {});
		expect(before).not.toBeNull();
		// Both the file and the index, so the tree stays clean and the key is computed.
		chmodSync(join(root, "run.sh"), 0o755);
		git(root, ["update-index", "--chmod=+x", "run.sh"]);
		git(root, ["commit", "-q", "-m", "run.sh is executable"]);
		const after = codeKey(root, {});
		expect(after).not.toBeNull();
		expect(after).not.toBe(before);
	});
});
