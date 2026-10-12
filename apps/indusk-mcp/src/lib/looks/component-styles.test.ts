import { describe, expect, it } from "vitest";
import { classesOf, componentStylesheet, STYLESHEET_HEADER } from "./component-styles.js";
import type { Foundation } from "./foundation.js";

/**
 * The render step's stylesheet cut (storybook-components ADR decision 10):
 * the app's compiled rules for the classes a component's snapshots use, on the
 * foundation's tokens only. Pure, so no browser: the compiled CSS is a string.
 *
 * promise: mockups-render-in-the-cockpit
 */

const token = (name: string, path: string[], value: string) => ({
	name,
	path,
	type: "dimension",
	value,
});

const foundation: Foundation = {
	hash: "h",
	tokens: [
		token("--space-2", ["space", "2"], "8px"),
		token("--size-badge", ["size", "badge"], "30px"),
		token("--border-1", ["border", "1"], "1px"),
		token("--color-ink", ["color", "ink"], "#18202b"),
		token("--easing-ease", ["easing", "ease"], "ease"),
		token("--duration-fast", ["duration", "fast"], "150ms"),
		token("--leading-1", ["leading", "1"], "12px"),
	],
};

const COMPILED = `
@layer theme { :root { --spacing-2: 8px; --spacing-badge: 30px; --color-ink: #18202b; } }
@layer base { * { box-sizing: border-box; } }
@property --tw-border-style { syntax: "*"; inherits: false; initial-value: solid; }
@layer utilities {
	.size-badge { width: var(--spacing-badge); height: var(--spacing-badge); }
	.px-2 { padding-inline: var(--spacing-2); }
	.p-9 { padding: var(--spacing-2); }
	.border { border-style: var(--tw-border-style); border-width: 1px; }
	.border-t-0 { border-top-width: 0px; }
	.text-ink { color: var(--color-ink); }
	.bg-current { background-color: currentcolor; }
	.min-w-0 { min-width: var(--spacing-0); }
	.leading-1 { --tw-leading: var(--leading-1); line-height: var(--tw-leading); }
	.transition-colors {
		transition-property: color, background-color, border-color;
		transition-duration: var(--tw-duration, var(--duration-fast));
	}
	.hover\\:text-ink:hover { color: var(--color-ink); }
	.max-\\[759px\\]\\:hidden { display: none; }
}
.pulse { animation: pulse var(--duration-fast) var(--easing-ease) infinite; }
@keyframes pulse { 50% { opacity: 0.3; } }
@keyframes unused { to { opacity: 0; } }
`;

const sheet = (classes: string[]) => componentStylesheet(COMPILED, new Set(classes), foundation);

describe("componentStylesheet", () => {
	it("keeps the rules of exactly the classes given, and nothing the build wrote around them", () => {
		const css = sheet(["px-2", "text-ink"]);
		expect(css).toContain(".px-2");
		expect(css).toContain(".text-ink");
		expect(css).not.toContain(".p-9");
		expect(css).not.toContain("box-sizing");
		expect(css).not.toContain(":root");
	});

	it("names the foundation's tokens where the build named its theme", () => {
		const css = sheet(["size-badge", "px-2"]);
		expect(css).toContain("width: var(--size-badge)");
		expect(css).toContain("padding-inline: var(--space-2)");
		expect(css).not.toContain("--spacing");
	});

	it("resolves the build's own variables, and leaves none of them", () => {
		const css = sheet(["border", "leading-1", "transition-colors"]);
		expect(css).toContain("border-style: solid");
		expect(css).toContain("line-height: var(--leading-1)");
		expect(css).toContain("transition-duration: var(--duration-fast)");
		expect(css).not.toContain("--tw-");
	});

	it("reads a raw value as the token that holds exactly it, and a zero as 0", () => {
		const css = sheet(["border", "border-t-0", "min-w-0", "bg-current"]);
		expect(css).toContain("border-width: var(--border-1)");
		expect(css).toContain("border-top-width: 0;");
		expect(css).toContain("min-width: 0;");
		expect(css).toContain("background-color: currentColor");
	});

	it("collapses a transition's list of property names to the one keyword the value check allows", () => {
		expect(sheet(["transition-colors"])).toContain("transition-property: all");
	});

	it("keeps variants and the keyframes an animation names, and only those", () => {
		const css = sheet(["hover:text-ink", "max-[759px]:hidden", "pulse"]);
		expect(css).toContain(".hover\\:text-ink:hover");
		expect(css).toContain(".max-\\[759px\\]\\:hidden");
		expect(css).toContain("@keyframes pulse");
		expect(css).not.toContain("unused");
	});

	it("is the header alone when no class has a rule, and the same bytes every time", () => {
		expect(sheet(["nothing"])).toBe(STYLESHEET_HEADER);
		expect(sheet(["px-2", "text-ink"])).toBe(sheet(["text-ink", "px-2"]));
	});
});

describe("classesOf", () => {
	it("reads the classes of every element, nested ones included", () => {
		const html = '<span class="a b"><i class="b c"></i><u></u></span>';
		expect([...classesOf(html)].sort()).toEqual(["a", "b", "c"]);
	});
});
