// promise: a-look-check-costs-what-changed
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkApp } from "./check.js";
import { fakeOpener, fixtureApp } from "./check-run.fixtures.js";
import { devServerMarker } from "./dev-server.js";
import { readApp } from "./mockups.js";

describe("devServerMarker", () => {
	it.each([
		[
			'<script src="/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_0b1mqtk._.js">',
			"hmr-client",
		],
		['<script src="/_next/static/chunks/react-refresh.js">', "react-refresh"],
		['<script type="module" src="/@vite/client"></script>', "/@vite/client"],
	])("names the development marker in %s", (html, marker) => {
		expect(devServerMarker(html)).toBe(marker);
	});

	it("finds none in a production page", () => {
		expect(
			devServerMarker('<link rel="stylesheet" href="/_next/static/chunks/0my-dgs-thrfj.css">'),
		).toBeNull();
	});
});

describe("checkApp on a development server", () => {
	it("refuses before any look opens, naming the declared serve command", async () => {
		const { app, approvals } = await fixtureApp(["home.empty"], [], {
			serve: "pnpm build && pnpm start",
		});
		const opener = fakeOpener({ "home.empty": "held" });
		await expect(
			checkApp(app, approvals, "http://app", [], {
				opener,
				fetchPage: async () => '<script src="/@vite/client"></script>',
			}),
		).rejects.toThrow(/development server \(\/@vite\/client\).*pnpm build && pnpm start/s);
		expect(opener.opened).toEqual([]);
	});

	it("says how to declare one when the app declares no serve command", async () => {
		const { app, approvals } = await fixtureApp(["home.empty"]);
		await expect(
			checkApp(app, approvals, "http://app", [], {
				opener: fakeOpener({}),
				fetchPage: async () => '<script src="/@vite/client"></script>',
			}),
		).rejects.toThrow(/"serve".*screens\.json/s);
	});
});

describe("an app's serve declaration", () => {
	it("is read from screens.json and reopens nothing", async () => {
		const { root, app } = await fixtureApp([]);
		const file = join(app.dir, "screens.json");
		const declared = JSON.parse(readFileSync(file, "utf-8"));
		writeFileSync(file, JSON.stringify({ ...declared, serve: "pnpm build && pnpm start" }));
		const served = await readApp(root, "demo");
		expect(served.serve).toBe("pnpm build && pnpm start");
		expect(served.declarationsHash).toBe(app.declarationsHash);
	});
});
