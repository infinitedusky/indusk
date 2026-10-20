// clause: the-cost-sets-the-wait/the-setting-decides
import { describe, expect, it } from "vitest";
import { scheduleDue, type Timers } from "./due-timer.js";

function fakeTimers() {
	const pending = new Map<number, { fn: () => void; ms: number }>();
	let next = 1;
	const timers: Timers = {
		set: (fn, ms) => {
			pending.set(next, { fn, ms });
			return next++;
		},
		clear: (h) => void pending.delete(h as number),
	};
	return { timers, pending };
}

describe("scheduleDue", () => {
	it("T28 — a timed question is swept at its stored time with no admin read at all", () => {
		const { timers, pending } = fakeTimers();
		let fired = 0;
		scheduleDue(
			{ state: "waiting", dueAt: 5 * 60_000 },
			() => 60_000,
			timers,
			() => fired++,
		);
		const [only] = [...pending.values()];
		expect(only?.ms).toBe(4 * 60_000);
		only?.fn();
		expect(fired).toBe(1);
	});

	it("T28 — the timer is cleared when the session ends first", () => {
		const { timers, pending } = fakeTimers();
		let fired = 0;
		const cancel = scheduleDue(
			{ state: "waiting", dueAt: 10 },
			() => 0,
			timers,
			() => fired++,
		);
		const [only] = [...pending.values()];
		cancel();
		expect(pending.size).toBe(0);
		only?.fn();
		expect(fired).toBe(0);
	});

	it("sets no timer for a question that holds or is not waiting", () => {
		const { timers, pending } = fakeTimers();
		scheduleDue(
			{ state: "waiting", dueAt: null },
			() => 0,
			timers,
			() => {},
		);
		scheduleDue(
			{ state: "answered", dueAt: 5 },
			() => 0,
			timers,
			() => {},
		);
		expect(pending.size).toBe(0);
	});

	it("sets a wait longer than a timer takes again when it fires", () => {
		const { timers, pending } = fakeTimers();
		let fired = 0;
		let clock = 0;
		scheduleDue(
			{ state: "waiting", dueAt: 40 * 86_400_000 },
			() => clock,
			timers,
			() => fired++,
		);
		const [first] = [...pending.values()];
		pending.clear();
		clock = 2 ** 31 - 1;
		first?.fn();
		expect(fired).toBe(0);
		expect(pending.size).toBe(1);
	});
});
