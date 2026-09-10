import { afterEach, describe, expect, it } from "vitest";
import {
	oneRepoAtPath,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import { listOversizedChangedFiles } from "./oversized.js";

/**
 * workbench-trust-fixes A6 — the cleanup file scan refuses at a versioned
 * workbench root.
 *
 * `listOversizedChangedFiles` guards on "is this a git repo". A workbench root
 * is one now, so the guard passes, the diff it examines is the plan documents
 * (the code is ignored by the workbench's git), and it returns `[]` — read
 * everywhere as "checked and clean". `verify` had the identical gap and was
 * fixed to refuse by declaration (`resolveVerifyRoots`); this is cleanup's
 * turn. An empty list at a workbench root is the one answer this function
 * must never give.
 */
describe("A6 — cleanup's changed-file scan at a versioned workbench root", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	it("throws, naming the workbench shape and its declared repo dir", () => {
		wb = oneRepoAtPath();
		let thrown: unknown = null;
		let result: unknown = "(did not return)";
		try {
			result = listOversizedChangedFiles(wb.root, "main");
		} catch (e) {
			thrown = e;
		}
		expect(thrown, `returned ${JSON.stringify(result)} instead of refusing`).not.toBeNull();
		const message = String((thrown as Error)?.message ?? thrown);
		expect(message).toMatch(/workbench/);
		expect(message).toContain("code/alpha");
	});
});
