import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	makeVersionedWorkbench,
	oneRepoAtPath,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import { isRefusal, resolveVerifyRoots } from "./roots.js";

/**
 * workbench-trust-fixes A13 + A14 — the first tests `resolveVerifyRoots` has
 * ever had. Its refusal was correct by construction and covered by nothing.
 *
 * A13: the refusal tells the operator to run verify "inside <dir>". That
 * directory is `join(planRoot, name)`, which exists only on the flat legacy
 * layout. Nested and sibling layouts get told to go somewhere that is not
 * there.
 *
 * A14: `isWorkbench` gates on `shape === "workbench"` alone, so a config
 * that declares `repos[]` and forgot the flag reads as a normal-mode project
 * and verify judges the wrapper repo — the plan documents — as if they were
 * code.
 */

function suggestedDir(message: string): string {
	const m = /Run verify inside (\S+) instead/.exec(message);
	expect(m, `refusal does not say where to run:\n${message}`).not.toBeNull();
	return (m as RegExpExecArray)[1];
}

describe("A13 — the refusal names a directory that exists", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	for (const layout of ["nested", "sibling"] as const) {
		it(`${layout} layout, repo declared at code/alpha`, () => {
			wb = oneRepoAtPath(layout);
			const r = resolveVerifyRoots(wb.root);
			expect(isRefusal(r), "a workbench must refuse").toBe(true);
			if (!isRefusal(r)) return;
			const dir = suggestedDir(r.error);
			expect(existsSync(dir), `suggested ${dir}, which does not exist`).toBe(true);
		});
	}
});

describe("A14 — repos declared without `shape` are still a workbench", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	it("refuses rather than verifying the wrapper repo", () => {
		wb = makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "nested" });
		const r = resolveVerifyRoots(wb.root);
		expect(
			isRefusal(r),
			`resolved to ${JSON.stringify(r)} — would verify the plan repo as code`,
		).toBe(true);
	});
});
