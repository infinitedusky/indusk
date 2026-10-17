import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { type AppLooksRead, mockupDocument, proposedCount, storyDocument } from "./overview";

const look = (approval: "approved" | "proposed") => ({ approval });
const app = (mockups: string[], stories: string[]) =>
	({
		app: "demo",
		mockups: mockups.map((a) => look(a as "approved")),
		stories: stories.map((a) => look(a as "approved")),
	}) as unknown as AppLooksRead;

describe("the count of looks waiting for a person", () => {
	it("counts every proposed mockup and story across apps, and no approved one", () => {
		const apps = [
			app(["approved", "proposed"], ["proposed", "proposed"]),
			app(["proposed"], ["approved"]),
		];
		expect(proposedCount(apps)).toBe(4);
	});

	it("skips an app that could not be read", () => {
		expect(proposedCount([{ app: "x", problem: "no foundation" }])).toBe(0);
	});
});

describe("a story's frame", () => {
	const story = { component: "badge", html: '<span data-component="badge">ok</span>' };
	const styles = [
		{ component: "badge", css: ".badge-own {}" },
		{ component: "other", css: ".other-own {}" },
	];

	it("draws under the app's base, after the tokens and before the component's own sheet", () => {
		const doc = storyDocument(story, ":root{--font-sans:x}", {
			styles,
			base: "body { font-family: var(--font-sans); }",
			reset: "",
		});
		const tokens = doc.indexOf("data-foundation");
		const base = doc.indexOf('data-component-style="_base"');
		const own = doc.indexOf('data-component-style="badge"');
		expect(tokens).toBeGreaterThanOrEqual(0);
		expect(base).toBeGreaterThan(tokens);
		expect(own).toBeGreaterThan(base);
		expect(doc).toContain("font-family: var(--font-sans)");
		expect(doc).not.toContain(".other-own");
	});

	it("carries no base when the app has none", () => {
		expect(storyDocument(story, "", { styles, base: "", reset: "" })).not.toContain(
			'data-component-style="_base"',
		);
	});
});

/**
 * The cockpit's own pages (mockups-draw-components-as-stories, T5, T6): the
 * reset sits in its place on a story page, and a mockup's own style rules reach
 * its page only, never a component it places.
 *
 * promise: mockups-render-in-the-cockpit
 */
describe("the cockpit's pages draw components as their stories do", () => {
	it("T5: a story page loads the reset after the tokens and before the base and the component's sheet", () => {
		const doc = storyDocument(
			{ component: "badge", html: '<span data-component="badge">ok</span>' },
			":root{--font-sans:x}",
			{
				styles: [{ component: "badge", css: ".badge-own {}" }],
				base: "body { color: red; }",
				reset: "a:where([data-component]) { color: inherit; }",
			},
		);
		const at = (needle: string) => doc.indexOf(needle);
		expect(at("data-foundation")).toBeGreaterThanOrEqual(0);
		expect(at('data-component-style="_reset"')).toBeGreaterThan(at("data-foundation"));
		expect(at('data-component-style="_base"')).toBeGreaterThan(at('data-component-style="_reset"'));
		expect(at('data-component-style="badge"')).toBeGreaterThan(at('data-component-style="_base"'));
	});

	const MARKUP =
		'<html><head><style>.grid { display: grid; } [data-component="card"] .grid { gap: 0; } .grid::before { content: ""; } .page { color: red; }</style></head><body class="page"><div data-component="card" class="grid">x</div></body></html>';
	const SCOPE = ":not(:where([data-component], [data-component] *))";

	it("T6: a mockup's own rule never reaches a component; a rule naming a marker still places it", () => {
		const doc = mockupDocument(MARKUP, ":root{}", [{ component: "card", css: ".card-own {}" }], "");
		const own = doc.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
		const selectors: string[] = [];
		postcss.parse(own).walkRules((r) => {
			selectors.push(...r.selectors);
		});
		expect(selectors).toEqual([
			`.grid${SCOPE}`,
			'[data-component="card"] .grid',
			`.grid${SCOPE}::before`,
			`.page${SCOPE}`,
		]);
		// the foundation's and the component's own sheets are not the mockup's rules
		expect(doc).toContain(".card-own {}");
		expect(doc).not.toContain(`.card-own${SCOPE}`);
	});
	it("a component's variant rules come after every component's plain rules, as the app's build orders them", () => {
		const doc = mockupDocument(
			"<html><head></head><body></body></html>",
			":root{}",
			[
				{
					component: "a",
					css: ".flex { display: flex; }\n.max-md-hidden { @media (width < 759px) { display: none; } }\n@media (max-width: 759px) { .cols { gap: 1px; } }",
				},
				{ component: "b", css: ".flex { display: flex; }\n.p-1 { padding: 1px; }" },
			],
			"",
		);
		const at = (needle: string, from = 0) => doc.indexOf(needle, from);
		const lastPlain = doc.lastIndexOf(".flex { display: flex; }");
		expect(at(".max-md-hidden")).toBeGreaterThan(lastPlain);
		expect(at("@media (max-width: 759px)")).toBeGreaterThan(lastPlain);
		expect(at(".p-1 { padding: 1px; }")).toBeGreaterThan(-1);
		expect(doc.match(/\.flex \{ display: flex; \}/g)).toHaveLength(2);
	});
});
