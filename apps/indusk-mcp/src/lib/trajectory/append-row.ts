const TRAJECTORY_HEADING = /^## Test Trajectory\s*$/m;

function cells(row: string): string[] {
	return row
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((c) => c.trim());
}

/**
 * Append a row to an impl's Test Trajectory for a test that is written and
 * passes in build phase `phase` — appended after the impl was authored, so
 * the phase cannot close until that test passes — together with the
 * justification the impl's shape requires for a row authored after its first
 * phase (`justifyLateRow`). The id continues the table's own `A`/`T` prefix
 * and numbering; the phase is spelled the way the impl spells phases. An impl
 * with no trajectory is returned unchanged, with a null id.
 *
 * Moved here from `lib/promises/reopen.ts` (day-monitor cleanup): editing a
 * trajectory table and its register is this module's job; the promise loop's
 * Maintenance phase is one caller.
 */
export function appendLateRow(
	text: string,
	phase: number,
	row: { asserts: string; why: string },
): { text: string; id: string | null } {
	const heading = TRAJECTORY_HEADING.exec(text);
	if (!heading) return { text, id: null };
	const lines = text.split("\n");
	const headingLine = text.slice(0, heading.index).split("\n").length - 1;
	let first = headingLine + 1;
	while (first < lines.length && !lines[first].trimStart().startsWith("|")) first++;
	let last = first;
	while (last + 1 < lines.length && lines[last + 1].trimStart().startsWith("|")) last++;
	if (first >= lines.length) return { text, id: null };

	const header = cells(lines[first]).map((c) => c.toLowerCase());
	// Continue the table's own prefix (`A` or `T`) and number.
	const existing = lines
		.slice(first + 2, last + 1)
		.map((l) => /^([TA])(\d+)$/.exec(cells(l)[0] ?? ""))
		.filter((m): m is RegExpExecArray => m !== null);
	const prefix = existing.at(-1)?.[1] ?? "T";
	const id = `${prefix}${Math.max(0, ...existing.filter((m) => m[1] === prefix).map((m) => Number(m[2]))) + 1}`;
	const testPhases = /^### Test Phase \d+/m.test(text);
	const phaseRef = testPhases ? `Build Phase ${phase}` : `Phase ${phase}`;
	const value: Record<string, string> = {
		id,
		asserts: row.asserts,
		"writable at": phaseRef,
		"passes at": phaseRef,
		state: "planned",
	};
	lines.splice(last + 1, 0, `| ${header.map((h) => value[h] ?? "").join(" | ")} |`);

	justifyLateRow(lines, id, phase, row.why, testPhases);
	return { text: lines.join("\n"), id };
}

/**
 * The justification an impl requires for a row authored after its first
 * phase, in the shape that impl uses: an entry in Test Phase 1's register, or
 * in `### Trajectory Rationale` for an impl written before test phases.
 * Edits `lines` in place.
 */
function justifyLateRow(
	lines: string[],
	id: string,
	phase: number,
	why: string,
	testPhases: boolean,
): void {
	if (testPhases) {
		const verification = lines.findIndex((l) => /^#### Test Phase 1 Verification\s*$/.test(l));
		if (verification !== -1) {
			lines.splice(
				verification,
				0,
				`#### Deferred to Build Phase ${phase}`,
				"",
				`- **${id}** — ${why}.`,
				"",
			);
		}
		return;
	}
	const entry = `- **${id}** \`Writable at: Phase ${phase}\` — ${why}.`;
	const rationale = lines.findIndex((l) => /^### Trajectory Rationale\s*$/.test(l));
	if (rationale !== -1) {
		let end = rationale + 1;
		while (end < lines.length && !/^#{2,3} /.test(lines[end])) end++;
		while (end > rationale + 1 && lines[end - 1].trim() === "") end--;
		lines.splice(end, 0, entry);
		return;
	}
	const checklist = lines.findIndex((l) => /^## Checklist\s*$/.test(l));
	lines.splice(
		checklist === -1 ? lines.length : checklist,
		0,
		"### Trajectory Rationale",
		"",
		entry,
		"",
	);
}
