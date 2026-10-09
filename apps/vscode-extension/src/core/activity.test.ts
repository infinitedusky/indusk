import { describe, expect, it } from "vitest";
import { ACTIVITY_MAX, activityLines, addRuns, type Run, startActivity } from "./activity.js";

/**
 * vscode-extension A27: the activity section adds each run once, as it
 * arrives, newest first, and keeps a bounded number.
 *
 * promise: the-editor-shows-each-run-as-it-happens
 */

const run = (i: number, outcome: Run["outcome"] = "upheld"): Run => ({
	promise: "seats-held",
	source: "local",
	outcome,
	at: new Date(Date.UTC(2026, 9, 8, 12, 0, i)).toISOString(),
	traceId: `t-${i}`,
});

describe("activity", () => {
	it("A27 — says when no run has arrived yet", () => {
		expect(activityLines(startActivity())).toEqual(["No runs yet."]);
	});

	it("A27 — adds only runs it has not shown, newest first", () => {
		let a = addRuns(startActivity(), [run(2), run(1)]);
		a = addRuns(a, [run(3, "violated"), run(2), run(1)]);
		expect(a.runs.map((r) => r.traceId)).toEqual(["t-3", "t-2", "t-1"]);
		expect(activityLines(a)[0]).toMatch(/seats-held broke \(local\)/);
		expect(activityLines(a)[1]).toMatch(/seats-held held \(local\)/);
	});

	it("A27 — keeps a bounded number, dropping the oldest", () => {
		let a = startActivity();
		for (let i = 0; i < ACTIVITY_MAX + 20; i++) a = addRuns(a, [run(i)]);
		expect(a.runs).toHaveLength(ACTIVITY_MAX);
		expect(a.runs[0]?.traceId).toBe(`t-${ACTIVITY_MAX + 19}`);
	});
});
