import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	AUDIT_QUESTIONS,
	describeAnswers,
	PLAN_REVIEW_QUESTIONS,
	readAuditAnswers,
} from "../../lib/audit/answers.js";
import { auditInputs } from "../../lib/audit/inputs.js";
import { type BuildStep, nextBuildStep } from "../../lib/build/next-step.js";
import { BuildPlanUnreadable, readBuildPlan } from "../../lib/build/read-plan.js";
import { buildReview, type Review } from "../../lib/build/review.js";
import { buildStepModel } from "../../lib/build/step-model.js";
import { getDraftMaxAgeDays } from "../../lib/config.js";
import {
	draftHomeOf,
	findDraft,
	startFromDraft,
	sweepDrafts,
	writeProposal,
} from "../../lib/drafts/index.js";
import { parsePhaseRef } from "../../lib/impl-headings.js";
import { nextSessionForPlan } from "../../lib/models/next-session.js";
import { phaseModel } from "../../lib/models/phase-model.js";
import { isTierStep, TIER_STEPS, TierConfigError } from "../../lib/models/tier-names.js";
import { archiveDeadPlans } from "../../lib/planning/archive-dead.js";
import { type Amendment, AmendmentsUnreadable, amendmentsOf } from "../../lib/plans/amendments.js";
import { askAdminToPlan } from "../../lib/plans/ask-admin.js";
import {
	acceptBrief,
	acceptPlan,
	approvePlan,
	landPlan,
	PlanCommandRefusal,
	reapprovePlan,
	startPlan,
} from "../../lib/plans/index.js";
import { plansTestsOutcome } from "../../lib/plans/plan-tests.js";
import { planTimeText } from "../../lib/timing/view.js";
import { livePlanCopy, resolvePlanCopies } from "../../lib/worktree/plan-worktrees.js";

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
	opts: { repo?: string; fromDraft?: string } = {},
): Promise<void> {
	return planVerb(async () => {
		const s = opts.fromDraft
			? await startFromDraftId(cwd, opts.fromDraft, type, name, opts.repo)
			: await startPlan(cwd, type, name, new Date(), opts);
		if (s.code) {
			return `Started ${s.plan} (${s.type}): its ${s.document} is at the workbench root, and its code is on ${s.branch} in ${s.code.repo}, at ${s.code.worktree}.`;
		}
		return `Started ${s.plan} (${s.type}) in ${s.worktree} on ${s.branch}; its ${s.document} is there, and nothing is on the trunk until it is approved.`;
	});
}

/** The draft `id` made a plan: `type` and `name` are the person's, over the agent's proposal. */
async function startFromDraftId(
	cwd: string,
	id: string,
	type: string,
	name: string,
	repo?: string,
) {
	const draft = findDraft(draftHomeOf(cwd), id);
	if (!draft) throw new PlanCommandRefusal(`there is no draft ${id} in this project`);
	writeProposal(draft, { name, type, ...(repo ? { repo } : {}) });
	return startFromDraft(cwd, draft);
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

/** The tier and model as `plans model` prints them, or `session` when the project names none. */
function describeModel(answer: { tier: string; model: string } | null): string {
	return answer ? `${answer.tier} ${answer.model}` : "session";
}

/**
 * `indusk plans model <name> --phase <ref> | --step <step>` — the tier and model a phase is built on,
 * or a step's default tier (no phase override), or `session`.
 */
export function plansModel(
	cwd: string,
	name: string,
	opts: { phase?: string; step?: string },
): Promise<void> {
	return planVerb(async () => {
		const { phase, step } = opts;
		if (phase !== undefined && step !== undefined) {
			throw new PlanCommandRefusal("--phase and --step are alternatives; give one");
		}
		// promise: the-auditor-runs-on-its-tier — the audit's model is the step's tier, answered here for the skill.
		if (step !== undefined) {
			if (!isTierStep(step)) {
				throw new PlanCommandRefusal(
					`--step must name a step with a tier (${TIER_STEPS.join(", ")}); got "${step}"`,
				);
			}
			const answer = await buildStepModel(cwd, name, step);
			return describeModel(answer);
		}
		if (phase === undefined) {
			throw new PlanCommandRefusal("name what to answer for: --phase <ref> or --step <step>");
		}
		const ref = parsePhaseRef(/^\d+$/.test(phase.trim()) ? `Phase ${phase.trim()}` : phase);
		if (!ref) {
			throw new PlanCommandRefusal(
				`--phase must name a phase, like "Build Phase 1", "Test Phase 1" or "1"; got "${phase}"`,
			);
		}
		const answer = await phaseModel(cwd, name, ref);
		return describeModel(answer);
	});
}

/** `indusk plans audit-inputs <name>` — what the auditor is handed, as JSON. */
export function plansAuditInputs(cwd: string, name: string, approved?: string): Promise<void> {
	return planVerb(async () => JSON.stringify(await auditInputs(cwd, name, approved), null, 2));
}

/**
 * `indusk plans audit-answers <name> [--plan-review]` — every dismissal and amendment answer
 * in `audit.md` (or `plan-review.md`), for the person; exit 2 naming each finding or question
 * the plan's agent has still to answer.
 */
export async function plansAuditAnswers(
	cwd: string,
	name: string,
	planReview: boolean,
): Promise<void> {
	const file = planReview ? "plan-review.md" : "audit.md";
	const live = await livePlanCopy(cwd, name);
	if (!live.ok) {
		console.error(`Refused: the worktree record ${live.file} cannot be read: ${live.problem}`);
		process.exit(1);
	}
	const path = join(live.copy.dir, file);
	if (!existsSync(path)) {
		console.error(`Refused: ${name} has no ${file} in ${live.copy.dir}`);
		process.exit(1);
	}
	const read = readAuditAnswers(readFileSync(path, "utf-8"), {
		questions: planReview ? PLAN_REVIEW_QUESTIONS : AUDIT_QUESTIONS,
		causes: !planReview,
	});
	const { open, shown } = describeAnswers(read, file);
	if (open.length > 0) {
		console.error(`${file} is not answered:\n${open.map((l) => `  ${l}`).join("\n")}`);
		process.exit(2);
	}
	console.info(
		shown.length > 0 ? shown.join("\n") : `${file}: nothing dismissed, nothing amended.`,
	);
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

/** `indusk plans accept-brief <name>` — the brief is settled and the plan can be written from it. */
export function plansAcceptBrief(cwd: string, name: string): Promise<void> {
	return planVerb(async () => {
		const a = await acceptBrief(cwd, name);
		return `Accepted the brief of ${a.plan}.\n${await askAdminToPlan(cwd, a.plan)}`;
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
		case "shorten-reason":
			return `shorten-reason: the ${s.ritual} was skipped with a reason of ${s.length} characters (${s.sentences} sentence${s.sentences === 1 ? "" : "s"}) — one sentence, at most 120; rewrite that line, do not run the ritual`;
		case "judgement":
			return `judgement: ${s.phase} waits on a person — ${s.item}`;
		case "review":
			return "review: built — every phase, the falsification and the cleanup are closed, and the audit written or skipped";
		case "cannot-continue":
			return `cannot continue: ${s.why}`;
	}
}

/** One amendment as a line: `promise x: was "a" — now "b"`. */
export function describeAmendment(a: Amendment): string {
	const said = (s: string | null) => (s === null ? "(not in the brief)" : JSON.stringify(s));
	return `${a.part} ${a.name}: was ${said(a.was)} — now ${said(a.now)}`;
}

/**
 * `indusk plans amendments <name> [--dir <folder>] [--json]` — what the brief
 * says now that it did not at approval. `--dir` names the plan folder the
 * caller means (check-gates hands the impl's own); otherwise the plan's live
 * copy. Exit 0 with the list, empty or not; 1 when it cannot be told.
 */
export function plansAmendments(
	cwd: string,
	name: string,
	opts: { dir?: string; json?: boolean },
): Promise<void> {
	return planVerb(async () => {
		let dir = opts.dir;
		if (dir === undefined) {
			const copies = await resolvePlanCopies(cwd);
			if (!copies.ok) {
				throw new PlanCommandRefusal(
					`the worktree record ${copies.file} cannot be read: ${copies.problem}`,
				);
			}
			const copy = copies.copies.get(name);
			if (!copy)
				throw new PlanCommandRefusal(`no plan named ${name}, on the trunk or in a worktree`);
			dir = copy.dir;
		}
		let amendments: Amendment[];
		try {
			amendments = await amendmentsOf(dir);
		} catch (err) {
			if (err instanceof AmendmentsUnreadable) throw new PlanCommandRefusal(err.message);
			throw err;
		}
		if (opts.json) return JSON.stringify(amendments);
		if (amendments.length === 0) return `${name}: nothing waits — the brief is the one approved`;
		return [
			`${name}: ${amendments.length} amendment(s) wait on the person:`,
			...amendments.map((a) => `  ${describeAmendment(a)}`),
		].join("\n");
	});
}

/** `indusk plans reapprove <name>` — the person approves the amendments an approved plan waits on. */
export function plansReapprove(cwd: string, name: string): Promise<void> {
	return planVerb(async () => {
		const r = await reapprovePlan(cwd, name);
		if (r.amendments.length === 0) {
			return `${r.plan}: no amendment waited; its brief is recorded as approved (${r.approvedBrief.slice(0, 8)}).`;
		}
		return [
			`Approved ${r.amendments.length} amendment(s) to ${r.plan}; its brief is recorded as approved (${r.approvedBrief.slice(0, 8)}) and the build goes on:`,
			...r.amendments.map((a) => `  ${describeAmendment(a)}`),
		].join("\n");
	});
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
	const amended = r.amendments;
	if (
		amended &&
		(amended.approved.length > 0 || amended.waiting.length > 0 || amended.unreadable)
	) {
		lines.push("", "Amendments:");
		for (const a of amended.approved)
			lines.push(`  ✓ ${describeAmendment(a)} — approved by ${a.by}, ${a.at}`);
		for (const a of amended.waiting)
			lines.push(`  … ${describeAmendment(a)} — waiting on the person`);
		if (amended.unreadable) lines.push(`  ? cannot be told: ${amended.unreadable}`);
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
	// Conversations not kept age out of the project's home the same way (drafts.max_age_days).
	const drafts = sweepDrafts(draftHomeOf(projectRoot), {
		maxAgeDays: getDraftMaxAgeDays(projectRoot),
		dryRun: opts.dryRun,
	});
	if (drafts.length > 0) {
		console.info(
			`${opts.dryRun ? "Would archive" : "Archived"} ${drafts.length} untouched draft(s) in the project home: ${drafts.join(", ")}`,
		);
	}
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

/**
 * `indusk plans time <name>` — a plan's phases, unattended steps and test runs
 * with their durations, and its total from the brief's acceptance to landing.
 *
 * promise: a-plan-says-how-long-it-took
 */
export function plansTime(root: string, name: string): Promise<void> {
	return planVerb(() => planTimeText(root, name));
}

/**
 * `indusk plans tests <name> --phase <ref> | --landing [--list]` — run the plan's
 * test set: its rows' tests, the tests its changes reach and, at landing, the
 * tests of the promises its brief lists as Must not break. Exit 1 when any fails.
 *
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 */
export function plansTests(
	root: string,
	name: string,
	opts: { phase?: string; landing?: boolean; list?: boolean },
): Promise<void> {
	return planVerb(async () => {
		if (opts.landing === true && opts.phase !== undefined) {
			throw new PlanCommandRefusal("--phase and --landing are alternatives; give one");
		}
		let scope: Parameters<typeof plansTestsOutcome>[1]["scope"];
		if (opts.landing === true) {
			scope = { landing: true };
		} else if (opts.phase !== undefined) {
			const ref = parsePhaseRef(
				/^\d+$/.test(opts.phase.trim()) ? `Phase ${opts.phase.trim()}` : opts.phase,
			);
			if (!ref) {
				throw new PlanCommandRefusal(
					`--phase must name a phase, like "Build Phase 1", "Test Phase 1" or "1"; got "${opts.phase}"`,
				);
			}
			scope = { phase: ref };
		} else {
			throw new PlanCommandRefusal("name what to run: --phase <ref> or --landing");
		}
		const outcome = await plansTestsOutcome(root, { plan: name, scope, list: opts.list === true });
		if (outcome.exitCode !== 0) {
			console.info(outcome.text);
			process.exit(outcome.exitCode);
		}
		return outcome.text;
	});
}
