// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { briefText } from "./helpers/plan-fixture.js";
import { type PlanLifecycleProject, planLifecycleProject } from "./helpers/plan-lifecycle-fixture.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, startLocalJaeger } from "./helpers/local-jaeger.js";

/**
 * a-run-can-be-trusted A86: `indusk plans accept-brief` run as a process, on a branch
 * behind main, against a local Jaeger, delivers the `main-is-merged-first` span before the
 * process exits. A short-lived command that exits before its exporter flushes reports
 * nothing; this is the test that a real process does. System tier: it starts Jaeger and
 * the command line.
 *
 * Today accepting a brief reports no clause, so no span ever carries the clause and the
 * poll below ends on its own assertion.
 */

const PLAN = "seat-holds";
const CLAUSE = "main-is-merged-first";

let jaeger: LocalJaeger;
let p: PlanLifecycleProject;
beforeAll(async () => {
	jaeger = await startLocalJaeger();
	p = planLifecycleProject("accept-brief-signals-contract");
}, 120_000);
afterAll(() => {
	jaeger?.stop();
	p?.cleanup();
});

/** The traces Jaeger holds for the command's service that carry the clause tag. */
async function tracesWithClause(): Promise<number> {
	const url = `${jaeger.queryUrl}/api/traces?service=indusk&limit=20&lookback=1h&tags=${encodeURIComponent(
		JSON.stringify({ "indusk.clause": CLAUSE }),
	)}`;
	const res = await fetch(url);
	if (!res.ok) return 0;
	const body = (await res.json()) as { data?: unknown[] };
	return body.data?.length ?? 0;
}

describe.skipIf(SHOULD_SKIP)("A86 — accepting a brief from the command line delivers its signal", () => {
	it("a span for main-is-merged-first is in Jaeger after the process has exited", async () => {
		const wt = p.makeWorktree(PLAN);
		p.commit(
			wt,
			{
				[`.indusk/planning/${PLAN}/brief.md`]: briefText(PLAN).replace(
					"status: accepted",
					"status: draft",
				),
			},
			"the brief",
		);
		p.commit(p.trunk, { "other.txt": "main moved\n" }, "main moves");

		const r = runCli(p.trunk, ["plans", "accept-brief", PLAN], {
			INDUSK_HOME: jaeger.home,
			// acceptance is refused inside a build step; this process is the person's command
			INDUSK_BUILD_STEP: undefined,
		});
		expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);

		// Jaeger stores in batches: poll after the process is gone.
		let found = 0;
		for (const deadline = Date.now() + 20_000; found === 0 && Date.now() < deadline; ) {
			found = await tracesWithClause();
			if (found === 0) await new Promise((res) => setTimeout(res, 500));
		}
		expect(found, `no span carrying indusk.clause=${CLAUSE} reached Jaeger`).toBeGreaterThan(0);
	}, 90_000);
});
