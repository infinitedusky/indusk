import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readApprovals } from "./approvals.js";
import * as check from "./check.js";
import { checkable, pageUrl } from "./check.js";
import { readApp } from "./mockups.js";

/**
 * promise: tokens-are-held-exactly — which screen states the browser check
 * opens, and where. No browser: the driver half is `looks-browser.contract.test.ts`.
 * promise: every-part-of-the-ui-is-covered — A36, through the `judgeLook` seam.
 */

const FIXTURE = join(__dirname, "..", "..", "__tests__", "fixtures", "looks-app");

describe("checkable — what the app is held to", () => {
	it("opens an approved mockup, and one held to its last approved version on an unchanged foundation", async () => {
		const app = await readApp(FIXTURE, "demo");
		const { checked, unchecked } = checkable(app, readApprovals(app));
		expect(checked.map((c) => `${c.screen}.${c.state}`).sort()).toEqual([
			"home.empty",
			"home.full",
		]);
		expect(unchecked).toEqual([{ mockup: "detail.default", reason: "proposed, never approved" }]);
	});

	it("checks nothing against a mockup nobody approved", async () => {
		const app = await readApp(FIXTURE, "demo");
		const { checked } = checkable(app, []);
		expect(checked).toEqual([]);
	});
});

describe("pageUrl", () => {
	it("serves a screen at its declared path, else /<name>, with the state as a query", () => {
		expect(pageUrl("http://localhost:3000", "home", undefined, "empty")).toBe(
			"http://localhost:3000/home?state=empty",
		);
		expect(pageUrl("http://localhost:3000/app/", "home", "/", "full")).toBe(
			"http://localhost:3000/?state=full",
		);
	});
});

/**
 * ui-promises A36 — promise: every-part-of-the-ui-is-covered. A screen state
 * is held only when the page says it rendered that state: the measure reads
 * the page's own answer (`data-look-state`) and `judgeLook` decides from it,
 * with no browser. Absent or another state, the look is unchecked, naming why.
 */
describe("A36 — a state the page did not say it rendered is unchecked, never held", () => {
	const held = { runtime: { "--color-dusk": "#c2620b" }, elements: [] };
	const judge = (states: string[]) =>
		(check as unknown as { judgeLook?: (input: unknown) => unknown }).judgeLook?.({
			app: "demo",
			look: { screen: "home", state: "empty" },
			device: "phone",
			scheme: "light",
			approved: { "--color-dusk": "#c2620b" },
			seen: { ...held, states, scheme: "light" },
		});

	it("A36 a page that reports no state is unchecked, naming the state it did not report", () => {
		expect(judge([])).toEqual({
			unchecked: {
				mockup: "home.empty",
				device: "phone",
				reason: "the page did not report state empty",
			},
		});
	});

	it("A36 a page that reports another state is unchecked too", () => {
		expect(judge(["home.full"])).toMatchObject({
			unchecked: { mockup: "home.empty", reason: "the page did not report state empty" },
		});
	});

	it("A36 a page that reports the state is judged by value", () => {
		const out = judge(["nav.expanded", "home.empty"]) as {
			result?: { verdict: { state: string } };
		};
		expect(out?.result?.verdict.state).toBe("held");
	});
});
