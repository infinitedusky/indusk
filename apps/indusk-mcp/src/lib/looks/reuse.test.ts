/**
 * promise: a-look-check-runs-what-changed
 * promise: tokens-are-held-exactly
 *
 * When a look's last held result is reused, and where it is kept
 * (looks-check-speed A2-A8, A19, A28-A32, A38, A39). The rule is pure: every
 * input is handed in.
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { checkApp } from "./check.js";
import { fakeOpener, fixtureApp, servedPage } from "./check-run.fixtures.js";
import { pageSourceFilter } from "./components.js";
import { type LooksApp, pageSourcesHashOf, servedBuildOf, sourcesHashOf } from "./mockups.js";
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
	configHash: "k0",
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
			configHash: "k0",
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
			fetchPage: servedPage,
			home,
		});
		writeFileSync(join(root, "src", "Edited.jsx"), "export const edited = 1;\n");
		const opener = fakeOpener(answers);
		const report = await checkApp(app, approvals, "http://app", storyApprovals, {
			opener,
			projectRoot: root,
			fetchPage: servedPage,
			home,
		});
		expect(opener.opened.sort()).toEqual(["home.empty", "story home.full"]);
		expect(report.reused).toEqual([]);
		expect(report.notice).toMatch(/indusk looks stories demo/);
	});

	it("A6: a page-code edit reopens every screen and no story; an uncomposed screen is never reused; a changed seed reopens its screen", async () => {
		const { app } = await fixtureApp(["home.full"], ["home.full"]);
		const facts = {
			current: true,
			pageSourcesHash: "p",
			schemes: ["light", "dark"],
			configHash: "k0",
		};
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
		const facts = {
			current: true,
			pageSourcesHash: "p",
			schemes: ["light", "dark"],
			configHash: "k0",
		};
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

describe("what is actually served is judged against the sources", () => {
	it("A38: tells a build by its assets and inline styles, not by the page's text", () => {
		const page = (text: string, css: string) =>
			`<link rel="stylesheet" href="/${css}.css"><script src="/a.js"></script><p>${text}</p>`;
		expect(servedBuildOf(page("one", "x"))).toBe(servedBuildOf(page("two", "x")));
		expect(servedBuildOf(page("one", "x"))).not.toBe(servedBuildOf(page("one", "y")));
		expect(servedBuildOf("<p>nothing to tell by</p>")).toBeNull();
	});

	it("A38: judges the served build against the sources, not as part of the key", () => {
		const built = (sources: string, served: string) => ({ build: { sources, served } });
		const record = { ...held, ...built("s1", "b1") };
		// same sources, same build: reused; edited sources, rebuilt: reused
		expect(reuseOf(record, story, built("s1", "b1"))).toEqual({ reuse: true, at: held.at });
		expect(reuseOf(record, story, built("s2", "b2"))).toEqual({ reuse: true, at: held.at });
		// same sources served by another build: reopened
		expect(reuseOf(record, story, built("s1", "b2"))).toEqual({
			reuse: false,
			changed: "served build",
		});
		// edited sources still served by the old build: this look's own inputs are
		// unchanged, so it stands on the build it was measured on (A29)
		expect(reuseOf(record, story, built("s2", "b1"))).toEqual({ reuse: true, at: held.at });
		// a record that kept no build, and a build that could not be read
		expect(reuseOf(held, story, built("s1", "b1"))).toEqual({
			reuse: false,
			changed: "served build",
		});
		expect(reuseOf(record, story, { build: null })).toEqual({
			reuse: false,
			changed: "served build unreadable",
		});
	});

	it("A39: reopens a look whose styling configuration or lockfile changed", () => {
		expect(reuseOf(held, { ...story, configHash: "k1" })).toEqual({
			reuse: false,
			changed: "configuration",
		});
	});

	it.each([
		["a Tailwind config", "tailwind.config.js"],
		["a PostCSS config", "postcss.config.mjs"],
		["the Storybook config", ".storybook/main.ts"],
		["the lockfile", "pnpm-lock.yaml"],
	])("A39: a check after %s changed opens every look it held", async (_name, file) => {
		const { app, approvals, root, home } = await fixtureApp(["home.empty"]);
		const run = async (answers: Record<string, "held">) => {
			const opener = fakeOpener(answers);
			await checkApp(app, approvals, "http://app", [], {
				opener,
				projectRoot: root,
				home,
				fetchPage: servedPage,
			});
			return opener.opened;
		};
		expect(await run({ "home.empty": "held" })).toEqual(["home.empty"]);
		expect(await run({})).toEqual([]);
		const target = join(root, file);
		mkdirSync(join(target, ".."), { recursive: true });
		writeFileSync(target, "one\n");
		expect(await run({ "home.empty": "held" })).toEqual(["home.empty"]);
		expect(await run({})).toEqual([]);
		writeFileSync(target, "two\n");
		expect(await run({ "home.empty": "held" })).toEqual(["home.empty"]);
	});

	it("A38: a check reopens a look served by another build of the same sources, and reuses it after a rebuild", async () => {
		const { app, approvals, storyApprovals, root, home } = await fixtureApp([], ["home.full"]);
		const build = (name: string) => async () => `<link rel="stylesheet" href="/${name}.css">`;
		const run = async (fetchPage: () => Promise<string>, answers: Record<string, "held"> = {}) => {
			const opener = fakeOpener(answers);
			const report = await checkApp(app, approvals, "http://app", storyApprovals, {
				opener,
				projectRoot: root,
				home,
				fetchPage,
			});
			return { opened: opener.opened, report };
		};
		/** An edit to the sources, with the stories rendered from them again. */
		const edit = async (text: string) => {
			writeFileSync(join(root, "src", "Edited.jsx"), text);
			const catalog = join(app.dir, "components.json");
			const rendered = JSON.parse(readFileSync(catalog, "utf-8"));
			rendered.renderedFrom = await sourcesHashOf(root, app);
			writeFileSync(catalog, JSON.stringify(rendered));
		};
		const held = { "story home.full": "held" } as const;
		expect((await run(build("old"), held)).opened).toEqual(["story home.full"]);
		expect((await run(build("old"))).opened).toEqual([]);
		expect((await run(build("new"), held)).opened).toEqual(["story home.full"]);
		// an edit, then the server still serving the build from before it: the story's own inputs are unchanged (A29)
		await edit("export const one = 1;\n");
		expect((await run(build("new"))).opened).toEqual([]);
		// an edit, rebuilt: the story is unchanged, so it is reused and the record follows the build
		await edit("export const two = 2;\n");
		const rebuilt = await run(build("rebuilt"));
		expect(rebuilt.opened).toEqual([]);
		expect(rebuilt.report.reused.map((r) => r.look)).toEqual(["home.full"]);
		await edit("export const three = 3;\n");
		expect((await run(build("rebuilt"))).opened).toEqual([]);
		const unread = await run(async () => {
			throw new Error("connection refused");
		}, held);
		expect(unread.opened).toEqual(["story home.full"]);
		expect(unread.report.notice).toMatch(/could not be read/);
	});
});

/** The stories rendered again from the sources as they are now: the catalog's `renderedFrom` moved, with `extra` beside it. */
async function renderedAgain(root: string, app: LooksApp, extra: object = {}): Promise<void> {
	const catalog = join(app.dir, "components.json");
	const rendered = JSON.parse(readFileSync(catalog, "utf-8"));
	writeFileSync(
		catalog,
		JSON.stringify({ ...rendered, ...extra, renderedFrom: await sourcesHashOf(root, app) }),
	);
}

/** A served page of one stylesheet named `name`: the build's identity. */
const build = (name: string) => async () => `<link rel="stylesheet" href="/${name}.css">`;

describe("a reuse proves only the build it measured", () => {
	it("A28: a look opened while the server still serves the build from before the sources changed is reported, not kept, and opened again on the next run", async () => {
		const { app, approvals, root, home } = await fixtureApp(["home.empty"], [], {
			serve: "pnpm build && pnpm start",
		});
		const run = async () => {
			const opener = fakeOpener({ "home.empty": "held" });
			const report = await checkApp(app, approvals, "http://app", [], {
				opener,
				projectRoot: root,
				home,
				fetchPage: build("old"),
			});
			return { opened: opener.opened, report };
		};
		expect((await run()).opened).toEqual(["home.empty"]);
		// A page-code edit, the stories rendered from it, and the server not rebuilt.
		appendFileSync(join(root, "src", "styles.css"), "/* edited */\n");
		await renderedAgain(root, app);
		const stale = await run();
		expect(stale.opened).toEqual(["home.empty"]);
		expect(stale.report.results).toHaveLength(app.devices.length * 2);
		expect(stale.report.notice ?? "(no notice)").toMatch(
			/http:\/\/app serves a build from before the sources changed — results were not kept; rebuild and serve it: pnpm build && pnpm start/,
		);
		const again = await run();
		expect(again.opened, "a result measured on the old build was kept as held").toEqual([
			"home.empty",
		]);
	});

	it("A29: against a server not rebuilt since a page-code edit, a story whose own inputs are unchanged is reused, and its record keeps the build it was measured on", async () => {
		const { app, approvals, storyApprovals, root, home } = await fixtureApp([], ["home.full"]);
		const run = async () => {
			const opener = fakeOpener({ "story home.full": "held" });
			const report = await checkApp(app, approvals, "http://app", storyApprovals, {
				opener,
				projectRoot: root,
				home,
				fetchPage: build("old"),
			});
			return { opened: opener.opened, report };
		};
		await run();
		const measuredOn = readHeld(root, app.app, home)["story:home.full"]?.build;
		expect(measuredOn).toBeDefined();
		appendFileSync(join(root, "src", "styles.css"), "/* page code */\n");
		await renderedAgain(root, app);
		const after = await run();
		expect(after.opened).toEqual([]);
		expect(after.report.reused.map((r) => r.look)).toEqual(["home.full"]);
		expect(readHeld(root, app.app, home)["story:home.full"]?.build).toEqual(measuredOn);
	});

	it("A30: the element, universal and root rules of the app's compiled CSS are hashed apart from any class's", async () => {
		const styles = (await import("./component-styles.js")) as Record<string, unknown>;
		const elementRulesOf = styles.elementRulesOf as ((css: string) => string) | undefined;
		expect(elementRulesOf, "component-styles exports no elementRulesOf").toBeTypeOf("function");
		if (!elementRulesOf) return;
		const css = (a: string, h2: string, badge: string, marked: string) =>
			`@layer base { *, ::before { box-sizing: border-box; } a { color: ${a}; } html, :root { line-height: 1.5; } body { margin: 0; } }
@media (min-width: 40rem) { h2 { font-size: ${h2}; } }
@layer utilities { .badge { color: ${badge}; } [data-component="card"] p { color: ${marked}; } }`;
		const base = elementRulesOf(css("red", "2rem", "x", "y"));
		expect(elementRulesOf(css("blue", "2rem", "x", "y"))).not.toBe(base);
		expect(elementRulesOf(css("red", "3rem", "x", "y"))).not.toBe(base);
		expect(elementRulesOf(css("red", "2rem", "x2", "y2"))).toBe(base);
	});

	it("A30: a re-render after an element, universal or body rule changed reopens every story", async () => {
		const { app, approvals, storyApprovals, root, home } = await fixtureApp(
			[],
			["home.full", "home.empty"],
		);
		const run = async () => {
			const opener = fakeOpener({ "story home.full": "held", "story home.empty": "held" });
			await checkApp(app, approvals, "http://app", storyApprovals, {
				opener,
				projectRoot: root,
				home,
				fetchPage: build("b"),
			});
			return opener.opened.sort();
		};
		await renderedAgain(root, app, { baseRulesHash: "rules-1" });
		expect(await run()).toEqual(["story home.empty", "story home.full"]);
		expect(await run()).toEqual([]);
		await renderedAgain(root, app, { baseRulesHash: "rules-2" });
		expect(await run()).toEqual(["story home.empty", "story home.full"]);
	});

	it("A31: a changed checker reopens a look, named as the checker", () => {
		const before = { ...held, key: { ...story, checkerHash: "c1" } };
		expect(reuseOf(before, { ...story, checkerHash: "c2" } as LookKey)).toEqual({
			reuse: false,
			changed: "checker",
		});
	});

	it("A31: every look is held to the checker that measured it, which moves with what is measured and how it is judged", async () => {
		const { app, approvals, root, home } = await fixtureApp(["home.empty"]);
		const run = async () => {
			const opener = fakeOpener({ "home.empty": "held" });
			await checkApp(app, approvals, "http://app", [], {
				opener,
				projectRoot: root,
				home,
				fetchPage: build("b"),
			});
			return opener.opened;
		};
		await run();
		const record = readHeld(root, app.app, home);
		const key = record["screen:home.empty"]?.key as unknown as Record<string, unknown>;
		expect(String(key.checkerHash), "a held look's key names no checker").toMatch(/^[0-9a-f]{64}$/);
		key.checkerHash = "a checker from an earlier release";
		writeHeld(root, app.app, record, home);
		expect(await run()).toEqual(["home.empty"]);

		const mockups = (await import("./mockups.js")) as Record<string, unknown>;
		const checkerHashOf = mockups.checkerHashOf as
			| ((c: { properties: readonly string[]; script: string; verdictVersion: number }) => string)
			| undefined;
		expect(checkerHashOf, "mockups exports no checkerHashOf").toBeTypeOf("function");
		if (!checkerHashOf) return;
		const now = { properties: ["color"], script: "measure()", verdictVersion: 1 };
		const h = checkerHashOf(now);
		expect(checkerHashOf({ ...now, properties: ["color", "outline-color"] })).not.toBe(h);
		expect(checkerHashOf({ ...now, script: "measure(2)" })).not.toBe(h);
		expect(checkerHashOf({ ...now, verdictVersion: 2 })).not.toBe(h);
	});

	it("A32: a look another check removed while this one ran is not written back as held", async () => {
		const { app, approvals, root, home } = await fixtureApp(["home.empty", "home.full"]);
		const run = (answers: Parameters<typeof fakeOpener>[0], onOpen?: () => void) =>
			checkApp(app, approvals, "http://app", [], {
				opener: fakeOpener(answers, onOpen),
				projectRoot: root,
				home,
				fetchPage: build("b"),
			});
		// home.empty held; home.full timed out, so the next run opens it.
		await run({ "home.empty": "held", "home.full": "timeout" });
		expect(Object.keys(readHeld(root, app.app, home))).toEqual(["screen:home.empty"]);
		// While this run measures home.full, another check of the project removes home.empty.
		await run({ "home.full": "held" }, () => {
			const now = readHeld(root, app.app, home);
			delete now["screen:home.empty"];
			writeHeld(root, app.app, now, home);
		});
		expect(Object.keys(readHeld(root, app.app, home)).sort()).toEqual(["screen:home.full"]);
	});

	it("A32: a look another check kept while this one ran stays kept", async () => {
		const { app, approvals, root, home } = await fixtureApp(["home.empty", "home.full"]);
		await checkApp(app, approvals, "http://app", [], {
			opener: fakeOpener({ "home.empty": "held", "home.full": "held" }),
			projectRoot: root,
			home,
			fetchPage: build("b"),
		});
		const kept = readHeld(root, app.app, home)["screen:home.full"] as Held;
		writeHeld(
			root,
			app.app,
			{ "screen:home.empty": readHeld(root, app.app, home)["screen:home.empty"] as Held },
			home,
		);
		await checkApp(app, approvals, "http://app", [], {
			opener: fakeOpener({ "home.full": "held" }, () => {
				writeHeld(
					root,
					app.app,
					{ ...readHeld(root, app.app, home), "story:other.ok": kept },
					home,
				);
			}),
			projectRoot: root,
			home,
			fetchPage: build("b"),
		});
		expect(Object.keys(readHeld(root, app.app, home)).sort()).toEqual([
			"screen:home.empty",
			"screen:home.full",
			"story:other.ok",
		]);
	});
});
