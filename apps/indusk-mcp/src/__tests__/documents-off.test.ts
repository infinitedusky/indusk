import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { derivePlanPosition } from "../lib/lifecycle.js";
import { parsePlan } from "../lib/plan-parser.js";
import { writePlanFolder } from "./helpers/plan-folder.js";

/**
 * promise: the-core-is-always-kept
 *
 * new-project-flow A12: a project can turn a planning document off in its
 * config (`planning.documents_off`); a feature plan in that project is not
 * asked for it, and the plan status the admin reads says the document was
 * skipped - never missing.
 *
 * The status is read the way the admin reads it (`planning-reader.ts`): the
 * plan's folder through `parsePlan`, then `derivePlanPosition` over that
 * summary. The project's config is not handed to either; whatever reads it
 * has to find it from the plan's folder, as the admin has only the folder.
 */

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A project whose config turns `off` off, holding a feature plan with every document but the ADR. */
function projectWith(off: string[]): string {
	const root = mkdtempSync(join(tmpdir(), "documents-off-"));
	made.push(root);
	mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ mode: "full", planning: { documents_off: off } }),
	);
	return writePlanFolder(join(root, ".indusk", "planning"), "demo", {
		"brief.md": ["status: accepted", "workflow: feature"],
		"test-plan.md": ["status: accepted"],
		"impl.md": ["status: in-progress"],
	});
}

const segments = (planDir: string) =>
	derivePlanPosition({
		summary: parsePlan(planDir),
		impl: null,
		readiness: null,
		archived: false,
	}).segments;

describe("planning.documents_off", () => {
	it("A12 a plan in a project with decision records turned off reads the ADR as skipped, not missing", () => {
		expect(segments(projectWith(["adr"])).adr).toBe("skipped");
	});
});
