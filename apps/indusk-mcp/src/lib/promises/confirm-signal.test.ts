import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	failingRun,
	noSignals,
	PLAN,
	PROMISE,
	passingRun,
	RESTING,
	registryState,
	stoppedDaemon,
	testOf,
	upheldSignals,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { confirmPlan } from "./confirm.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/upheld-by-its-signal
// clause: a-clause-is-proved-twice/no-signal-is-not-holding

/**
 * A9, A10 and the closing half of A15 of mark-first. A plan written as clauses
 * closes only when each split and limit clause's tests pass now and its signal
 * has reported it upheld in a real run, both read through inputs; the refusal
 * says which half is missing. A stopped daemon refuses, never passes. Once
 * every clause passes, the promise is enforced; a promise made only of resting
 * clauses closes when what it rests on is in force, with no row of its own.
 */

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const messages = (r: Awaited<ReturnType<typeof confirmPlan>>) =>
	r.ok ? [] : r.refusals.map((x) => x.message);

function close(p: PromiseProject, inputs: Partial<Parameters<typeof confirmPlan>[0]>) {
	return confirmPlan({ planRoot: p.planRoot, codeRoot: p.codeRoot, plan: PLAN, ...inputs });
}

describe("A9 — a plan written as clauses closes only on both halves", () => {
	it("refuses a clause whose signal never reported upheld, saying the signal is missing", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, {
			runTests: passingRun(),
			readSignals: upheldSignals("b-clause"),
		});
		expect(r.ok).toBe(false);
		const text = messages(r).join("\n");
		expect(text).toMatch(/a-promise\/b-clause/);
		expect(text).toMatch(/no signal/);
		expect(text, "the clause that reported is not refused").not.toMatch(/a-promise\/a-clause/);
		expect(registryState(fixture, PROMISE)).toBe("declared");
	});

	it("refuses every clause when nothing reported, though every test passes", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, { runTests: passingRun(), readSignals: noSignals });
		const text = messages(r).join("\n");
		expect(text).toMatch(/a-promise\/a-clause/);
		expect(text).toMatch(/a-promise\/b-clause/);
	});

	it("says which half is missing for each clause: tests for one, signal for the other", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, {
			runTests: failingRun(testOf("a-clause")),
			readSignals: upheldSignals("b-clause"),
		});
		const text = messages(r);
		expect(text.find((m) => m.includes("a-promise/a-clause"))).toMatch(/tests/);
		expect(text.find((m) => m.includes("a-promise/b-clause"))).toMatch(/signal/);
	});

	it("refuses a clause whose signal reports broken", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, {
			runTests: passingRun(),
			readSignals: async () => ({
				ok: true,
				heartbeatOk: true,
				byClause: {
					"a-clause": [{ outcome: "upheld", at: "2026-10-18T10:00:00.000Z" }],
					"b-clause": [{ outcome: "broken", at: "2026-10-18T10:00:00.000Z" }],
				},
			}),
		});
		expect(messages(r).join("\n")).toMatch(/a-promise\/b-clause.*broken/);
	});

	it("a stopped daemon refuses, naming the daemon and how to start it, never a pass", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, { runTests: passingRun(), readSignals: stoppedDaemon });
		expect(r.ok).toBe(false);
		expect(messages(r).join("\n")).toMatch(/daemon is not running.*indusk telemetry start/s);
		expect(registryState(fixture, PROMISE)).toBe("declared");
	});

	it("a plan written as clauses is refused when no test runner or signal reader is given", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, {});
		expect(r.ok).toBe(false);
		expect(messages(r).join("\n")).toMatch(/test runner|signal/);
	});
});

describe("A10 — when such a plan closes, its promise is enforced", () => {
	it("enforces the promise once every clause's tests pass and its signal reported upheld", async () => {
		fixture = clausePlanProject();
		const r = await close(fixture, { runTests: passingRun(), readSignals: upheldSignals() });
		expect(messages(r)).toEqual([]);
		expect(r.ok && r.confirmed.map((c) => c.name)).toEqual([PROMISE]);
		expect(registryState(fixture, PROMISE)).toBe("enforced");
	});
});

describe("A15 (closing half) — a promise made only of resting clauses", () => {
	it("closes when the promise it rests on is in force, with no row of its own", async () => {
		fixture = clausePlanProject({ resting: true });
		const r = await close(fixture, { runTests: passingRun(), readSignals: upheldSignals() });
		expect(messages(r)).toEqual([]);
		expect(registryState(fixture, RESTING)).toBe("enforced");
	});

	it("does not close while the promise it rests on is not in force", async () => {
		fixture = clausePlanProject({ resting: true, baseState: "declared" });
		const r = await close(fixture, { runTests: passingRun(), readSignals: upheldSignals() });
		expect(r.ok).toBe(false);
		expect(messages(r).join("\n")).toMatch(/rests-on-base/);
		expect(registryState(fixture, RESTING)).toBe("declared");
	});
});
