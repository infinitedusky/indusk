import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { archiveDeadPlans, classifyPlans } from "../archive-dead.js";

/**
 * Supporting tests for indusk-makeover Phase 1 (feeds trajectory row A11 —
 * the behavioral half of A11 is the Phase 6 backfill against the real repo).
 *
 * Dead draft = all docs draft/abandoned/no-status AND newest file older than
 * planning.dead_draft_days AND not protected by a non-draft master.md row.
 * Archive moves, never deletes, never overwrites.
 */

const NOW = new Date("2026-07-23T12:00:00.000Z");
const OLD = new Date("2026-05-01T00:00:00.000Z"); // ~12 weeks before NOW

function ageAllFiles(dir: string, when: Date): void {
	// utimes every file so newestMtimeMs sees an old tree
	for (const rel of ["brief.md", "research.md", "impl.md"]) {
		const p = join(dir, rel);
		if (existsSync(p)) utimesSync(p, when, when);
	}
	utimesSync(dir, when, when);
}

describe("archiveDeadPlans", () => {
	let projectRoot: string;
	let planningDir: string;

	function writePlan(name: string, docs: Record<string, string>, mtime: Date): string {
		const dir = join(planningDir, name);
		mkdirSync(dir, { recursive: true });
		for (const [file, status] of Object.entries(docs)) {
			const frontmatter = status === "(none)" ? "" : `---\ntitle: "x"\nstatus: ${status}\n---\n`;
			writeFileSync(join(dir, file), `${frontmatter}\n# ${name} ${file}\n`);
		}
		ageAllFiles(dir, mtime);
		return dir;
	}

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-archive-dead-"));
		planningDir = join(projectRoot, ".indusk/planning");
		mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
		mkdirSync(planningDir, { recursive: true });
		writeFileSync(join(projectRoot, ".indusk/config.json"), JSON.stringify({ mode: "full" }));
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("archives an old all-draft plan with documents intact", () => {
		writePlan("dead-idea", { "brief.md": "draft" }, OLD);

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived.map((p) => p.name)).toEqual(["dead-idea"]);
		expect(existsSync(join(planningDir, "dead-idea"))).toBe(false);
		expect(existsSync(join(planningDir, "archive/dead-idea/brief.md"))).toBe(true);
	});

	it("never archives a plan with any status beyond draft (accepted brief)", () => {
		writePlan("accepted-plan", { "brief.md": "accepted" }, OLD);

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived).toEqual([]);
		expect(result.skipped.map((s) => s.name)).toContain("accepted-plan");
		expect(existsSync(join(planningDir, "accepted-plan"))).toBe(true);
	});

	it("never archives a recently-touched draft", () => {
		writePlan("fresh-draft", { "brief.md": "draft" }, NOW);

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived).toEqual([]);
		expect(existsSync(join(planningDir, "fresh-draft"))).toBe(true);
	});

	it("archives abandoned plans (abandoned is terminal, archive is where it belongs)", () => {
		writePlan("gave-up", { "brief.md": "draft", "impl.md": "abandoned" }, OLD);

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived.map((p) => p.name)).toEqual(["gave-up"]);
	});

	it("blocks on unparseable frontmatter (conservative on bad input)", () => {
		const dir = join(planningDir, "mangled");
		mkdirSync(dir);
		writeFileSync(join(dir, "brief.md"), "---\nstatus: [unclosed\ntitle: {{{\n---\nbody\n");
		utimesSync(join(dir, "brief.md"), OLD, OLD);
		utimesSync(dir, OLD, OLD);

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived).toEqual([]);
		expect(result.skipped.find((s) => s.name === "mangled")?.reason).toMatch(/unparseable/);
	});

	it("master.md protects plans on non-draft rows; draft rows stay archivable", () => {
		writePlan("parked-plan", { "brief.md": "draft" }, OLD);
		writePlan("stale-draft", { "brief.md": "draft" }, OLD);
		writeFileSync(
			join(planningDir, "master.md"),
			[
				"| [parked-plan](parked-plan/brief.md) | parked — revisit with v2 |",
				"| [stale-draft](stale-draft/brief.md) | brief draft | can run anytime |",
			].join("\n"),
		);

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived.map((p) => p.name)).toEqual(["stale-draft"]);
		expect(result.skipped.find((s) => s.name === "parked-plan")?.reason).toMatch(/master\.md/);
	});

	it("dry-run reports candidates without moving anything", () => {
		writePlan("dead-idea", { "brief.md": "draft" }, OLD);

		const result = archiveDeadPlans(projectRoot, { now: NOW, dryRun: true });

		expect(result.dryRun).toBe(true);
		expect(result.archived.map((p) => p.name)).toEqual(["dead-idea"]);
		expect(existsSync(join(planningDir, "dead-idea"))).toBe(true);
		expect(existsSync(join(planningDir, "archive/dead-idea"))).toBe(false);
	});

	it("never overwrites an existing archive entry (collision → skip)", () => {
		writePlan("dead-idea", { "brief.md": "draft" }, OLD);
		mkdirSync(join(planningDir, "archive/dead-idea"), { recursive: true });
		writeFileSync(join(planningDir, "archive/dead-idea/brief.md"), "the original archived copy");

		const result = archiveDeadPlans(projectRoot, { now: NOW });

		expect(result.archived).toEqual([]);
		expect(result.skipped.find((s) => s.name === "dead-idea")?.reason).toMatch(/already/);
		expect(existsSync(join(planningDir, "dead-idea"))).toBe(true);
	});

	it("respects planning.dead_draft_days from config", () => {
		writeFileSync(
			join(projectRoot, ".indusk/config.json"),
			JSON.stringify({ mode: "full", planning: { dead_draft_days: 365 } }),
		);
		writePlan("twelve-weeks-old", { "brief.md": "draft" }, OLD);

		const { candidates } = classifyPlans(projectRoot, { now: NOW });

		expect(candidates).toEqual([]);
	});
});
