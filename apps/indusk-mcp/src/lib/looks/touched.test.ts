// clause: a-look-check-runs-what-changed/the-changed-looks
// promise: a-look-check-runs-what-changed
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LooksApp } from "./mockups.js";
import { foundationFiles, touchedLooks } from "./touched.js";

const temps: string[] = [];
afterEach(() => {
	for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Looks are named as the held record names them: `screen:<name>.<state>`, `story:<component>.<state>`. */
const closures = {
	"screen:home.full": ["app/page.tsx", "app/layout.tsx", "components/chip.tsx"],
	"screen:plan.parts": ["app/plan/[name]/page.tsx", "app/layout.tsx"],
	"story:chip.waiting": ["components/chip.tsx"],
};

describe("which looks a change touches", () => {
	it("T8 a page edit touches its screens only", () => {
		expect(
			touchedLooks({ closures, foundation: [], changed: ["app/plan/[name]/page.tsx"] }),
		).toEqual(["screen:plan.parts"]);
	});

	it("T9 a component edit touches its stories and the screens importing it", () => {
		expect(
			touchedLooks({ closures, foundation: [], changed: ["components/chip.tsx"] }).sort(),
		).toEqual(["screen:home.full", "story:chip.waiting"]);
	});

	it("T10 a foundation edit, or an unreadable closure, touches every look", () => {
		expect(
			touchedLooks({ closures, foundation: ["tokens.json"], changed: ["tokens.json"] }),
		).toHaveLength(3);
		const unreadable = { ...closures, "screen:plan.parts": null };
		expect(touchedLooks({ closures: unreadable, foundation: [], changed: ["x.ts"] })).toHaveLength(
			3,
		);
	});

	it("a change that no look is drawn from touches none", () => {
		expect(touchedLooks({ closures, foundation: ["tokens.json"], changed: ["README.md"] })).toEqual(
			[],
		);
	});

	it("T18 the app's public files and Next.js config touch every look", async () => {
		const root = mkdtempSync(join(tmpdir(), "foundation-"));
		temps.push(root);
		for (const f of [
			"apps/web/package.json",
			"apps/web/next.config.ts",
			"apps/web/public/img/logo.svg",
			"apps/web/src/app/page.tsx",
		]) {
			mkdirSync(dirname(join(root, f)), { recursive: true });
			writeFileSync(join(root, f), "x");
		}
		const app = {
			app: "web",
			sources: ["apps/web/src"],
			screens: [],
			stories: [],
		} as unknown as LooksApp;
		const foundation = await foundationFiles(root, app);
		expect(foundation).toContain("apps/web/public/img/logo.svg");
		expect(foundation).toContain("apps/web/next.config.ts");
		expect(foundation).not.toContain("apps/web/src/app/page.tsx");
		expect(
			touchedLooks({ closures, foundation, changed: ["apps/web/public/img/logo.svg"] }),
		).toHaveLength(3);
		expect(
			touchedLooks({ closures, foundation, changed: ["apps/web/next.config.ts"] }),
		).toHaveLength(3);
	});
});
