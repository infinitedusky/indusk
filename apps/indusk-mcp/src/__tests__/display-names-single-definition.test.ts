import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { closedAt } from "../lib/promises/after-close.js";
import { planDates } from "../lib/promises/display.js";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * display-names A8: how a promise or a plan is named for a person, and a
 * plan's dates, are worked out in one place — the package's
 * `promises/display` — and the editor and the admin read it. A second copy
 * is how two windows come to name the same thing two ways.
 *
 * promise: display-names-are-defined-once
 * lesson: structural-single-definition-test-for-must-agree-invariants
 */

const LESSON = "lesson: structural-single-definition-test-for-must-agree-invariants";
const DISPLAY = join(REPO_ROOT, "apps/indusk-mcp/src/lib/promises/display.ts");
const ADMIN = join(REPO_ROOT, "apps/indusk-admin/src");
const EDITOR = join(REPO_ROOT, "apps/vscode-extension/src");

function sources(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
		return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
	});
}

describe("A8 — display names are defined once, in the package", () => {
	it("lib/promises/display.ts defines promiseWords, planTitle and planDates", () => {
		const text = existsSync(DISPLAY) ? readFileSync(DISPLAY, "utf-8") : "";
		const where = `apps/indusk-mcp/src/lib/promises/display.ts — ${LESSON}`;
		expect(text, where).toMatch(/export function promiseWords\(/);
		expect(text, where).toMatch(/export function planTitle\(/);
		expect(text, where).toMatch(/export (async )?function planDates\(/);
	});

	it("neither the admin nor the editor defines either, or turns a handle into words itself", () => {
		const copies = [...sources(ADMIN), ...sources(EDITOR)]
			.filter((path) => {
				const text = readFileSync(path, "utf-8");
				return (
					/function (promiseWords|planTitle|planDates)\b/.test(text) ||
					/replace\(\/-\/g, ?" "\)|replaceAll\("-", ?" "\)/.test(text)
				);
			})
			.map((path) => relative(REPO_ROOT, path));
		expect(copies, `a second definition of a display name — ${LESSON}`).toEqual([]);
	});
});

describe("A17 — a plan's landing date is worked out once in the package", () => {
	it("no file under apps/indusk-mcp/src but display.ts reads the 'Landed on main at' line", () => {
		const readers = sources(join(REPO_ROOT, "apps/indusk-mcp/src"))
			.filter(
				(path) =>
					path !== DISPLAY &&
					/\/Landed on main at|RegExp\([^)]*Landed on main at/.test(readFileSync(path, "utf-8")),
			)
			.map((path) => relative(REPO_ROOT, path));
		expect(readers, `a second reader of the landing line — ${LESSON}`).toEqual([]);
	});

	it("the monitor's close date and the editor's landed date agree for every plan here", () => {
		const planning = join(REPO_ROOT, ".indusk/planning");
		const disagree: string[] = [];
		for (const [root, archived] of [
			[planning, false],
			[join(planning, "archive"), true],
		] as const) {
			if (!existsSync(root)) continue;
			for (const name of readdirSync(root)) {
				const dir = join(root, name);
				if (name === "archive" || !statSync(dir).isDirectory()) continue;
				const closed = closedAt(dir)?.toISOString().slice(0, 10);
				const landed = planDates(dir, undefined, { archived }).landed;
				if (closed && landed && closed !== landed) disagree.push(`${name}: ${closed} vs ${landed}`);
			}
		}
		expect(disagree, `two landing dates for one plan — ${LESSON}`).toEqual([]);
	});
});
