import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addProject, readRegistry } from "../registry.js";

/**
 * T24 — `readRegistry()` called against a malformed `projects.json` must
 *       quarantine the file (rename to `projects.json.corrupt.{ISO}.bak`)
 *       before `addProject()` writes a fresh registry. The malformed bytes
 *       must be preserved on disk; the next write path must NOT silently
 *       overwrite corrupt data with an empty registry.
 *
 * Today's behavior (red): `readRegistry` catches the JSON.parse throw and
 * returns `emptyRegistry()`. `addProject` appends and calls `writeRegistry`,
 * which tmp-writes + renames OVER the malformed `projects.json` — destroying
 * the original bytes with no chance of recovery.
 *
 * Expected behavior (green): `readRegistry` detects malformed, renames the
 * file to a timestamped `.bak`, returns `emptyRegistry()`. The subsequent
 * `writeRegistry` creates a brand-new `projects.json` with the single new
 * entry; the quarantined file sits alongside it with the original contents.
 */

const MALFORMED_JSON = '{"not-valid-json,"missing":true';

let testHome: string;

describe("registry quarantine — T24", () => {
	beforeEach(() => {
		testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
		mkdirSync(testHome, { recursive: true });
		process.env.INDUSK_HOME = testHome;
	});

	afterEach(() => {
		delete process.env.INDUSK_HOME;
		if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	});

	it("quarantines malformed projects.json before addProject writes a fresh registry", () => {
		// Seed: a malformed registry file exists on disk.
		const registryPath = join(testHome, "projects.json");
		writeFileSync(registryPath, MALFORMED_JSON);

		// Sanity: readRegistry survives (returns an empty shape) even with
		// the malformed file present. This is existing contract.
		const reg = readRegistry();
		expect(reg.projects).toEqual([]);

		// Act: register a fresh project.
		const projectDir = mkdtempSync(join(tmpdir(), "quar-"));
		try {
			addProject(projectDir);

			// Assert (a): a quarantined backup file exists with the original
			// malformed contents.
			const entries = readdirSync(testHome);
			const corrupt = entries.find(
				(e) => e.startsWith("projects.json.corrupt.") && e.endsWith(".bak"),
			);
			expect(corrupt, `expected projects.json.corrupt.*.bak in ${testHome}`).toBeDefined();
			if (!corrupt) return;

			const backupContents = readFileSync(join(testHome, corrupt), "utf-8");
			expect(backupContents).toBe(MALFORMED_JSON);

			// Assert (b): projects.json now holds exactly one entry.
			const fresh = readRegistry();
			expect(fresh.projects).toHaveLength(1);
			expect(fresh.projects[0].path).toBe(projectDir);

			// Assert (c): the new projects.json does NOT still contain the
			// malformed bytes — it's a real JSON registry.
			const currentContents = readFileSync(registryPath, "utf-8");
			expect(currentContents).not.toContain("not-valid-json");
			expect(() => JSON.parse(currentContents)).not.toThrow();
		} finally {
			rmSync(projectDir, { recursive: true, force: true });
		}
	});

	it("does NOT quarantine a well-formed but wrong-shape registry more than once per read cycle", () => {
		// Edge case: a file that parses as JSON but has the wrong shape
		// (e.g., an array instead of an object with `version`/`projects`).
		// The quarantine must still fire — same data-loss mechanism — but
		// repeated `readRegistry` calls without a write in between shouldn't
		// produce multiple .bak files (idempotence on the SAME malformed bytes).
		const registryPath = join(testHome, "projects.json");
		writeFileSync(registryPath, JSON.stringify([{ malformed: "array" }]));

		readRegistry();
		readRegistry();
		readRegistry();

		const backups = readdirSync(testHome).filter((e) =>
			e.startsWith("projects.json.corrupt."),
		);
		// After the first read quarantines, subsequent reads see NO
		// registryPath (because the rename moved it away) and return empty
		// without creating a second backup. So exactly one .bak should exist.
		expect(backups).toHaveLength(1);
	});
});
