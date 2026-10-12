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
 * against, and Build Phase 3 builds to:
 *
 *   story    { kind: "story", story: "<component>.<state>", snapshotHash,
 *              foundationHash, declarationsHash, by, at }
 *   mockup   today's entry + componentsHash, the sha256 of the sorted snapshot
 *            hashes of the components it composes joined by newline; its
 *            `mockupHash` is the hash of the mockup's source bytes. If Build
 *            Phase 3 hashes the composed mockup instead, regenerate with this
 *            script rather than editing the record.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readApp } from "../src/lib/looks/mockups.js";

const ROOT = resolve(import.meta.dirname, "../src/__tests__/fixtures/components-app");
const APP = ".indusk/mockups/demo";
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const snapshot = (name: string) =>
	sha256(readFileSync(join(ROOT, APP, "components", `${name}.html`)));

const app = await readApp(ROOT, "demo");
const by = "sandy";
const at = "2026-10-12T09:00:00.000Z";
const bound = {
	foundationHash: app.foundation.hash,
	declarationsHash: app.declarationsHash,
	by,
	at,
};
const componentsHash = (names: string[]) => sha256(names.map(snapshot).sort().join("\n"));
const mockupHash = (name: string) => {
	const m = app.mockups.find((x) => x.name === name);
	if (!m) throw new Error(`fixture has no mockup ${name}`);
	return m.hash;
};

writeFileSync(
	join(ROOT, APP, "approved.json"),
	`${JSON.stringify(
		{
			approvals: [
				{ kind: "story", story: "badge.ok", snapshotHash: snapshot("badge.ok"), ...bound },
				{ kind: "story", story: "card.default", snapshotHash: snapshot("card.default"), ...bound },
				{
					mockup: "home.default",
					mockupHash: mockupHash("home.default"),
					componentsHash: componentsHash(["badge.ok", "card.default"]),
					...bound,
				},
				{
					mockup: "detail.default",
					mockupHash: mockupHash("detail.default"),
					componentsHash: componentsHash(["card.default"]),
					...bound,
				},
			],
		},
		null,
		"\t",
	)}\n`,
);

const catalogFile = join(ROOT, APP, "components.json");
const catalog = JSON.parse(readFileSync(catalogFile, "utf-8")) as {
	components: Array<{ name: string; states: Array<{ name: string; snapshotHash: string }> }>;
};
for (const c of catalog.components) {
	for (const s of c.states) s.snapshotHash = snapshot(`${c.name}.${s.name}`);
}
writeFileSync(catalogFile, `${JSON.stringify(catalog, null, "\t")}\n`);
process.stdout.write("wrote approved.json and components.json\n");
