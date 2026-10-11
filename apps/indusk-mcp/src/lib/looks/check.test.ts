import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readApprovals } from "./approvals.js";
import { checkable, pageUrl } from "./check.js";
import { readApp } from "./mockups.js";

/**
 * promise: tokens-are-held-exactly — which screen states the browser check
 * opens, and where. No browser: the driver half is `looks-browser.contract.test.ts`.
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
