import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, newTraceId, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	type PromiseSpec,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * day-monitor — the plan tools' halves of A14 and A16–A19.
 *
 * A14: after `watch` opens an incident, the promise's archived owner is
 * reopened — `list_plans` lists it active with a Maintenance phase naming the
 * incident. A16–A19: `monitor` is derived from files (ADR D8) — a landing
 * date, incidents' `last_seen`, and the quiet window (default 7 days). Dates
 * are relative to the real clock, so no clock is injected: "closed 2 days
 * ago" is `monitor` on any day the suite runs.
 *
 * The `monitor` field these rows fix: `{ windowDays, elapsedDays, restartedAt }`
 * on a plan whose stage is `monitor`; `restartedAt` is null unless a violation
 * restarted the window.
 *
 * Red today: `list_plans` and `get_plan_status` read only `planning/`, never
 * the archive, so no archived plan appears at all. A19 is a regression guard
 * and passes now.
 */

const PROMISE = "seat-never-double-booked";
const OWNER = "lab-v0";

type Plan = {
	name: string;
	stage?: string;
	monitor?: { windowDays: number; elapsedDays: number; restartedAt: string | null };
};

const LEGACY_IMPL = `---
title: "${OWNER}"
status: completed
---

# ${OWNER}

## Checklist

### Phase 1: Seats

- [x] Hold a seat atomically

#### Phase 1 Verification

- [x] The seat tests pass

#### Phase 1 Context

- [x] Noted in CLAUDE.md

#### Phase 1 Document

- [x] The seats page
`;

function behaviour(extra: Partial<PromiseSpec> = {}): PromiseSpec {
	return {
		name: PROMISE,
		kind: "behaviour",
		state: "enforced",
		domain: "seating",
		owner: OWNER,
		sites: [`src/${PROMISE}.ts`],
		tests: [`src/${PROMISE}.test.ts`],
		...extra,
	};
}

const FILES = {
	[`src/${PROMISE}.ts`]: siteFile(PROMISE),
	[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
};

async function listPlans(root: string, active: boolean): Promise<Plan[]> {
	const { json } = await toolCaller((server) => registerPlanTools(server, root)).call(
		"list_plans",
		active ? { active: true } : {},
	);
	return active ? (json as { active: Plan[] }).active : (json as Plan[]);
}

const projects: PromiseProject[] = [];
function project(
	landedDaysAgo: number,
	opts: { promise?: PromiseSpec; lastSeenDaysAgo?: number } = {},
) {
	const id = `i-${daysAgo(opts.lastSeenDaysAgo ?? 0)}-${PROMISE}`;
	const withIncident = opts.lastSeenDaysAgo !== undefined;
	const p = promiseProject({
		domains: ["seating"],
		landed: { [OWNER]: daysAgo(landedDaysAgo) },
		planFiles: { [`archive/${OWNER}/impl.md`]: LEGACY_IMPL },
		promises: [
			opts.promise ?? behaviour(withIncident ? { state: "known-violated", incidents: [id] } : {}),
		],
		incidents: withIncident
			? [
					{
						id,
						promise: PROMISE,
						source: "local",
						status: "open",
						date: daysAgo(opts.lastSeenDaysAgo ?? 0),
						rootCause: "_Unwritten — a person writes this._",
					},
				]
			: [],
		files: FILES,
	});
	if (withIncident) {
		// ADR D6's `last_seen`, which the fixture's incident writer does not carry.
		const path = join(p.planRoot, ".indusk", "promises", "incidents", `${id}.md`);
		const text = readFileSync(path, "utf-8").replace(
			/^status: open$/m,
			`status: open\nlast_seen: '${daysAgo(opts.lastSeenDaysAgo ?? 0)}T12:00:00Z'`,
		);
		writeFileSync(path, text);
	}
	projects.push(p);
	return p;
}

afterAll(() => {
	for (const p of projects) rmSync(p.root, { recursive: true, force: true });
});

describe("A16–A19 — monitor, derived from files", () => {
	it("A16 — closed 2 days ago holding a behaviour promise: `monitor`, with the window's elapsed share", async () => {
		const p = project(2);
		const plan = (await listPlans(p.root, true)).find((x) => x.name === OWNER);
		expect(plan, `${OWNER} in the active list`).toBeDefined();
		expect(plan?.stage).toBe("monitor");
		expect(plan?.monitor?.windowDays).toBe(7);
		expect(plan?.monitor?.elapsedDays).toBeGreaterThanOrEqual(1);
		expect(plan?.monitor?.elapsedDays).toBeLessThanOrEqual(3);
		expect(plan?.monitor?.restartedAt).toBeNull();
	});

	it("A17 — closed 10 days ago with no violation since: archived, not monitor", async () => {
		const p = project(10);
		expect((await listPlans(p.root, true)).some((x) => x.name === OWNER)).toBe(false);
		// Positive half: asked by name, the plan is judged, and judged archived.
		const { json, isError } = await toolCaller((server) => registerPlanTools(server, p.root))
			.call("get_plan_status", { name: OWNER })
			.catch((err: Error) => ({ json: { threw: err.message }, isError: true }));
		expect(isError, JSON.stringify(json)).toBe(false);
		expect((json as Plan).stage).toBe("archived");
	});

	it("A18 — a violation during the window keeps it in monitor from the violation, and says it restarted", async () => {
		const p = project(10, { lastSeenDaysAgo: 1 });
		const plan = (await listPlans(p.root, true)).find((x) => x.name === OWNER);
		expect(plan?.stage).toBe("monitor");
		expect(plan?.monitor?.restartedAt).toMatch(new RegExp(`^${daysAgo(1)}`));
		expect(plan?.monitor?.elapsedDays).toBeLessThanOrEqual(2);
	});

	it("A19 — a plan holding no behaviour promise never reads monitor", async () => {
		const p = project(2, {
			promise: {
				name: PROMISE,
				kind: "state",
				state: "enforced",
				domain: "seating",
				owner: OWNER,
				statement: "A table's seat count equals the seats stored for it.",
				sites: [`src/${PROMISE}.ts`],
				tests: [`src/${PROMISE}.test.ts`],
			},
		});
		for (const active of [true, false]) {
			for (const plan of await listPlans(p.root, active)) {
				expect(plan.stage, plan.name).not.toBe("monitor");
			}
		}
	});
});

describe.skipIf(SHOULD_SKIP)("A14 — a violation reopens the archived owner (tools half)", () => {
	let jaeger: LocalJaeger;
	let p: PromiseProject;
	let incidentId = "";

	beforeAll(async () => {
		jaeger = await startLocalJaeger();
		p = project(3);
		await jaeger.load([
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: newTraceId(),
			},
		]);
		runCli(p.root, ["promises", "watch"], { INDUSK_HOME: jaeger.home });
		const dir = join(p.planRoot, ".indusk", "promises", "incidents");
		incidentId = (() => {
			try {
				return (
					readdirSync(dir)
						.find((n) => n.includes(PROMISE))
						?.replace(/\.md$/, "") ?? ""
				);
			} catch {
				return "";
			}
		})();
	}, 90_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
	});

	it("list_plans lists the owner active, with a Maintenance phase naming the incident", async () => {
		expect(incidentId, "watch opened an incident").not.toBe("");
		const impl = readFileSync(
			join(p.planRoot, ".indusk", "planning", "archive", OWNER, "impl.md"),
			"utf-8",
		);
		expect(impl).toMatch(new RegExp(`^### Build Phase \\d+: Maintenance — ${incidentId}$`, "m"));
		const plan = (await listPlans(p.root, true)).find((x) => x.name === OWNER);
		expect(plan, `${OWNER} reopened into the active list`).toBeDefined();
		expect(JSON.stringify(plan)).toContain(`Maintenance — ${incidentId}`);
	});
});
