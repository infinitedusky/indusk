import { describe, expect, it } from "vitest";
import {
	otherTestRuns,
	SUITE_PROMISE,
	sendSuiteMark,
	suiteSpanAttributes,
	suiteSpeedMark,
	THRESHOLD_MS,
} from "../../scripts/suite-speed.js";

/**
 * promise: everyday-suite-stays-fast — test-kinds A16, A17.
 *
 * Each everyday run is marked held or broken with how long it took; a slow run
 * fails nothing; a run that overlapped another is not judged; with no daemon,
 * nothing is marked and the reason is said. The daemon and the sender are
 * passed in, so none of this needs a daemon or a wait
 * (lesson: a-suites-speed-is-a-promise-not-a-gate).
 */

describe("everyday-suite-stays-fast — test-kinds A16, A17", () => {
	it("A16: under the threshold is held, at or over it is broken, and an overlapping run is not judged", () => {
		expect(suiteSpeedMark({ durationMs: 54_000, overlapped: false })).toEqual({
			outcome: "upheld",
			durationMs: 54_000,
		});
		expect(suiteSpeedMark({ durationMs: THRESHOLD_MS, overlapped: false }).outcome).toBe(
			"violated",
		);
		expect(suiteSpeedMark({ durationMs: 300_000, overlapped: true })).toEqual({
			skip: expect.stringMatching(/overlapped/),
		});
	});

	it("A17: a slow run is sent as a violation of the promise, in this project, with its duration", async () => {
		const sent: Array<{ intake: string; attrs: Record<string, unknown> }> = [];
		const said = await sendSuiteMark(
			"/repo",
			suiteSpeedMark({ durationMs: 130_000, overlapped: false }),
			{
				status: async () => ({ running: true, otlpPort: 4318 }),
				project: () => "dusk",
				body: (_name, attrs) => ({ body: attrs }),
				send: async (intake, body) => {
					sent.push({ intake, attrs: body as Record<string, unknown> });
				},
			},
		);
		expect(sent).toEqual([
			{
				intake: "http://localhost:4318",
				attrs: {
					"indusk.promise": SUITE_PROMISE,
					"indusk.promise.outcome": "violated",
					"indusk.suite.duration_ms": 130_000,
					"indusk.project": "dusk",
				},
			},
		]);
		expect(said, "lesson: a-suites-speed-is-a-promise-not-a-gate").toMatch(
			/marked .* violated \(130 s\)/,
		);
	});

	it("A16: with no daemon nothing is marked and the reason is said; a failing sender never throws", async () => {
		const mark = suiteSpeedMark({ durationMs: 50_000, overlapped: false });
		const noDaemon = await sendSuiteMark("/repo", mark, {
			status: async () => ({ running: false }),
			project: () => "dusk",
			body: () => ({ body: {} }),
			send: async () => {},
		});
		expect(noDaemon).toBe("not marked: no telemetry daemon is running");
		const refused = await sendSuiteMark("/repo", mark, {
			status: async () => ({ running: true, otlpPort: 4318 }),
			project: () => "dusk",
			body: () => ({ body: {} }),
			send: async () => {
				throw new Error("http://localhost:4318/v1/traces refused the span (500)");
			},
		});
		expect(refused).toMatch(/^not marked: .*refused the span/);
	});

	it("the attributes are the promise vocabulary every reader uses", () => {
		expect(Object.keys(suiteSpanAttributes({ outcome: "upheld", durationMs: 1 }, "p"))).toEqual([
			"indusk.promise",
			"indusk.promise.outcome",
			"indusk.suite.duration_ms",
			"indusk.project",
		]);
	});

	it("an overlapping run is another vitest process — not a shell that names the word, not this run's own", () => {
		const ps = [
			{ pid: 1, ppid: 0, command: "/sbin/launchd" },
			{
				pid: 10,
				ppid: 1,
				command: "zsh -c while pgrep -f vitest >/dev/null; do sleep 3; done; pnpm test",
			},
			{
				pid: 11,
				ppid: 10,
				command:
					"node apps/indusk-mcp/scripts/with-daemon-guard.js --mark everyday-suite-stays-fast",
			},
			{ pid: 12, ppid: 11, command: "node /repo/node_modules/vitest/vitest.mjs run" },
			{
				pid: 20,
				ppid: 1,
				command: "node /wt/node_modules/.pnpm/vitest@4/node_modules/vitest/vitest.mjs run src/x",
			},
			{ pid: 21, ppid: 20, command: "node /wt/node_modules/vitest/dist/workers/forks.js" },
		];
		expect(
			otherTestRuns(ps, 11).map((p) => p.pid),
			"the evaluator's run and its worker",
		).toEqual([12, 20, 21]);
		expect(otherTestRuns(ps.slice(0, 4), 12), "this run, seen from inside it").toEqual([]);
	});
});
