import type { Question } from "./record.js";

/**
 * The timer a session holds for a question on a set time (ADR decision 4): when its
 * stored time comes, `fire` runs the sweep, so the question goes ahead whether or
 * not anyone opens the admin. The admin's read-time sweep stays as the catch-up for
 * a session that is gone. Returns a cancel, called when the session ends first.
 *
 * clause: the-cost-sets-the-wait/the-setting-decides
 */
export interface Timers {
	set(fn: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

/** The longest wait a timer takes in one go; a longer one is set again when it fires. */
const LONGEST_MS = 2 ** 31 - 1;

export const realTimers: Timers = {
	set: (fn, ms) => setTimeout(fn, ms),
	clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function scheduleDue(
	q: Pick<Question, "state" | "dueAt">,
	now: () => number,
	timers: Timers,
	fire: () => void,
): () => void {
	const due = q.dueAt;
	if (q.state !== "waiting" || due === null || due === undefined) return () => {};
	let handle: unknown;
	let cancelled = false;
	const arm = () => {
		const left = due - now();
		if (left > LONGEST_MS) {
			handle = timers.set(arm, LONGEST_MS);
			return;
		}
		handle = timers.set(
			() => {
				if (!cancelled) fire();
			},
			Math.max(0, left),
		);
	};
	arm();
	return () => {
		cancelled = true;
		timers.clear(handle);
	};
}
