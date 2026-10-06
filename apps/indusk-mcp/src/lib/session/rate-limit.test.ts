import { describe, expect, it } from "vitest";
import { isRateLimited } from "../eval/persistent-evaluator.js";
import { parseSessionLine } from "./protocol.js";
import { isRateLimitedResult, RATE_LIMIT_RETRIES, rateLimitDelayMs } from "./rate-limit.js";

/**
 * promise: one-definition-per-shared-rule — admin-plan-authoring A40.
 *
 * The evaluator and a build step both start the developer's `claude` and
 * both try again when the API rate-limits the start. They judge it by one
 * rule — the result's `api_error_status` is 429, the field incident
 * i-2026-10-05-every-commit-evaluated found reliable — and wait one schedule.
 */

const line = (fields: Record<string, unknown>) =>
	JSON.stringify({ type: "result", subtype: "success", session_id: "s", ...fields });

/** What a build step judges: the stream's result event, as the protocol reads it. */
function buildJudges(raw: string): boolean {
	const [ev] = parseSessionLine(raw);
	return isRateLimitedResult(ev);
}

/** What the evaluator judges: the same message, printed whole by `-p --output-format json`. */
const evaluatorJudges = (raw: string) => isRateLimited({ code: 1, stdout: raw });

describe("A40 — one rate-limit rule for builds and the evaluator", () => {
	it("a result carrying api_error_status 429 is rate-limited, to both", () => {
		const raw = line({ is_error: true, result: "API Error", api_error_status: 429 });
		expect(buildJudges(raw)).toBe(true);
		expect(evaluatorJudges(raw)).toBe(true);
	});

	it("another API error is not, to both", () => {
		const raw = line({ is_error: true, result: "API Error", api_error_status: 500 });
		expect(buildJudges(raw)).toBe(false);
		expect(evaluatorJudges(raw)).toBe(false);
	});

	it("words about a rate limit without the status are not, to both", () => {
		const raw = line({ is_error: true, result: "the plan discusses a rate limit" });
		expect(buildJudges(raw)).toBe(false);
		expect(evaluatorJudges(raw)).toBe(false);
	});

	it("both wait 15, 45 and 90 seconds, three times", () => {
		expect(RATE_LIMIT_RETRIES).toBe(3);
		expect([1, 2, 3].map((a) => rateLimitDelayMs(a))).toEqual([15_000, 45_000, 90_000]);
		expect([1, 2, 3].map((a) => rateLimitDelayMs(a, 10))).toEqual([10, 30, 60]);
	});
});
