// clause: a-new-project-reports-from-its-first-run/the-spans-reach-the-daemon
//
// a-new-project-starts-instrumented, Test Phase 1: T6 - nothing InDusk hands an
// application tells it to send to port 4318. The daemon holds InDusk's own block now
// (daemon-found-not-guessed), so 4318 stays with a person's other collectors and with a
// recording server. Read: the templates, the skills, the demo's README, the docs pages on
// setting up an app, this repository's own allow-list. Not read: tests (their fixtures
// set the variable to a fake collector), archived plans, plan documents, incidents, the
// changelog and the code graph. The recording server's files name no such address today.
import { describe, expect, it } from "vitest";
import { describeHits, trackedLinesMatching } from "./helpers/tracked-lines.js";

const STANDARD_PORT = "localhost:4318";

const NOT_HANDED_TO_AN_APP = (rel: string) =>
	rel.includes("/archive/") ||
	rel.startsWith(".indusk/planning/") ||
	rel.startsWith(".indusk/promises/incidents/") ||
	rel.startsWith(".indusk/graph/") ||
	rel === "apps/docs/src/changelog.md" ||
	/\.test\.ts$/.test(rel);

describe("app-port-4318-gone", () => {
	it("T6: nothing InDusk hands an application tells it to send to the standard port", () => {
		const hits = trackedLinesMatching(STANDARD_PORT, NOT_HANDED_TO_AN_APP);
		expect(describeHits(hits)).toEqual([]);
	});
});
