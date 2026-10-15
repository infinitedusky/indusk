import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
