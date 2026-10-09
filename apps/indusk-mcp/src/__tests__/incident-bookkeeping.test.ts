import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isBookkeeping } from "../lib/plans/bookkeeping.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { implText } from "./helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * incident-recording A24 — promise: indusk-leaves-main-clean.
 *
 * Recording writes incident files on the trunk; they are InDusk's, like
 * `current.md` and the lessons, and nothing InDusk writes is left
 * uncommitted. So an incident counts as bookkeeping, and a landing that finds
 * one uncommitted on the trunk commits it with the rest and leaves the trunk
 * clean. (The other half — `watch` by hand committing what it wrote — is
 * A2's, in Build Phase 1, where the writer exists.)
 *
 * Red today: `isBookkeeping` does not know the incidents directory, and the
 * landing leaves the incident uncommitted.
 */

const PLAN = "seat-holds";
const INCIDENT = ".indusk/promises/incidents/i-2026-10-08-seat-released.md";

describe("A24 — an incident file is InDusk's bookkeeping", () => {
	it("isBookkeeping says so", () => {
		expect(isBookkeeping(INCIDENT)).toBe(true);
		expect(isBookkeeping(".indusk/promises/seat-released.md")).toBe(false);
	});
});

let p: PlanLifecycleProject;
let wt: string;
beforeEach(() => {
	p = planLifecycleProject("incident-bookkeeping");
	wt = p.makeWorktree(PLAN);
	p.commit(
		wt,
		{
			[`.indusk/planning/${PLAN}/impl.md`]: implText(PLAN, {
				status: "completed",
				rows: [{ state: "passing" }],
			}),
			"src/seat.ts": "export const seat = 1;\n",
		},
		"the build",
	);
});
afterEach(() => p.cleanup());

describe.skipIf(SHOULD_SKIP)("A24 — a landing commits an incident left on the trunk", () => {
	it("lands, and leaves no incident uncommitted", () => {
		mkdirSync(join(p.trunk, ".indusk", "promises", "incidents"), { recursive: true });
		writeFileSync(
			join(p.trunk, INCIDENT),
			"---\nid: i-2026-10-08-seat-released\npromise: seat-released\nsource: deployed\nstatus: open\n---\n",
		);
		expect(runCli(p.trunk, ["plans", "accept", PLAN]).code).toBe(0);
		const r = runCli(p.trunk, ["plans", "land", PLAN]);
		expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
		expect(git(p.trunk, ["status", "--porcelain"])).toBe("");
		expect(git(p.trunk, ["log", "--format=%s", "main"])).toMatch(/bookkeeping/);
	});
});
