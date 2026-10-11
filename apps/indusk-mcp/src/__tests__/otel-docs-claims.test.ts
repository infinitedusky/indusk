// What the OpenTelemetry docs say the browser template does about async handlers.
// browser-template-claims T5: the reference page said a `.then()` chain compiled
// below ES2017 follows the click; the shipped template installs no async-aware
// context manager, so nothing but a request made synchronously in the handler does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

const PAGES = ["apps/docs/src/reference/tools/otel.md", "apps/indusk-mcp/extensions/otel/skill.md"];

/** Sentences (split on . ! ? and newlines) that tie a deferred call to following the click. */
function asyncFollowClaims(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+|\n+/)
		.filter((sentence) => /\bfollows? the click\b|\bin the click's trace\b/i.test(sentence))
		.filter((sentence) =>
			/\.then\(|\bsetTimeout\b|\btimer\b|\bES20\d\d\b|\bcompiled below\b/i.test(sentence),
		)
		.filter((sentence) => !/\b(not|never|no)\b|its own trace|outside the click/i.test(sentence));
}

describe("otel docs claims", () => {
	for (const page of PAGES) {
		it(`T5: ${page} does not say a .then() chain, a timer or compiled-down async follows the click`, () => {
			const text = readFileSync(join(REPO_ROOT, page), "utf-8");
			expect(asyncFollowClaims(text)).toEqual([]);
		});
	}
});
