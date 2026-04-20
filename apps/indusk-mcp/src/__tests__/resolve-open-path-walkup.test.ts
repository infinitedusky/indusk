import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveOpenPath } from "../bin/commands/ui.js";
import { addProject } from "../lib/admin/registry.js";

/**
 * T25 — `resolveOpenPath()` matches registered project when cwd is a
 *       SUBDIRECTORY of the project's `path` (not just when cwd is the
 *       root exactly). Without this, bare `indusk ui` from anywhere below
 *       the project root silently falls through to `/`, regressing T16's
 *       cwd-aware promise.
 *
 * Today's behavior (red): `resolveOpenPath` does an exact-string realpath
 * compare. cwd = `/tmp/proj/apps/indusk-mcp` does NOT equal the registered
 * `/tmp/proj`, so the function returns `/`.
 *
 * Expected behavior (green): walk up cwd's parents until a registered
 * project's realpath is found OR we hit filesystem root. Capped at a
 * reasonable ancestor count (40) for safety.
 */

let testHome: string;
let testProject: string;
let originalCwd: string;

describe("resolveOpenPath — T25 walk-up from subdirectory", () => {
	beforeEach(() => {
		testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
		testProject = mkdtempSync(join(tmpdir(), "t25-proj-"));
		mkdirSync(testHome, { recursive: true });
		originalCwd = process.cwd();
		process.env.INDUSK_HOME = testHome;
	});

	afterEach(() => {
		process.chdir(originalCwd);
		delete process.env.INDUSK_HOME;
		if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
		if (existsSync(testProject)) rmSync(testProject, { recursive: true, force: true });
	});

	it("returns /p/{name}/ from a deep subdirectory of a registered project", () => {
		const entry = addProject(testProject);

		// Deep subdirectory: mirrors the real-world dusk monorepo layout where
		// `indusk ui` is often invoked from apps/indusk-mcp/src
		const deep = join(testProject, "apps", "indusk-mcp", "src");
		mkdirSync(deep, { recursive: true });
		process.chdir(deep);

		expect(resolveOpenPath()).toBe(`/p/${entry.name}/`);
	});

	it("returns /p/{name}/ from one level below the registered root", () => {
		const entry = addProject(testProject);

		const one = join(testProject, "apps");
		mkdirSync(one, { recursive: true });
		process.chdir(one);

		expect(resolveOpenPath()).toBe(`/p/${entry.name}/`);
	});

	it("still returns /p/{name}/ when cwd equals the registered root exactly (regression guard)", () => {
		const entry = addProject(testProject);
		process.chdir(testProject);
		expect(resolveOpenPath()).toBe(`/p/${entry.name}/`);
	});

	it("returns / when cwd is outside any registered project", () => {
		addProject(testProject);

		// Create a sibling dir that is NOT under testProject
		const stranger = mkdtempSync(join(tmpdir(), "t25-stranger-"));
		try {
			process.chdir(stranger);
			expect(resolveOpenPath()).toBe("/");
		} finally {
			rmSync(stranger, { recursive: true, force: true });
		}
	});
});
