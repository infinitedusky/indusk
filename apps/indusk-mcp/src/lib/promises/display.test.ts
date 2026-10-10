import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../__tests__/helpers/cli.js";
import { git, initRepoWithCommit } from "../../__tests__/helpers/test-git.js";
import { planDates, planTitle, promiseWords, readHealthNames } from "./display.js";

/**
 * display-names A2, A3, A6, A11, A12, A13, A14, A15: how a handle reads as words, how a
 * plan reads by its title, and a plan's start, landing and release dates.
 *
 * promise: a-promise-reads-as-words
 * promise: a-plan-reads-by-its-title
 * promise: a-plan-shows-when-it-shipped
 */

function plan(opts: { brief?: string; retro?: string }): string {
	const dir = join(mkdtempSync(join(tmpdir(), "display-")), "my-plan");
	mkdirSync(dir, { recursive: true });
	if (opts.brief !== undefined) writeFileSync(join(dir, "brief.md"), opts.brief);
	if (opts.retro !== undefined) writeFileSync(join(dir, "retrospective.md"), opts.retro);
	return dir;
}

const BRIEF = '---\ntitle: "My plan — a thing"\ndate: 2026-10-08\n---\n\n# My plan\n';
const LANDED = "# Retrospective\n\nLanded on main at abc1234, 2026-10-09.\n";
const CHANGELOG = [
	"# Changelog",
	"## [Unreleased]",
	"## [1.69.0] — 2026-10-10",
	"- **Other** (someone-else): x",
	"## [1.68.0] — 2026-10-09",
	"- **Thing** (my-plan): shipped",
	"## [1.67.0] — 2026-10-01",
	"- **Older** (older-plan): y",
].join("\n");

describe("A2 — product names keep their capitals", () => {
	it("reads a handle as words, with Fly and InDusk spelled their way", () => {
		expect(promiseWords("a-fly-deploy-is-one-command")).toBe("A Fly deploy is one command");
		expect(promiseWords("indusk-leaves-main-clean")).toBe("InDusk leaves main clean");
	});
});

describe("A3 — a project names its own product words", () => {
	it("keeps a configured word's spelling", () => {
		const words = promiseWords("seatholds-never-double-book", { seatholds: "SeatHolds" });
		expect(words.startsWith("SeatHolds")).toBe(true);
		expect(words).toBe("SeatHolds never double book");
	});
});

describe("A6 — a plan with no title reads by its folder", () => {
	it("falls back to the folder for no brief title or an empty one", () => {
		expect(planTitle(undefined, "my-plan")).toBe("my-plan");
		expect(planTitle("", "my-plan")).toBe("my-plan");
	});
	it("reads the part of the brief's title before ' — '", () => {
		expect(planTitle("VS Code extension — promises in the editor", "vscode-extension")).toBe(
			"VS Code extension",
		);
	});
});

describe("A11 — a plan shows when it started and landed", () => {
	it("reads the brief's date and the retrospective's landing line", () => {
		const dates = planDates(plan({ brief: BRIEF, retro: LANDED }), CHANGELOG);
		expect(dates.started).toBe("2026-10-08");
		expect(dates.landed).toBe("2026-10-09");
	});
});

describe("A12 — a landed plan shows the release that shipped it", () => {
	it("names the first release whose changelog names the plan", () => {
		const dates = planDates(plan({ brief: BRIEF, retro: LANDED }), CHANGELOG);
		expect(dates.released).toEqual({ version: "1.68.0", date: "2026-10-09" });
	});
	it("takes the earliest release when several name it", () => {
		const later = `${CHANGELOG}\n## [1.66.0] — 2026-09-30\n- **Earlier** (my-plan): first\n`;
		expect(planDates(plan({ brief: BRIEF, retro: LANDED }), later).released).toEqual({
			version: "1.66.0",
			date: "2026-09-30",
		});
	});
});

describe("A13 — a plan not landed, or landed and unreleased", () => {
	it("shows only the start date for a plan with no landing line", () => {
		expect(planDates(plan({ brief: BRIEF }), CHANGELOG)).toEqual({
			started: "2026-10-08",
			landed: null,
			released: null,
		});
	});
	it("has released: null when landed but in no release yet", () => {
		const dates = planDates(
			plan({ brief: BRIEF, retro: LANDED }),
			"## [1.67.0] — 2026-10-01\n- x (older)",
		);
		expect(dates).toEqual({ started: "2026-10-08", landed: "2026-10-09", released: null });
	});
});

/** A plan folder holding the named documents, each with its text. */
function folderWith(files: Record<string, string>): string {
	const dir = join(mkdtempSync(join(tmpdir(), "display-")), "my-plan");
	mkdirSync(dir, { recursive: true });
	for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
	return dir;
}

const RETRO_NO_LINE = "---\ndate: 2026-09-10\n---\n\n# Retrospective\n";

describe("A14 — an archived plan with no landing line is still landed", () => {
	it("dates it by its retrospective and shows the release the changelog names", () => {
		const dir = folderWith({ "brief.md": BRIEF, "retrospective.md": RETRO_NO_LINE });
		expect(planDates(dir, CHANGELOG, { archived: true })).toEqual({
			started: "2026-10-08",
			landed: "2026-09-10",
			released: { version: "1.68.0", date: "2026-10-09" },
		});
	});
	it("a landing line, when present, still wins", () => {
		const dir = folderWith({ "brief.md": BRIEF, "retrospective.md": LANDED });
		expect(planDates(dir, CHANGELOG, { archived: true }).landed).toBe("2026-10-09");
	});
	it("a plan not archived with no landing line is still not landed", () => {
		const dir = folderWith({ "brief.md": BRIEF, "retrospective.md": RETRO_NO_LINE });
		expect(planDates(dir, CHANGELOG).landed).toBeNull();
	});
	it("reads through readHealthNames for a plan under archive/", () => {
		const root = mkdtempSync(join(tmpdir(), "display-project-"));
		const planDir = join(root, ".indusk", "planning", "archive", "my-plan");
		mkdirSync(planDir, { recursive: true });
		writeFileSync(join(planDir, "brief.md"), BRIEF);
		writeFileSync(join(planDir, "retrospective.md"), RETRO_NO_LINE);
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({
				workflow: {
					steps: {
						release: { command: "x", version_file: "package.json", changelog: "CHANGELOG.md" },
					},
				},
			}),
		);
		writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
		expect(readHealthNames(root).planDates["my-plan"]).toEqual({
			started: "2026-10-08",
			landed: "2026-09-10",
			released: { version: "1.68.0", date: "2026-10-09" },
		});
	});
});

describe("A15 — a plan with no brief shows when it started", () => {
	it("takes the date from its research", () => {
		const dir = folderWith({ "research.md": "---\ndate: 2026-10-01\n---\n\n# R\n" });
		expect(planDates(dir).started).toBe("2026-10-01");
	});
	it("takes the date from its test plan when nothing earlier exists", () => {
		const dir = folderWith({ "test-plan.md": "---\ndate: 2026-10-02\n---\n\n# T\n" });
		expect(planDates(dir).started).toBe("2026-10-02");
	});
	it("the brief's date still wins", () => {
		const dir = folderWith({
			"brief.md": BRIEF,
			"research.md": "---\ndate: 2026-10-01\n---\n",
		});
		expect(planDates(dir).started).toBe("2026-10-08");
	});
});

/** A commit on `date`, empty, with `message`; returns its full sha. */
function commitOn(dir: string, date: string, message: string): string {
	const at = `${date}T12:00:00Z`;
	git(dir, ["commit", "-q", "--allow-empty", "-m", message], {
		GIT_AUTHOR_DATE: at,
		GIT_COMMITTER_DATE: at,
	});
	return git(dir, ["rev-parse", "HEAD"]);
}

function retro(dir: string, plan: string, text: string): void {
	const folder = join(dir, ".indusk", "planning", "archive", plan);
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, "retrospective.md"), text);
}

describe("A16 — a plan shows the release that shipped it, whatever the changelog says", () => {
	it("is the first release commit after the plan's landing commit on the trunk", () => {
		const dir = mkdtempSync(join(tmpdir(), "display-trunk-"));
		initRepoWithCommit(dir);
		const p1 = commitOn(dir, "2026-02-01", "feat: p1 lands");
		git(dir, ["checkout", "-q", "-b", "plan/p3"]);
		commitOn(dir, "2026-02-02", "feat: p3 work");
		git(dir, ["checkout", "-q", "main"]);
		git(dir, ["merge", "--no-ff", "-q", "-m", "Merge branch 'plan/p3'", "plan/p3"], {
			GIT_AUTHOR_DATE: "2026-02-03T12:00:00Z",
			GIT_COMMITTER_DATE: "2026-02-03T12:00:00Z",
		});
		commitOn(dir, "2026-02-05", "chore(release): 1.2.0 — the first");
		const p2 = commitOn(dir, "2026-02-10", "feat: p2 lands");
		commitOn(dir, "2026-02-11", "chore: unrelated");
		retro(dir, "p1", `# R\n\nLanded on main at ${p1.slice(0, 7)}, 2026-02-01.\n`);
		retro(dir, "p2", `# R\n\nLanded on main at ${p2.slice(0, 7)}, 2026-02-10.\n`);
		retro(dir, "p3", "---\ndate: 2026-02-03\n---\n\n# R\n");
		mkdirSync(join(dir, "docs"), { recursive: true });
		writeFileSync(
			join(dir, "docs", "changelog.md"),
			"## [1.2.0] — 2026-02-05\n- **Thing** (other): x\n",
		);
		mkdirSync(join(dir, ".indusk"), { recursive: true });
		writeFileSync(
			join(dir, ".indusk", "config.json"),
			JSON.stringify({ workflow: { steps: { release: { changelog: "docs/changelog.md" } } } }),
		);
		const dates = readHealthNames(dir).planDates;
		expect(dates.p1.released).toEqual({ version: "1.2.0", date: "2026-02-05" });
		expect(dates.p3.released).toEqual({ version: "1.2.0", date: "2026-02-05" });
		expect(dates.p2.landed).toBe("2026-02-10");
		expect(dates.p2.released).toBeNull();
	});

	const onDusk = existsSync(join(REPO_ROOT, ".indusk/planning/archive/day-promises"));
	it.skipIf(!onDusk)("shows day-promises and dawn-verify released on this repository", () => {
		const dates = readHealthNames(REPO_ROOT).planDates;
		expect(dates["day-promises"]?.released).not.toBeNull();
		expect(dates["dawn-verify"]?.released).not.toBeNull();
	});
});
