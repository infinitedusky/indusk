/**
 * promise: a-look-check-costs-what-changed
 * promise: tokens-are-held-exactly
 *
 * When a look's last held result is reused, and where it is kept
 * (looks-check-speed A2-A8, A19). The rule is pure: every input is handed in.
 */
import { appendFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { checkApp } from "./check.js";
import { fakeOpener, fixtureApp } from "./check-run.fixtures.js";
import { pageSourceFilter } from "./components.js";
import { pageSourcesHashOf, sourcesHashOf } from "./mockups.js";
import {
	type Held,
	heldPath,
	type LookKey,
	lookKey,
	readHeld,
	reuseOf,
	writeHeld,
} from "./reuse.js";

const story = {
	kind: "story",
	name: "badge.ok",
	foundationHash: "f",
	declarationsHash: "d",
	devices: "phone,desktop",
	schemes: "light,dark",
	snapshotHash: "s",
	stylesheetHash: "c",
	current: true,
} as const;
const held = { key: story, at: "2026-10-16T03:00:00.000Z", state: "held" as const };

describe("whether a look's last held result is reused", () => {
	it("reuses a look whose every input is unchanged", () => {
		expect(reuseOf(held, story)).toEqual({ reuse: true, at: held.at });
	});

	it.each([
		["snapshot", { snapshotHash: "s2" }], // A2
		["stylesheet", { stylesheetHash: "c2" }], // A2
		["declarations", { declarationsHash: "d2" }], // A3
		["devices", { devices: "phone" }], // A3
		["foundation", { foundationHash: "f2" }], // A19
	])("reopens a look whose %s changed", (changed, patch) => {
		expect(reuseOf(held, { ...story, ...patch })).toEqual({ reuse: false, changed });
	});

	it("A2: a changed mockup or composed component reopens the screen", () => {
		const screen = {
			kind: "screen",
			name: "home.full",
			foundationHash: "f",
			declarationsHash: "d",
			devices: "phone,desktop",
			schemes: "light,dark",
			mockupHash: "m",
			componentsHash: "k",
			pageSourcesHash: "p",
			path: "/home",
			seed: "",
			current: true,
			uncomposed: false,
		} as const;
		const h = { key: screen, at: held.at, state: "held" as const };
		expect(reuseOf(h, { ...screen, mockupHash: "m2" })).toEqual({
			reuse: false,
			changed: "mockup",
		});
		expect(reuseOf(h, { ...screen, componentsHash: "k2" })).toEqual({
			reuse: false,
			changed: "components",
		});
	});

	it("A4: reopens a look last broken or unchecked, or never held", () => {
		expect(reuseOf({ ...held, state: "broken" }, story).reuse).toBe(false);
		expect(reuseOf({ ...held, state: "unchecked" }, story).reuse).toBe(false);
		expect(reuseOf(undefined, story).reuse).toBe(false);
	});

	it("A5: reuses nothing when the stories were not rendered from the current sources", () => {
		expect(reuseOf(held, { ...story, current: false })).toEqual({
			reuse: false,
			changed: "stories not rendered from the current sources",
		});
	});

	it("A5: after a source edit the stories were not rendered from, the check opens every look and says to render the stories", async () => {
		const { app, approvals, storyApprovals, root, home } = await fixtureApp(
			["home.empty"],
			["home.full"],
		);
		const answers = { "home.empty": "held", "story home.full": "held" } as const;
		await checkApp(app, approvals, "http://app", storyApprovals, {
			opener: fakeOpener(answers),
			projectRoot: root,
			home,
		});
		writeFileSync(join(root, "src", "Edited.jsx"), "export const edited = 1;\n");
		const opener = fakeOpener(answers);
		const report = await checkApp(app, approvals, "http://app", storyApprovals, {
			opener,
			projectRoot: root,
			home,
		});
		expect(opener.opened.sort()).toEqual(["home.empty", "story home.full"]);
		expect(report.reused).toEqual([]);
		expect(report.notice).toMatch(/indusk looks stories demo/);
	});

	it("A6: a page-code edit reopens every screen and no story; an uncomposed screen is never reused; a changed seed reopens its screen", async () => {
		const { app } = await fixtureApp(["home.full"], ["home.full"]);
		const facts = { current: true, pageSourcesHash: "p", schemes: ["light", "dark"] };
		const edited = { ...facts, pageSourcesHash: "p2" };
		const screenLook = { screen: "home", state: "full" };
		const storyLook = { name: "home.full", component: "home", state: "full", id: "home--full" };
		const heldOn = (key: LookKey): Held => ({ key, at: held.at, state: "held" });
		const screenBefore = heldOn(lookKey(app, screenLook, facts));
		const storyBefore = heldOn(lookKey(app, storyLook, facts));

		// Page code is in a screen's key and not in a story's.
		expect(reuseOf(screenBefore, lookKey(app, screenLook, edited))).toEqual({
			reuse: false,
			changed: "page code",
		});
		expect(reuseOf(storyBefore, lookKey(app, storyLook, edited))).toEqual({
			reuse: true,
			at: held.at,
		});
		expect(reuseOf(screenBefore, lookKey(app, screenLook, facts))).toEqual({
			reuse: true,
			at: held.at,
		});

		expect(reuseOf(screenBefore, lookKey(app, { ...screenLook, seed: "make-one" }, facts))).toEqual(
			{ reuse: false, changed: "seed" },
		);

		app.uncomposed = ["home.full"];
		expect(reuseOf(screenBefore, lookKey(app, screenLook, facts))).toEqual({
			reuse: false,
			changed: "uncomposed",
		});
	});

	it("A6: the page-code hash moves with a layout or stylesheet edit and not with a catalogued component's, a story's or a test's", async () => {
		const { app, root } = await fixtureApp([]);
		const catalog = {
			components: [{ name: "badge", file: "src/Badge.jsx", properties: [], states: [] }],
		};
		const page = () => pageSourcesHashOf(root, app, pageSourceFilter(catalog));
		const all = () => sourcesHashOf(root, app);
		const [page0, all0] = [await page(), await all()];
		appendFileSync(join(root, "src", "Badge.jsx"), "// edited\n");
		writeFileSync(join(root, "src", "Badge.stories.jsx"), "export default {};\n");
		writeFileSync(join(root, "src", "Badge.test.jsx"), "// a test\n");
		expect(await page()).toBe(page0);
		expect(await all()).not.toBe(all0);
		appendFileSync(join(root, "src", "styles.css"), "/* edited */\n");
		expect(await page()).not.toBe(page0);
	});

	it("A7: reopens every look with --all", () => {
		expect(reuseOf(held, story, { all: true })).toEqual({ reuse: false, changed: "--all" });
	});

	it("A19: a changed foundation reopens every look, story and screen alike", async () => {
		const { app } = await fixtureApp(["home.full"], ["home.full"]);
		const facts = { current: true, pageSourcesHash: "p", schemes: ["light", "dark"] };
		const looks = [
			{ screen: "home", state: "full" },
			{ name: "home.full", component: "home", state: "full", id: "home--full" },
		];
		const before = looks.map((l) => ({
			key: lookKey(app, l, facts),
			at: held.at,
			state: "held" as const,
		}));
		app.foundation = { ...app.foundation, hash: `${app.foundation.hash}-changed` };
		looks.forEach((l, i) => {
			expect(reuseOf(before[i], lookKey(app, l, facts))).toEqual({
				reuse: false,
				changed: "foundation",
			});
		});
	});
});

describe("where held results are kept", () => {
	let fixture: Fixture | undefined;
	afterEach(() => {
		fixture?.cleanup();
		fixture = undefined;
	});

	/** Every file under `dir`, relative, git's own folder aside. */
	function listFiles(dir: string): string[] {
		return readdirSync(dir, { recursive: true, withFileTypes: true })
			.filter((e) => e.isFile())
			.map((e) => relative(dir, join(e.parentPath, e.name)))
			.filter((f) => !f.startsWith(".git"))
			.sort();
	}

	it("A8: keeps held results in the project's home, the same from another worktree, and nothing in the checkout", () => {
		fixture = makeFixture();
		const { main: repo, worktree, home } = fixture;
		const before = listFiles(repo);
		writeHeld(repo, "admin", { "story:badge.ok": held }, home);
		expect(heldPath(repo, "admin", home).startsWith(join(home, "projects"))).toBe(true);
		expect(heldPath(worktree, "admin", home)).toBe(heldPath(repo, "admin", home));
		expect(readHeld(worktree, "admin", home)["story:badge.ok"]).toEqual(held);
		expect(listFiles(repo)).toEqual(before);
	});

	it("A8: a held-results file that cannot be read is no results, never the end of the check", () => {
		fixture = makeFixture();
		const { main: repo, home } = fixture;
		writeHeld(repo, "admin", { "story:badge.ok": held }, home);
		writeFileSync(heldPath(repo, "admin", home), "{ not json");
		expect(readHeld(repo, "admin", home)).toEqual({});
	});
});
