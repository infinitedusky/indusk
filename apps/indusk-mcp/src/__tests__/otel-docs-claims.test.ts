// What the OpenTelemetry docs say the browser template does about async handlers.
// browser-template-claims T5: the reference page said a `.then()` chain compiled
// below ES2017 follows the click; the shipped template installs no async-aware
// context manager, so nothing but a request made synchronously in the handler does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

const PAGES = ["apps/docs/src/reference/tools/otel.md", "apps/indusk-mcp/extensions/otel/skill.md"];

/** What a sentence says when it states the limit rather than the claim: the request is in its own trace. */
const SAYS_IT_DOES_NOT_FOLLOW =
	/\bits own trace\b|\bnot (?:in )?the click's\b|\boutside the click\b|\bdoes not follow the click\b|\bdo not follow the click\b/i;

/** Sentences (split on . ! ? and newlines) that tie a deferred call to following the click. */
function asyncFollowClaims(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+|\n+/)
		.filter((sentence) => /\bfollows? the click\b|\bin the click's trace\b/i.test(sentence))
		.filter((sentence) =>
			/\.then\(|\bsetTimeout\b|\btimer\b|\bES20\d\d\b|\bcompiled below\b/i.test(sentence),
		)
		.filter((sentence) => !SAYS_IT_DOES_NOT_FOLLOW.test(sentence));
}

describe("otel docs claims", () => {
	for (const page of PAGES) {
		it(`T5: ${page} does not say a .then() chain, a timer or compiled-down async follows the click`, () => {
			const text = readFileSync(join(REPO_ROOT, page), "utf-8");
			expect(asyncFollowClaims(text)).toEqual([]);
		});
	}

	it("T7: the guard flags a reworded claim and passes the current wording of the limit", () => {
		const reworded =
			"A request from a `.then()` chain follows the click, not only synchronous ones.";
		expect(asyncFollowClaims(reworded), "a reworded claim is flagged").toHaveLength(1);
		const limit =
			"A request made after a native `await`, from a `.then()` callback or from a timer is in its own trace, not the click's.";
		expect(asyncFollowClaims(limit), "the limit as documented is not a claim").toEqual([]);
	});
});
