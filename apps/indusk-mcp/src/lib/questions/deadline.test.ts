// clause: the-cost-sets-the-wait/holds-by-default
// clause: the-cost-sets-the-wait/the-setting-decides
// clause: what-was-agreed-is-never-cheap/never-timed-out
import { describe, expect, it } from "vitest";
import { dueAt, isDue, readQuestionWait } from "./deadline.js";

const opt = (label: string, changes: ("brief" | "promise" | "look" | "gate")[] = []) => ({
	label,
	changes,
});
const asked = Date.parse("2026-10-19T10:00:00Z");
const q = (over = {}) => ({
	options: [opt("a"), opt("b")],
	recommended: "a",
	reason: "r",
	cost: "cheap" as "cheap" | "moderate" | "expensive",
	askedAt: asked,
	...over,
});
const never = Number.MAX_SAFE_INTEGER;

describe("questions — the deadline", () => {
	it("T4 — with nothing set, every cost holds", () => {
		const none = readQuestionWait({});
		for (const cost of ["cheap", "moderate", "expensive"] as const) {
			expect(dueAt(q({ cost }), none)).toBeNull();
			expect(isDue(q({ cost }), never, none)).toBe(false);
		}
	});

	it("T27/T5 — the setting decides, on a stored deadline", () => {
		const wait = readQuestionWait({ cheap: 5, moderate: "immediate" });
		expect(isDue(q(), asked + 4 * 60_000, wait)).toBe(false);
		expect(isDue(q(), asked + 5 * 60_000, wait)).toBe(true);
		expect(dueAt(q(), wait)).toBe(asked + 5 * 60_000);
		expect(isDue(q({ cost: "moderate" }), asked, wait)).toBe(true);
		expect(isDue(q({ cost: "expensive" }), never, wait)).toBe(false);
	});

	it("T5 — the stored time is what counts: later settings and restarts give no more time", () => {
		const stored = { ...q(), dueAt: asked + 5 * 60_000 };
		expect(isDue(stored, asked + 5 * 60_000, readQuestionWait({}))).toBe(true);
		expect(isDue(stored, asked + 6 * 3_600_000, readQuestionWait({ cheap: 600 }))).toBe(true);
		const held = { ...q(), dueAt: null };
		expect(isDue(held, never, readQuestionWait({ cheap: "immediate" }))).toBe(false);
	});

	it("T27 — a setting that is none of hold, whole minutes or immediate is refused, naming the key", () => {
		expect(() => readQuestionWait({ cheap: "soon" })).toThrow(/sessions\.question_wait\.cheap/);
		expect(() => readQuestionWait({ moderate: 2.5 })).toThrow(/sessions\.question_wait\.moderate/);
		expect(() => readQuestionWait({ expensive: 0 })).toThrow(/sessions\.question_wait\.expensive/);
		expect(() => readQuestionWait({ cheap: -3 })).toThrow(/sessions\.question_wait\.cheap/);
	});

	it("T9 — what was agreed never goes ahead, whatever the setting", () => {
		const agreed = q({ options: [opt("a", ["promise"]), opt("b")] });
		for (const v of ["immediate", 5] as const) {
			const all = readQuestionWait({ cheap: v, moderate: v, expensive: v });
			expect(dueAt(agreed, all)).toBeNull();
			expect(isDue(agreed, never, all)).toBe(false);
			expect(isDue({ ...agreed, dueAt: asked }, never, all)).toBe(false);
		}
	});
});
