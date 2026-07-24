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
