import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPlanParts } from "./parts.js";

/**
 * `hasBriefFile` tells a plan with no brief from a brief outside the contract
 * shape: both have `hasBrief: false` (no parts to read), but only the first is
 * a plan the page may show the parts of at 0 (cockpit-redraw, `brief.empty`).
 */
let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

function plan(brief: string | null): string {
	root = mkdtempSync(join(tmpdir(), "plan-parts-"));
	const dir = join(root, ".indusk", "planning", "p");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "research.md"), "# research\n");
	if (brief !== null) writeFileSync(join(dir, "brief.md"), brief);
	return root;
}

describe("readPlanParts — a missing brief and a brief outside the contract", () => {
	it("a plan with no brief.md has no brief file", async () => {
		const parts = await readPlanParts(plan(null), "p");
		expect(parts.hasBrief).toBe(false);
		expect(parts.hasBriefFile).toBe(false);
	});

	it("a brief outside the contract shape is a file the page must not read as empty", async () => {
		const parts = await readPlanParts(
			plan("---\nstatus: accepted\n---\n\n# Old brief\n\nJust prose.\n"),
			"p",
		);
		expect(parts.hasBrief).toBe(false);
		expect(parts.hasBriefFile).toBe(true);
	});
});
