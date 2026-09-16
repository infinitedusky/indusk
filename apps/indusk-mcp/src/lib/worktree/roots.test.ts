import { existsSync, realpathSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	LAYOUTS,
	makeVersionedWorkbench,
	twoRepos,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import { isRootsRefusal, resolveExecutionRoots } from "./roots.js";

/**
 * The one resolver for "where is the plan, where is the code".
 *
 * Moved here from `verify/roots.ts` by dawn-workbench-execution, with the
 * one-repo case flipped from a refusal to a resolution. The two claims
 * workbench-trust-fixes pinned on the old resolver still hold in their new
 * form: the directory it names exists on every layout (A13 there — the
 * refusal used to point at `<planRoot>/<name>`, which only the flat layout
 * has), and repos declared without a `shape` flag are still a workbench (A14
 * there — a shapeless `repos[]` once read as flat, and verify would have
 * judged the plan documents as code).
 */

let wb: VersionedWorkbench | null = null;
afterEach(() => {
	wb?.cleanup();
	wb = null;
});

describe.each(LAYOUTS)("a one-repo workbench resolves on the %s layout", (_label, build) => {
	it("to a split whose code root exists", () => {
		wb = build();
		const r = resolveExecutionRoots(wb.root);
		expect(isRootsRefusal(r), JSON.stringify(r)).toBe(false);
		if (isRootsRefusal(r)) return;
		expect(r.split).toBe(true);
		expect(r.planRoot).toBe(wb.root);
		expect(existsSync(r.codeRoot), `code root ${r.codeRoot} does not exist`).toBe(true);
		expect(realpathSync(r.codeRoot)).toBe(realpathSync(wb.repos[0].dir));
	});
});

describe("the refusals", () => {
	it("repos declared without `shape` are still a workbench — resolved, never read as flat", () => {
		wb = makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "nested" });
		const r = resolveExecutionRoots(wb.root);
		expect(isRootsRefusal(r)).toBe(false);
		if (isRootsRefusal(r)) return;
		expect(r.split, "a shapeless repos[] resolved as a flat project").toBe(true);
	});

	it("two declared repos refuse, naming both", () => {
		wb = twoRepos("nested");
		const r = resolveExecutionRoots(wb.root);
		expect(isRootsRefusal(r)).toBe(true);
		if (!isRootsRefusal(r)) return;
		expect(r.error).toMatch(/alpha/);
		expect(r.error).toMatch(/beta/);
	});

	it("a workbench-shaped config with no repos refuses rather than falling back to the plan root", () => {
		wb = makeVersionedWorkbench({
			repos: [],
			layout: "nested",
			shape: "workbench",
			initRepos: false,
		});
		const r = resolveExecutionRoots(wb.root);
		expect(isRootsRefusal(r)).toBe(true);
		if (!isRootsRefusal(r)) return;
		expect(r.error).toMatch(/declares no repos/);
	});
});

describe("a flat project", () => {
	it("resolves to itself, unsplit", () => {
		// A repo declared nowhere: the temp workbench with its declaration removed
		// is the simplest flat project the helper can produce.
		wb = makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "nested" });
		const r = resolveExecutionRoots(wb.repos[0].dir);
		expect(r).toEqual({ planRoot: wb.repos[0].dir, codeRoot: wb.repos[0].dir, split: false });
	});
});
