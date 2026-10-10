import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planDates, planTitle, promiseWords } from "./display.js";

/**
 * display-names A2, A3, A6, A11, A12, A13: how a handle reads as words, how a
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
