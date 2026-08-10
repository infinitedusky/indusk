import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A20 — Shape is reachable from a consumer install.
 *
 * The `/work` skill instructs an agent to call `prepareShapeReview` and friends.
 * In a consumer project the only way to reach them is a declared subpath export;
 * `cleanup/oversized`, `cleanup/gate`, `trajectory/parser` and three others are
 * declared, and shape was not. Every one of the 41 shape tests passed while the
 * library was unreachable outside this monorepo, because they all import the
 * source directly — the fixtures cannot see the path a real user would take.
 *
 * This is the `consumer-reachability-before-publish` lesson as a test.
 */

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

interface PackageJson {
	exports: Record<string, { types?: string; default?: string } | string>;
}

function packageJson(): PackageJson {
	return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8")) as PackageJson;
}

/** The surfaces the `/work` skill's Shape step tells an agent to call. */
const REQUIRED_SUBPATHS = ["./shape/shape", "./shape/boundary", "./shape/findings", "./shape/rules"];

describe("A20 — the Shape surfaces the skill names are exported", () => {
	it("declares every entry point the skill instructs agents to import", () => {
		const declared = Object.keys(packageJson().exports);

		expect(declared).toEqual(expect.arrayContaining(REQUIRED_SUBPATHS));
	});

	it("resolves each export to a file that exists in the build", () => {
		// A declared export pointing at nothing is the same outage with extra
		// steps — it fails at import time in the consumer instead of at publish.
		const { exports } = packageJson();

		for (const subpath of REQUIRED_SUBPATHS) {
			const entry = exports[subpath];
			expect(entry, `${subpath} is not declared`).toBeDefined();
			const target = typeof entry === "string" ? entry : entry?.default;
			expect(target, `${subpath} has no default target`).toBeDefined();
			expect(
				existsSync(join(packageRoot, target as string)),
				`${subpath} → ${target} does not exist`,
			).toBe(true);
		}
	});
});
