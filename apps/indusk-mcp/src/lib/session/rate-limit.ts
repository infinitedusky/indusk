/**
 * When a run of the developer's `claude` was rate-limited, and how long to
 * wait before trying it again (admin-plan-authoring A40) — one rule for the
 * evaluator and a build step. The API's refusal arrives on the run's result
 * as `api_error_status: 429`: the field incident
 * i-2026-10-05-every-commit-evaluated found reliable, where words in the
 * result are not (a plan can talk about rate limits).
 *
 * promise: one-definition-per-shared-rule
 */

/** How many times a rate-limited run is tried again. */
export const RATE_LIMIT_RETRIES = 3;

/** The wait before retry `attempt` (1-based): 15, 45 and 90 seconds — long enough for a burst to pass. */
export function rateLimitDelayMs(attempt: number, base = 15_000): number {
	return base * [1, 3, 6][Math.min(Math.max(attempt, 1), 3) - 1];
}

/**
 * Whether a run's result says the API rate-limited it: Claude's own result
 * message (`api_error_status`), or the protocol's reading of it
 * (`apiErrorStatus`).
 */
export function isRateLimitedResult(result: unknown): boolean {
	if (typeof result !== "object" || result === null) return false;
	const r = result as { api_error_status?: unknown; apiErrorStatus?: unknown };
	return (r.api_error_status ?? r.apiErrorStatus) === 429;
}
