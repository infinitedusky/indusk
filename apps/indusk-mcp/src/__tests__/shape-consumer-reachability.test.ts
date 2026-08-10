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

/**
 * T25 — the surfaces the `/work` skill actually names, read out of the skill.
 *
 * This list used to be hardcoded here, which meant the assertion could not fail
 * the way its claim implied: add a fifth Shape surface to the skill and the test
 * still passed, while a consumer following that skill hit an unresolvable
 * import. A list maintained beside the thing it describes drifts from it.
 */
function subpathsNamedBySkill(): string[] {
	const skill = readFileSync(join(packageRoot, "skills", "work.md"), "utf-8");
	const named = skill.matchAll(/@infinitedusky\/indusk-mcp\/(shape\/[a-z-]+)/g);
	return [...new Set([...named].map((m) => `./${m[1]}`))];
}

describe("A20 — the Shape surfaces the skill names are exported", () => {
	it("names at least one Shape surface in the skill", () => {
		// Guards the guard: if the skill stops naming any import path, the two
		// assertions below pass vacuously over an empty list.
		expect(subpathsNamedBySkill().length).toBeGreaterThan(0);
	});

	it("declares every entry point the skill instructs agents to import", () => {
		const declared = Object.keys(packageJson().exports);

		expect(declared).toEqual(expect.arrayContaining(subpathsNamedBySkill()));
	});

	it("maps each export to source that exists, without needing a build", () => {
		// T26 — this asserted against `dist/`, which is gitignored: a fresh clone
		// failed for having not run a build, which is an environment fact rather
		// than a defect. The mapping dist/lib/X.js ← src/lib/X.ts is mechanical,
		// so checking the source proves the export points somewhere real while
		// staying true on a clean checkout.
		const { exports } = packageJson();

		for (const subpath of subpathsNamedBySkill()) {
			const entry = exports[subpath];
			expect(entry, `${subpath} is not declared`).toBeDefined();
			const target = typeof entry === "string" ? entry : entry?.default;
			expect(target, `${subpath} has no default target`).toBeDefined();

			const source = (target as string).replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
			expect(
				existsSync(join(packageRoot, source)),
				`${subpath} → ${target} has no source at ${source}`,
			).toBe(true);
		}
	});
});
