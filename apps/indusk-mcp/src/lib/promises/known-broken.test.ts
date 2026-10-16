import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
// The admin's and the editor's words are read by relative path: both files hold only types
// beside their values, and the states they key on are the package's.
import {
	PROMISE_HEALTH_CHIP,
	PROMISE_STATE_CHIP,
} from "../../../../indusk-admin/src/components/bars/labels.js";
import { stateIn, type View } from "../../../../vscode-extension/src/core/view.js";
import {
	behaviourPromise,
	codeFilesFor,
	openIncidentSpec,
	type PromiseSpec,
	promiseProject,
} from "../../__tests__/helpers/promises-fixture.js";
import { checkPromises, formatSummary } from "./check.js";
import { healthOf } from "./health.js";
import { fixIncident, recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import type { MarkedSpan } from "./telemetry.js";

// promise: a-promise-is-upheld-or-broken

/**
 * A4 and A5 of one-promise-language: the registry state `known-violated` is
 * `known-broken` now, and the old word on a file is read as the new one.
 * A4 is the reading: a promise file saying `known-violated`, with an open
 * incident, loads as `known-broken` and every reader of the state says so.
 * A5 is the moving: opening an incident writes `known-broken`, and fixing the
 * last open one returns a file saying either word to `enforced`.
 */

const NAME = "seats-held";
const OWNER = "seat-holds";
const OPEN = "i-2026-10-05-seats-held";

const cleanups: string[] = [];
afterEach(() => {
	for (const c of cleanups.splice(0)) rmSync(c, { recursive: true, force: true });
});

/** A project holding one behaviour promise in `state`, with one incident in `incidentStatus`. */
function project(state: string, incidentStatus: "open" | "fixed" | null = "open") {
	const fx = promiseProject({
		activePlans: [OWNER],
		promises: [
			behaviourPromise(NAME, {
				owner: OWNER,
				domain: "seating",
				state: state as PromiseSpec["state"],
				...(incidentStatus ? { incidents: [OPEN] } : {}),
			}),
		],
		incidents: incidentStatus
			? [
					openIncidentSpec(OPEN, NAME, {
						status: incidentStatus,
						rootCause: "The hold was not atomic.",
						...(incidentStatus === "fixed" ? { fixed: "2026-10-06T08:00:00Z" } : {}),
					}),
				]
			: [],
		domains: ["seating"],
		files: codeFilesFor(NAME),
	});
	cleanups.push(fx.root);
	return fx;
}

const stateOnDisk = (planRoot: string) =>
	matter(readFileSync(join(planRoot, ".indusk/promises", `${NAME}.md`), "utf-8")).data.state;

function registryOf(planRoot: string) {
	const read = readPromises(planRoot);
	expect(read.ok, "the registry reads").toBe(true);
	if (!read.ok) throw new Error("registry did not read");
	return read.registry;
}

describe("A4 — a promise file saying known-violated is read as known-broken", () => {
	it("loads with state known-broken", () => {
		const fx = project("known-violated");
		expect(registryOf(fx.planRoot).promises[0]?.state).toBe("known-broken");
	});

	it("the registry check accepts it and its summary counts it as known-broken", async () => {
		const fx = project("known-violated");
		const result = await checkPromises(fx.planRoot);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(formatSummary(result.summary)).toContain("known-broken 1");
	});

	it("its health is amber", () => {
		const fx = project("known-violated");
		const entry = registryOf(fx.planRoot).promises[0];
		if (!entry) throw new Error("no entry");
		expect(healthOf(entry, null)?.health).toBe("amber");
	});

	it("the admin's state chip and health chip say known broken", () => {
		const chips = PROMISE_STATE_CHIP as Record<string, { label: string }>;
		expect(chips["known-broken"]?.label).toBe("known broken");
		expect(PROMISE_HEALTH_CHIP.amber.label).toBe("known broken");
	});

	it("the editor's label for an amber row says known broken", () => {
		const view = {
			line: {
				sources: [
					{
						name: "local",
						ok: true,
						rows: [{ promise: NAME, state: "amber", lastSeen: null, violations: null, tests: [] }],
					},
				],
			},
			notReading: false,
		} as unknown as View;
		const source = view.line.sources[0];
		if (!source) throw new Error("no source");
		expect(stateIn(source, NAME).shown).toBe("known broken");
	});
});

describe("A5 — incidents move a promise in and out of known-broken", () => {
	const violation = (): MarkedSpan => ({
		promise: NAME,
		outcome: "violated" as MarkedSpan["outcome"],
		traceId: "a".repeat(32),
		spanId: "s1",
		service: "seat-holds",
		operation: "release",
		at: new Date("2026-10-10T09:00:00Z"),
		symptom: "seat 4 held twice",
		environment: null,
	});

	it("opening an incident on an enforced promise writes known-broken into its file", () => {
		const fx = project("enforced", null);
		const registry = registryOf(fx.planRoot);
		const promise = registry.promises[0];
		if (!promise) throw new Error("no promise");
		const change = recordViolations(
			registry,
			promise,
			[violation()],
			"local",
			new Date("2026-10-10T10:00:00Z"),
		);
		expect(change?.kind).toBe("opened");
		expect(stateOnDisk(fx.planRoot)).toBe("known-broken");
	});

	it("fixing the last open incident returns a known-broken file to enforced", () => {
		const fx = project("known-broken");
		fixIncident(registryOf(fx.planRoot), OPEN, new Date("2026-10-11T08:00:00Z"));
		expect(stateOnDisk(fx.planRoot)).toBe("enforced");
	});

	it("fixing the last open incident returns a known-violated file to enforced", () => {
		const fx = project("known-violated");
		fixIncident(registryOf(fx.planRoot), OPEN, new Date("2026-10-11T08:00:00Z"));
		expect(stateOnDisk(fx.planRoot)).toBe("enforced");
	});
});
