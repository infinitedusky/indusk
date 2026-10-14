import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";

/**
 * promise: a-placed-component-shows-its-content — component-content Test
 * Phase 1, A5.
 *
 * System tier: `indusk looks stories admin` renders the admin's real stories
 * in Chromium, and `components.json` is read back: each
 * state must say which properties a mockup may fill.
 */

const REPO = join(__dirname, "..", "..", "..", "..");
const ADMIN = join(REPO, ".indusk", "mockups", "admin");
const backups: string[] = [];

/** The admin's mockups are put back as they were: the render step rewrites them in place. */
afterAll(() => {
	for (const b of backups) {
		rmSync(ADMIN, { recursive: true, force: true });
		cpSync(b, ADMIN, { recursive: true });
		rmSync(b, { recursive: true, force: true });
	}
});

interface Place {
	at: number[];
	nodes?: number;
	before?: string;
	after?: string;
}

interface State {
	name: string;
	content?: Record<string, Array<number[] | Place>>;
}

/**
 * Stories render through the project's own checkout: Vite will not serve the
 * admin's sources through a symlinked or copied tree, so this runs in place,
 * over a backup of the one directory the step writes, and restores it.
 */
function render(): { components: Array<{ name: string; states: State[] }>; out: string } {
	const backup = mkdtempSync(join(tmpdir(), "looks-content-"));
	backups.push(backup);
	cpSync(ADMIN, backup, { recursive: true });
	const r = runCli(REPO, ["looks", "stories", "admin"]);
	return {
		out: `${r.stdout}\n${r.stderr}`,
		components: JSON.parse(readFileSync(join(ADMIN, "components.json"), "utf-8")).components,
	};
}

describe("the render step records where content goes", () => {
	it("A5 each state says which properties a mockup may fill", { timeout: 600_000 }, () => {
		const { components, out } = render();
		const state = (component: string, name: string) =>
			components.find((c) => c.name === component)?.states.find((s) => s.name === name);
		const takes = (component: string, name: string) =>
			Object.keys(state(component, name)?.content ?? {}).sort();
		expect(takes("button", "default"), out).toContain("children");
		expect(takes("tag", "default"), out).toContain("children");
		expect(takes("step", "done"), out).toContain("name");
		expect(takes("box", "default"), out).toEqual(expect.arrayContaining(["title", "children"]));
	});

	it("A14 a place records the words around a property and the nodes its children span", {
		timeout: 600_000,
	}, () => {
		const { components, out } = render();
		const places = (component: string, state: string, property: string) =>
			(
				components.find((c) => c.name === component)?.states.find((s) => s.name === state)
					?.content?.[property] ?? []
			).map((p) => (Array.isArray(p) ? { at: p } : p));
		expect(places("part-section", "open", "summary")[0]?.before, out).toBe("\u00b7 ");
		expect(places("decision-card", "ask", "children")[0]?.nodes, out).toBe(2);
	});
});
