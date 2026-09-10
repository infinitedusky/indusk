import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { paperProject } from "../../__tests__/helpers/papers-fixture.js";
import { readConfig, writeConfig } from "../config.js";
import { ensurePapersConfig } from "./config.js";

/**
 * A6 (writing-skill): `update` ensures the `papers` block the way it ensures
 * `cleanup` and the decay keys — keyed on block presence, so a project with
 * destinations keeps them byte-for-byte and a project without gets an empty
 * list once.
 *
 * Authored at Build Phase 2 start: its subject is `ensurePapersConfig`, which
 * this phase introduces, so the file cannot load before it.
 */
describe("ensurePapersConfig (A6)", () => {
	it("adds an empty destinations list once and never clobbers one", () => {
		const { root } = paperProject({ docs: {} });

		expect(ensurePapersConfig(root)).toBe("added");
		expect(readConfig(root)?.papers).toEqual({ destinations: [] });

		const config = readConfig(root);
		if (!config) throw new Error("config vanished");
		writeConfig(root, {
			...config,
			papers: {
				destinations: [{ name: "blog", path: "/x", dir: "w", index: "w/index.md" }],
			},
		});
		const before = readFileSync(join(root, ".indusk/config.json"), "utf-8");

		expect(ensurePapersConfig(root)).toBe("already-set");
		expect(readFileSync(join(root, ".indusk/config.json"), "utf-8")).toBe(before);
	});

	it("a present but empty block is already-set, not re-added", () => {
		const { root } = paperProject({ docs: {}, config: { papers: { destinations: [] } } });
		const before = readFileSync(join(root, ".indusk/config.json"), "utf-8");

		expect(ensurePapersConfig(root)).toBe("already-set");
		expect(readFileSync(join(root, ".indusk/config.json"), "utf-8")).toBe(before);
	});

	it("reports no-config when the project has no .indusk/config.json", () => {
		const { root } = paperProject({ docs: {} });
		// paperProject always writes one; point at a directory that has none.
		expect(ensurePapersConfig(join(root, "nowhere"))).toBe("no-config");
	});
});
