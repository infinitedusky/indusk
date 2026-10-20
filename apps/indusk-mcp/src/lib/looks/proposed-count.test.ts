// clause: admin-pages-load-fast/never-freezes
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOCKUPS_DIR } from "./mockups";
import { proposedCount, proposedCountOf, readLooks } from "./overview";

const FIXTURE = join(__dirname, "..", "..", "__tests__", "fixtures", "looks-app");

/**
 * The Looks page counts what waits for a person in every plan worktree; a
 * count that drew every page and read the coverage of each took 11 s over 34
 * worktrees. The light count must say what the full read says, and read again
 * when a file under the mockups changes.
 */
describe("the count of looks waiting, read without drawing them", () => {
	it("equals the full read's count, and follows a changed screen", async () => {
		const root = mkdtempSync(join(tmpdir(), "proposed-count-"));
		cpSync(FIXTURE, root, { recursive: true });
		expect(await proposedCountOf(root)).toBe(proposedCount(await readLooks(root)));
		expect(await proposedCountOf(root)).toBe(proposedCount(await readLooks(root)));

		const before = proposedCount(await readLooks(root));
		const screens = join(root, MOCKUPS_DIR, "demo", "screens");
		writeFileSync(join(screens, "brand-new.html"), "<!doctype html><html><body>new</body></html>");
		const after = proposedCount(await readLooks(root));
		expect(after).toBe(before + 1);
		expect(await proposedCountOf(root)).toBe(after);
	});
});
