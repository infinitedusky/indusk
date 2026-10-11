import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, runCli } from "./helpers/cli.js";

/**
 * promise: a-mockup-leaves-nothing-undefined — ui-promises A9.
 *
 * The cockpit is the first app held: its mockups, redrawn from
 * `plan-cockpit.html` on its own foundation, pass `indusk looks lint admin`
 * with no raw value. Red until Build Phase 5 draws them — today there is no
 * `looks` command and no `.indusk/mockups/admin/`.
 */
describe("the cockpit's mockups, on its foundation", () => {
	it("A9: the admin's foundation and mockups exist", () => {
		expect(existsSync(join(REPO_ROOT, ".indusk/mockups/admin/foundation.tokens.json"))).toBe(true);
	});

	it("A9: `indusk looks lint admin` passes with no raw value", () => {
		const r = runCli(REPO_ROOT, ["looks", "lint", "admin"]);
		expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
	});
});
