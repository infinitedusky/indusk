import type { RetrospectiveReadiness } from "./cleanup/gate.js";
import type { GateKind } from "./impl-headings.js";
import type { ImplPhase, ParsedImpl } from "./impl-parser.js";
import type { PlanSummary } from "./plan-parser.js";
import type { PhaseBoundaryRecord } from "./shape/boundary.js";

/**
 * The one definition of a plan's lifecycle (admin-ui-phase-progress, ADR D1).
 *
 * Before this module the lifecycle lived in three places, none of them
 * exported: a module-private stage order in the plan parser (which omitted
 * `test-plan`), the ritual order in skill prose, and two disagreeing gate-kind
 * types. Every reader that needed it copied a part and drifted — the admin's
 * phase view could not see a test phase for a month. This module is what
 * `parsePlan`, the retrospective readiness gate and the admin all read, pinned
 * single-definition by `lifecycle-single-definition.test.ts`.
 *
 * Two vocabularies, deliberately kept apart (Sandy, 2026-09-16):
 *
 *   - **Positions are nouns.** Where a plan stands — facts about which
 *     documents exist and what their status says. Nothing is happening in a
 *     position.
 *   - **Activities are verbs.** What is happening now, inside exactly one
 *     position (`executing`), because that is the only stretch of the
 *     lifecycle that leaves observable traces on disk every few minutes.
 *
 * A plan can therefore never render as "archived" and "verifying" at once.
 */

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

/** Where a plan stands. Nouns. In lifecycle order. */
export type PlanPosition =
	| "research"
	| "brief"
	| "test-plan"
	| "adr"
	| "impl-approved"
	| "executing"
	| "falsify"
	| "cleanup"
	| "retrospective"
	| "archived"
	| "monitor";

/**
 * Every position, in order. `monitor` follows `archived` (day-monitor, ADR
 * D8): a closed plan holding a behaviour promise waits there until its
 * promises have been quiet for the window.
 */
export const PLAN_POSITIONS: readonly PlanPosition[] = [
	"research",
	"brief",
	"test-plan",
	"adr",
	"impl-approved",
	"executing",
	"falsify",
	"cleanup",
	"retrospective",
	"archived",
	"monitor",
];

/**
 * The positions that are a document on disk, in lifecycle order — the plan
 * parser's stage order. `test-plan` joins it here: every new plan has one,
 * and the old private order walked past it as if it were not a stage.
 */
export const DOCUMENT_POSITIONS = [
	"research",
	"brief",
	"test-plan",
	"adr",
	"impl",
	"retrospective",
] as const;
export type DocumentPosition = (typeof DOCUMENT_POSITIONS)[number];

/**
 * The close-out rituals, in order, as the word a ritual phase's title must
 * START with (`### Phase N: Falsification — …`). The retrospective readiness
 * gate matches these; the skill prose used to be the only place the order was
 * written down.
 */
export const RITUAL_ORDER = ["falsification", "cleanup"] as const;
export type RitualWord = (typeof RITUAL_ORDER)[number];

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

/** What is happening inside `executing`. Verbs. */
export type PhaseActivity =
	| "authoring"
	| "implementing"
	| "instrumenting"
	| "verifying"
	| "capturing-context"
	| "documenting"
	| "closed"
	| "falsifying"
	| "cleaning-up";

export const PHASE_ACTIVITIES: readonly PhaseActivity[] = [
	"authoring",
	"implementing",
	"instrumenting",
	"verifying",
	"capturing-context",
	"documenting",
	"closed",
	"falsifying",
	"cleaning-up",
];

/**
 * The gate stages a phase passes through after its implementation items, in
 * the order `/work` completes them. OTel is a stage wherever the project emits
 * it; a project whose `otel.role` is `library` simply never has the block.
 */
export const GATE_STAGES: readonly GateKind[] = ["Verification", "OTel", "Context", "Document"];

/** A stage inside a phase: the implementation items, then each gate. */
export type StageKind = "implementation" | GateKind;

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/**
 * Every bar segment is one of these (Sandy, 2026-09-16). A bar that is only
 * filled-or-empty cannot show the middle, and the middle is the whole point
 * of watching. Skipped is drawn, never omitted, so every plan's bar has the
 * same shape.
 */
export type SegmentState = "done" | "active" | "pending" | "skipped";

export interface PlanPositionState {
	position: PlanPosition;
	/** One state per position, in `PLAN_POSITIONS` order. */
	segments: Record<PlanPosition, SegmentState>;
	/** What the active position waits on, e.g. "brief drafted, awaiting acceptance". Null when nothing is active. */
	awaiting: string | null;
	/** The quiet window, when the position is `monitor` — the one segment that measures time. */
	monitor?: MonitorWindow;
}

export interface StageState {
	kind: StageKind;
	state: SegmentState | "opted-out";
	checked: number;
	total: number;
	/** The conversation proof of an opt-out (`asked: … — user: …`), when the gate was skipped with one. */
	proof?: string;
}

export interface PhaseActivityState {
	activity: PhaseActivity;
	stages: StageState[];
	/** When the phase opened, if a boundary record says so. */
	openedAt: string | null;
}

// ---------------------------------------------------------------------------
// Deriving a plan's position
// ---------------------------------------------------------------------------

export interface DerivePlanPositionInput {
	summary: PlanSummary;
	/** The parsed impl, when the plan has one. */
	impl: ParsedImpl | null;
	/** Retrospective readiness, when the plan has an impl. */
	readiness: RetrospectiveReadiness | null;
	archived: boolean;
	/**
	 * What an archived plan is doing after it closed (day-monitor), from
	 * `lib/promises/after-close.ts`. Absent reads as at rest.
	 */
	afterClose?: {
		/** Open Maintenance phases' names: the plan is reopened and executing. */
		reopened: string[];
		/** Set while the plan's behaviour promises are inside the quiet window. */
		monitor: MonitorWindow | null;
	};
}

/** A plan in `monitor`: how much of its quiet window has passed. */
export interface MonitorWindow {
	windowDays: number;
	/** Days since the plan closed, or since the violation that restarted the window. */
	elapsedDays: number;
	/** ISO time of the violation that restarted the window; null when it runs from the close. */
	restartedAt: string | null;
}

/** "3 of 7 days quiet", "window restarted 2026-09-18 — 0 of 7 days quiet". */
export function monitorAwaiting(m: MonitorWindow): string {
	const quiet = `${Math.floor(m.elapsedDays)} of ${m.windowDays} days quiet`;
	return m.restartedAt ? `window restarted ${m.restartedAt.slice(0, 10)} — ${quiet}` : quiet;
}

const DOC_POSITION_TO_PLAN: Record<DocumentPosition, PlanPosition> = {
	research: "research",
	brief: "brief",
	"test-plan": "test-plan",
	adr: "adr",
	impl: "impl-approved",
	retrospective: "retrospective",
};

/** The plan-level position a plan summary + impl state resolves to, and why. */
function resolvePosition(input: DerivePlanPositionInput): {
	position: PlanPosition;
	awaiting: string | null;
} {
	const { summary, impl, readiness, archived, afterClose } = input;
	if (archived) {
		if (afterClose && afterClose.reopened.length > 0) {
			return { position: "executing", awaiting: `executing ${afterClose.reopened[0]}` };
		}
		if (afterClose?.monitor) {
			return { position: "monitor", awaiting: monitorAwaiting(afterClose.monitor) };
		}
		return { position: "archived", awaiting: null };
	}

	const stage = summary.stage;
	const status = summary.stageStatus;

	if (stage === "retrospective") {
		return { position: "retrospective", awaiting: "retrospective written, awaiting archive" };
	}
	if (stage === "impl") {
		if (status === "completed") {
			// A29: the bar may never say "cleaned" over a fact it does not hold.
			// No readiness means the impl could not be read — say so; a
			// non-terminal row means the gate would refuse — name it.
			if (readiness === null) {
				return {
					position: "falsify",
					awaiting: "impl complete — readiness unknown (impl unreadable)",
				};
			}
			const missing = readiness.missing;
			if (missing.includes("falsification")) {
				return { position: "falsify", awaiting: "impl complete, awaiting /falsify" };
			}
			if (missing.includes("cleanup")) {
				return { position: "cleanup", awaiting: "falsified, awaiting /cleanup" };
			}
			if (missing.includes("rows")) {
				const rows = readiness.nonTerminalRows.join(", ");
				return {
					position: "retrospective",
					awaiting: `rows not terminal — retrospective blocked${rows ? ` (${rows})` : ""}`,
				};
			}
			return { position: "retrospective", awaiting: "cleaned, awaiting /retrospective" };
		}
		if (status === "in-progress") {
			// A33: the active segment always carries the message. Normally the
			// active phase speaks; when nothing is open there is no active
			// phase, so the position itself says what it is waiting for.
			const nothingOpen =
				impl !== null &&
				impl.phases.length > 0 &&
				impl.phases.every((p) => p.gates.every((g) => g.items.every((i) => i.checked)));
			return {
				position: "executing",
				awaiting: nothingOpen ? "every item checked — impl status is still in-progress" : null,
			};
		}
		if (status === "approved")
			return { position: "impl-approved", awaiting: "impl approved, awaiting /work" };
		return { position: "impl-approved", awaiting: `impl ${status}, awaiting approval` };
	}
	if (stage === "research" || stage === "brief" || stage === "test-plan" || stage === "adr") {
		const noun = stage === "test-plan" ? "test plan" : stage === "adr" ? "ADR" : stage;
		if (status === "accepted" || status === "complete" || status === "completed") {
			return { position: stage, awaiting: `${noun} accepted, awaiting the next document` };
		}
		if (status === "proposed" || status === "draft" || status === "in-progress") {
			return { position: stage, awaiting: `${noun} ${status}, awaiting acceptance` };
		}
		return { position: stage, awaiting: `${noun} ${status}` };
	}
	// `paper`, `unknown`, `malformed`: no lifecycle position has been reached.
	return { position: "research", awaiting: `${stage} — no lifecycle document yet` };
}

/**
 * The plan bar. Positions before the current one are done — or skipped, when
 * they are a document position whose file is absent while a later one exists
 * (a bugfix skips research; a refactor skips the ADR). The current position is
 * active; later ones pending. Archived has no active segment: nothing is
 * happening. `monitor` is pending unless a closed plan is inside its quiet
 * window, when it is active and `archived` behind it is done.
 */
export function derivePlanPosition(input: DerivePlanPositionInput): PlanPositionState {
	const { position, awaiting } = resolvePosition(input);
	const currentIndex = PLAN_POSITIONS.indexOf(position);
	const docs = new Set(input.summary.documents);
	const segments = {} as Record<PlanPosition, SegmentState>;
	for (const [index, candidate] of PLAN_POSITIONS.entries()) {
		if (index > currentIndex) {
			segments[candidate] = "pending";
			continue;
		}
		if (index === currentIndex) {
			segments[candidate] = position === "archived" ? "done" : "active";
			continue;
		}
		const doc = documentFor(candidate);
		segments[candidate] = doc !== null && !docs.has(`${doc}.md`) ? "skipped" : "done";
	}
	const monitor = position === "monitor" ? input.afterClose?.monitor : null;
	return {
		position,
		segments,
		awaiting: position === "archived" ? null : awaiting,
		...(monitor ? { monitor } : {}),
	};
}

function documentFor(position: PlanPosition): DocumentPosition | null {
	for (const doc of DOCUMENT_POSITIONS) {
		if (DOC_POSITION_TO_PLAN[doc] === position) return doc;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Deriving a phase's activity
// ---------------------------------------------------------------------------

/** `(none needed — asked: "…" — user: "…")` — the conversation proof a skipped gate carries. */
const OPT_OUT = /\(\s*(?:none needed|not applicable)\b[^)]*asked:\s*"[^"]+"[^)]*user:\s*"[^"]+"/i;

const STAGE_VERB: Record<StageKind, PhaseActivity> = {
	implementation: "implementing",
	Verification: "verifying",
	OTel: "instrumenting",
	Context: "capturing-context",
	Document: "documenting",
};

const GATE_TYPE_TO_STAGE: Record<string, StageKind> = {
	implementation: "implementation",
	verification: "Verification",
	otel: "OTel",
	context: "Context",
	document: "Document",
};

/**
 * The phase bar: the implementation items, then each gate the phase carries,
 * in `GATE_STAGES` order. A stage is done when every item is checked,
 * opted-out when its only checked item is a conversation-proof skip, pending
 * otherwise. The first stage that is not done is active and names the verb —
 * `authoring` for a test phase's items, `falsifying` / `cleaning-up` for a
 * ritual phase's, `implementing` for everything else. All done ⇒ `closed`.
 */
export function derivePhaseActivity(
	phase: ImplPhase,
	boundary: PhaseBoundaryRecord | null,
): PhaseActivityState {
	const byStage = new Map<StageKind, ImplPhase["gates"][number]["items"]>();
	for (const gate of phase.gates) {
		const stage = GATE_TYPE_TO_STAGE[gate.type];
		if (!stage) continue;
		byStage.set(stage, [...(byStage.get(stage) ?? []), ...gate.items]);
	}
	const order: StageKind[] = ["implementation", ...GATE_STAGES];
	const stages: StageState[] = [];
	let activeFound = false;
	let activity: PhaseActivity = "closed";
	for (const kind of order) {
		const items = byStage.get(kind);
		// A32: a stage with nothing in it is not a stage — the parser always
		// emits an implementation gate, and an empty one read "implementing
		// 0 of 0" forever while the active-phase rule said nothing was open.
		if (!items || items.length === 0) continue;
		const checked = items.filter((i) => i.checked).length;
		const total = items.length;
		const optOut = items.find((i) => i.checked && OPT_OUT.test(i.text));
		let state: StageState["state"];
		if (total > 0 && checked === total) {
			state = optOut ? "opted-out" : "done";
		} else if (!activeFound) {
			state = "active";
			activeFound = true;
			activity = verbFor(phase, kind);
		} else {
			state = "pending";
		}
		stages.push({
			kind,
			state,
			checked,
			total,
			...(optOut ? { proof: optOut.text } : {}),
		});
	}
	return { activity, stages, openedAt: boundary?.timestamp ?? null };
}

function verbFor(phase: ImplPhase, stage: StageKind): PhaseActivity {
	if (stage !== "implementation") return STAGE_VERB[stage];
	if (phase.kind === "test") return "authoring";
	const title = phase.name.toLowerCase();
	if (title.startsWith(RITUAL_ORDER[0])) return "falsifying";
	if (title.startsWith(RITUAL_ORDER[1])) return "cleaning-up";
	return "implementing";
}
