/**
 * Additive section ensure for AGENTS.md — the twin of `hook-migration.ts` for
 * a user-owned prose file.
 *
 * `init` and `update` copy `templates/AGENTS.md` only when the project has no
 * AGENTS.md, and never overwrite one that exists (users extend it). So a
 * section added to the template reaches new projects and pre-1.28 projects,
 * and never reaches a project that already has the file — which is every
 * project that matters. A conduct rule that ships only to projects that do
 * not exist yet has not shipped.
 *
 * This closes the other half additively: each heading in
 * `ENSURED_AGENTS_MD_SECTIONS` is appended, verbatim from the template, to a
 * project AGENTS.md that lacks it. A present section is never rewritten (the
 * user's wording wins), an absent file is never created (that is the copy
 * path's job), and the heading is the identity — matched as a whole line,
 * because the phrase appearing in prose is not the section being there.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Template sections every project AGENTS.md must carry. Extend on new rules. */
export const ENSURED_AGENTS_MD_SECTIONS: readonly string[] = ["## Citing plan artifacts"];

export interface EnsureAgentsMdSectionsResult {
	/** Headings appended to the project file. */
	added: string[];
	/** Headings already present — left byte-untouched. */
	current: string[];
	/** No project AGENTS.md — nothing to ensure into; creation belongs to the copy path. */
	fileMissing: boolean;
}

export interface EnsureAgentsMdSectionsOptions {
	/** Override the ensured list (tests). */
	headings?: readonly string[];
}

const isH2 = (line: string): boolean => /^## /.test(line);

/**
 * The block from `heading` through the line before the next `## ` heading (or
 * EOF), trailing blank lines trimmed. Throws when the template has no such
 * heading: a template missing a section it promises is a packaging bug, not
 * consumer state, and a silent no-op here would ship the rule to nobody.
 */
export function extractSection(template: string, heading: string): string {
	const lines = template.split("\n");
	const start = lines.findIndex((l) => l.trimEnd() === heading);
	if (start === -1) throw new Error(`templates/AGENTS.md has no "${heading}" section`);
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (isH2(lines[i])) {
			end = i;
			break;
		}
	}
	return lines.slice(start, end).join("\n").trimEnd();
}

const hasHeading = (body: string, heading: string): boolean =>
	body.split("\n").some((l) => l.trimEnd() === heading);

/**
 * Append every ensured template section the project's AGENTS.md lacks.
 * Idempotent: a second run reports every heading as current and writes nothing.
 */
export function ensureAgentsMdSections(
	projectRoot: string,
	packageRoot: string,
	opts: EnsureAgentsMdSectionsOptions = {},
): EnsureAgentsMdSectionsResult {
	const headings = opts.headings ?? ENSURED_AGENTS_MD_SECTIONS;
	const result: EnsureAgentsMdSectionsResult = { added: [], current: [], fileMissing: false };

	// Validate the template before looking at the project, so a packaging bug
	// is loud on every path rather than only on projects that happen to lack
	// the section.
	const template = readFileSync(join(packageRoot, "templates/AGENTS.md"), "utf-8");
	const sections = headings.map((h) => [h, extractSection(template, h)] as const);

	const target = join(projectRoot, "AGENTS.md");
	if (!existsSync(target)) {
		result.fileMissing = true;
		return result;
	}

	const original = readFileSync(target, "utf-8");
	let body = original;
	for (const [heading, section] of sections) {
		if (hasHeading(body, heading)) {
			result.current.push(heading);
			continue;
		}
		const trimmed = body.replace(/\s+$/, "");
		body = trimmed ? `${trimmed}\n\n${section}\n` : `${section}\n`;
		result.added.push(heading);
	}

	if (body !== original) writeFileSync(target, body);
	return result;
}
