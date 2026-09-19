/**
 * The promise vocabulary — one definition (day-promises ADR D6).
 *
 * Kept beside, not inside, `lib/lifecycle.ts`: a promise's state is not a
 * plan position. The tuples are `as const` so the unions derive from them and
 * the admin's label maps can be `satisfies Record<…>` over the same members;
 * `promises-single-definition.test.ts` pins that no second copy exists.
 */

/**
 * What can break a promise after it was proved, and therefore what checks it:
 * `behaviour` breaks on inputs nobody chose (a run); `state` on a later change
 * to the code that produces the state (a test); `structure` on a change that
 * removes or duplicates something (a build-time check).
 */
export const PROMISE_KINDS = ["behaviour", "state", "structure"] as const;
export type PromiseKind = (typeof PROMISE_KINDS)[number];

/**
 * `declared` — stated in planning, not yet established; the owner is an open
 * plan. `enforced` — upheld; a violation is a bug. `known-violated` — the
 * implementation provably cannot uphold it; carries the incident that proves
 * it. `retired` — no longer a promise, kept for history.
 */
export const PROMISE_STATES = ["declared", "enforced", "known-violated", "retired"] as const;
export type PromiseState = (typeof PROMISE_STATES)[number];

/**
 * `holds` — in force for as long as the system runs (the default).
 * `established` — a transition that cannot be undone once done; retires the
 * moment it is proved, so the registry does not fill with things that can
 * never break again.
 */
export const PROMISE_LIFETIMES = ["holds", "established"] as const;
export type PromiseLifetime = (typeof PROMISE_LIFETIMES)[number];

/** Where the system was running when the promise broke; `desk` is a finding by reading. */
export const INCIDENT_SOURCES = ["local", "smoke", "deployed", "desk"] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export const INCIDENT_STATUSES = ["open", "fixed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** The registry directory, relative to the plan root. */
export const PROMISES_REL_DIR = ".indusk/promises";
/** Incidents live in a subdirectory of the registry. */
export const INCIDENTS_SUBDIR = "incidents";

/** A promise name: kebab-case starting with a letter, so it sits in a file name and a comment unchanged. */
export const PROMISE_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * The one token form a code site or a test carries: `promise: <name>`. It
 * sits in any comment syntax, a docstring, a decorator argument or a helper
 * call, which is what makes the check language-agnostic (ADR D2).
 *
 * Two rules keep a bare `promise:` from reading as a citation where it is
 * only a word — found by running the check against this repository, which
 * has a field named `promise` (a `{ promise: <type> }` annotation), a test example, and a
 * package called `promise` in its lockfile (`promise: 4`):
 *
 *   1. the token must FOLLOW a comment opener or a quote on the same line —
 *      `//`, `#`, `*`, `--`, `;`, `<!--`, `"`, `'`, `` ` `` — so a type
 *      annotation, a YAML key at line start and a lockfile entry never match;
 *   2. a name starts with a letter.
 */
export function promiseToken(name: string): string {
	return `promise: ${name}`;
}

/**
 * What may sit before the token on its line (A27, the falsification's
 * refinement of rule 1): a comment opener anywhere EARLIER on the line
 * (`//`, `#`, `/*`, `<!--` — so `// enforces` followed by the token counts), a
 * line-leading docblock, SQL or ini opener (`*`, `--`, `;`) with any text
 * after it, or a quote DIRECTLY before the token (so a type annotation on a
 * line with an earlier string literal still does not count).
 */
const TOKEN_OPENER = String.raw`(?<=(?:(?:\/\/|#|\/\*|<!--)[^\n]*|(?:^|\n)[ \t]*(?:\*|--|;)[^\n]*|["'${"`"}][ \t]*))`;

/** Matches the token for one specific name. */
export function promiseTokenPattern(name: string): RegExp {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`${TOKEN_OPENER}promise:[ \\t]*${escaped}(?![a-z0-9-])`);
}

/** Matches every token in a file; group 1 is the name. Fresh per call (it is global). */
export function anyPromiseTokenPattern(): RegExp {
	return new RegExp(`${TOKEN_OPENER}promise:[ \\t]*([a-z][a-z0-9-]*)(?![a-z0-9-])`, "g");
}

/**
 * The mark a running system leaves when it upholds or breaks a behaviour
 * promise (day-monitor, ADR D1): plain OpenTelemetry names the application
 * sets itself, so it runs with InDusk deleted and anyone with the raw trace
 * can read which promise broke. Violation is its own attribute and event,
 * never the span's error status — "an error happened" and "a promise broke"
 * differ in both directions. One home: the evaluator's mark, the test helper
 * and the Jaeger reader all spell these from here.
 */
export const PROMISE_MARK = {
	/** Span attribute: the promise's registry name. */
	promise: "indusk.promise",
	/** Span attribute: `upheld` or `violated`. */
	outcome: "indusk.promise.outcome",
	/** Span event, present on a violation. */
	violatedEvent: "indusk.promise.violated",
	/** Attribute on the violated event: what was observed, one line. */
	symptom: "indusk.promise.symptom",
} as const;

export const PROMISE_OUTCOMES = ["upheld", "violated"] as const;
export type PromiseOutcome = (typeof PROMISE_OUTCOMES)[number];

/**
 * The name inside a token argument (`"promise: <name>"`), or null when the
 * string is not exactly one token. The trace-shape helper takes the token,
 * not the bare name, so the call itself is the promise's test link.
 */
export function parsePromiseToken(token: string): string | null {
	const m = /^promise:[ \t]*([a-z][a-z0-9-]*)$/.exec(token.trim());
	return m ? m[1] : null;
}
