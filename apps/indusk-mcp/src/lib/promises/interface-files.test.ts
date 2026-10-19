import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readApp } from "../looks/mockups.js";
import { lookClosures } from "../looks/touched.js";
import { interfaceFilesAmong } from "./interface-files.js";

/**
 * main-suite-green A14 (not for a promise).
 *
 * A test file under an app's declared `sources` changes no look, so it is not
 * the app's interface; a story renders an approved snapshot and still is.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function projectDeclaring(sources: string[]): string {
	const root = mkdtempSync(join(tmpdir(), "interface-files-"));
	roots.push(root);
	const dir = join(root, ".indusk", "mockups", "demo");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "screens.json"), JSON.stringify({ sources }));
	return root;
}

describe("interfaceFilesAmong", () => {
	it("A14: counts a story and a component, not a test file", () => {
		const root = projectDeclaring(["app/src"]);
		const found = interfaceFilesAmong(root, [
			"app/src/__tests__/x.test.ts",
			"app/src/a.test.tsx",
			"app/src/b.spec.ts",
			"app/src/Button.stories.tsx",
			"app/src/Button.tsx",
		]);
		expect(found.map((f) => f.path)).toEqual(["app/src/Button.stories.tsx", "app/src/Button.tsx"]);
	});
});

/**
 * a-brief-is-planned-unasked T10 (a regression guard, not for a promise): the
 * admin's interface is what draws, so a plan that changes how the admin runs
 * can be accepted with no look. Read over this repository's own declaration.
 */
const REPO = join(__dirname, "..", "..", "..", "..", "..");

describe("the admin's interface is its pages and components", () => {
	it("T10: server code and API routes are not interface; a page and a component are", () => {
		const found = interfaceFilesAmong(REPO, [
			"apps/indusk-admin/src/lib/build-host.ts",
			"apps/indusk-admin/src/app/api/plans/approve/route.ts",
			"apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx",
			"apps/indusk-admin/src/components/ui/PromiseRow.tsx",
		]);
		expect(found.map((f) => f.path)).toEqual([
			"apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx",
			"apps/indusk-admin/src/components/ui/PromiseRow.tsx",
		]);
	});

	it("T10: every look of the admin still has a readable closure", async () => {
		const app = await readApp(REPO, "admin");
		const unreadable = Object.entries(lookClosures(app, REPO))
			.filter(([, files]) => files === null)
			.map(([name]) => name);
		expect(unreadable).toEqual([]);
	});
});
