import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shouldEmitOtelGate } from "../config.js";
import { parseImplString } from "../impl-parser-core.js";
import { appendLateRow } from "../trajectory/append-row.js";

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
	| { reopened: false; reason: "already" | "no-owner" }
	/** The plan-worktree record could not say where the owner lives; nothing was written. */
	| { reopened: false; reason: "copy-problem"; detail: string };

/** Append the incident's Maintenance phase to `owner`'s impl. */
export function reopenOwner(
	planRoot: string,
	owner: string,
	incidentId: string,
	promise: string,
	/** The owner's live folder when it is assigned to a worktree (day-monitor A29); else found here. */
	liveDir?: string,
): ReopenResult {
	const dir = liveDir ?? ownerDir(planRoot, owner);
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
	const withRow = appendLateRow(text, next, {
		asserts: `${promise} holds again after ${incidentId}: the test that reproduces it, named by its root cause, passes`,
		why: `the test that reproduces ${incidentId} is decided by its root cause, which this Maintenance phase writes first`,
	});
	writeFileSync(
		implPath,
		`${withRow.text.replace(/\n*$/, "\n")}\n${maintenancePhase(next, incidentId, otelGate, withRow.id)}`,
	);
	return { reopened: true, impl: implPath, phase: next };
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
