import type { DeferredRow, Trajectory, TrajectoryRow } from "./parser.js";
import { parseTrajectory } from "./parser.js";

export type MitigationKind =
	| "telemetry-alert"
	| "scheduled-review"
	| "downstream-plan"
	| "canary-or-staging"
	| "feedback-signal"
	| "unclassified";

export interface MitigationClassification {
	row: DeferredRow;
	kind: MitigationKind;
	/** Hints extracted from the text: plan names, file paths, metric names. */
	hints: string[];
	/** Non-null when the mitigation is too vague — needs a more concrete commitment. */
	warning: string | null;
}

const TELEMETRY_KEYWORDS = ["alert", "metric", "otel", "dash0", "grafana", "threshold"];
const REVIEW_KEYWORDS = [
	"weekly",
	"monthly",
	"quarterly",
	"daily",
	"review",
	"spot-check",
	"audit",
];
const PLAN_REF = /\b[a-z][a-z0-9-]*-[a-z][a-z0-9-]*\b/g; // kebab-case identifiers that look like plan slugs
const CANARY_KEYWORDS = ["staging", "canary", "smoke", "preflight", "pre-release"];
const FEEDBACK_KEYWORDS = ["feedback", "ticket", "support", "channel", "signal"];

function classifyMitigation(row: DeferredRow): MitigationClassification {
	const text = row.mitigation.toLowerCase();
	const hints: string[] = [];

	const hasAny = (words: string[]) => words.some((w) => text.includes(w));

	let kind: MitigationKind = "unclassified";
	if (hasAny(TELEMETRY_KEYWORDS)) kind = "telemetry-alert";
	else if (hasAny(CANARY_KEYWORDS)) kind = "canary-or-staging";
	else if (hasAny(FEEDBACK_KEYWORDS)) kind = "feedback-signal";
	else if (hasAny(REVIEW_KEYWORDS)) kind = "scheduled-review";

	const planRefs = [...row.mitigation.matchAll(PLAN_REF)].map((m) => m[0]);
	if (planRefs.length > 0) {
		hints.push(...planRefs);
		if (kind === "unclassified") kind = "downstream-plan";
	}

	let warning: string | null = null;
	if (kind === "unclassified" || row.mitigation.trim().length < 20) {
		warning = `Mitigation for "${row.name}" is vague — expected a specific alert, review cadence, plan reference, or procedure. Got: "${row.mitigation}"`;
	}

	return { row, kind, hints, warning };
}

/**
 * Retrospective audit: classify every Deferred Verification row, flag any
 * whose mitigation text is too vague or unclassifiable. Returns findings
 * suitable for inclusion in a retrospective's "What We Learned" section
 * or a Graphiti audit episode.
 */
export function auditDeferredMitigations(trajectory: Trajectory): MitigationClassification[] {
	return trajectory.deferred.map(classifyMitigation);
}

export interface BlockedRowFinding {
	row: TrajectoryRow;
	message: string;
}

/**
 * Retrospective audit: surface trajectory rows that ended the plan in
 * `blocked` state. Blocked means "was writable/written but regressed or
 * changed" — if the plan closes with blocked rows, they should be
 * explicitly resolved (fix, move passesAt, or move to Deferred Verification).
 */
export function findBlockedRows(trajectory: Trajectory): BlockedRowFinding[] {
	return trajectory.rows
		.filter((row) => row.state === "blocked")
		.map((row) => ({
			row,
			message: `Row ${row.id} ended plan in 'blocked' state — needs resolution (fix, reschedule, or move to Deferred Verification)`,
		}));
}

export interface TestIdResolution {
	id: string;
	asserts: string;
	/** Best-effort test file name glob (e.g. "**\/*reconciler*.test.ts") or null. */
	fileGlob: string | null;
	/** Vitest command with a filter, if one can be derived from the asserts text. */
	suggestedCommand: string;
}

/**
 * Derive a concrete test file glob + runnable command from a trajectory
 * row's asserts text. Heuristic: extract identifiers (camelCase, kebab-case,
 * backtick-quoted code) and use the longest as a filename hint. Returns a
 * fallback `pnpm test` with a `-t` name filter if no filename hint found.
 *
 * The verify skill uses this to resolve phase-Verification items that say
 * "T3 passes (...)" into a real invocation. Best-effort — human can override.
 */
export function resolveTestIdCommand(trajectory: Trajectory, id: string): TestIdResolution | null {
	const row = trajectory.rows.find((r) => r.id === id);
	if (!row) return null;

	const backtickMatches = [...row.asserts.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
	const identifiers = [...row.asserts.matchAll(/\b[a-zA-Z][a-zA-Z0-9_]{3,}\b/g)].map((m) => m[0]);

	const keyword =
		backtickMatches.filter((s) => /[a-zA-Z]/.test(s)).sort((a, b) => b.length - a.length)[0] ??
		identifiers.sort((a, b) => b.length - a.length)[0] ??
		null;

	const fileGlob = keyword
		? `**/*${keyword.toLowerCase().replace(/[^a-z0-9]/g, "")}*.test.ts`
		: null;
	const suggestedCommand = keyword
		? `pnpm test -t "${keyword}"`
		: `pnpm test -t "${row.asserts.slice(0, 40)}"`;

	return { id, asserts: row.asserts, fileGlob, suggestedCommand };
}

/** Convenience — parse + audit + resolve in one call for the retrospective skill. */
export function auditPlanAtClose(body: string): {
	deferred: MitigationClassification[];
	blocked: BlockedRowFinding[];
} {
	const trajectory = parseTrajectory(body);
	return {
		deferred: auditDeferredMitigations(trajectory),
		blocked: findBlockedRows(trajectory),
	};
}
