/**
 * Turning a Shape finding into work.
 *
 * `appendFindingToPhase` returns the edited body and never writes. The caller
 * owns the write so the edit flows through the PreToolUse gate chain like any
 * other impl edit — a library that wrote impl.md directly would be a hole in
 * the gate by construction, which is precisely what `atdawn run`'s falsification
 * found when `bash` was rewriting checkboxes the `edit` gate would have refused.
 */

export interface ShapeFinding {
	file: string;
	/** The concrete change to make. */
	change: string;
	/** The rule it came from — a finding without its basis is unreviewable. */
	rule: string;
}

/**
 * LF, CR, and the two Unicode line separators (U+2028 LINE SEPARATOR, U+2029
 * PARAGRAPH SEPARATOR).
 *
 * Compared by code point rather than matched by a regex literal: as literal
 * characters U+2028/U+2029 terminate a line in the *source*, so a regex class
 * containing them stops the file parsing. This is the same pair the
 * falsification log rejects at its own boundary, for the same reason.
 */
const LINE_SEPARATOR_CODE_POINTS = new Set([0x0a, 0x0d, 0x2028, 0x2029]);

/**
 * A checklist item is one line. A field carrying a line separator would split it
 * into an item plus orphaned prose, silently changing the plan's structure.
 */
function hasLineSeparator(value: string): boolean {
	for (const char of value) {
		if (LINE_SEPARATOR_CODE_POINTS.has(char.codePointAt(0) ?? 0)) return true;
	}
	return false;
}

/** The gate sub-headings (`#### Phase N Verification`) close the implementation block. */
function isImplementationBlockEnd(line: string): boolean {
	return /^#{2,4}\s/.test(line);
}

function findPhaseHeading(lines: string[], phase: number): number {
	return lines.findIndex((line) => new RegExp(`^###\\s+Phase\\s+${phase}\\b`).test(line));
}

/**
 * Append a finding as an unchecked implementation item in the phase that wrote
 * the code.
 *
 * Unchecked is the mechanism: the existing gate machinery already refuses to
 * close a phase with outstanding items, so a finding is non-ignorable without
 * Shape needing to block anything itself. Placement matters as much as the text
 * — an item that lands past the first `####` heading is inside a gate block and
 * gets classified as a verification/context/document item instead.
 */
export function appendFindingToPhase(
	implBody: string,
	phase: number,
	finding: ShapeFinding,
): string {
	for (const [field, value] of Object.entries(finding)) {
		if (hasLineSeparator(value)) {
			throw new Error(
				`Shape finding's \`${field}\` contains a line separator — a checklist item is one line, so this would split the plan's structure. Collapse it to a single line.`,
			);
		}
	}

	const lines = implBody.split("\n");
	const headingAt = findPhaseHeading(lines, phase);
	if (headingAt === -1) {
		throw new Error(
			`Cannot append a Shape finding to Phase ${phase} — this impl has no such phase. Refusing to guess which phase wrote the code.`,
		);
	}

	// The implementation block runs from the phase heading to the first heading
	// after it, whatever that heading is.
	let blockEnd = lines.length;
	for (let i = headingAt + 1; i < lines.length; i++) {
		if (isImplementationBlockEnd(lines[i])) {
			blockEnd = i;
			break;
		}
	}

	// Land directly after the last item, not in the trailing blank line — the
	// blank before the next heading is separation, and writing into it puts the
	// item visually adrift from the list it belongs to.
	let insertAt = blockEnd;
	while (insertAt > headingAt + 1 && lines[insertAt - 1].trim() === "") insertAt--;

	const item = `- [ ] Shape (\`${finding.file}\`) — ${finding.change}. Rule: ${finding.rule}`;
	return [...lines.slice(0, insertAt), item, ...lines.slice(insertAt)].join("\n");
}
