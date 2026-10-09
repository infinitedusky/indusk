import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * vscode-extension A7: promise health is worked out in one place — the
 * package's `promises/health` — and the admin, the CLI and the editor all
 * read it. A second copy is how two windows come to disagree.
 *
 * promise: the-editor-shows-the-same-health-as-the-admin
 * lesson: structural-single-definition-test-for-must-agree-invariants
 */

const LESSON = "lesson: structural-single-definition-test-for-must-agree-invariants";
const HEALTH = join(REPO_ROOT, "apps/indusk-mcp/src/lib/promises/health.ts");
const ADMIN = join(REPO_ROOT, "apps/indusk-admin/src");
const EDITOR = join(REPO_ROOT, "apps/vscode-extension/src");

function sources(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
		return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
	});
}

describe("A7 — promise health is defined once, in the package", () => {
	it("lib/promises/health.ts defines readHealth and healthOf", () => {
		const text = existsSync(HEALTH) ? readFileSync(HEALTH, "utf-8") : "";
		expect(text, `apps/indusk-mcp/src/lib/promises/health.ts — ${LESSON}`).toMatch(
			/export async function readHealth\(/,
		);
		expect(text, LESSON).toMatch(/export function healthOf\(/);
	});

	it("neither the admin nor the editor defines either", () => {
		const copies = [...sources(ADMIN), ...sources(EDITOR)]
			.filter((path) => /function (readHealth|healthOf)\(/.test(readFileSync(path, "utf-8")))
			.map((path) => relative(REPO_ROOT, path));
		expect(copies, `a second health reader — ${LESSON}`).toEqual([]);
	});

	it("the admin reads health from the package's promises/health", () => {
		const importers = sources(ADMIN).filter((path) =>
			/from "[^"]*promise-health"|from "@infinitedusky\/indusk-mcp\/promises\/health"/.test(
				readFileSync(path, "utf-8"),
			),
		);
		expect(importers.length, "the admin reads promise health somewhere").toBeGreaterThan(0);
		const local = importers
			.filter((path) => /from "[^"]*promise-health"/.test(readFileSync(path, "utf-8")))
			.map((path) => relative(REPO_ROOT, path));
		expect(local, `the admin imports its own copy — ${LESSON}`).toEqual([]);
	});
});
