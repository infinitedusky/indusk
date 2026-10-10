import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanProjectOptions,
	type IncidentSpec,
	type PromiseProject,
	promiseProject,
} from "../../__tests__/helpers/promises-fixture.js";
import { openIncidentLines } from "../../bin/commands/promises.js";
import { checkPromises } from "./check.js";
import { openIncidents } from "./health.js";
import { recorded, violationState } from "./incidents.js";
import { readPromises } from "./registry.js";

/**
 * release-records-its-failures, Build Phase 3: an incident a release opens
 * (ADR D7) carries `tests:` and `release:` where a watcher's carries
 * `traces:`. Every reader of incidents is held to that shape here, through a
 * fixture incident of the new kind.
 *
 * promise: an-open-incident-stays-loud
 */

const ID = "i-2026-10-10-impact-events-are-strikes";

/** The fixture's known-violated promise, held by a release's incident instead of a smoke one. */
const RELEASE_INCIDENT: IncidentSpec = {
	id: ID,
	promise: "impact-events-are-strikes",
	source: "release",
	status: "open",
	date: "2026-10-10",
	opened: "2026-10-10T04:00:00Z",
	lastSeen: "2026-10-10T04:00:00Z",
	tests: ["src/strikes.test.ts > counts a strike"],
	release: ["1.4.0 at 3fa2c1d"],
	symptom: "Release 1.4.0: src/strikes.test.ts still failed after its rerun (counts a strike).",
	rootCause: "_Unwritten — a person writes this._",
	fix: "_Not yet fixed._",
};

const projects: PromiseProject[] = [];
afterEach(() => {
	for (const p of projects.splice(0)) rmSync(p.root, { recursive: true, force: true });
});

function releaseIncidentProject(): PromiseProject {
	const o = cleanProjectOptions();
	o.promises = (o.promises ?? []).map((p) =>
		p.name === "impact-events-are-strikes" ? { ...p, incidents: [ID] } : p,
	);
	o.incidents = [RELEASE_INCIDENT];
	const p = promiseProject(o);
	projects.push(p);
	return p;
}

describe("an incident with tests: and no traces:", () => {
	it("passes `promises check`: `release` is an incident source", async () => {
		const p = releaseIncidentProject();
		const result = await checkPromises(p.root);
		expect(result.ok, JSON.stringify(result)).toBe(true);
	});

	it("is read by the registry with its tests and release, and no traces", () => {
		const p = releaseIncidentProject();
		const read = readPromises(p.root);
		if (!read.ok) throw new Error(JSON.stringify(read));
		const incident = read.registry.incidents.find((i) => i.id === ID);
		expect(incident).toEqual(
			expect.objectContaining({
				source: "release",
				traces: [],
				tests: ["src/strikes.test.ts > counts a strike"],
				release: ["1.4.0 at 3fa2c1d"],
			}),
		);
		expect(incident?.symptom).toContain("Release 1.4.0");
	});

	it("leaves the trace readers with nothing to count: recorded() and violationState", () => {
		const p = releaseIncidentProject();
		const read = readPromises(p.root);
		if (!read.ok) throw new Error(JSON.stringify(read));
		const incident = read.registry.incidents.find((i) => i.id === ID);
		expect(recorded(join(read.registry.dir, incident?.file ?? ""))).toEqual({
			traces: [],
			lastSeen: "2026-10-10T04:00:00Z",
		});
		expect(violationState("any-trace", read.registry.incidents)).toBe("unrecorded");
	});

	it("is an open incident with its age and owner, as `promises status` and promise_health say it", () => {
		const p = releaseIncidentProject();
		const read = readPromises(p.root);
		if (!read.ok) throw new Error(JSON.stringify(read));
		const now = new Date("2026-10-12T04:00:00Z");
		const open = openIncidents(p.root, read.registry, now);
		expect(open).toEqual([
			expect.objectContaining({
				id: ID,
				promise: "impact-events-are-strikes",
				owner: "lab-v0",
				ageMs: 2 * 86_400_000,
			}),
		]);
		expect(openIncidentLines(open)[0]).toMatch(
			new RegExp(`^open incident ${ID} — impact-events-are-strikes, open 2 days; lab-v0`),
		);
	});
});
