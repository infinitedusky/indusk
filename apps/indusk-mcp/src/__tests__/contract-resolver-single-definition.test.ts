import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * promise: one-definition-per-shared-rule — workbench-plan-authoring A17.
 * lesson: a-repo-has-one-contract-and-one-resolver-finds-it
 *
 * Where a repo's promises live is decided in one place, `contractDir`
 * (`lib/promises/registry.ts`): the repo's own `.indusk/promises/` once it
 * holds one, else the workbench's shadow contract. A second module building
 * its own path to the folder would read the shadow while the repo's contract
 * says otherwise, the two-definitions problem this plan exists to end. And
 * where a plan's code lives is decided by `resolveExecutionRoots` and the
 * plan's `code.json`: the plan, build and session modules never look a repo
 * up for themselves.
 */

const SRC = join(__dirname, "..");
const RESOLVER = "lib/promises/registry.ts";

function sources(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: "utf-8" })
		.filter((f) => f.endsWith(".ts") && !f.includes("__tests__") && !f.endsWith(".test.ts"))
		.map((f) => join(dir, f));
}

const rel = (abs: string) => relative(SRC, abs);

describe("A17 — one resolver for the contract, and for the code", () => {
	it("the resolver exists, and the old path-builder is gone", () => {
		const registry = readFileSync(join(SRC, RESOLVER), "utf-8");
		expect(registry).toMatch(/export function contractDir\(/);
		expect(registry).not.toMatch(/export function promisesDir\(/);
	});

	it("no module but the resolver builds a path to the promises folder", () => {
		const joins = /join\([^)]*(PROMISES_REL_DIR|"\.indusk",\s*"promises")/;
		const offenders = sources(join(SRC, "lib"))
			.concat(sources(join(SRC, "tools")), sources(join(SRC, "bin")))
			.filter((f) => rel(f) !== RESOLVER && joins.test(readFileSync(f, "utf-8")))
			.map(rel);
		expect(offenders, "lesson: a-repo-has-one-contract-and-one-resolver-finds-it").toEqual([]);
	});

	it("the plan, build and session modules never look a repo up for themselves", () => {
		const lookups = /\b(declaredRepoDirs|readWorkbenchRepos)\(/;
		const offenders = ["lib/plans", "lib/build", "lib/session"]
			.flatMap((d) => sources(join(SRC, d)))
			.filter((f) => lookups.test(readFileSync(f, "utf-8")))
			.map(rel);
		expect(offenders, "lesson: a-repo-has-one-contract-and-one-resolver-finds-it").toEqual([]);
	});
});
