/**
 * The seat rules, with the clock as an argument so every rule is a test that
 * never waits. A held seat that is not booked is released when its window
 * passes; the release is "upheld" when it came within the tolerance, and
 * "violated" when it came late. With the fault on, a release waits an extra
 * `faultDelayMs`, so it comes late on purpose.
 */

export interface SeatsOptions {
	seats: number;
	windowMs: number;
	toleranceMs: number;
	faultDelayMs?: number;
}

export interface Release {
	seat: number;
	outcome: "upheld" | "violated";
	lateMs: number;
	symptom?: string;
}

export type SeatView =
	| { seat: number; state: "free" }
	| { seat: number; state: "held"; who: string; remainingMs: number }
	| { seat: number; state: "booked"; who: string };

type Seat =
	| { state: "free" }
	| { state: "held"; who: string; expiresAt: number }
	| { state: "booked"; who: string };

export function createSeats(opts: SeatsOptions) {
	const faultDelayMs = opts.faultDelayMs ?? opts.toleranceMs * 3;
	const seats = new Map<number, Seat>();
	for (let n = 1; n <= opts.seats; n++) seats.set(n, { state: "free" });

	return {
		hold(seat: number, who: string, now: number): { ok: boolean } {
			if (seats.get(seat)?.state !== "free") return { ok: false };
			seats.set(seat, { state: "held", who, expiresAt: now + opts.windowMs });
			return { ok: true };
		},

		book(seat: number, who: string, _now: number): { ok: boolean } {
			const s = seats.get(seat);
			if (s?.state !== "held" || s.who !== who) return { ok: false };
			seats.set(seat, { state: "booked", who });
			return { ok: true };
		},

		sweep(now: number, { fault }: { fault: boolean }): Release[] {
			const released: Release[] = [];
			for (const [n, s] of seats) {
				if (s.state !== "held") continue;
				const due = s.expiresAt + (fault ? faultDelayMs : 0);
				if (now < due) continue;
				seats.set(n, { state: "free" });
				const lateMs = now - s.expiresAt;
				released.push(
					lateMs <= opts.toleranceMs
						? { seat: n, outcome: "upheld", lateMs }
						: {
								seat: n,
								outcome: "violated",
								lateMs,
								symptom: `seat ${n} released ${(lateMs / 1000).toFixed(1)} s late`,
							},
				);
			}
			return released;
		},

		list(now: number): SeatView[] {
			return [...seats].map(([n, s]): SeatView => {
				if (s.state === "held")
					return {
						seat: n,
						state: "held",
						who: s.who,
						remainingMs: Math.max(0, s.expiresAt - now),
					};
				if (s.state === "booked") return { seat: n, state: "booked", who: s.who };
				return { seat: n, state: "free" };
			});
		},
	};
}

export type Seats = ReturnType<typeof createSeats>;
