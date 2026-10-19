// clause: a-plan-is-found-in-the-archive/one-lookup
// clause: a-plan-is-found-in-the-archive/active-first
// promise: a-plan-is-found-in-the-archive
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveImplPath } from "../impl-parser.js";
import { findPlanFolder } from "./plan-folder.js";

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

describe("findPlanFolder", () => {
	it("T1 the planning folder, else the archive, else none", () => {
		const root = project();
		mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
		mkdirSync(join(root, ".indusk/planning/archive/b"), { recursive: true });
		expect(findPlanFolder(root, "a")).toBe(join(root, ".indusk/planning/a"));
		expect(findPlanFolder(root, "b")).toBe(join(root, ".indusk/planning/archive/b"));
		expect(findPlanFolder(root, "c")).toBeNull();
	});

	it("T6 a plan in both places is read from the planning folder", () => {
		const root = project();
		mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
		mkdirSync(join(root, ".indusk/planning/archive/a"), { recursive: true });
		expect(findPlanFolder(root, "a")).toBe(join(root, ".indusk/planning/a"));
	});

	it("T8 refuses the archive folder, a file, a separator and `..`", () => {
		const root = project();
		mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
		mkdirSync(join(root, ".indusk/planning/archive/b"), { recursive: true });
		writeFileSync(join(root, ".indusk/planning/master.md"), "# master\n");
		for (const name of ["archive", "master.md", "archive/b", "../planning/a", ""]) {
			expect(findPlanFolder(root, name), name).toBeNull();
		}
	});
});
