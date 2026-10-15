import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildReview } from "../lib/build/review.js";
import { briefText } from "./helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";

// promise: approval-is-of-the-brief

/**
 * brief-as-the-contract A10: the review shows the test plan, the ADR and the
 * impl as evidence beside the approval, and asks for no separate sign-off on
 * them. Through the package's `buildReview` over a plan built on its own
 * branch: the evidence group names each document the plan has, in that order,
 * and carries no field a sign-off could be recorded in.
 */

const PLAN = "seat-holds";
const planDir = `.indusk/planning/${PLAN}`;

const IMPL = `---
title: "${PLAN}"
status: completed
---

# ${PLAN}

### Build Phase 1: Seats

- [x] build seats
`;

let p: PlanLifecycleProject;
let wt: string;
beforeEach(() => {
	p = planLifecycleProject("review-evidence");
	wt = p.makeWorktree(PLAN);
	p.commit(
		wt,
		{
			[`${planDir}/brief.md`]: briefText(PLAN, { makes: [] }),
			[`${planDir}/test-plan.md`]: "# Test plan\n",
			[`${planDir}/adr.md`]: "# ADR\n",
			[`${planDir}/impl.md`]: IMPL,
		},
		"the build",
	);
});
afterEach(() => p.cleanup());

describe("A10 — the other documents are evidence at review", () => {
	it("A10 the review shows the other documents as evidence, with no sign-off on them", async () => {
		const review = await buildReview(p.trunk, PLAN);
		expect(review.evidence.map((e) => e.document)).toEqual(["test-plan", "adr", "impl"]);
		expect(review.evidence.every((e) => (e as { signoff?: unknown }).signoff === undefined)).toBe(
			true,
		);
	});
});
