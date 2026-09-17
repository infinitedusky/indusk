import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	formatVersionState,
	PACKAGED_PATHS,
	readVersionState,
	versionStateProblem,
} from "../lib/version-state.js";

/**
 * The three-way version state an agent must never guess at (2026-09-17: an
 * agent reported 1.50.0 unpublished an hour after the operator published,
 * upgraded and updated — none of the three left a mark).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "../..");

let root: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "version-state-"));
	mkdirSync(join(root, ".indusk"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const online = () => Promise.resolve({ latestVersion: "1.50.0", fromCache: false });
const offline = () => Promise.resolve({ latestVersion: null, fromCache: false });

describe("version state", () => {
	it("PACKAGED_PATHS mirrors the release guard's list exactly — bash cannot import it", () => {
		const guard = readFileSync(join(PKG_ROOT, "scripts/release-guard.sh"), "utf-8");
		const block = guard.slice(
			guard.indexOf("PACKAGED_PATHS=("),
			guard.indexOf(")", guard.indexOf("PACKAGED_PATHS=(")),
		);
		const fromBash = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
		expect(fromBash).toEqual([...PACKAGED_PATHS]);
	});

	it("reads the version `indusk update` recorded, and reports a project updated by another version as a fault", async () => {
		writeFileSync(
			join(root, ".indusk/config.json"),
			JSON.stringify({
				mode: "local",
				verify: {},
				indusk: { version: "1.44.2", updated_at: "2026-09-15T10:00:00.000Z" },
			}),
		);
		const s = await readVersionState(root, { checkLatest: online, installed: "1.50.0" });
		expect(s.projectUpdatedTo).toBe("1.44.2");
		expect(s.repo).toBeNull();
		expect(formatVersionState(s)).toContain("project updated to 1.44.2 on 2026-09-15");
		expect(versionStateProblem(s)).toMatch(/last updated by 1\.44\.2 but 1\.50\.0 is running/);
	});

	it("a project with no recorded update says so; an unreachable registry says unknown, never a version", async () => {
		writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local", verify: {} }));
		const s = await readVersionState(root, { checkLatest: offline, installed: "1.50.0" });
		expect(s.published).toBeNull();
		const line = formatVersionState(s);
		expect(line).toContain("published unknown");
		expect(line).toContain("never recorded an update");
		expect(versionStateProblem(s)).toBeNull();
	});

	it("on the monorepo itself, names the release commit and counts packaged commits since it", async () => {
		const repoRoot = join(PKG_ROOT, "../..");
		const s = await readVersionState(repoRoot, { checkLatest: online, installed: "1.50.0" });
		expect(s.repo).not.toBeNull();
		expect(s.repo?.version).toMatch(/^\d+\.\d+\.\d+$/);
		// The release commit for the current version exists in this repo's history.
		expect(s.repo?.releaseCommit).toMatch(/^[0-9a-f]{8}$/);
		expect(formatVersionState(s)).toMatch(
			/release commit [0-9a-f]{8} for \d+\.\d+\.\d+, \d+ packaged commit/,
		);
	});
});
