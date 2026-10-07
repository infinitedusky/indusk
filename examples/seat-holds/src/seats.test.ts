// promise: a-held-seat-is-released-in-time — the example's own promise.
// promise: the-demo-app-starts-with-its-promise-holding — demo-app-template A1, A2.
// promise: the-demo-break-is-caught-locally — demo-app-template A6.
import { describe, expect, it } from "vitest";
import { createSeats } from "./seats.js";

// The clock is an argument: every rule here runs in microseconds, never waits.
const opts = { seats: 4, windowMs: 3000, toleranceMs: 1000, faultDelayMs: 3000 };

describe("seat holds", () => {
	it("A1: a held seat comes free when its window passes; a booked one never does; a held seat is not anyone else's", () => {
		const s = createSeats(opts);
		expect(s.hold(1, "ann", 0).ok).toBe(true);
		expect(s.hold(1, "bob", 10).ok).toBe(false);
		expect(s.hold(2, "bob", 0).ok).toBe(true);
		expect(s.book(2, "bob", 100).ok).toBe(true);
		expect(s.book(1, "bob", 100).ok, "only the holder books").toBe(false);
		expect(s.sweep(2900, { fault: false })).toEqual([]);
		expect(s.sweep(3100, { fault: false }).map((r) => r.seat)).toEqual([1]);
		expect(s.sweep(60_000, { fault: false }), "a booked seat never comes free").toEqual([]);
		expect(s.hold(1, "bob", 3200).ok, "a released seat can be held again").toBe(true);
	});

	it("A2: a release on time is held; a late one is broken, naming the seat and how late", () => {
		const s = createSeats(opts);
		s.hold(1, "ann", 0);
		expect(s.sweep(3500, { fault: false })[0]).toMatchObject({ seat: 1, outcome: "upheld" });
		s.hold(2, "bob", 0);
		expect(s.sweep(6200, { fault: false })[0]).toMatchObject({
			seat: 2,
			outcome: "violated",
			lateMs: 3200,
			symptom: "seat 2 released 3.2 s late",
		});
	});

	it("A6: with the fault on, a release waits past its window and is broken; off, it is on time", () => {
		const s = createSeats(opts);
		s.hold(1, "ann", 0);
		expect(s.sweep(3100, { fault: true }), "the fault holds the release back").toEqual([]);
		expect(s.sweep(6100, { fault: true })[0]).toMatchObject({ seat: 1, outcome: "violated" });
		s.hold(2, "bob", 7000);
		expect(s.sweep(10_100, { fault: false })[0]).toMatchObject({ seat: 2, outcome: "upheld" });
	});
});
