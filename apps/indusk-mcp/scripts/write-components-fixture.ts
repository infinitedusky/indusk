/**
 * Writes the two files of `src/__tests__/fixtures/components-app/` that carry
 * hashes: `components.json`'s snapshot hashes and `approved.json`.
 *
 * `approved.json` is written here, through the package's own hash functions
 * (`readApp`), because the approval guard hook refuses a tool write to any
 * `.indusk/mockups/*\/approved.json` (ui-promises Test Phase 1 Forward
 * Intelligence). Run after changing a fixture file the hashes cover:
 *
 *   cd apps/indusk-mcp && pnpm exec tsx scripts/write-components-fixture.ts
 *
 * The entry shapes are the contract `looks-components-cli.test.ts` is written
 * against:
 *
 *   story    { kind: "story", story: "<component>.<state>", snapshotHash,
 *              stylesheetHash (when its component has a stylesheet),
 *              foundationHash, declarationsHash, by, at }
 *   mockup   today's entry + componentsHash (`componentsHashOf`: the sha256 of
 *            the sorted snapshot hashes of the components it composes, joined
 *            by newline, then `css:<hash>` of each stylesheet of a component
 *            it names); its `mockupHash` is the hash of the mockup composed
 *            (`looks/compose`), as Build Phase 3 decided — what is shown is
 *            what is bound. Every hash is read from `readApp`, never computed
 *            here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readApp } from "../src/lib/looks/mockups.js";

const ROOT = resolve(import.meta.dirname, "../src/__tests__/fixtures/components-app");
const APP = ".indusk/mockups/demo";

const app = await readApp(ROOT, "demo");
const by = "sandy";
const at = "2026-10-12T09:00:00.000Z";
const bound = {
	foundationHash: app.foundation.hash,
	declarationsHash: app.declarationsHash,
	by,
	at,
};
const storyOf = (name: string) => {
	const s = app.stories.find((x) => x.name === name);
	if (!s) throw new Error(`fixture has no snapshot ${name}`);
	return s;
};
const snapshot = (name: string) => storyOf(name).hash;
/** A story's entry: its snapshot, and its component's stylesheet when it has one. */
const story = (name: string) => {
	const s = storyOf(name);
	return {
		kind: "story",
		story: name,
		snapshotHash: s.hash,
		...(s.stylesheetHash === null ? {} : { stylesheetHash: s.stylesheetHash }),
		...bound,
	};
};
const mockup = (name: string) => {
	const m = app.mockups.find((x) => x.name === name);
	if (!m) throw new Error(`fixture has no mockup ${name}`);
	return { mockup: m.name, mockupHash: m.hash, componentsHash: m.componentsHash, ...bound };
};

writeFileSync(
	join(ROOT, APP, "approved.json"),
	`${JSON.stringify(
		{
			approvals: [
				story("badge.ok"),
				story("card.default"),
				mockup("home.default"),
				mockup("detail.default"),
			],
		},
		null,
		"\t",
	)}\n`,
);

const catalogFile = join(ROOT, APP, "components.json");
const catalog = JSON.parse(readFileSync(catalogFile, "utf-8")) as {
	components: Array<{
		name: string;
		stylesheet?: string;
		stylesheetHash?: string;
		states: Array<{ name: string; snapshotHash: string }>;
	}>;
};
for (const c of catalog.components) {
	for (const s of c.states) s.snapshotHash = snapshot(`${c.name}.${s.name}`);
	const sheet = app.styles.find((x) => x.component === c.name);
	if (sheet) {
		c.stylesheet = `components/${sheet.key}`;
		c.stylesheetHash = sheet.hash;
	}
}
writeFileSync(catalogFile, `${JSON.stringify(catalog, null, "\t")}\n`);
process.stdout.write("wrote approved.json and components.json\n");
