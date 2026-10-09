import { auditInputs } from "../../lib/audit/inputs.js";
import { type BuildStep, nextBuildStep } from "../../lib/build/next-step.js";
import { BuildPlanUnreadable, readBuildPlan } from "../../lib/build/read-plan.js";
import { buildReview, type Review } from "../../lib/build/review.js";
import { parsePhaseRef } from "../../lib/impl-headings.js";
import { nextSessionForPlan } from "../../lib/models/next-session.js";
import { phaseModel } from "../../lib/models/phase-model.js";
import { TierConfigError } from "../../lib/models/tier-names.js";
import { archiveDeadPlans } from "../../lib/planning/archive-dead.js";
import {
	acceptPlan,
	approvePlan,
	landPlan,
	PlanCommandRefusal,
	startPlan,
} from "../../lib/plans/index.js";

/** Run a plan verb: print what it did, or its refusal on stderr and exit 1. */
async function planVerb(run: () => Promise<string>): Promise<void> {
	try {
		console.info(await run());
	} catch (err) {
		if (
			err instanceof PlanCommandRefusal ||
			err instanceof TierConfigError ||
			err instanceof BuildPlanUnreadable
		) {
			console.error(`Refused: ${err.message}`);
			process.exit(1);
		}
		throw err;
	}
}

/** `indusk plans start <type> <name>` — the plan's own branch and worktree, its first document there. */
export function plansStart(
	cwd: string,
	type: string,
	name: string,
	opts: { repo?: string } = {},
): Promise<void> {
	return planVerb(async () => {
		const s = await startPlan(cwd, type, name, new Date(), opts);
		if (s.code) {
			return `Started ${s.plan} (${s.type}): its ${s.document} is at the workbench root, and its code is on ${s.branch} in ${s.code.repo}, at ${s.code.worktree}.`;
		}
		return `Started ${s.plan} (${s.type}) in ${s.worktree} on ${s.branch}; its ${s.document} is there, and nothing is on the trunk until it is approved.`;
	});
}

/** `indusk plans approve <name>` — the documents and promises reach the trunk. */
export function plansApprove(cwd: string, name: string): Promise<void> {
	return planVerb(async () => {
		const a = await approvePlan(cwd, name);
		const next = await nextSessionForPlan(cwd, name);
		if (a.workbench) {
			return `Approved ${a.plan}: its documents are committed at the workbench root (${a.merge.slice(0, 8)}); its build continues on its code branch.\n${next}`;
		}
		return `Approved ${a.plan}: ${a.paths.length} file(s) merged to the trunk at ${a.merge.slice(0, 8)}; its build continues on its branch.\n${next}`;
	});
}

/** `indusk plans model <name> --phase <ref>` — the tier and model a phase is built on, or `session`. */
export function plansModel(cwd: string, name: string, phase: string): Promise<void> {
	return planVerb(async () => {
		const ref = parsePhaseRef(/^\d+$/.test(phase.trim()) ? `Phase ${phase.trim()}` : phase);
		if (!ref) {
			throw new PlanCommandRefusal(
				`--phase must name a phase, like "Build Phase 1", "Test Phase 1" or "1"; got "${phase}"`,
			);
		}
		const answer = await phaseModel(cwd, name, ref);
		return answer ? `${answer.tier} ${answer.model}` : "session";
	});
}

/** `indusk plans audit-inputs <name>` — what the auditor is handed, as JSON. */
export function plansAuditInputs(cwd: string, name: string, approved?: string): Promise<void> {
	return planVerb(async () => JSON.stringify(await auditInputs(cwd, name, approved), null, 2));
}

/** `indusk plans next-session <name>` — the command to run in a new session, from the plan as it stands. */
export function plansNextSession(cwd: string, name: string): Promise<void> {
	return planVerb(() => nextSessionForPlan(cwd, name));
}

/** `indusk plans accept <name>` — the build may ship. */
export function plansAccept(cwd: string, name: string, auto: boolean): Promise<void> {
	return planVerb(async () => {
		const a = await acceptPlan(cwd, name, auto ? "auto" : "person");
		return `Accepted ${a.plan} at ${a.accepted}${a.acceptedBy === "auto" ? ", by its workflow" : ""}.`;
	});
}

/** `indusk plans next <name>` — what an unattended build does next, from the plan as it stands. */
export async function plansNext(cwd: string, name: string, json: boolean): Promise<void> {
	try {
		const step = nextBuildStep(await readBuildPlan(cwd, name));
		console.info(json ? JSON.stringify(step) : describeStep(step));
	} catch (err) {
		if (err instanceof BuildPlanUnreadable) {
			console.error(`Refused: ${err.message}`);
			process.exit(1);
		}
		throw err;
	}
}

function describeStep(s: BuildStep): string {
	switch (s.step) {
		case "work":
			return `work: ${s.phase}`;
		case "falsify":
			return "falsify: every phase is closed and the falsification has not run";
		case "cleanup":
			return "cleanup: falsification is closed and the cleanup has not run";
		case "audit":
			return "audit: the cleanup is closed and no audit.md has been written (or the audit skipped with a reason)";
		case "judgement":
			return `judgement: ${s.phase} waits on a person — ${s.item}`;
		case "review":
			return "review: built — every phase, the falsification and the cleanup are closed, and the audit written or skipped";
		case "cannot-continue":
			return `cannot continue: ${s.why}`;
	}
}

/** `indusk plans review <name>` — what a person needs to decide whether a built plan may ship. */
export async function plansReview(cwd: string, name: string, json: boolean): Promise<void> {
	try {
		const r = await buildReview(cwd, name);
		console.info(json ? JSON.stringify(r, null, 2) : describeReview(r));
	} catch (err) {
		if (err instanceof BuildPlanUnreadable) {
			console.error(`Refused: ${err.message}`);
			process.exit(1);
		}
		throw err;
	}
}

function describeReview(r: Review): string {
	const lines = [`${r.plan} — review`, "", "Promises:"];
	for (const p of r.promises) {
		lines.push(
			p.proven
				? `  ✓ ${p.name} — ${p.rows.map((row) => row.id).join(", ")}`
				: `  ✗ ${p.name} — unproven: ${p.why}`,
		);
	}
	for (const f of r.falsification) {
		lines.push("", `${f.phase}:`);
		for (const row of f.rows) lines.push(`  ${row.id} (${row.state}) ${row.asserts}`);
		for (const item of f.items) lines.push(`  ${item.done ? "[x]" : "[ ]"} ${item.text}`);
	}
	lines.push("", `Files changed: ${r.files.length}`);
	for (const f of r.files) lines.push(`  ${f.status} ${f.path}`);
	if (r.skips.length > 0) {
		lines.push("", "Skipped:");
		for (const s of r.skips) lines.push(`  ${s.phase} ${s.gate}: ${s.item}`);
	}
	return lines.join("\n");
}

/** `indusk plans land <name>` — an accepted plan's build reaches the trunk. */
export function plansLand(cwd: string, name: string): Promise<void> {
	return planVerb(async () => {
		const l = await landPlan(cwd, name);
		const checks = l.checks.length > 0 ? ` after ${l.checks.length} check(s)` : "";
		return `Landed ${l.plan} on the trunk at ${l.merge.slice(0, 8)}${checks}; its worktree and branch are removed.`;
	});
}

export interface PlansArchiveDeadOptions {
	dryRun?: boolean;
}

/**
 * `indusk plans archive-dead [--dry-run]` — move dead-draft plans to
 * `.indusk/planning/archive/`. Dead = all docs draft/abandoned/no-status AND
 * newest file older than `planning.dead_draft_days` (default 30) AND not
 * protected by a non-draft master.md row. Moves, never deletes.
 */
export function plansArchiveDead(projectRoot: string, opts: PlansArchiveDeadOptions = {}): void {
	const result = archiveDeadPlans(projectRoot, { dryRun: opts.dryRun });
	const verb = result.dryRun ? "Would archive" : "Archived";
	if (result.archived.length === 0) {
		console.info("No dead-draft plans found.");
	} else {
		console.info(`${verb} ${result.archived.length} dead-draft plan(s):`);
		for (const p of result.archived) {
			const age = new Date(p.newestMtimeMs).toISOString().slice(0, 10);
			console.info(`  - ${p.name} (newest file ${age})`);
		}
	}
	const interesting = result.skipped.filter(
		(s) => !s.reason.startsWith("active within"), // recently-touched plans are the boring common case
	);
	if (interesting.length > 0) {
		console.info("Skipped:");
		for (const s of interesting) {
			console.info(`  - ${s.name}: ${s.reason}`);
		}
	}
}
