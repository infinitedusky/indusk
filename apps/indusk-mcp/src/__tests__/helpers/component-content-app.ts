import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	APPROVALS_FILE,
	type ApprovalEntry,
	type StoryApprovalEntry,
} from "../../lib/looks/approvals.js";
import { type LooksApp, readApp } from "../../lib/looks/mockups.js";
import { app as copyOf, MOCKUPS } from "./looks-cli.js";

/**
 * A copy of the components fixture with one component that takes words — a
 * `button` whose `children` is a text node, a `box` whose body is — and
 * mockups placing them (component-content Test Phase 1). The `content` maps
 * are written by hand here as the render step will write them (Build Phase 2).
 */

export const BUTTON = '<button data-component="button">Marker</button>\n';
export const BOX = '<section data-component="box"><h2>Title</h2><p>Story body</p></section>\n';

export function contentApp(mockups: Record<string, string>): string {
	const root = copyOf("components-app");
	const dir = join(root, MOCKUPS);
	writeFileSync(join(dir, "components", "button.default.html"), BUTTON);
	writeFileSync(join(dir, "components", "box.default.html"), BOX);
	const catalogFile = join(dir, "components.json");
	const catalog = JSON.parse(readFileSync(catalogFile, "utf-8")) as {
		components: Array<Record<string, unknown>>;
	};
	catalog.components.push(
		{
			name: "button",
			file: "src/Button.jsx",
			properties: [{ name: "children", type: "ReactNode" }],
			states: [{ name: "default", snapshotHash: "unused", content: { children: [[0, 0]] } }],
		},
		{
			name: "box",
			file: "src/Box.jsx",
			properties: [{ name: "children", type: "ReactNode" }],
			states: [{ name: "default", snapshotHash: "unused", content: { children: [[0, 1]] } }],
		},
	);
	writeFileSync(catalogFile, JSON.stringify(catalog, null, "\t"));
	for (const [name, html] of Object.entries(mockups)) {
		writeFileSync(join(dir, "screens", `${name}.html`), html);
	}
	return root;
}

/** Approve every story and the named mockups as they read now, as a person's Approve would write them. */
export async function approveAll(root: string, mockupNames: string[]): Promise<LooksApp> {
	const app = await readApp(root, "demo");
	const at = "2026-10-14T00:00:00.000Z";
	const bound = { foundationHash: app.foundation.hash, declarationsHash: app.declarationsHash };
	const sheetOf = new Map(app.styles.map((s) => [s.component, s.hash] as const));
	const entries: Array<StoryApprovalEntry | ApprovalEntry> = [
		...app.stories.map(
			(s): StoryApprovalEntry => ({
				kind: "story",
				story: s.name,
				snapshotHash: s.hash,
				...(sheetOf.has(s.component) ? { stylesheetHash: sheetOf.get(s.component) as string } : {}),
				...bound,
				by: "tester",
				at,
			}),
		),
		...app.mockups
			.filter((m) => mockupNames.includes(m.name))
			.map(
				(m): ApprovalEntry => ({
					mockup: m.name,
					mockupHash: m.hash,
					componentsHash: m.componentsHash,
					components: Object.fromEntries(
						m.uses.filter((u) => u.snapshotHash).map((u) => [u.story, u.snapshotHash as string]),
					),
					...bound,
					by: "tester",
					at,
				}),
			),
	];
	const file = join(root, MOCKUPS, APPROVALS_FILE);
	writeFileSync(file, JSON.stringify({ approvals: entries }, null, "\t"));
	return readApp(root, "demo");
}
