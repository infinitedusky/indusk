import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Badge, type BadgeVariant } from "./Badge";

/**
 * T9: each trajectory state's Badge variant renders with a recognizable
 * color class so pass/fail status is visually legible at a glance.
 *
 * We assert the className contains a known color token per variant —
 * not the exact RGB. The Tailwind utility names are stable enough; the
 * point is that "passing" carries green tokens and "blocked" carries
 * red tokens, distinct from each other.
 */
describe("Badge — color-coded trajectory states (T9)", () => {
	const cases: Array<[BadgeVariant, RegExp]> = [
		["passing", /green/],
		["blocked", /red/],
		["skipped", /yellow/],
		["planned", /gray/],
		["writable", /gray/],
		["written", /blue/],
		["unknown", /gray/],
		["neutral", /gray/],
	];

	for (const [variant, colorPattern] of cases) {
		it(`renders ${variant} with ${colorPattern.source} color tokens`, async () => {
			const { container } = await render(<Badge variant={variant}>{variant}</Badge>);
			const span = container.querySelector("span");
			expect(span).not.toBeNull();
			expect(span?.className).toMatch(colorPattern);
		});
	}

	it("passing and blocked are visually distinct", async () => {
		const { container: pContainer } = await render(<Badge variant="passing">ok</Badge>);
		const { container: bContainer } = await render(<Badge variant="blocked">err</Badge>);
		const pClass = pContainer.querySelector("span")?.className ?? "";
		const bClass = bContainer.querySelector("span")?.className ?? "";
		// Passing and blocked must carry DIFFERENT primary color tokens.
		expect(pClass).toMatch(/green/);
		expect(bClass).toMatch(/red/);
		expect(pClass).not.toBe(bClass);
	});
});
