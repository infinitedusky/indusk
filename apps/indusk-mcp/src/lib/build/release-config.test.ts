import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autoAccepts } from "./release-config.js";

/**
 * promise: nothing-ships-until-accepted — admin-plan-authoring A20, the setting.
 *
 * Only `release.auto_accept: true` accepts a built plan without the person;
 * anything else — absent, false, a string — leaves it waiting.
 */
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function project(release?: unknown): string {
	const dir = mkdtempSync(join(tmpdir(), "release-config-"));
	dirs.push(dir);
	mkdirSync(join(dir, ".indusk"));
	writeFileSync(
		join(dir, ".indusk", "config.json"),
		JSON.stringify(release === undefined ? { mode: "full" } : { mode: "full", release }),
	);
	return dir;
}

describe("release.auto_accept", () => {
	it("true accepts; absent, false or a word does not", () => {
		expect(autoAccepts(project({ auto_accept: true }))).toBe(true);
		expect(autoAccepts(project())).toBe(false);
		expect(autoAccepts(project({ auto_accept: false }))).toBe(false);
		expect(autoAccepts(project({ auto_accept: "yes" }))).toBe(false);
	});
});
