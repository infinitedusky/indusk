/**
 * The five kinds of test, and when each runs (test-kinds, ADR D1).
 *
 * A test answers one question, and its kind says when that question is worth
 * asking. A test plan names one kind per assertion — the smallest that can
 * prove it; a `contract` only when the question is about something we do not
 * own (Jaeger's API, npm, a browser, the OS, Claude Code).
 *
 * The one definition. The hooks carry a copy (`hooks/_test-kinds.js`), pinned
 * equal to this by `test-kinds-parity.test.ts`.
 */

export const TEST_KINDS = ["unit", "contract", "live check", "smoke", "promise"] as const;

export type TestKind = (typeof TEST_KINDS)[number];

/** When each kind runs. */
export const TEST_KIND_MOMENTS: Record<TestKind, string> = {
	unit: "in the phase that writes it; part of `pnpm test`",
	contract: "`pnpm test:system`: at landing and on release",
	"live check": "once, against the real system, recorded in the plan with its result",
	smoke: "at deploy",
	promise: "continuously, by the watcher",
};

export function isTestKind(value: string): value is TestKind {
	return (TEST_KINDS as readonly string[]).includes(value.trim().toLowerCase());
}

/** How a refusal names the kinds. */
export function kindsList(): string {
	return TEST_KINDS.join(", ");
}
