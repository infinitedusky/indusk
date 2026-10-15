import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readApp } from "./mockups.js";
import { renderStories } from "./stories.js";

/**
 * promise: mockups-render-in-the-cockpit — storybook-components A36.
 * promise: a-mockup-is-approved-by-a-person — storybook-components A37.
 *
 * The render step rebuilds the app's Storybook (`build:storybook`) when the
 * build is older than what it is built from. `/storybook` and `indusk looks
 * check` draw from that build, so a stylesheet the build reads (`globals.css`)
 * must count as surely as a component or a story file.
 *
 * Reached over its boundary: a small app whose `build:storybook` only records
 * that it ran and writes an empty manifest. The render that follows needs the
 * app's Vitest, which this app does not have, so `renderStories` fails after
 * the freshness decision; the test reads only whether the build ran.
 */

const COMPONENTS = join(__dirname, "..", "..", "__tests__", "fixtures", "components-app");
const MOCKUPS = ".indusk/mockups/demo";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A project whose app has a Storybook, its build made at `built`, the rest at the times given. */
function project(times: { component: number; css: number; built: number }): {
	root: string;
	ran: string;
} {
	const root = mkdtempSync(join(tmpdir(), "looks-stories-"));
	roots.push(root);
	for (const file of ["foundation.tokens.json", "devices.json"]) {
		cpSync(join(COMPONENTS, MOCKUPS, file), join(root, MOCKUPS, file), { recursive: true });
	}
	writeFileSync(
		join(root, MOCKUPS, "screens.json"),
		JSON.stringify({ screens: [], sources: ["app/src"] }),
	);
	const app = join(root, "app");
	mkdirSync(join(app, "src"), { recursive: true });
	mkdirSync(join(app, ".storybook"), { recursive: true });
	writeFileSync(
		join(app, "package.json"),
		JSON.stringify({
			name: "stories-app",
			private: true,
			scripts: { "build:storybook": "node build.mjs --output-dir out" },
		}),
	);
	const ran = join(app, "build-ran");
	writeFileSync(
		join(app, "build.mjs"),
		[
			'import { mkdirSync, writeFileSync } from "node:fs";',
			'mkdirSync("out/manifests", { recursive: true });',
			'writeFileSync("out/manifests/components.json", "{}");',
			'writeFileSync("build-ran", "yes");',
			"",
		].join("\n"),
	);
	const main = join(app, ".storybook", "main.ts");
	writeFileSync(main, 'export default { stories: ["../src/**/*.stories.tsx"] };\n');
	const badge = join(app, "src", "Badge.jsx");
	writeFileSync(badge, 'export const Badge = () => <span data-component="badge">ok</span>;\n');
	const css = join(app, "src", "globals.css");
	writeFileSync(css, ".halo { outline: 0; }\n");
	const manifest = join(app, "out", "manifests", "components.json");
	mkdirSync(join(app, "out", "manifests"), { recursive: true });
	writeFileSync(manifest, "{}");

	const at = (file: string, seconds: number) => utimesSync(file, seconds, seconds);
	at(main, times.component);
	at(badge, times.component);
	at(css, times.css);
	at(manifest, times.built);
	return { root, ran };
}

const now = Math.floor(Date.now() / 1000);

describe("the render step rebuilds a Storybook older than its sources", { timeout: 60_000 }, () => {
	// A36
	it("A36 a stylesheet in the app's sources newer than the build rebuilds it", async () => {
		const { root, ran } = project({ component: now - 300, built: now - 200, css: now - 100 });
		await renderStories(root, "demo").catch(() => undefined);
		expect(existsSync(ran), "globals.css is newer than the build, so the build runs").toBe(true);
	});

	it("A36 as a component file newer than the build does; a build newer than everything is kept", async () => {
		const stale = project({ component: now - 100, built: now - 200, css: now - 300 });
		await renderStories(stale.root, "demo").catch(() => undefined);
		expect(existsSync(stale.ran), "a component newer than the build rebuilds it").toBe(true);

		const fresh = project({ component: now - 300, built: now - 100, css: now - 200 });
		await renderStories(fresh.root, "demo").catch(() => undefined);
		expect(existsSync(fresh.ran), "a build newer than its sources is kept").toBe(false);
	});
});

describe("a looks hash is computed by one function each way", () => {
	// A37
	it("A37 the hashes written to components.json equal the ones read, and no module but mockups.ts calls createHash", async () => {
		const root = mkdtempSync(join(tmpdir(), "looks-hash-"));
		roots.push(root);
		cpSync(COMPONENTS, root, { recursive: true });
		const app = await readApp(root, "demo");
		const catalog = JSON.parse(readFileSync(join(root, MOCKUPS, "components.json"), "utf-8")) as {
			components: {
				name: string;
				states: { name: string; snapshotHash: string }[];
				stylesheetHash?: string;
			}[];
		};
		for (const c of catalog.components) {
			for (const s of c.states) {
				const story = app.stories.find((x) => x.name === `${c.name}.${s.name}`);
				expect(story?.hash, `${c.name}.${s.name} written vs read`).toBe(s.snapshotHash);
			}
			const sheet = app.styles.find((x) => x.component === c.name);
			expect(sheet?.hash, `${c.name}.css written vs read`).toBe(c.stylesheetHash);
		}

		const here = __dirname;
		const callers = readdirSync(here)
			.filter((f) => f.endsWith(".ts") && !f.includes(".test"))
			.filter((f) => /createHash\(/.test(readFileSync(join(here, f), "utf-8")))
			.sort();
		expect(callers, "the one place a looks hash is computed").toEqual(["mockups.ts"]);
	});
});
