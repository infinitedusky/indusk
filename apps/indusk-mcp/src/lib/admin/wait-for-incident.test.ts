// clause: landing-tests-hold-under-load/recorder-waits-for-its-break
// lesson: everyday-tests-never-wait
import { describe, expect, it } from "vitest";
import { INCIDENT_WAIT_UPPER_BOUND_MS, waitForIncident } from "./wait-for-incident.js";

/**
 * a-run-can-be-trusted A60, A62: the recorder test's waiting rule, decided from a fake clock
 * and fake reads. No real time passes.
 */

function fakeClock() {
	let t = 0;
	return {
		now: () => t,
		elapsed: () => t,
		sleep: async (ms: number) => {
			t += ms;
		},
	};
}

describe("waitForIncident", () => {
	it("A62: an incident after the old minute but before the scan ends passes", async () => {
		const clock = fakeClock();
		const result = await waitForIncident({
			now: clock.now,
			sleep: clock.sleep,
			incident: () => (clock.elapsed() > 75_000 ? "incident-1" : null),
			scanFinishedAfterBreak: () => clock.elapsed() > 90_000,
			upperBoundMs: 300_000,
		});
		expect(result).toEqual({ found: "incident-1" });
	});

	it("A62: no incident after a scan that ended cleanly fails", async () => {
		const clock = fakeClock();
		await expect(
			waitForIncident({
				now: clock.now,
				sleep: clock.sleep,
				incident: () => null,
				scanFinishedAfterBreak: () => clock.elapsed() > 5_000,
				upperBoundMs: 300_000,
			}),
		).rejects.toThrow(/finished a scan/);
		expect(clock.elapsed()).toBeLessThan(10_000);
	});

	it("A62: a scan that threw is not finished, so the wait goes on to its upper bound", async () => {
		const clock = fakeClock();
		await expect(
			waitForIncident({
				now: clock.now,
				sleep: clock.sleep,
				incident: () => null,
				scanFinishedAfterBreak: () => false,
				lastScanError: () => "jaeger query timed out",
				upperBoundMs: 120_000,
			}),
		).rejects.toThrow(/finished no scan.*jaeger query timed out/);
		expect(clock.elapsed()).toBeGreaterThanOrEqual(120_000);
	});

	it("A60: a break the admin never records fails naming the break, and does not hang", async () => {
		const clock = fakeClock();
		await expect(
			waitForIncident({
				now: clock.now,
				sleep: clock.sleep,
				incident: () => null,
				scanFinishedAfterBreak: () => clock.elapsed() >= 30_000,
				breakName: "seat-holds/release violated",
			}),
		).rejects.toThrow(/seat-holds\/release violated was not recorded/);
	});

	it("A60: with no scan ever finishing, the upper bound ends it naming the break", async () => {
		const clock = fakeClock();
		await expect(
			waitForIncident({
				now: clock.now,
				sleep: clock.sleep,
				incident: () => null,
				scanFinishedAfterBreak: () => false,
				breakName: "seat-holds/release violated",
			}),
		).rejects.toThrow(/seat-holds\/release violated was not recorded within 240000 ms/);
		expect(INCIDENT_WAIT_UPPER_BOUND_MS).toBe(240_000);
	});
});
