import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const SECTION_NAMES = [
	"What This Is",
	"Architecture",
	"Conventions",
	"Key Decisions",
	"Known Gotchas",
	"Current State",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export interface ContextSection {
	name: SectionName;
	content: string;
}

export interface ParsedContext {
	title: string;
	sections: ContextSection[];
}

export interface ContextValidation {
	valid: boolean;
	missing: SectionName[];
	extra: string[];
}

/**
 * Parse CLAUDE.md into its 6 canonical sections.
 * Sections are split on `## ` headings. Content between the title (H1)
 * and the first H2 is ignored (it's the intro line).
 */
export function parseContext(filePath: string): ParsedContext {
	if (!existsSync(filePath)) {
		return { title: "", sections: [] };
	}

	const raw = readFileSync(filePath, "utf-8");
	return parseContextString(raw);
}

export function parseContextString(raw: string): ParsedContext {
	const lines = raw.split("\n");

	// Extract H1 title
	const titleLine = lines.find((l) => l.startsWith("# "));
	const title = titleLine ? titleLine.replace(/^# /, "").trim() : "";

	// Split on ## headings
	const sections: ContextSection[] = [];
	let currentName: string | null = null;
	let currentLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("## ")) {
			if (currentName !== null) {
				sections.push({
					name: currentName as SectionName,
					content: currentLines.join("\n").trim(),
				});
			}
			currentName = line.replace(/^## /, "").trim();
			currentLines = [];
		} else if (currentName !== null) {
			currentLines.push(line);
		}
	}

	// Push last section
	if (currentName !== null) {
		sections.push({
			name: currentName as SectionName,
			content: currentLines.join("\n").trim(),
		});
	}

	return { title, sections };
}

export function validateContext(parsed: ParsedContext): ContextValidation {
	const found = new Set(parsed.sections.map((s) => s.name));
	const missing = SECTION_NAMES.filter((n) => !found.has(n));
	const canonical = new Set<string>(SECTION_NAMES);
	const extra = parsed.sections.map((s) => s.name).filter((n) => !canonical.has(n));

	return {
		valid: missing.length === 0 && extra.length === 0,
		missing: missing as SectionName[],
		extra,
	};
}

export function getSection(parsed: ParsedContext, name: SectionName): string | null {
	const section = parsed.sections.find((s) => s.name === name);
	return section?.content ?? null;
}

export function updateSection(filePath: string, name: SectionName, newContent: string): void {
	const raw = readFileSync(filePath, "utf-8");
	const updated = updateSectionString(raw, name, newContent);
	writeFileSync(filePath, updated);
}

export function updateSectionString(raw: string, name: SectionName, newContent: string): string {
	const header = `## ${name}`;
	const headerIdx = raw.indexOf(header);
	if (headerIdx === -1) {
		throw new Error(`Section "${name}" not found in CLAUDE.md`);
	}

	// Find the end of this section (next ## or EOF)
	const afterHeader = headerIdx + header.length;
	const nextSectionMatch = raw.slice(afterHeader).search(/\n## /);
	const endIdx = nextSectionMatch === -1 ? raw.length : afterHeader + nextSectionMatch;

	return `${raw.slice(0, afterHeader)}\n\n${newContent.trim()}\n${raw.slice(endIdx)}`;
}
