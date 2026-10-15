import { describe, expect, it } from "vitest";
import { cssFindings } from "../lib/looks/lint-values.js";

/**
 * promise: a-mockup-leaves-nothing-undefined
 *
 * The value check judges a shadow whole: each layer must equal a shadow token's.
 * A shadow assembled from a space token and a colour token passed the lint, part
 * by part, and broke at the live check — the needs-you ring (storybook-components,
 * Build Phase 8). The lint now refuses it where it is written.
 */

const findings = (css: string) => cssFindings("x.css", { code: css, startLine: 1 });

describe("looks lint — a shadow is a shadow token, whole", () => {
	it("refuses a shadow assembled from other tokens, naming the value", async () => {
		const found = await findings(
			".halo { box-shadow: 0 0 0 var(--space-1) var(--color-dusk-wash); }",
		);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({ rule: "shadow-not-token", line: 1 });
		expect(found[0]?.message).toContain("--shadow-");
	});

	it("refuses one assembled layer among token layers", async () => {
		const found = await findings(
			".a { box-shadow: var(--shadow-card), 0 0 0 var(--space-1) var(--color-line); }",
		);
		expect(found.map((f) => f.rule)).toEqual(["shadow-not-token"]);
	});

	it("passes a shadow token and none", async () => {
		expect(await findings(".a { box-shadow: var(--shadow-ring); }")).toEqual([]);
		expect(await findings(".a { box-shadow: none; text-shadow: none; }")).toEqual([]);
	});

	it("leaves a custom property alone: declaring a new shadow token is how one is proposed", async () => {
		expect(
			await findings(":root { --shadow-new: 0 0 0 var(--space-1) var(--color-line); }"),
		).toEqual([]);
	});
});
