// promise: one-definition-per-shared-rule
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * day-promises — A32 and A33, the Cleanup Phase's structural pins.
 *
 * A32: the presence-keyed config-block ensure existed three times by the end
 * of this plan (cleanup, papers, promises). One `ensureConfigBlock` under
 * `lib/config.ts`, and the three named ensures call it — pinned by count, the
 * way every shared shape here is, because a fourth copy comes back silently.
 * The behaviour half (update adds all three blocks once, leaves a declared
 * one alone) is the existing A14 and the cleanup-ritual ensure test.
 *
 * A33: the reverse scan is its own module. `registry.ts` reads,
 * `citations.ts` scans, `check.ts` judges — and `check.ts` spells no scan of
 * its own.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const IGNORE = ["**/*.test.ts", "**/*.test-support.ts"];

function libFiles(): string[] {
	return globSync("**/*.ts", { cwd: SRC_LIB, ignore: IGNORE }).sort();
}

function definers(pattern: RegExp): string[] {
	return libFiles().filter((f) => pattern.test(readFileSync(join(SRC_LIB, f), "utf-8")));
}

describe("A32 — one presence-keyed config-block ensure under src/lib", () => {
	it("exactly one `export function ensureConfigBlock` exists, in lib/config.ts", () => {
		expect(definers(/export function ensureConfigBlock\b/)).toEqual(["config.ts"]);
	});

	it("the cleanup, papers and promises ensures each call it", () => {
		for (const rel of ["config.ts", "papers/config.ts", "promises/config.ts"]) {
			const source = readFileSync(join(SRC_LIB, rel), "utf-8");
			expect(source, `${rel} does not call ensureConfigBlock`).toMatch(/\bensureConfigBlock\(/);
		}
	});

	it("no module under src/lib spells the presence check for itself any more", () => {
		// The shape each copy had: read the block, `already-set` when it is an object.
		const spellers = definers(/typeof existing === "object"\) return "already-set"/);
		expect(spellers).toEqual(["config.ts"]);
	});
});

describe("A33 — the reverse scan lives in lib/promises/citations.ts", () => {
	it("citations.ts exists and exports citedNames", () => {
		const path = join(SRC_LIB, "promises/citations.ts");
		expect(existsSync(path), "lib/promises/citations.ts is missing").toBe(true);
		expect(readFileSync(path, "utf-8")).toMatch(/export async function citedNames\b/);
	});

	it("check.ts imports the scan and defines none of its own", () => {
		const check = readFileSync(join(SRC_LIB, "promises/check.ts"), "utf-8");
		expect(check).toMatch(/import \{[^}]*\bcitedNames\b[^}]*\} from "\.\/citations\.js"/);
		expect(check).not.toMatch(/"ls-files"/);
		expect(check).not.toMatch(/function citedNames\b/);
		expect(definers(/export async function citedNames\b/)).toEqual(["promises/citations.ts"]);
	});
});
