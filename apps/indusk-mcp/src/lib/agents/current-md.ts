/**
 * `.indusk/current.md` section-shape parser, serializer, and mutation helpers.
 *
 * File shape:
 *
 *   # Operational State
 *
 *   {preamble — explanatory text from the template, unchanged by mutations}
 *
 *   ## Project (shared)
 *
 *   {shared section body — any agent can edit}
 *
 *   ---
 *
 *   ## Session <short8> — <task>
 *
 *   **Session ID**: <full uuid>
 *   **Last updated**: <ISO timestamp>
 *
 *   ### In Flight
 *
 *   {body}
 *
 *   ### Open Questions
 *
 *   {body}
 *
 *   ### Cursor
 *
 *   {body}
 *
 *   ---
 *
 *   ## Session <short8b> — <task2>
 *   ...
 *
 * Sessions are matched by the `**Session ID**: <full uuid>` line — full UUID
 * is the canonical identity. Short ID in the heading is for human legibility
 * only; collisions on the 8-char prefix are tolerated (full ID disambiguates).
 *
 * Mutations are pure-string: every helper takes a content string and returns
 * a new content string. No filesystem access. The CLI / MCP tool handles
 * the read-write-atomic-rename surface around these helpers.
 *
 * Path safety: every public helper that accepts an external sessionId routes
 * it through `sanitizeSessionId` from `./session.ts`. Throws TypeError on
 * rejection. Callers catch and surface as non-zero exit.
 */

import { sanitizeSessionId } from "./session.js";

/**
 * Reject body content that would corrupt the file structure when written into
 * a section. Added as the Phase 6 falsification fix for T14:
 * `parseCurrentMd` splits content first on `^---\s*$` delimiters, then on
 * `^##\s+Session\s+` headings. A body containing those markers is
 * indistinguishable from a real session boundary on re-parse, so an attacker
 * (or an honest user pasting a snippet) can inject a fake session that other
 * agents see.
 *
 * Six forbidden line patterns:
 *   1. `^---\s*$`              — horizontal rule (section delimiter)
 *   2. `^##\s+Session\s+`      — session heading
 *   3. `^\*\*Session ID\*\*:`  — full-UUID marker
 *   4. `^\*\*Last updated\*\*:` — staleness timestamp
 *   5. `^\*\*Branch\*\*:`       — branch marker (worktree-visibility)
 *   6. `^\*\*Worktree\*\*:`     — worktree marker (worktree-visibility)
 *
 * Throws TypeError on any match; the public mutation helpers
 * (`upsertSection`, `editSharedSection`) route every body through this
 * sanitizer before writing.
 */
export function sanitizeSectionBody(body: string, fieldName: string): string {
	const forbidden = [
		{ pattern: /^---\s*$/m, label: "horizontal rule (---)" },
		{ pattern: /^##\s+Session\s+/m, label: "## Session heading" },
		{ pattern: /^\*\*Session ID\*\*:/m, label: "**Session ID**: marker" },
		{ pattern: /^\*\*Last updated\*\*:/m, label: "**Last updated**: marker" },
		{ pattern: /^\*\*Branch\*\*:/m, label: "**Branch**: marker" },
		{ pattern: /^\*\*Worktree\*\*:/m, label: "**Worktree**: marker" },
	];
	for (const { pattern, label } of forbidden) {
		if (pattern.test(body)) {
			throw new TypeError(
				`Invalid section body (${fieldName}): contains forbidden structural marker (${label})`,
			);
		}
	}
	return body;
}

export interface AgentSection {
	/** Full session ID — the canonical identity. UUID v4 from CLAUDE_CODE_SESSION_ID, or pid-<N>. */
	sessionId: string;
	/** First 8 characters of sessionId — heading-friendly. */
	sessionShort: string;
	/** Human-readable task description. */
	task: string;
	/** ISO 8601 UTC timestamp of last update. Drives staleness filtering. */
	lastUpdated: string;
	/** Markdown body of `### In Flight`. May be empty. */
	inFlight: string;
	/** Markdown body of `### Open Questions`. May be empty. */
	openQuestions: string;
	/** Markdown body of `### Cursor`. May be empty. */
	cursor: string;
	/** Git branch the session's cwd is on, `**Branch**:` marker. May be empty (detached / no repo). */
	branch: string;
	/** Worktree toplevel path the session's cwd resolves to, `**Worktree**:` marker. May be empty. */
	worktree: string;
}

export interface CurrentMd {
	/** Text between the top-level `# Operational State` heading and `## Project (shared)`. Preserved verbatim. */
	preamble: string;
	/** Markdown body of `## Project (shared)`. Editable by any agent. */
	sharedSection: string;
	/** Per-agent sections, in file order. */
	sections: AgentSection[];
}

const SECTION_DELIMITER = "---";
const EMPTY_PLACEHOLDER = "(empty)";

/**
 * Extract a `### Heading` subsection body from a block. Returns "" if heading
 * absent or body is the literal `(empty)` placeholder.
 *
 * Uses split-and-slice rather than a single regex because JavaScript regexes
 * don't have `\Z` (end-of-string-only anchor) and `$` in multiline mode only
 * matches end-of-line. Splitting on the start anchor + finding the next
 * `### ` heading is robust and easy to reason about.
 */
function extractSubsection(block: string, heading: string): string {
	const headingPattern = new RegExp(`^###\\s+${heading}\\s*$`, "m");
	const startMatch = block.match(headingPattern);
	if (!startMatch || startMatch.index === undefined) return "";
	const startIdx = startMatch.index + startMatch[0].length;
	const rest = block.slice(startIdx);
	const nextHeading = rest.match(/^###\s+/m);
	const endIdx =
		nextHeading && nextHeading.index !== undefined ? startIdx + nextHeading.index : block.length;
	const body = block.slice(startIdx, endIdx).trim();
	return body === EMPTY_PLACEHOLDER ? "" : body;
}

/** Parse a single `## Session <short> — <task>` block into an AgentSection (or null if malformed). */
function parseSessionSection(block: string): AgentSection | null {
	// Match the heading: "## Session <short8> — <task>"
	const headingMatch = block.match(/^##\s+Session\s+(\S+)\s+[—-]\s+(.+?)\s*$/m);
	if (!headingMatch) return null;
	const sessionShort = headingMatch[1];
	const task = headingMatch[2].trim();

	// **Session ID**: <full uuid>
	const sessionIdMatch = block.match(/^\*\*Session ID\*\*:\s*(\S+)\s*$/m);
	if (!sessionIdMatch) return null;
	const sessionId = sessionIdMatch[1];

	// **Last updated**: <timestamp> — accept any non-empty trailing text so that
	// pruneStaleSections's malformed-timestamp handling sees the section.
	const lastUpdatedMatch = block.match(/^\*\*Last updated\*\*:\s*(.+?)\s*$/m);
	if (!lastUpdatedMatch) return null;
	const lastUpdated = lastUpdatedMatch[1];

	// **Branch**: / **Worktree**: — optional markers (worktree-visibility). Absent → "".
	const branchMatch = block.match(/^\*\*Branch\*\*:\s*(.+?)\s*$/m);
	const worktreeMatch = block.match(/^\*\*Worktree\*\*:\s*(.+?)\s*$/m);

	return {
		sessionId,
		sessionShort,
		task,
		lastUpdated,
		branch: branchMatch ? branchMatch[1] : "",
		worktree: worktreeMatch ? worktreeMatch[1] : "",
		inFlight: extractSubsection(block, "In Flight"),
		openQuestions: extractSubsection(block, "Open Questions"),
		cursor: extractSubsection(block, "Cursor"),
	};
}

/**
 * Split a content string by horizontal-rule delimiters. Returns an array of
 * blocks where each block is the text between two `---` lines (or between
 * file start/end and a `---`). Empty blocks are filtered out.
 */
function splitByDelimiter(content: string): string[] {
	return content
		.split(/^---\s*$/m)
		.map((block) => block.trim())
		.filter((block) => block.length > 0);
}

/**
 * Extract preamble (between `# Operational State` and `## Project (shared)`)
 * and the Project (shared) body from a top-level block.
 *
 * Uses split-and-slice for the same reason as `extractSubsection`.
 */
function extractPreambleAndShared(block: string): {
	preamble: string;
	sharedSection: string;
} {
	const topHeading = block.match(/^#\s+Operational State\s*$/m);
	const sharedHeading = block.match(/^##\s+Project\s+\(shared\)\s*$/m);
	if (!topHeading || topHeading.index === undefined) {
		return { preamble: "", sharedSection: "" };
	}
	const topEnd = topHeading.index + topHeading[0].length;

	let preamble = "";
	let sharedSection = "";

	if (sharedHeading && sharedHeading.index !== undefined) {
		preamble = block.slice(topEnd, sharedHeading.index).trim();
		const sharedBodyStart = sharedHeading.index + sharedHeading[0].length;
		const rest = block.slice(sharedBodyStart);
		const nextHeading = rest.match(/^##\s+/m);
		const sharedEnd =
			nextHeading && nextHeading.index !== undefined
				? sharedBodyStart + nextHeading.index
				: block.length;
		const sharedBody = block.slice(sharedBodyStart, sharedEnd).trim();
		sharedSection = sharedBody === EMPTY_PLACEHOLDER ? "" : sharedBody;
	} else {
		preamble = block.slice(topEnd).trim();
	}

	return { preamble, sharedSection };
}

/** Parse a `.indusk/current.md` content string into a structured CurrentMd. */
export function parseCurrentMd(content: string): CurrentMd {
	const blocks = splitByDelimiter(content);

	let preamble = "";
	let sharedSection = "";
	const sections: AgentSection[] = [];

	for (const block of blocks) {
		if (block.match(/^#\s+Operational State/m)) {
			const extracted = extractPreambleAndShared(block);
			preamble = extracted.preamble;
			sharedSection = extracted.sharedSection;
			continue;
		}
		if (block.match(/^##\s+Session\s+/m)) {
			// A delimiter-split block may contain MULTIPLE `## Session` headings
			// when git's merge=union driver combined two branches' appends and
			// deduplicated the trailing `---` separators. Split on `## Session`
			// boundaries before parsing so each session is recognized independently.
			const sessionSubBlocks = block.split(/^(?=##\s+Session\s+)/m);
			for (const sub of sessionSubBlocks) {
				if (sub.match(/^##\s+Session\s+/m)) {
					const section = parseSessionSection(sub);
					if (section) sections.push(section);
				}
			}
		}
	}

	return { preamble, sharedSection, sections };
}

/** Serialize a single AgentSection into the markdown block form. */
function serializeSection(section: AgentSection): string {
	// **Branch**: / **Worktree**: are emitted only when non-empty, so absence
	// round-trips to "" and the file stays clean for detached/no-repo sessions.
	const idLines = [`**Session ID**: ${section.sessionId}`, `**Last updated**: ${section.lastUpdated}`];
	if (section.branch) idLines.push(`**Branch**: ${section.branch}`);
	if (section.worktree) idLines.push(`**Worktree**: ${section.worktree}`);
	return [
		`## Session ${section.sessionShort} — ${section.task}`,
		"",
		...idLines,
		"",
		"### In Flight",
		"",
		section.inFlight || EMPTY_PLACEHOLDER,
		"",
		"### Open Questions",
		"",
		section.openQuestions || EMPTY_PLACEHOLDER,
		"",
		"### Cursor",
		"",
		section.cursor || EMPTY_PLACEHOLDER,
		"",
	].join("\n");
}

/** Serialize a CurrentMd back into the canonical markdown form. */
export function serializeCurrentMd(doc: CurrentMd): string {
	const out: string[] = ["# Operational State", ""];
	if (doc.preamble) {
		out.push(doc.preamble.trim(), "");
	}
	out.push("## Project (shared)", "", doc.sharedSection.trim() || EMPTY_PLACEHOLDER, "");
	out.push(SECTION_DELIMITER, "");
	for (const section of doc.sections) {
		out.push(serializeSection(section));
		out.push(SECTION_DELIMITER, "");
	}
	return `${out.join("\n").trimEnd()}\n`;
}

/** Build the short ID (first 8 chars) from a full session ID. Empty input returns "". */
function buildSessionShort(sessionId: string): string {
	return sessionId.slice(0, 8);
}

/**
 * Insert or overwrite the section for `section.sessionId`. If a section with
 * that sessionId already exists, it's replaced in place (preserves file order).
 * Otherwise a new section is appended at the end. Session ID is sanitized.
 */
export function upsertSection(content: string, section: AgentSection): string {
	const sessionId = sanitizeSessionId(section.sessionId);
	// Route each body through the sanitizer before any write. Throws TypeError
	// on structural-marker injection. See sanitizeSectionBody above.
	sanitizeSectionBody(section.inFlight, "inFlight");
	sanitizeSectionBody(section.openQuestions, "openQuestions");
	sanitizeSectionBody(section.cursor, "cursor");
	const normalized: AgentSection = {
		...section,
		sessionId,
		sessionShort: section.sessionShort || buildSessionShort(sessionId),
	};
	const doc = parseCurrentMd(content);
	const existingIdx = doc.sections.findIndex((s) => s.sessionId === sessionId);
	if (existingIdx >= 0) {
		doc.sections[existingIdx] = normalized;
	} else {
		doc.sections.push(normalized);
	}
	return serializeCurrentMd(doc);
}

/**
 * Remove the section for the named session ID. Other sections survive byte-equal
 * after a parse-serialize roundtrip. No-op if no section matches. Session ID
 * is sanitized.
 */
export function removeSection(content: string, sessionId: string): string {
	const safeId = sanitizeSessionId(sessionId);
	const doc = parseCurrentMd(content);
	doc.sections = doc.sections.filter((s) => s.sessionId !== safeId);
	return serializeCurrentMd(doc);
}

/** Replace the `## Project (shared)` section body. Session sections untouched. */
export function editSharedSection(content: string, sharedBody: string): string {
	// Phase 6 falsification fix: shared body also goes through the structural-marker
	// sanitizer. An attacker editing `## Project (shared)` could otherwise inject
	// a fake session via the same mechanism.
	sanitizeSectionBody(sharedBody, "sharedSection");
	const doc = parseCurrentMd(content);
	doc.sharedSection = sharedBody;
	return serializeCurrentMd(doc);
}

/**
 * Filter sections whose `lastUpdated` is older than `ttlMinutes` from `now`.
 * `now` defaults to the current time but can be injected for tests.
 */
export function pruneStaleSections(
	content: string,
	ttlMinutes: number,
	now: Date = new Date(),
): string {
	const cutoffMs = now.getTime() - ttlMinutes * 60 * 1000;
	const doc = parseCurrentMd(content);
	doc.sections = doc.sections.filter((s) => {
		const t = Date.parse(s.lastUpdated);
		if (Number.isNaN(t)) return true; // malformed timestamp → keep (don't silently drop)
		return t >= cutoffMs;
	});
	return serializeCurrentMd(doc);
}

/**
 * Return the partition of fresh vs stale sections according to ttlMinutes from `now`.
 * Pure read — does not modify the content string.
 */
export function listSections(
	content: string,
	ttlMinutes: number,
	now: Date = new Date(),
): { fresh: AgentSection[]; stale: AgentSection[] } {
	const cutoffMs = now.getTime() - ttlMinutes * 60 * 1000;
	const doc = parseCurrentMd(content);
	const fresh: AgentSection[] = [];
	const stale: AgentSection[] = [];
	for (const section of doc.sections) {
		const t = Date.parse(section.lastUpdated);
		if (Number.isNaN(t) || t >= cutoffMs) {
			fresh.push(section);
		} else {
			stale.push(section);
		}
	}
	return { fresh, stale };
}
