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

export function createSeats(_opts: SeatsOptions) {
	return {
		hold: (_seat: number, _who: string, _now: number) => ({ ok: false }),
		book: (_seat: number, _who: string, _now: number) => ({ ok: false }),
		sweep: (_now: number, _o: { fault: boolean }): Release[] => [],
	};
}
