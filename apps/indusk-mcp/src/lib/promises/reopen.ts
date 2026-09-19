import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shouldEmitOtelGate } from "../config.js";
import { parseImplString } from "../impl-parser-core.js";

/**
 * Reopening a plan is an appended phase, in place (day-monitor, ADR D7).
 *
 * An incident sends the promise's owning plan back to work: its impl gains
 * `### Build Phase N: Maintenance — <incident>` with its gates (OTel too when
 * the project's `otel.role` asks for it, as the validator will), numbered
 * after the owner's own build phases. The plan folder never moves — dozens of
 * pointers cite archive paths — and an owner with no impl gets one holding
 * only this phase. A plan whose impl already has the incident's Maintenance
 * phase is left alone, so a second pass writes nothing.
 */

export const MAINTENANCE_TITLE = "Maintenance";

export function maintenanceHeadingName(incidentId: string): string {
	return `${MAINTENANCE_TITLE} — ${incidentId}`;
}

/** The owner's folder: active wins over archived, as everywhere else. */
export function ownerDir(planRoot: string, owner: string): string | null {
	for (const dir of [
		join(planRoot, ".indusk", "planning", owner),
		join(planRoot, ".indusk", "planning", "archive", owner),
	]) {
		if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
	}
	return null;
}

function maintenancePhase(
	n: number,
	incidentId: string,
	otelGate: boolean,
	rowId: string | null,
): string {
	const otel = otelGate
		? [
				`#### Build Phase ${n} OTel`,
				"",
				"- [ ] The fixed code still marks the promise on its span (`indusk.promise`, `indusk.promise.outcome`)",
				"",
			]
		: [];
	return [
		`### Build Phase ${n}: ${maintenanceHeadingName(incidentId)}`,
		"",
		`- [ ] Write the root cause in the incident (\`.indusk/promises/incidents/${incidentId}.md\`)`,
		"- [ ] Fix: a code site, a widened test, or a revised promise",
		"",
		`#### Build Phase ${n} Verification`,
		"",
		rowId
			? `- [ ] ${rowId}: the test that reproduces the incident passes, and the promise is seen upheld after the fix (\`indusk promises status\`)`
			: "- [ ] The promise is seen upheld after the fix (`indusk promises status`)",
		"",
		...otel,
		`#### Build Phase ${n} Context`,
		"",
		"- [ ] CLAUDE.md, if the fix changes a convention",
		"",
		`#### Build Phase ${n} Document`,
		"",
		"- [ ] The incident's Fix section",
		"",
	].join("\n");
}

export type ReopenResult =
	| { reopened: true; impl: string; phase: number }
	| { reopened: false; reason: "already" | "no-owner" };

/** Append the incident's Maintenance phase to `owner`'s impl. */
export function reopenOwner(
	planRoot: string,
	owner: string,
	incidentId: string,
	promise: string,
): ReopenResult {
	const dir = ownerDir(planRoot, owner);
	if (!dir) return { reopened: false, reason: "no-owner" };
	const implPath = join(dir, "impl.md");
	// The phase carries every gate the validator will ask this project for.
	const otelGate = shouldEmitOtelGate(planRoot);
	if (!existsSync(implPath)) {
		writeFileSync(
			implPath,
			`---\ntitle: "${owner} — maintenance"\nstatus: in-progress\n---\n\n# ${owner} — maintenance\n\n## Checklist\n\n${maintenancePhase(1, incidentId, otelGate, null)}`,
		);
		return { reopened: true, impl: implPath, phase: 1 };
	}
	const text = readFileSync(implPath, "utf-8");
	const parsed = parseImplString(text);
	const name = maintenanceHeadingName(incidentId);
	if (parsed.phases.some((p) => p.kind === "build" && p.name === name)) {
		return { reopened: false, reason: "already" };
	}
	const next =
		Math.max(0, ...parsed.phases.filter((p) => p.kind === "build").map((p) => p.number)) + 1;
	const withRow = addTrajectoryRow(text, next, incidentId, promise);
	writeFileSync(
		implPath,
		`${withRow.text.replace(/\n*$/, "\n")}\n${maintenancePhase(next, incidentId, otelGate, withRow.id)}`,
	);
	return { reopened: true, impl: implPath, phase: next };
}

const TRAJECTORY_HEADING = /^## Test Trajectory\s*$/m;

function cells(row: string): string[] {
	return row
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((c) => c.trim());
}

/**
 * An impl with a Test Trajectory commits every phase to a named test, and a
 * Maintenance phase is no exception: its test is the one that reproduces the
 * incident, written once the root cause says what it is. Append that row —
 * writable and passing in the Maintenance phase, so the phase cannot close
 * until it passes — and its justification (`justifyLateRow`). An impl with no
 * trajectory is returned as is.
 */
function addTrajectoryRow(
	text: string,
	phase: number,
	incidentId: string,
	promise: string,
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
		asserts: `${promise} holds again after ${incidentId}: the test that reproduces it, named by its root cause, passes`,
		"writable at": phaseRef,
		"passes at": phaseRef,
		state: "planned",
	};
	lines.splice(last + 1, 0, `| ${header.map((h) => value[h] ?? "").join(" | ")} |`);

	justifyLateRow(lines, id, phase, incidentId, testPhases);
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
	incidentId: string,
	testPhases: boolean,
): void {
	const why = `the test that reproduces ${incidentId} is decided by its root cause, which this Maintenance phase writes first`;
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

/** An impl with an unchecked item under a Maintenance phase — the plan is reopened. */
export function openMaintenancePhases(implText: string): string[] {
	return parseImplString(implText)
		.phases.filter(
			(p) =>
				p.name.startsWith(`${MAINTENANCE_TITLE} — `) &&
				p.gates.some((g) => g.items.some((i) => !i.checked)),
		)
		.map((p) => p.name);
}
