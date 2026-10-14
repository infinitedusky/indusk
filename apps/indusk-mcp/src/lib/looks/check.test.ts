import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readApprovals, readStoryApprovals } from "./approvals.js";
import * as check from "./check.js";
import { checkable, type LookTarget, pageUrl, withScreenSeed } from "./check.js";
import { type LooksApp, readApp } from "./mockups.js";

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

/**
 * storybook-components Build Phase 4 — promise: tokens-are-held-exactly. The
 * value check reaches stories: which stories are opened and where, judged from
 * values with no browser (A19's contract opens them in Chromium).
 */
describe("checkableStories — the stories the app is held to", () => {
	const COMPONENTS = join(__dirname, "..", "..", "__tests__", "fixtures", "components-app");

	/** A copy of the components fixture whose catalog gives `badge.ok` a Storybook id. */
	async function withIds(): Promise<string> {
		const { cpSync, mkdtempSync, readFileSync, writeFileSync } = await import("node:fs");
		const { tmpdir } = await import("node:os");
		const root = mkdtempSync(join(tmpdir(), "looks-stories-check-"));
		cpSync(COMPONENTS, root, { recursive: true });
		const file = join(root, ".indusk/mockups/demo/components.json");
		const catalog = JSON.parse(readFileSync(file, "utf-8"));
		catalog.components[0].states[0].id = "components-badge--ok";
		writeFileSync(file, JSON.stringify(catalog, null, "\t"));
		return root;
	}

	it("opens an approved story that has a Storybook id; a proposed one is unchecked, never approved", async () => {
		const root = await withIds();
		const app = await readApp(root, "demo");
		const { checked, unchecked } = check.checkableStories(app, readStoryApprovals(app));
		expect(checked).toEqual([
			{ name: "badge.ok", component: "badge", state: "ok", id: "components-badge--ok" },
		]);
		expect(unchecked).toContainEqual({
			mockup: "story badge.broken",
			reason: "proposed, never approved",
		});
	});

	it("names an approved story the catalog gives no id", async () => {
		const app = await readApp(COMPONENTS, "demo");
		const { checked, unchecked } = check.checkableStories(app, readStoryApprovals(app));
		expect(checked).toEqual([]);
		expect(unchecked.find((u) => u.mockup === "story badge.ok")?.reason).toMatch(
			/no Storybook id in the catalog/,
		);
	});
});

describe("storyUrl and judgeStory", () => {
	it("serves a story from the app's /storybook with the scheme as the theme global", () => {
		expect(check.storyUrl("http://localhost:3939/", "components-badge--ok", "dark")).toBe(
			"http://localhost:3939/storybook/iframe.html?id=components-badge--ok&viewMode=story&globals=theme%3Adark",
		);
	});

	const story = { name: "badge.ok", component: "badge", state: "ok", id: "components-badge--ok" };
	const input = {
		app: "demo",
		story,
		device: "phone",
		scheme: "light" as const,
		approved: { "--color-dusk": "#c2620b" },
	};

	it("judges a story by value with no state to report, marked as a story", () => {
		const out = check.judgeStory({
			...input,
			seen: { runtime: { "--color-dusk": "#c2620b" }, elements: [], states: [], scheme: "light" },
		}) as { result: { kind: string; screen: string; verdict: { state: string } } };
		expect(out.result).toMatchObject({
			kind: "story",
			screen: "badge",
			verdict: { state: "held" },
		});
	});

	it("is broken when a token is not the approved value, and unchecked when the scheme was not drawn", () => {
		const broken = check.judgeStory({
			...input,
			seen: { runtime: { "--color-dusk": "#000000" }, elements: [], states: [], scheme: "light" },
		}) as { result: { verdict: { state: string } } };
		expect(broken.result.verdict.state).toBe("broken");
		const dark = check.judgeStory({
			...input,
			scheme: "dark",
			seen: { runtime: {}, elements: [], states: [], scheme: "light" },
		});
		expect(dark).toEqual({
			unchecked: {
				mockup: "story badge.ok",
				device: "phone",
				reason: "the page did not render the dark scheme",
			},
		});
	});
});

/**
 * A screen whose states exist only once something does (a draft, a record):
 * `paths` gives a state its own address, `seed` makes the thing before the
 * screen is opened and `unseed` takes it away after, whatever happened.
 */
describe("a screen with a seed", () => {
	it("opens a state with a path of its own at that path, and the rest at the screen's", async () => {
		const app = await readApp(FIXTURE, "demo");
		const declared: LooksApp = {
			...app,
			screens: app.screens.map((s) =>
				s.name === "home"
					? {
							...s,
							path: "/",
							paths: { full: "/home/{seed}" },
							seed: "make",
							unseed: "remove {seed}",
						}
					: s,
			),
		};
		const { checked } = checkable(declared, readApprovals(declared));
		const byState = Object.fromEntries(
			checked.filter((c) => c.screen === "home").map((c) => [c.state, c.path]),
		);
		expect(byState).toEqual({ empty: "/", full: "/home/{seed}" });
		expect(checked.find((c) => c.screen === "home")?.seed).toBe("make");
	});

	const looks: LookTarget[] = [
		{ screen: "s", state: "a", path: "/s/{seed}", seed: "make", unseed: "remove {seed}" },
		{ screen: "s", state: "b", seed: "make", unseed: "remove {seed}" },
	];

	it("runs the seed once, puts its trimmed output in every path, and unseeds after", async () => {
		const ran: string[] = [];
		const run = (command: string) => {
			ran.push(command);
			return command === "make" ? "d-42\n" : "";
		};
		const seen = await withScreenSeed(looks, async (seeded) => seeded.map((l) => l.path), run);
		expect(seen).toEqual(["/s/d-42", undefined]);
		expect(ran).toEqual(["make", "remove d-42"]);
	});

	it("unseeds after the body fails, and the failure still reaches the caller", async () => {
		const ran: string[] = [];
		const run = (command: string) => {
			ran.push(command);
			return "d-7";
		};
		await expect(
			withScreenSeed(
				looks,
				async () => {
					throw new Error("the page answered 404");
				},
				run,
			),
		).rejects.toThrow("the page answered 404");
		expect(ran).toEqual(["make", "remove d-7"]);
	});

	it("runs nothing for a screen that declares no seed", async () => {
		const ran: string[] = [];
		const out = await withScreenSeed(
			[{ screen: "s", state: "a", path: "/s" }],
			async (l) => l.length,
			(c) => {
				ran.push(c);
				return "";
			},
		);
		expect(out).toBe(1);
		expect(ran).toEqual([]);
	});
});
