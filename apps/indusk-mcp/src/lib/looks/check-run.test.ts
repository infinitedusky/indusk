/**
 * promise: a-look-check-costs-what-changed — which looks the check opens and
 * how it reports them, decided from an opener it is given (looks-check-speed
 * A16, A17, A18). No browser.
 */
import { describe, expect, it } from "vitest";
import { checkApp } from "./check.js";
import { fakeOpener, fixtureApp } from "./check-run.fixtures.js";

describe("what the check opens", () => {
	it("a look that does not load in time is unchecked at every device and scheme; the rest are judged", async () => {
		const { app, approvals } = await fixtureApp(["home.empty", "home.full"]);
		const opener = fakeOpener({ "home.empty": "timeout", "home.full": "held" });
		const { results, unchecked } = await checkApp(app, approvals, "http://app", [], { opener });
		expect(unchecked.filter((u) => u.mockup === "home.empty").map((u) => u.device)).toEqual(
			app.devices.flatMap((d) => [d.name, `${d.name}/dark`]),
		);
		expect(unchecked[0].reason).toMatch(/timed out 2 times/);
		expect(results.filter((r) => r.state === "full")).toHaveLength(app.devices.length * 2);
	});

	it("--only checks just the named looks, screen and story alike", async () => {
		const { app, approvals, storyApprovals } = await fixtureApp(["home.empty", "home.full"], ["home.full"]);
		const opener = fakeOpener({ "home.empty": "held", "home.full": "held", "story home.full": "held" });
		const { results } = await checkApp(app, approvals, "http://app", storyApprovals, { opener, only: ["home.full"] });
		expect(opener.opened.sort()).toEqual(["home.full", "story home.full"]);
		expect(new Set(results.map((r) => `${r.kind ?? "screen"}:${r.screen}.${r.state}`))).toEqual(
			new Set(["screen:home.full", "story:home.full"]),
		);
	});

	it("--only with a name no look has is refused, naming it, before any page opens", async () => {
		const { app, approvals } = await fixtureApp(["home.empty"]);
		const opener = fakeOpener({ "home.empty": "held" });
		await expect(checkApp(app, approvals, "http://app", [], { opener, only: ["nope.x"] })).rejects.toThrow(/nope\.x/);
		expect(opener.opened).toEqual([]);
	});
});
