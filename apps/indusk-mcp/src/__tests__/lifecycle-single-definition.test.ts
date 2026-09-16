import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * admin-ui-phase-progress — A16.
 *
 * The lifecycle was defined in three places, none of them exported: a
 * module-private `STAGE_ORDER` in the plan parser (missing `test-plan`), the
 * ritual order in skill prose, and two disagreeing gate-kind types. The admin
 * carried a fourth partial copy — a private phase-heading regex that could
 * not see `Test Phase N`. This pins the fix: one `PLAN_POSITIONS`, one
 * `GATE_STAGES`, one `PHASE_HEADING`, and no heading regex in the admin.
 *
 * Same shape as its siblings (`shared-resolution`, `execution-roots-…`,
 * `head-sha-…`): a source-tree scan asserting exactly one definition exists,
 * because no behavioural test can catch a divergence that has not happened.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const ADMIN_PHASES = join(REPO_ROOT, "apps/indusk-admin/src/lib/phases.ts");
const IGNORE = ["**/*.test.ts", "**/*.test-support.ts"];

function libFiles(): string[] {
	return globSync("**/*.ts", { cwd: SRC_LIB, ignore: IGNORE }).sort();
}

function definers(pattern: RegExp): string[] {
	return libFiles().filter((f) => pattern.test(readFileSync(join(SRC_LIB, f), "utf-8")));
}

describe("A16 — one lifecycle definition, one phase-heading parser", () => {
	it("(a) the admin's phases.ts carries no phase-heading regex of its own", () => {
		const source = readFileSync(ADMIN_PHASES, "utf-8");
		expect(source, "phases.ts still spells a `Phase\\s` regex").not.toMatch(/Phase\\s/);
		expect(source, "phases.ts still walks lines for `### `").not.toMatch(/\^#{3}/);
	});

	it("(b) exactly one PLAN_POSITIONS and one GATE_STAGES, both in lifecycle.ts", () => {
		expect(definers(/export const PLAN_POSITIONS\b/)).toEqual(["lifecycle.ts"]);
		expect(definers(/export const GATE_STAGES\b/)).toEqual(["lifecycle.ts"]);
	});

	it("(c) no STAGE_ORDER array literal survives outside lifecycle.ts", () => {
		expect(definers(/const STAGE_ORDER\b/).filter((f) => f !== "lifecycle.ts")).toEqual([]);
	});

	it("(d) exactly one PHASE_HEADING definition, in impl-headings.ts", () => {
		expect(definers(/export const PHASE_HEADING\b/)).toEqual(["impl-headings.ts"]);
	});
});
