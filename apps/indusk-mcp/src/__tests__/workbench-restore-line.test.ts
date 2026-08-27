import { describe, expect, it } from "vitest";
import { type RestoreStatus, restoreLine } from "../bin/commands/workbench.js";

/**
 * The seam the Shape finding asked for.
 *
 * A30 asserts through the CLI that restore never claims a link it did not
 * make — correct, and slow. This reads the same decision directly, so the
 * phrasing of all four outcomes is checkable without a workbench on disk.
 */
describe("restoreLine — what restore says it did", () => {
	const repo = { name: "alpha", path: "alpha-checkout" } as const;

	it("claims a link only in the two cases where one was made", () => {
		const linked: RestoreStatus[] = ["cloned", "present"];
		for (const status of linked) {
			expect(restoreLine(repo, status, "/parent")).toMatch(/linked/);
		}
	});

	it("names the real directory, by declared path, when no link was made", () => {
		for (const status of ["cloned-unlinked", "present-unlinked"] as RestoreStatus[]) {
			const line = restoreLine(repo, status, "/parent");
			// The declared path is what occupies the trunk slot — not the name.
			expect(line).toContain("alpha-checkout/");
			expect(line).toMatch(/no trunk symlink was made/);
			// "…and linked" must not appear. `unlinked` contains the substring
			// "linked", so this asks the question the reader actually cares about.
			expect(line).not.toMatch(/and linked|trunk linked/);
		}
	});

	it("says where a clone landed, so a reader can go look", () => {
		expect(restoreLine(repo, "cloned", "/parent")).toContain("/parent");
		expect(restoreLine(repo, "cloned-unlinked", "/parent")).toContain("/parent/alpha");
	});
});
