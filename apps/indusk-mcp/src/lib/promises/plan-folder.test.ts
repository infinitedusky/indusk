// clause: a-plan-is-found-in-the-archive/one-lookup
// promise: a-plan-is-found-in-the-archive
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveImplPath } from "../impl-parser.js";

const project = () => mkdtempSync(join(tmpdir(), "plan-folder-"));
const withImpl = (root: string, ...rel: string[]) => {
	const dir = join(root, ".indusk", "planning", ...rel);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "impl.md"), "# impl\n");
	return join(dir, "impl.md");
};

describe("T8 a name that is not a plan's folder is not found as a plan", () => {
	it("the archive folder itself is not a plan", () => {
		const root = project();
		withImpl(root, "archive");
		expect(resolveImplPath(root, "archive")).toBeNull();
	});

	it("a name with a path separator is not a plan", () => {
		const root = project();
		withImpl(root, "archive", "b");
		expect(resolveImplPath(root, "archive/b")).toBeNull();
	});

	it("a name with `..` is not a plan", () => {
		const root = project();
		withImpl(root, "a");
		expect(resolveImplPath(root, "../planning/a")).toBeNull();
	});

	it("a file in the planning folder is not a plan", () => {
		const root = project();
		mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
		writeFileSync(join(root, ".indusk", "planning", "master.md"), "# master\n");
		expect(resolveImplPath(root, "master.md")).toBeNull();
	});
});
