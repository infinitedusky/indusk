/**
 * The five levels of test, and when each runs (test-kinds ADR D1; renamed by
 * planner-promises ADR D7).
 *
 * A test answers one question, and its level says when that question is worth
 * asking. A test plan names one level per assertion — the smallest that can
 * prove it; a `contract` only when the question is about something we do not
 * own (Jaeger's API, npm, a browser, the OS, Claude Code).
 *
 * "Level", not "kind": a promise has a kind (behaviour, state, structure), and
 * a test row names both a level and a promise.
 *
 * The one definition. The hooks carry a copy (`hooks/_test-levels.js`), pinned
 * equal to this by `test-levels-parity.test.ts`.
 */

export const TEST_LEVELS = ["unit", "contract", "live check", "smoke", "promise"] as const;

export type TestLevel = (typeof TEST_LEVELS)[number];

/** When each level runs. */
export const TEST_LEVEL_MOMENTS: Record<TestLevel, string> = {
	unit: "in the phase that writes it; part of `pnpm test`",
	contract: "`pnpm test:system`: at landing and on release",
	"live check": "once, against the real system, recorded in the plan with its result",
	smoke: "at deploy",
	promise: "continuously, by the watcher",
};

export function isTestLevel(value: string): value is TestLevel {
	return (TEST_LEVELS as readonly string[]).includes(value.trim().toLowerCase());
}

/** How a refusal names the levels. */
export function levelsList(): string {
	return TEST_LEVELS.join(", ");
}
