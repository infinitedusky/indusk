import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { planHasLanded } from "./landed.js";

// promise: a-component-has-one-implementation
// promise: the-everyday-suite-passes-on-main
const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function project(...folders: string[]): string {
	const root = mkdtempSync(join(tmpdir(), "landed-"));
	roots.push(root);
	for (const f of folders) mkdirSync(join(root, ".indusk", "planning", f), { recursive: true });
	return root;
}

describe("planHasLanded", () => {
	it("an active folder not archived has not landed", () => {
		expect(planHasLanded(project("x"), "x")).toBe(false);
	});
	it("an archived folder has landed, even if an active copy remains", () => {
		expect(planHasLanded(project("archive/x"), "x")).toBe(true);
		expect(planHasLanded(project("x", "archive/x"), "x")).toBe(true);
	});
	it("a plan with no folder reads landed, so legacy records stay strictly checked", () => {
		expect(planHasLanded(project(), "ghost")).toBe(true);
	});
});
