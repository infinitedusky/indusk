import { describe, expect, it } from "vitest";
import { verdict } from "./verdict.js";

/**
 * promise: tokens-are-held-exactly — ui-promises A17.
 *
 * The verdict is a pure function of approved values and measured values, so it
 * is read here without a browser (ADR decision 6). The browser half is the
 * system tier's (`looks-browser.contract.test.ts`).
 */

const SPACING = { "--space-2": "8px", "--space-3": "12px", "--space-4": "16px" };

describe("verdict — held and broken by value", () => {
	it("is held when the runtime tokens equal the approved ones", () => {
		const v = verdict({
			approved: { "--dusk": "#c2620b" },
			runtime: { "--dusk": "#c2620b" },
			elements: [],
		});
		expect(v.state).toBe("held");
		expect(v.findings).toEqual([]);
	});

	it("is broken, naming the token, approved and actual, when a runtime token differs", () => {
		const v = verdict({
			approved: { "--dusk": "#c2620b" },
			runtime: { "--dusk": "#c2620c" },
			elements: [],
		});
		expect(v.state).toBe("broken");
		expect(v.findings).toHaveLength(1);
		expect(v.findings[0]).toMatchObject({
			token: "--dusk",
			approved: "#c2620b",
			actual: "#c2620c",
		});
	});

	it("is broken when an approved token is absent at runtime", () => {
		const v = verdict({ approved: { "--dusk": "#c2620b" }, runtime: {}, elements: [] });
		expect(v.state).toBe("broken");
		expect(v.findings[0]).toMatchObject({ token: "--dusk", approved: "#c2620b" });
	});

	it("is broken when an element's length is not a member, naming the nearest token", () => {
		const v = verdict({
			approved: SPACING,
			runtime: SPACING,
			elements: [{ selector: "button.primary", property: "padding-top", actual: "13px" }],
		});
		expect(v.state).toBe("broken");
		expect(v.findings).toEqual([
			{
				element: "button.primary",
				property: "padding-top",
				actual: "13px",
				nearest: "--space-3 (12px)",
			},
		]);
	});

	it("holds an element whose value is a member, in the spelling the browser computes", () => {
		const approved = { "--dusk": "#c2620b", "--space-3": "12px", "--duration-fast": "200ms" };
		const v = verdict({
			approved,
			runtime: approved,
			elements: [
				{ selector: "a", property: "color", actual: "rgb(194, 98, 11)" },
				{ selector: "a", property: "padding-left", actual: "12px" },
				{ selector: "a", property: "transition-duration", actual: "0.2s" },
			],
		});
		expect(v.state).toBe("held");
	});

	it("breaks a duration that differs from its approved value, like a length", () => {
		const approved = { "--duration-fast": "200ms" };
		const v = verdict({
			approved,
			runtime: approved,
			elements: [{ selector: "button", property: "transition-duration", actual: "0.25s" }],
		});
		expect(v.state).toBe("broken");
		expect(v.findings[0]).toMatchObject({
			element: "button",
			property: "transition-duration",
			actual: "0.25s",
			nearest: "--duration-fast (200ms)",
		});
	});

	it("breaks an easing that differs from its approved value", () => {
		const approved = { "--easing-standard": "cubic-bezier(0.2, 0, 0, 1)" };
		const v = verdict({
			approved,
			runtime: approved,
			elements: [
				{
					selector: "button",
					property: "transition-timing-function",
					actual: "cubic-bezier(0.4, 0, 0.2, 1)",
				},
			],
		});
		expect(v.state).toBe("broken");
	});

	it("tolerates the browser's own initial values: zero, no shadow, no transition", () => {
		const v = verdict({
			approved: SPACING,
			runtime: SPACING,
			elements: [
				{ selector: "p", property: "margin-top", actual: "0px" },
				{ selector: "p", property: "box-shadow", actual: "none" },
				{ selector: "p", property: "transition-duration", actual: "0s" },
				{ selector: "p", property: "transition-timing-function", actual: "ease" },
				{ selector: "p", property: "background-color", actual: "rgba(0, 0, 0, 0)" },
			],
		});
		expect(v.state).toBe("held");
	});

	it("breaks a colour that is not in the foundation, naming the nearest colour token", () => {
		const approved = { "--dusk": "#c2620b", "--ink": "#1f1a17" };
		const v = verdict({
			approved,
			runtime: approved,
			elements: [{ selector: "h1", property: "color", actual: "rgb(194, 98, 12)" }],
		});
		expect(v.state).toBe("broken");
		expect(v.findings[0]?.nearest).toMatch(/^--dusk /);
	});

	it("reads a shadow by its layers, whichever colour spelling and order wrote them", () => {
		const approved = {
			"--shadow-card":
				"0px 1px 2px 0px rgb(9.4% 12.5% 16.9% / 0.06), 0px 6px 20px 0px rgb(9.4% 12.5% 16.9% / 0.06)",
		};
		const v = verdict({
			approved,
			// A minifier's spelling of the token, and the browser's computed form on an element,
			// with a framework's empty layer ahead of it.
			runtime: {
				"--shadow-card": "0px 1px 2px 0px #18202b0f, 0px 6px 20px 0px #18202b0f",
			},
			elements: [
				{
					selector: "div.elevated",
					property: "box-shadow",
					actual:
						"rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(24, 32, 43, 0.06) 0px 1px 2px 0px, rgba(24, 32, 43, 0.06) 0px 6px 20px 0px",
				},
			],
		});
		expect(v.findings).toEqual([]);
		expect(
			verdict({
				approved,
				runtime: approved,
				elements: [
					{ selector: "div", property: "box-shadow", actual: "rgba(0, 0, 0, 0.5) 0px 4px 8px 0px" },
				],
			}).state,
		).toBe("broken");
	});

	it("reads a shadow written short — `0 1px 2px` — as the browser computes it, `0px 1px 2px 0px`", () => {
		// The admin's dark --shadow-card, hand-written; found the first time the dark scheme was opened.
		const dark = "0 1px 2px rgba(0,0,0,.3), 0 6px 20px rgba(0,0,0,.25)";
		const v = verdict({
			approved: { "--shadow-card": dark },
			runtime: { "--shadow-card": dark },
			elements: [
				{
					selector: "button.elevated",
					property: "box-shadow",
					actual: "rgba(0, 0, 0, 0.3) 0px 1px 2px 0px, rgba(0, 0, 0, 0.25) 0px 6px 20px 0px",
				},
			],
		});
		expect(v.findings).toEqual([]);
	});
});
