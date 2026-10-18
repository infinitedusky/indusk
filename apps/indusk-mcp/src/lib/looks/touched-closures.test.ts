// clause: a-look-check-runs-what-changed/the-changed-looks
// promise: a-look-check-runs-what-changed
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import type { LooksApp } from "./mockups.js";
import { routeOf, segmentsOf } from "./routes.js";
import { foundationFiles, lookClosures, touchedLooks } from "./touched.js";

/** A small Next.js app-router app in a temp folder, with a path alias. */
const files: Record<string, string> = {
	"apps/web/package.json": "{}",
	"apps/web/tsconfig.json": JSON.stringify({
		compilerOptions: {
			jsx: "react-jsx",
			moduleResolution: "bundler",
			module: "esnext",
			paths: { "@/*": ["./src/*"] },
		},
	}),
	"apps/web/src/app/layout.tsx":
		'import { Nav } from "@/components/nav";\nimport "./globals.css";\nexport default Nav;',
	"apps/web/src/app/globals.css": "body{}",
	"apps/web/src/app/page.tsx": "export default function Home() { return null }",
	"apps/web/src/app/(shell)/about/page.tsx": "export default function About() { return null }",
	"apps/web/src/app/p/[project]/layout.tsx": "export default function L() { return null }",
	"apps/web/src/app/p/[project]/plan/[name]/page.tsx":
		'import { Chip } from "../../../../../components/chip";\nexport default Chip;',
	"apps/web/src/components/nav.tsx": "export const Nav = 1;",
	"apps/web/src/components/chip.tsx": 'import { tone } from "./tone";\nexport const Chip = tone;',
	"apps/web/src/components/tone.ts": "export const tone = 1;",
	"apps/web/src/components/unused.tsx": "export const Unused = 1;",
	"node_modules/lib/index.js": "export {}",
};
let root: string;
const at = (rel: string) => join(root, rel);

const app = {
	app: "web",
	dir: "",
	sources: ["apps/web/src"],
	screens: [
		{ name: "home", states: ["default"], path: "/" },
		{ name: "plan", states: ["parts"], path: "/p/dusk/plan/some-plan?x=1" },
		{ name: "ghost", states: ["default"], path: "/nowhere/at/all" },
		{ name: "about", states: ["default"], path: "/about" },
		{
			name: "hand",
			states: ["default"],
			path: "/anything",
			page: "apps/web/src/components/tone.ts",
		},
	],
	stories: [
		{
			name: "chip.ok",
			component: "chip",
			state: "ok",
			file: "",
			html: "",
			hash: "",
			stylesheetHash: null,
		},
	],
	mockups: [],
	uncatalogued: [],
} as unknown as LooksApp;

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "touched-closures-"));
	for (const [rel, text] of Object.entries(files)) {
		mkdirSync(dirname(at(rel)), { recursive: true });
		writeFileSync(at(rel), text);
	}
	app.dir = at(".indusk/mockups/web");
	mkdirSync(join(app.dir), { recursive: true });
	writeFileSync(
		join(app.dir, "components.json"),
		JSON.stringify({
			components: [
				{
					name: "chip",
					file: "apps/web/src/components/chip.tsx",
					properties: [],
					states: [{ name: "ok", snapshotHash: "" }],
				},
			],
		}),
	);
});

describe("the route a URL draws from", () => {
	it("drops the query and matches [param] folders and route groups, with the layouts above", () => {
		expect(segmentsOf("/p/dusk/plan/x?talk=1#top")).toEqual(["p", "dusk", "plan", "x"]);
		const route = routeOf(at("apps/web/src/app"), "/p/dusk/plan/some-plan");
		expect(route?.page).toBe(at("apps/web/src/app/p/[project]/plan/[name]/page.tsx"));
		expect(route?.layouts).toEqual([
			at("apps/web/src/app/layout.tsx"),
			at("apps/web/src/app/p/[project]/layout.tsx"),
		]);
		expect(routeOf(at("apps/web/src/app"), "/about")?.page).toBe(
			at("apps/web/src/app/(shell)/about/page.tsx"),
		);
		expect(routeOf(at("apps/web/src/app"), "/")?.page).toBe(at("apps/web/src/app/page.tsx"));
	});

	it("finds nothing for a path no page draws", () => {
		expect(routeOf(at("apps/web/src/app"), "/nowhere/at/all")).toBeNull();
	});
});

describe("the files each look is drawn from", () => {
	it("is a page, its layouts and their imports, inside the project", () => {
		const closures = lookClosures(app, root, ts);
		expect(closures["screen:plan.parts"]).toEqual(
			expect.arrayContaining([
				"apps/web/src/app/p/[project]/plan/[name]/page.tsx",
				"apps/web/src/app/layout.tsx",
				"apps/web/src/app/globals.css",
				"apps/web/src/components/nav.tsx",
				"apps/web/src/components/chip.tsx",
				"apps/web/src/components/tone.ts",
			]),
		);
		expect(closures["screen:plan.parts"]).not.toContain("apps/web/src/components/unused.tsx");
		expect(closures["screen:home.default"]).not.toContain("apps/web/src/components/chip.tsx");
		expect(closures["story:chip.ok"]).toEqual(
			expect.arrayContaining([
				"apps/web/src/components/chip.tsx",
				"apps/web/src/components/tone.ts",
			]),
		);
	});

	it("is the declared page when the screen names one, and null when no page can be found", () => {
		const closures = lookClosures(app, root, ts);
		expect(closures["screen:hand.default"]).toContain("apps/web/src/components/tone.ts");
		expect(closures["screen:hand.default"]).not.toContain("apps/web/src/app/layout.tsx");
		expect(closures["screen:ghost.default"]).toBeNull();
	});

	it("is null for every look when the app's TypeScript cannot be loaded", () => {
		const closures = lookClosures(app, root, null);
		expect(Object.values(closures).every((c) => c === null)).toBe(true);
	});

	it("T9 over real files: a component edit touches the screens whose page imports it and its story", async () => {
		const closures = { ...lookClosures(app, root, ts) };
		closures["screen:ghost.default"] = [];
		const touched = touchedLooks({
			closures,
			foundation: await foundationFiles(root, app),
			changed: ["apps/web/src/components/tone.ts"],
		});
		expect(touched.sort()).toEqual(["screen:hand.default", "screen:plan.parts", "story:chip.ok"]);
	});

	it("T10 over real files: a stylesheet under the sources touches every look", async () => {
		const closures = { ...lookClosures(app, root, ts) };
		closures["screen:ghost.default"] = [];
		const touched = touchedLooks({
			closures,
			foundation: await foundationFiles(root, app),
			changed: ["apps/web/src/app/globals.css"],
		});
		expect(touched).toHaveLength(Object.keys(closures).length);
	});
});
