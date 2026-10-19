import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { briefText, implText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "../../__tests__/helpers/promises-fixture.js";
import { confirmPlan } from "./confirm.js";

// promise: a-closed-plan-kept-its-promises

/**
 * A25 of mark-first, a regression guard: a plan written before clause plans
 * closes on passing tests that name its promises, and is never asked for a
 * signal. This passes today and must keep passing once closing starts reading
 * the daemon for plans written as clauses.
 */

const PLAN = "seats-v1";
const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const TEST = "src/seat-release.test.ts";
const SITE = "src/seat-release.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

describe("A25 — a plan with no clauses closes on passing tests alone", () => {
	it("is confirmed with no signal asked of it", async () => {
		fixture = promiseProject({
			domains: ["seating"],
			promises: [
				{
					name: NAME,
					kind: "state",
					state: "declared",
					domain: "seating",
					owner: PLAN,
					statement: SENTENCE,
				},
			],
			planFiles: {
				[`${PLAN}/brief.md`]: briefText(PLAN, { makes: [{ name: NAME, sentence: SENTENCE }] }),
				[`${PLAN}/impl.md`]: implText(PLAN, {
					keys: ["test_purpose: required"],
					columns: ["For", "Test"],
					rows: [{ state: "passing", cells: { For: `promise: ${NAME}`, Test: TEST } }],
				}),
			},
			files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) },
		});
		const closed = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
		});
		if (!closed.ok) throw new Error(closed.refusals.map((r) => r.message).join("\n"));
		expect(closed.confirmed.map((c) => c.name)).toEqual([NAME]);
	});
});
