import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkClaudeMdPointers, checkPointers } from "./context-pointers.js";

/** Walker unit tests supporting indusk-makeover trajectory row A3. */

describe("checkPointers", () => {
	let projectRoot: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-pointers-"));
		mkdirSync(join(projectRoot, ".indusk/planning/real-plan"), { recursive: true });
		writeFileSync(join(projectRoot, ".indusk/planning/real-plan/adr.md"), "# adr");
		mkdirSync(join(projectRoot, "apps/docs/src"), { recursive: true });
		writeFileSync(join(projectRoot, "apps/docs/src/guide.md"), "# guide");
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("resolves live pointers and flags dead ones", () => {
		const content = [
			"See `.indusk/planning/real-plan/adr.md` for the decision.",
			"Also see `.indusk/planning/ghost-plan/adr.md` (deleted).",
			"Guide at apps/docs/src/guide.md and apps/docs/src/missing.md.",
		].join("\n");

		const report = checkPointers(content, projectRoot);

		expect(report.dead).toEqual([".indusk/planning/ghost-plan/adr.md", "apps/docs/src/missing.md"]);
		expect(report.scanned).toContain(".indusk/planning/real-plan/adr.md");
	});

	it("skips globs and placeholders — documentation, not pointers", () => {
		const content = "Skills at `.indusk/planning/{kebab-case-name}/` and `apps/*/CLAUDE.md`.";
		const report = checkPointers(content, projectRoot);
		expect(report.dead).toEqual([]);
	});

	it("strips trailing punctuation from captured paths", () => {
		const content = "The ADR (see .indusk/planning/real-plan/adr.md).";
		const report = checkPointers(content, projectRoot);
		expect(report.dead).toEqual([]);
		expect(report.scanned).toContain(".indusk/planning/real-plan/adr.md");
	});

	it("checkClaudeMdPointers returns null when no CLAUDE.md exists", () => {
		expect(checkClaudeMdPointers(projectRoot)).toBeNull();
	});
});

/**
 * Version-claim refusal. dusk's CLAUDE.md said "1.36.0 published" for twelve
 * days and four releases while npm served 1.40.3 — nothing in the release
 * flow touches CLAUDE.md, so a hand-copied version is a drift by default.
 * Only `**Version**:` lines are checked: historical semvers elsewhere in the
 * document (release ranges, gotcha entries) are facts, not claims.
 */
describe("version claims", () => {
	let projectRoot: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-version-"));
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	function withPackageVersion(version: string): void {
		writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ version }));
	}

	it("fails a literal that disagrees with package.json", () => {
		withPackageVersion("1.40.3");
		const report = checkPointers("**Version**: **1.36.0 published**.", projectRoot);
		expect(report.versionClaims).toEqual([
			{ line: 1, claim: "1.36.0", problem: "mismatch", actual: "1.40.3" },
		]);
	});

	it("passes a literal that matches — it will fail here at the next bump", () => {
		withPackageVersion("1.40.3");
		const report = checkPointers("**Version**: 1.40.3.", projectRoot);
		expect(report.versionClaims).toEqual([]);
	});

	it("fails any literal when package.json has no version to check against", () => {
		writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "monorepo-root" }));
		const report = checkPointers(
			"**Version**: **1.36.0 published**; bumped to **1.36.1**.",
			projectRoot,
		);
		expect(report.versionClaims.map((v) => v.claim)).toEqual(["1.36.0", "1.36.1"]);
		expect(report.versionClaims.every((v) => v.problem === "unverifiable")).toBe(true);
	});

	it("passes a pointer-form Version line — no literal, nothing to drift", () => {
		const report = checkPointers(
			"**Version**: never hand-copied here — read `package.json`.",
			projectRoot,
		);
		expect(report.versionClaims).toEqual([]);
	});

	it("ignores semvers that are not on a Version line", () => {
		withPackageVersion("1.40.3");
		const content = "- **jj-residue-rip-out (1.36.1)** — shipped.\nGit-only substrate (1.31.0).";
		expect(checkPointers(content, projectRoot).versionClaims).toEqual([]);
	});

	it("checks every semver on the Version line, not just the first", () => {
		withPackageVersion("1.40.3");
		const report = checkPointers(
			"**Version**: 1.40.3 published; main bumped to 1.40.4.",
			projectRoot,
		);
		expect(report.versionClaims).toEqual([
			{ line: 1, claim: "1.40.4", problem: "mismatch", actual: "1.40.3" },
		]);
	});
});
