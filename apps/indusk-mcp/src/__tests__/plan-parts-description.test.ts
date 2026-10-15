import { describe, expect, it } from "vitest";
import { briefOpening } from "../lib/plans/parts.js";

/**
 * brief-as-the-contract A27 — a brief's `description:` written as YAML shows as
 * its text on the plan page.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */

const brief = (front: string) => `---\ntitle: "T"\n${front}\n---\n\n# T\n`;

describe("A27 — the description is read as YAML", () => {
	it("a folded block shows as its text, not as the indicator", () => {
		const { description } = briefOpening(
			brief("description: >-\n  A plan page that shows\n  what the brief says.\nstatus: draft"),
		);
		expect(description).toBe("A plan page that shows what the brief says.");
	});

	it("a quoted string with an escaped quote shows without the backslash", () => {
		const { description } = briefOpening(
			brief('description: "Say \\"hold\\" when a seat is kept"\nstatus: draft'),
		);
		expect(description).toBe('Say "hold" when a seat is kept');
	});

	it("the status is still read, and a brief with neither reads null", () => {
		expect(briefOpening(brief("status: accepted")).briefStatus).toBe("accepted");
		expect(briefOpening(brief("status: draft")).description).toBeNull();
	});
});
