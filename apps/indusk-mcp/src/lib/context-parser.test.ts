import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	parseContext,
	parseContextString,
	SECTION_NAMES,
	updateSectionString,
	validateContext,
} from "./context-parser.js";

const projectRoot = join(import.meta.dirname, "../../../..");

describe("parseContext", () => {
	it("parses the repo CLAUDE.md with all 6 sections", () => {
		const parsed = parseContext(join(projectRoot, "CLAUDE.md"));
		expect(parsed.title).toContain("infinitedusky");
		expect(parsed.sections).toHaveLength(6);

		const names = parsed.sections.map((s) => s.name);
		for (const expected of SECTION_NAMES) {
			expect(names).toContain(expected);
		}
	});

	it("returns empty for non-existent file", () => {
		const parsed = parseContext("/tmp/nonexistent.md");
		expect(parsed.title).toBe("");
		expect(parsed.sections).toEqual([]);
	});
});

describe("parseContextString", () => {
	it("extracts section content correctly", () => {
		const md = `# My Project

## What This Is

A test project.

## Architecture

Monorepo with apps.

## Conventions

- Use pnpm

## Key Decisions

- Chose Biome

## Known Gotchas

- Node 22 required

## Current State

In progress.
`;
		const parsed = parseContextString(md);
		expect(parsed.title).toBe("My Project");
		expect(parsed.sections).toHaveLength(6);
		expect(parsed.sections[0].content).toBe("A test project.");
		expect(parsed.sections[1].content).toBe("Monorepo with apps.");
	});
});

describe("validateContext", () => {
	it("reports valid for complete CLAUDE.md", () => {
		const parsed = parseContext(join(projectRoot, "CLAUDE.md"));
		const result = validateContext(parsed);
		expect(result.valid).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.extra).toEqual([]);
	});

	it("reports missing sections", () => {
		const parsed = parseContextString("# Test\n\n## What This Is\n\nHello\n");
		const result = validateContext(parsed);
		expect(result.valid).toBe(false);
		expect(result.missing).toContain("Architecture");
		expect(result.missing).toContain("Current State");
	});
});

describe("updateSectionString", () => {
	const md = `# Project

## What This Is

Old content.

## Architecture

Old arch.
`;

	it("replaces section content", () => {
		const updated = updateSectionString(md, "What This Is", "New content.");
		expect(updated).toContain("## What This Is\n\nNew content.\n\n## Architecture");
	});

	it("replaces last section content", () => {
		const updated = updateSectionString(md, "Architecture", "New arch.");
		expect(updated).toContain("## Architecture\n\nNew arch.\n");
		expect(updated).not.toContain("Old arch.");
	});

	it("throws for missing section", () => {
		expect(() => updateSectionString(md, "Conventions", "test")).toThrow(
			'Section "Conventions" not found',
		);
	});
});
