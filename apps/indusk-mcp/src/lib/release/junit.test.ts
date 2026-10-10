import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { failedFiles } from "./junit.js";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

const report = (file: string) =>
	`<testsuites><testsuite name="${file}"><testcase classname="${file}" name="t"><failure/></testcase></testsuite></testsuites>`;

describe("failedFiles — package-relative names (vitest's own)", () => {
	it("a name relative to the package the report sits in is read as repo-relative", () => {
		root = mkdtempSync(join(tmpdir(), "junit-paths-"));
		mkdirSync(join(root, "apps/app/src"), { recursive: true });
		mkdirSync(join(root, "apps/app/test-results"));
		writeFileSync(join(root, "apps/app/src/a.test.ts"), "");
		writeFileSync(join(root, "apps/app/test-results/system.junit.xml"), report("src/a.test.ts"));
		const read = failedFiles("apps/*/test-results/system.junit.xml", root);
		expect([...read.files.keys()]).toEqual(["apps/app/src/a.test.ts"]);
	});

	it("a name that is a file nowhere stays as written", () => {
		root = mkdtempSync(join(tmpdir(), "junit-paths-"));
		mkdirSync(join(root, "out"));
		writeFileSync(join(root, "out/r.xml"), report("src/ghost.test.ts"));
		expect([...failedFiles("out/r.xml", root).files.keys()]).toEqual(["src/ghost.test.ts"]);
	});
});
