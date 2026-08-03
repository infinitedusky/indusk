import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkGoalposts, snapshotTrajectory } from "./goalposts.js";
import { fixtureDir } from "./harness.test-support.js";

/**
 * Pure guard semantics for the goalpost policy — moved here from
 * `loop.test.ts` in Phase 7 so the tests live beside the module they target.
 * The loop-level assertions (T5's full run, T6's mid-run mutation) stay with
 * the loop; these are the unit-level rules.
 */

describe("checkGoalposts (pure guard semantics)", () => {
	const base = () =>
		snapshotTrajectory(
			[
				"---",
				"title: x",
				"---",
				"",
				"## Test Trajectory",
				"",
				"| ID | Asserts | Writable at | Passes at | State |",
				"|----|---------|-------------|-----------|-------|",
				"| T1 | parse works | Phase 1 | Phase 1 | written |",
				"| T2 | compare orders | Phase 1 | Phase 2 | planned |",
				"",
			].join("\n"),
		);

	it("returns no violations for an unchanged table", () => {
		expect(checkGoalposts(base(), base())).toEqual([]);
	});

	it("allows State-cell transitions and added rows", () => {
		const after = base();
		after.rows[0].state = "passing";
		after.rows.push({ ...after.rows[0], id: "T9", asserts: "new row added by falsify" });
		expect(checkGoalposts(base(), after)).toEqual([]);
	});

	it("flags an Asserts text change", () => {
		const after = base();
		after.rows[0].asserts = "parse never throws";
		const violations = checkGoalposts(base(), after);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/T1/);
		expect(violations[0]).toMatch(/Asserts/i);
	});

	it("flags a Passes-at moved later, allows moved earlier", () => {
		const later = base();
		later.rows[1].passesAt = 3;
		const violations = checkGoalposts(base(), later);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/T2/);
		expect(violations[0]).toMatch(/later/i);

		const earlier = base();
		earlier.rows[1].passesAt = 1;
		expect(checkGoalposts(base(), earlier)).toEqual([]);
	});

	it("flags a removed row", () => {
		const after = base();
		after.rows.splice(1, 1);
		const violations = checkGoalposts(base(), after);
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/T2/);
		expect(violations[0]).toMatch(/removed/i);
	});
});

describe("snapshotTrajectory", () => {
	it("parses rows out of full impl.md content, frontmatter included", async () => {
		const impl = await readFile(join(fixtureDir, "impl.md"), "utf8");
		const trajectory = snapshotTrajectory(impl);
		expect(trajectory.present).toBe(true);
		expect(trajectory.rows.map((r) => r.id)).toEqual(["T1", "T2", "T3"]);
		expect(trajectory.rows[0].passesAt).toBe(1);
	});
});
