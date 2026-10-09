import { describe, expect, it } from "vitest";

/**
 * incident-recording A32 — promise: one-definition-per-shared-rule.
 * The one wording of an incident's age, read by `indusk promises status` and
 * the admin's incidents table. Loaded by dynamic import: the module is this
 * phase's to write.
 */

async function formatAge(): Promise<(ms: number | null) => string> {
	const mod = (await import("./age.js")) as Record<string, unknown>;
	if (typeof mod.formatAge !== "function") throw new Error("age.ts exports no formatAge");
	return mod.formatAge as (ms: number | null) => string;
}

describe("A32 — an incident's age, in words", () => {
	it("days, then hours, then minutes, singular at one; unknown when there is no age", async () => {
		const age = await formatAge();
		expect(age(3 * 86_400_000 + 5)).toBe("3 days");
		expect(age(86_400_000)).toBe("1 day");
		expect(age(2 * 3_600_000)).toBe("2 hours");
		expect(age(60_000)).toBe("1 minute");
		expect(age(-5)).toBe("0 minutes");
		expect(age(null)).toBe("an unknown time");
	});
});
