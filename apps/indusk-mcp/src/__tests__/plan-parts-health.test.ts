import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { readPlanParts } from "../lib/plans/parts.js";
import type { PromiseHealth, SourceHealthRead } from "../lib/promises/health.js";
import { alarmRead, healthRows, redPlans } from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
import type { MarkedSpan, MarkedSpansResult } from "../lib/promises/telemetry.js";
import { behaviourPromise, codeFilesFor, promiseProject } from "./helpers/promises-fixture.js";

// promise: a-promise-reads-the-same-on-its-plan-page

/**
 * A plan's parts carry each promise's health, read from the alarm source the
 * nav's red dot reads. The pages are not started: the parts are read from a
 * fixture project and handed health from fake source reads. `readPlanParts`
 * takes a `health` option and `PartPromise` a `health` field only once the
 * build phase lands, so both are reached here through a cast.
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

/** The health the nav reads for each promise: the alarm source's rows, by name. */
function alarmHealth(
	registry: ReturnType<typeof project>["registry"],
	reads: SourceHealthRead[],
): Record<string, PromiseHealth> {
	const rows = healthRows(registry, alarmRead(reads) ?? null);
	return Object.fromEntries(Object.entries(rows).map(([name, row]) => [name, row.health]));
}

type WithHealth = { promises: Array<{ name: string; health?: PromiseHealth }> };
const partsWith = (root: string, health: Record<string, PromiseHealth>) =>
	(
		readPlanParts as unknown as (
			root: string,
			plan: string,
			options: { health: Record<string, PromiseHealth> },
		) => Promise<WithHealth>
	)(root, PLAN, { health });

describe("A1 — a break nobody has recorded is broken on the plan's parts", () => {
	// clause: a-promise-reads-the-same-on-its-plan-page/broken-reads-broken
	it("A1 an enforced behaviour promise with a live break carries health red", async () => {
		const { root, registry } = project();
		const reads = [read("local", "broken")];
		const health = alarmHealth(registry, reads);
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
		const parts = await partsWith(root, alarmHealth(registry, reads));
		expect(parts.promises.find((p) => p.name === PROMISE)?.health).toBe("green");
	});
});
