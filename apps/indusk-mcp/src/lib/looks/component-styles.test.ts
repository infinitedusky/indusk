import postcss from "postcss";
import { describe, expect, it } from "vitest";
import * as styles from "./component-styles.js";
import {
	baseStylesheet,
	classesOf,
	componentStylesheet,
	STYLESHEET_HEADER,
} from "./component-styles.js";
import type { Foundation } from "./foundation.js";
import { markedComponentsOf } from "./markup.js";

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
	@media (width >= 48rem) { .md\\:px-2 { padding-inline: var(--spacing-2); } }
}
[data-component="badge"] p { color: var(--color-ink); max-width: 64ch; }
[data-component="badge"][data-tone="alert"] p { color: var(--color-ink); }
[data-component="other"] p { color: var(--color-ink); }
p { margin: 0; }
.pulse { animation: pulse var(--duration-fast) var(--easing-ease) infinite; }
@keyframes pulse { 50% { opacity: 0.3; } }
@keyframes unused { to { opacity: 0; } }
`;

const sheet = (classes: string[], marks: string[] = []) =>
	componentStylesheet(COMPILED, new Set(classes), foundation, new Set(marks));

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

	it("keeps a rule the app writes on a component's own marker, which names no class", () => {
		// `[data-component="decision-card"] p { color: … }` in the app's stylesheet
		// is part of how the component draws; the story shows it, so a mockup must.
		const css = sheet(["px-2"], ["badge"]);
		expect(css).toContain('[data-component="badge"] p');
		expect(css).toContain('[data-component="badge"][data-tone="alert"] p');
		expect(css).not.toContain('[data-component="other"]');
		expect(css).not.toMatch(/^p \{/m);
		expect(sheet(["px-2"])).not.toContain("data-component");
	});

	it("is unlayered, rules in the order the build wrote them, wrappers that are not layers kept", () => {
		// A mockup's own page styles are unlayered, and an unlayered rule beats
		// every layered one whatever its specificity (ADR decision 10).
		const css = sheet(["px-2", "text-ink", "md:px-2"]);
		expect(css).not.toContain("@layer");
		expect(css).toContain("@media (width >= 48rem)");
		expect(css.indexOf(".px-2")).toBeLessThan(css.indexOf(".text-ink"));
		expect(css.indexOf(".text-ink")).toBeLessThan(css.indexOf(".md\\:px-2"));
	});

	it("is the header alone when no class has a rule, and the same bytes every time", () => {
		expect(sheet(["nothing"])).toBe(STYLESHEET_HEADER);
		expect(sheet(["px-2", "text-ink"])).toBe(sheet(["text-ink", "px-2"]));
	});
});

describe("markedComponentsOf", () => {
	it("reads every component marker in the markup, nested ones included", () => {
		const html = '<nav data-component="nav"><button data-component="plan-row"></button></nav>';
		expect([...markedComponentsOf(html)].sort()).toEqual(["nav", "plan-row"]);
	});
});

describe("classesOf", () => {
	it("reads the classes of every element, nested ones included", () => {
		const html = '<span class="a b"><i class="b c"></i><u></u></span>';
		expect([...classesOf(html)].sort()).toEqual(["a", "b", "c"]);
	});
});

describe("baseStylesheet", () => {
	const APP = `
@layer base { html, :host { line-height: 1.5; font-family: ui-sans-serif, system-ui; } }
@layer base { body { line-height: inherit; } }
body { color: var(--color-ink); font-family: var(--font-sans); }
.prose body, body p { margin: 0; }
.px-2 { padding-inline: var(--spacing-2); }
`;

	it("keeps the app's body rules, in the build's order, out of their layer, and nothing else", () => {
		const css = baseStylesheet(APP, foundation);
		expect(css.startsWith(STYLESHEET_HEADER)).toBe(true);
		expect(css).toContain("line-height: inherit");
		expect(css).toContain("color: var(--color-ink)");
		expect(css).toContain("font-family: var(--font-sans)");
		expect(css.indexOf("inherit")).toBeLessThan(css.indexOf("--font-sans"));
		expect(css).not.toMatch(/@layer|html|:host|ui-sans-serif|margin|padding/);
	});

	it("is just the header when the app writes no body rule", () => {
		expect(baseStylesheet(COMPILED, foundation)).toBe(STYLESHEET_HEADER);
	});
});

/**
 * The element resets a story draws under (mockups-draw-components-as-stories,
 * A1–A3): the app's compiled `a` and `textarea` rules, cut to a sheet that
 * reaches only components, so a mockup draws a component as its story does.
 * Read through the namespace so the file loads before `componentReset` exists.
 *
 * promise: mockups-render-in-the-cockpit
 */
describe("componentReset", () => {
	const APP = `
@layer base {
	*, ::before { box-sizing: border-box; }
	html, :host { line-height: 1.5; }
	body { margin: 0; }
	a { color: inherit; text-decoration: inherit; }
	textarea { font: inherit; font-size: 100%; }
	.px-2 { padding-inline: var(--spacing-2); }
	[data-component="badge"] p { color: var(--color-ink); }
}
`;
	const SCOPE = ":where([data-component], [data-component] *)";
	/** The body of the rule whose selector holds the element `tag` and the component scope. */
	const ruleFor = (css: string, tag: string): string => {
		const rule = [...css.matchAll(/^([^{}@\n][^{]*)\{([^}]*)\}/gm)].find(
			([, selector]) =>
				selector.includes(SCOPE) &&
				new RegExp(`(^|[\\s)])${tag}\\b|\\b${tag}:where`).test(selector.replace(SCOPE, " ")),
		);
		return rule?.[2] ?? "";
	};
	const reset = (): string => {
		const fn = (styles as Record<string, unknown>).componentReset;
		expect(fn, "componentReset is exported by component-styles").toBeTypeOf("function");
		return (fn as (css: string, f: Foundation) => string)(APP, foundation);
	};

	it("A1: a link component draws in its own ink — the sheet carries a's colour reset under components", () => {
		const css = reset();
		expect(ruleFor(css, "a")).toContain("color: inherit");
	});

	it("A2: a text field draws in the app's font and size — the sheet carries textarea's reset", () => {
		const css = reset();
		expect(ruleFor(css, "textarea")).toContain("font: inherit");
		expect(ruleFor(css, "textarea")).toContain("font-size: 100%");
	});

	it("A3: the resets reach only components, at zero added specificity, and no class or marker rule rides along", () => {
		const css = reset();
		expect(css.startsWith(STYLESHEET_HEADER)).toBe(true);
		for (const selector of css.match(/^[^{}@\n][^{]*(?=\{)/gm) ?? []) {
			expect(selector).toContain(SCOPE);
		}
		expect(css).not.toContain(".px-2");
		expect(css).not.toContain('[data-component="badge"] p');
		expect(css).not.toMatch(/(^|[\s,])(html|body|:root|:host)\b/m);
	});
	it("T4: a reset for a pseudo-element keeps the scope before it, in a selector a browser accepts", () => {
		const fn = (styles as Record<string, unknown>).componentReset as (
			css: string,
			f: Foundation,
		) => string;
		const css = fn(
			"@layer base { *, ::before, ::after { box-sizing: border-box; } input::placeholder { color: red } }",
			foundation,
		);
		const selectors: string[] = [];
		postcss.parse(css).walkRules((r) => {
			selectors.push(...r.selectors);
		});
		expect(selectors).toEqual([
			`*${SCOPE}`,
			`${SCOPE}::before`,
			`${SCOPE}::after`,
			`input${SCOPE}::placeholder`,
		]);
	});
});
