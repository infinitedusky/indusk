import type { DocumentPosition } from "./lifecycle.js";

/**
 * The one definition of a plan's type (admin-plan-type).
 *
 * A plan declares what kind it is with `workflow:` in its brief. The kind
 * decides which planning documents the plan needs, and so whether an absent
 * document is a gap or was never going to exist.
 *
 * Before this module those facts were stated twice — the planner skill's
 * Workflow Types table and the four files under `templates/workflows/` — and
 * the two disagreed: the table said a bugfix has a test plan, the bugfix
 * template listed only a brief and an impl, and a bugfix written from the
 * template closed without one. The admin needs the same facts to explain a
 * type, which would have been a third statement. This is where they live;
 * `workflow-types-parity.test.ts` pins the skill and the templates to it.
 *
 * No filesystem and no Node built-ins: the admin imports this from a browser
 * component.
 */

export const WORKFLOW_TYPES = ["feature", "bugfix", "refactor", "spike"] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export interface WorkflowDefinition {
	/** What this kind of plan is for, in a sentence. */
	purpose: string;
	/** The documents a plan of this kind has, in lifecycle order. */
	requires: readonly DocumentPosition[];
	/** The documents it never has, in lifecycle order. With `requires`, every document position. */
	skips: readonly DocumentPosition[];
	/** Why the skipped documents are skipped, and anything this kind carries instead. */
	why: string;
}

/**
 * The retrospective is required by every kind that ships an impl. The planner
 * skill's table lists it only for `feature` because that table describes what
 * `/planner` creates; the retrospective is `/retrospective`'s, and a bugfix or
 * a refactor is closed by one like any other plan.
 */
export const WORKFLOW_DEFINITIONS: Record<WorkflowType, WorkflowDefinition> = {
	feature: {
		purpose: "A new capability or a change to how the system works — the full lifecycle.",
		requires: ["research", "brief", "test-plan", "adr", "impl", "retrospective"],
		skips: [],
		why: "Nothing is skipped: the problem has to be explored, the direction proposed, the behaviour pinned down, and the decision recorded before code is written.",
	},
	bugfix: {
		purpose: "Something is broken and the fix is known.",
		requires: ["brief", "test-plan", "impl", "retrospective"],
		skips: ["research", "adr"],
		why: "The problem is already understood, so there is nothing to research and no architecture to decide. The test plan stays: its first assertion is the failing test that proves the bug.",
	},
	refactor: {
		purpose: "Existing code is restructured without changing what it does.",
		requires: ["brief", "test-plan", "impl", "retrospective"],
		skips: ["research", "adr"],
		why: "Behaviour does not change, so there is no problem space to research and no decision to record. The test plan stays — it is what proves the behaviour held — and the impl carries a boundary map.",
	},
	spike: {
		purpose: "Pure exploration, with no commitment to build anything.",
		requires: ["research"],
		skips: ["brief", "test-plan", "adr", "impl", "retrospective"],
		why: "A spike ends in findings. If it leads to building something, that is a new plan with its own brief.",
	},
};

/** What each document is called when a person reads it. */
export const DOCUMENT_LABELS: Record<DocumentPosition, string> = {
	research: "research",
	brief: "brief",
	"test-plan": "test plan",
	adr: "ADR",
	impl: "impl",
	retrospective: "retrospective",
};

export interface DeclaredWorkflow {
	/** The plan's type, when the declared word is one. */
	type: WorkflowType | null;
	/** The word as it was written — set whenever anything was declared, recognised or not. */
	declared: string | null;
}

/**
 * Read a `workflow:` frontmatter value. Three outcomes, kept apart on purpose:
 * a known type; a word that is not a type (`declared` set, `type` null — shown
 * as written, never guessed at); and nothing declared.
 *
 * A non-string is still a declaration — a list, a mapping, a number — and
 * treating it as "not declared" would hide the mistake. `written` is the text
 * on the document's `workflow:` line, when the caller has the document: it is
 * what such a declaration is shown as.
 */
export function readWorkflow(value: unknown, written: string | null = null): DeclaredWorkflow {
	if (value === undefined || value === null) return { type: null, declared: null };
	// Only a plain string can be a type. A list, a mapping, a number or a
	// boolean is a declaration that is not one: `String()` of a one-element
	// list is its element's text, which read `[bugfix]` as a bugfix. It is
	// shown as it was written on the line; a value written on the lines below
	// (a block list) has no text there, and is shown as YAML read it.
	if (typeof value !== "string") {
		return { type: null, declared: written ?? JSON.stringify(value) };
	}
	const declared = value.trim();
	if (declared === "") return { type: null, declared: null };
	const type = (WORKFLOW_TYPES as readonly string[]).includes(declared)
		? (declared as WorkflowType)
		: null;
	return { type, declared };
}

/**
 * One sentence for an absent document the bar cannot leave to colour alone.
 * `missing`: the type requires it and the plan moved past it. `unknown`: the
 * absence cannot be judged — because no type is declared, or because the word
 * that was declared is not one. Those are different facts, and the sentence
 * says which: a plan that declared `hotfix` did not declare nothing.
 */
export function absentDocumentNote(
	document: DocumentPosition,
	state: "missing" | "unknown",
	type: WorkflowType | null,
	/** The word that was declared, when it is not one of the types. */
	declared: string | null = null,
): string {
	const label = DOCUMENT_LABELS[document];
	if (state === "missing" && type !== null) {
		return `The ${label} is missing — a ${type} requires it.`;
	}
	if (declared !== null) {
		return `The ${label} is absent, and this plan declares "${declared}", which is not a recognised type, so whether that matters cannot be judged.`;
	}
	return `The ${label} is absent, and this plan declares no type, so whether that matters cannot be judged.`;
}
