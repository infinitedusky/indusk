import { describe, expect, it } from "vitest";
import { type AppLooksRead, proposedCount, storyDocument } from "./overview";

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
		const doc = storyDocument(
			story,
			":root{--font-sans:x}",
			styles,
			"body { font-family: var(--font-sans); }",
		);
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
		expect(storyDocument(story, "", styles)).not.toContain('data-component-style="_base"');
	});
});
