/**
 * clause: a-look-check-runs-what-changed/the-changed-looks
 * clause: a-look-check-runs-what-changed/no-other-look
 * promise: a-look-check-runs-what-changed
 *
 * A look check of what changed: `touched` (record names) decides which looks
 * open; every other look is reported from its held result. No browser.
 */
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkApp } from "./check.js";
import { fakeOpener, fixtureApp, servedPage } from "./check-run.fixtures.js";

/** Check the fixture once so both looks are held, and hand back what a second check needs. */
async function heldFixture() {
	const fixture = await fixtureApp(["home.empty", "home.full"]);
	const { app, approvals, home, root } = fixture;
	const common = { projectRoot: root, home, fetchPage: servedPage };
	await checkApp(app, approvals, "http://app", [], {
		...common,
		opener: fakeOpener({ "home.empty": "held", "home.full": "held" }),
	});
	return { ...fixture, common };
}

describe("a look check of what changed", () => {
	it("T11 a touched look is opened on every device it is drawn for", async () => {
		const { app, approvals, common } = await heldFixture();
		const inner = fakeOpener({ "home.full": "held" });
		const seen: string[][] = [];
		const opener = {
			...inner,
			open: async (...args: Parameters<typeof inner.open>) => {
				seen.push(args[1].map((d) => d.name));
				return inner.open(...args);
			},
		};
		const report = await checkApp(app, approvals, "http://app", [], {
			...common,
			opener,
			touched: new Set(["screen:home.full"]),
		});
		expect(inner.opened).toEqual(["home.full"]);
		expect(seen).toEqual([app.devices.map((d) => d.name)]);
		const devices = new Set(report.results.map((r) => r.device.split("/")[0]));
		expect([...devices].sort()).toEqual(app.devices.map((d) => d.name).sort());
		expect(report.reused.map((r) => r.look)).toEqual(["home.empty"]);
	});

	it("T12 an untouched look is reused even though its key changed", async () => {
		const { app, approvals, common, root } = await heldFixture();
		// The app's page code changed: every screen's key differs from the held one.
		appendFileSync(join(root, "src", "Card.jsx"), "\n// edited\n");
		const opener = fakeOpener({ "home.full": "held" });
		const report = await checkApp(app, approvals, "http://app", [], {
			...common,
			opener,
			touched: new Set(["screen:home.full"]),
		});
		expect(opener.opened).toEqual(["home.full"]);
		expect(report.reused.map((r) => r.look)).toEqual(["home.empty"]);
		expect(report.reused[0]?.devices).toEqual(
			app.devices.flatMap((d) => [d.name, `${d.name}/dark`]),
		);
	});

	it("a look never held is opened, touched or not", async () => {
		const { app, approvals, root, home } = await fixtureApp(["home.empty"]);
		const opener = fakeOpener({ "home.empty": "held" });
		await checkApp(app, approvals, "http://app", [], {
			projectRoot: root,
			home,
			fetchPage: servedPage,
			opener,
			touched: new Set(),
		});
		expect(opener.opened).toEqual(["home.empty"]);
	});

	it("--all opens every look whatever is touched", async () => {
		const { app, approvals, common } = await heldFixture();
		const opener = fakeOpener({ "home.empty": "held", "home.full": "held" });
		await checkApp(app, approvals, "http://app", [], {
			...common,
			opener,
			all: true,
			touched: new Set(),
		});
		expect(opener.opened.sort()).toEqual(["home.empty", "home.full"]);
	});
});
