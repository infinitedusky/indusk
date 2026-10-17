// clause: a-new-project-reports-from-its-first-run/the-service-is-named
//
// a-new-project-starts-instrumented, Test Phase 1: T4 - the placeholder service name of
// the old templates is gone from the repository. Plan documents, archived plans,
// incidents and the changelog keep the record of what was; every other tracked file
// (init, the templates, the skills, the docs) is read.
import { describe, expect, it } from "vitest";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { describeHits, trackedLinesMatching } from "./helpers/tracked-lines.js";

// Joined, so this file does not contain the word it looks for.
const PLACEHOLDER = ["unknown", "service"].join("-");

const KEEPS_THE_RECORD = (rel: string) =>
	rel.includes("/archive/") ||
	rel.startsWith(".indusk/planning/") ||
	rel.startsWith(".indusk/promises/incidents/") ||
	rel === "apps/docs/src/changelog.md";

describe.skipIf(SHOULD_SKIP)("unknown-service-gone", () => {
	it("T4: no tracked file outside archived plans, plan documents, incidents and the changelog names the placeholder service", () => {
		const hits = trackedLinesMatching(PLACEHOLDER, KEEPS_THE_RECORD);
		expect(describeHits(hits)).toEqual([]);
	});
});
