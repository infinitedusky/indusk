import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findStaleCompletedPlans } from "../lib/stale-completed.js";

/**
 * A plan `completed` for more than seven days with no retrospective is a
 * health ERROR, not a pending item — the makeover sat 53 days in a queue
 * labelled "any time" and nothing treated the wait as a fault. Carried into
 * dawn-workbench-execution from hook-cwd-independence's cut.
 */

let root: string;
const NOW = new Date("2026-09-16T12:00:00Z");

function plan(name: string, frontmatter: string, withRetro = false): void {
	const dir = join(root, ".indusk", "planning", name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "impl.md"), `---\n${frontmatter}\n---\n\n# ${name}\n`);
	if (withRetro) writeFileSync(join(dir, "retrospective.md"), "# retro\n");
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "stale-completed-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("stale completed plans", () => {
	it("reports a plan completed eight days ago with no retrospective, naming it", () => {
		plan("eight", 'title: "e"\nstatus: completed\ndate: 2026-09-01\nupdated: 2026-09-08');
		const found = findStaleCompletedPlans(root, { now: NOW });
		expect(found.map((f) => f.plan)).toEqual(["eight"]);
		expect(found[0].daysAgo).toBe(8);
		expect(found[0].since).toBe("2026-09-08");
	});

	it("reports nothing at six days, for a plan with a retrospective, for an in-progress plan, or for the archive", () => {
		plan("six", 'title: "s"\nstatus: completed\ndate: 2026-09-10');
		plan("retro", 'title: "r"\nstatus: completed\ndate: 2026-08-01', true);
		plan("open", 'title: "o"\nstatus: in-progress\ndate: 2026-08-01');
		plan("archive/old", 'title: "a"\nstatus: completed\ndate: 2026-01-01');
		expect(findStaleCompletedPlans(root, { now: NOW })).toEqual([]);
	});

	it("uses `updated` over `date`, and does not age a plan that carries neither", () => {
		plan("moved", 'title: "m"\nstatus: completed\ndate: 2026-01-01\nupdated: 2026-09-12');
		plan("undated", 'title: "u"\nstatus: completed');
		const found = findStaleCompletedPlans(root, { now: NOW });
		expect(found).toEqual([]);
	});

	it("is quiet on a project with no planning directory", () => {
		expect(findStaleCompletedPlans(join(root, "nowhere"), { now: NOW })).toEqual([]);
	});
});
