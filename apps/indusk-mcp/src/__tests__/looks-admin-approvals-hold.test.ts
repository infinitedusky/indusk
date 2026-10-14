import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approvalOf, readApprovals, readWithdrawals } from "../lib/looks/approvals.js";
import { readApp } from "../lib/looks/mockups.js";

/**
 * promise: a-mockup-composes-approved-components — component-content Test
 * Phase 1, A11: every approval already made on this repository's admin
 * mockups survives content-filling composition (it has no red window).
 */

const ROOT = join(__dirname, "..", "..", "..", "..");

describe("approvals made before component content", () => {
	it("A11 every admin mockup approved today is still approved", async () => {
		const app = await readApp(ROOT, "admin");
		const record = readApprovals(app);
		const withdrawals = readWithdrawals(app);
		const stillExist = app.mockups.filter((m) => record.some((e) => e.mockup === m.name));
		expect(stillExist.length).toBeGreaterThan(0);
		const proposed = stillExist
			.filter((m) => approvalOf(app, m, record, withdrawals).state !== "approved")
			.map((m) => m.name);
		expect(proposed).toEqual(KNOWN_PROPOSED_BEFORE);
	});
});

/** Mockups already proposed before this plan; the row guards the rest. */
const KNOWN_PROPOSED_BEFORE: string[] = [];
