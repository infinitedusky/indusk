import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { readPlanParts } from "../lib/plans/parts.js";
import type { PromiseHealth, SourceHealthRead } from "../lib/promises/health.js";
import { planPromiseHealth, redPlans } from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
import type { MarkedSpan, MarkedSpansResult } from "../lib/promises/telemetry.js";
import { behaviourPromise, codeFilesFor, promiseProject } from "./helpers/promises-fixture.js";

// promise: a-promise-reads-the-same-on-its-plan-page

/**
 * A plan's parts carry each promise's health, read from the alarm source the
 * nav's red dot reads. The pages are not started: the parts are read from a
 * fixture project and handed health from fake source reads, through the
 * package's `planPromiseHealth` — the answer the nav's red dot reads.
 */

const PLAN = "plan-under-test";
const PROMISE = "seats-held";
const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 12, min));

const BRIEF = `---
title: "Plan under test"
status: accepted
workflow: feature
---

# Plan under test

## Expectations

1. **Seats are held.**
   - Measure: no seat is held twice
   - Look: at the next hold

## Promises

### This plan makes

1. **\`${PROMISE}\`** (behaviour). A seat is never held by two players at once.

### Existing promises

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

## Looks

None — no screen changes.
`;

const span = (outcome: "upheld" | "violated", min: number, id: string): MarkedSpan =>
	({
		promise: PROMISE,
		outcome,
		traceId: id,
		spanId: `s-${id}`,
		service: "seat-holds",
		operation: "hold",
		at: at(min),
		symptom: outcome === "violated" ? "held twice" : null,
		environment: "production",
	}) as MarkedSpan;

function marksOf(kind: "broken" | "holding"): MarkedSpansResult {
	return {
		queryUrl: "http://fake",
		since: at(0),
		byPromise: new Map([
			[
				PROMISE,
				kind === "broken"
					? { violations: [span("violated", 20, "t1")], truncated: false, lastUpheld: undefined }
					: { violations: [], truncated: false, lastUpheld: span("upheld", 10, "u1") },
			],
		]),
	} as MarkedSpansResult;
}

const read = (name: "local" | "production", kind: "broken" | "holding"): SourceHealthRead => ({
	name,
	label: name,
	ok: true,
	at: at(30).toISOString(),
	marks: marksOf(kind),
});

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function project() {
	const p = promiseProject({
		domains: ["demo"],
		activePlans: [PLAN],
		planFiles: { [`${PLAN}/brief.md`]: BRIEF },
		promises: [behaviourPromise(PROMISE, { owner: PLAN, domain: "demo" })],
		files: codeFilesFor(PROMISE),
	});
	roots.push(p.root);
	const registry = readPromises(p.planRoot);
	if (!registry.ok) throw new Error("fixture registry did not read");
	return { root: p.root, registry: registry.registry };
}

const partsWith = (root: string, health: Record<string, PromiseHealth>) =>
	readPlanParts(root, PLAN, { health });

describe("A1 — a break nobody has recorded is broken on the plan's parts", () => {
	// clause: a-promise-reads-the-same-on-its-plan-page/broken-reads-broken
	it("A1 an enforced behaviour promise with a live break carries health red", async () => {
		const { root, registry } = project();
		const reads = [read("local", "broken")];
		const health = planPromiseHealth(registry, reads);
		expect(health[PROMISE], "the nav's own answer for the fixture").toBe("red");
		const parts = await partsWith(root, health);
		expect(parts.promises.find((p) => p.name === PROMISE)?.health).toBe("red");
	});
});

describe("A3 — the plan's parts read health as the nav's red dot does", () => {
	// clause: a-promise-reads-the-same-on-its-plan-page/no-rule-of-its-own
	it("A3 a laptop break beside a production that holds does not turn the plan red", async () => {
		const { root, registry } = project();
		const reads = [read("local", "broken"), read("production", "holding")];
		expect(redPlans(registry, reads).has(PLAN), "the nav's red dot for the plan").toBe(false);
		const parts = await partsWith(root, planPromiseHealth(registry, reads));
		expect(parts.promises.find((p) => p.name === PROMISE)?.health).toBe("green");
	});
});

describe("A4 — a promise only the plan's checkout registers reads no signal, not green", () => {
	// clause: a-promise-reads-the-same-on-its-plan-page/each-health-alike
	it("A4 an enforced behaviour promise absent from the trunk's registry is unverified", async () => {
		const { root, registry: checkout } = project();
		// The trunk has not merged the plan's branch: it lacks the promise.
		const trunk = { ...checkout, promises: checkout.promises.filter((p) => p.name !== PROMISE) };
		const extra = checkout.promises.filter((p) => !trunk.promises.some((t) => t.name === p.name));
		// The alarm source answers and holds, with no marks for this promise.
		const silent: SourceHealthRead = {
			...read("production", "holding"),
			marks: { queryUrl: "http://fake", since: at(0), byPromise: new Map() } as MarkedSpansResult,
		};
		const health = planPromiseHealth(trunk, [silent], extra);
		const parts = await partsWith(root, health);
		expect(parts.promises.find((p) => p.name === PROMISE)?.health).toBe("unverified");
	});
});

describe("A6 — a promise the branch changes to a behaviour promise reads no signal, not green", () => {
	// clause: a-promise-reads-the-same-on-its-plan-page/each-health-alike
	it("A6 a state promise on the trunk, behaviour on the branch, is unverified", async () => {
		const { root, registry: checkout } = project();
		// The trunk still has the promise as a state promise: it gives it no health.
		const trunk = {
			...checkout,
			promises: checkout.promises.map((p) =>
				p.name === PROMISE ? { ...p, kind: "state" as const } : p,
			),
		};
		const silent: SourceHealthRead = {
			...read("production", "holding"),
			marks: { queryUrl: "http://fake", since: at(0), byPromise: new Map() } as MarkedSpansResult,
		};
		const health = planPromiseHealth(trunk, [silent], checkout.promises);
		const parts = await partsWith(root, health);
		expect(parts.promises.find((p) => p.name === PROMISE)?.health).toBe("unverified");
	});
});

describe("A7 — the nav's red dot sees a promise only the plan's branch registers", () => {
	// clause: a-promise-reads-the-same-on-its-plan-page/no-rule-of-its-own
	it("A7 a branch-only behaviour promise broken in the alarm source marks its plan red, as on its page", () => {
		const { registry: checkout } = project();
		const trunk = { ...checkout, promises: checkout.promises.filter((p) => p.name !== PROMISE) };
		const reads = [read("production", "broken")];
		expect(planPromiseHealth(trunk, reads, checkout.promises)[PROMISE], "the plan page").toBe("red");
		expect(redPlans(trunk, reads, checkout.promises).has(PLAN), "the nav's red dot").toBe(true);
	});
});
