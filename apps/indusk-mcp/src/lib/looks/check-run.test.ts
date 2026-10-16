/**
 * promise: a-look-check-costs-what-changed — which looks the check opens and
 * how it reports them, decided from an opener it is given (looks-check-speed
 * A1, A9, A16, A17, A18). No browser.
 */
import { describe, expect, it } from "vitest";
import { checkApp } from "./check.js";
import { fakeOpener, fixtureApp, recordingTracer } from "./check-run.fixtures.js";
import { reportLooks } from "./report.js";

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
		const { app, approvals, storyApprovals } = await fixtureApp(
			["home.empty", "home.full"],
			["home.full"],
		);
		const opener = fakeOpener({
			"home.empty": "held",
			"home.full": "held",
			"story home.full": "held",
		});
		const { results } = await checkApp(app, approvals, "http://app", storyApprovals, {
			opener,
			only: ["home.full"],
		});
		expect(opener.opened.sort()).toEqual(["home.full", "story home.full"]);
		expect(new Set(results.map((r) => `${r.kind ?? "screen"}:${r.screen}.${r.state}`))).toEqual(
			new Set(["screen:home.full", "story:home.full"]),
		);
	});

	it("--only with a name no look has is refused, naming it, before any page opens", async () => {
		const { app, approvals } = await fixtureApp(["home.empty"]);
		const opener = fakeOpener({ "home.empty": "held" });
		await expect(
			checkApp(app, approvals, "http://app", [], { opener, only: ["nope.x"] }),
		).rejects.toThrow(/nope\.x/);
		expect(opener.opened).toEqual([]);
	});
});

describe("what the check reuses", () => {
	it("A1: a second check with nothing changed opens nothing and reports every look reused", async () => {
		const { app, approvals, home, root } = await fixtureApp(["home.empty", "home.full"]);
		const first = fakeOpener({ "home.empty": "held", "home.full": "held" });
		await checkApp(app, approvals, "http://app", [], { opener: first, projectRoot: root, home });
		const second = fakeOpener({});
		const report = await checkApp(app, approvals, "http://app", [], {
			opener: second,
			projectRoot: root,
			home,
		});
		expect(second.opened).toEqual([]);
		expect(second.launched).toBe(false);
		expect(report.results).toEqual([]);
		expect(report.reused.map((r) => r.look)).toEqual(["home.empty", "home.full"]);
		expect(report.reused[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("A9: a reused look sends an upheld signal marked reused, with when it was really measured", async () => {
		const { app, approvals, home, root } = await fixtureApp(["home.empty"]);
		await checkApp(app, approvals, "http://app", [], {
			opener: fakeOpener({ "home.empty": "held" }),
			projectRoot: root,
			home,
			now: new Date("2026-10-16T03:00:00.000Z"),
		});
		const report = await checkApp(app, approvals, "http://app", [], {
			opener: fakeOpener({}),
			projectRoot: root,
			home,
		});
		const spans = recordingTracer();
		reportLooks(report.results, spans.tracer, { reused: report.reused });
		expect(spans.all()).toHaveLength(app.devices.length * 2);
		for (const span of spans.all()) {
			expect(span.attributes["indusk.promise.outcome"]).toBe("upheld");
			expect(span.attributes["indusk.look.reused"]).toBe(true);
			expect(span.attributes["indusk.look.measured_at"]).toBe("2026-10-16T03:00:00.000Z");
		}
		const fresh = await checkApp(app, approvals, "http://app", [], {
			opener: fakeOpener({ "home.empty": "held" }),
			projectRoot: root,
			home,
			all: true,
		});
		const again = recordingTracer();
		reportLooks(fresh.results, again.tracer, { reused: fresh.reused });
		expect(again.all()).toHaveLength(app.devices.length * 2);
		expect(again.all().every((s) => s.attributes["indusk.look.reused"] === undefined)).toBe(true);
	});
});
