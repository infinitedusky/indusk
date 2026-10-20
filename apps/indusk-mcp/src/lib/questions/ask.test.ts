// clause: a-decision-is-a-question/asked-with-a-recommendation
// clause: the-cost-sets-the-wait/a-hold-frees-the-slot
import { describe, expect, it } from "vitest";
import { askDecision } from "./ask.js";
import { readQuestionWait } from "./deadline.js";

const input = (over: Record<string, unknown> = {}) => ({
	question: "Which store?",
	options: [{ label: "sqlite" }, { label: "files" }],
	recommended: "sqlite",
	reason: "simplest",
	cost: "cheap",
	...over,
});
const at = (wait: Record<string, unknown> = {}) => ({
	plan: "p",
	id: "q-1",
	now: 1_000,
	wait: readQuestionWait(wait),
});

describe("askDecision", () => {
	it("refuses a malformed question, saying what is missing", () => {
		const r = askDecision(input({ recommended: "nope", reason: "" }), at());
		expect(r.kind).toBe("refused");
		if (r.kind === "refused") {
			expect(r.message).toMatch(/recommended/);
			expect(r.message).toMatch(/reason/);
		}
		expect(askDecision(input({ question: " " }), at()).kind).toBe("refused");
		expect(
			askDecision(input({ options: [{ label: "a", changes: ["sky"] }, { label: "b" }] }), at())
				.kind,
		).toBe("refused");
	});

	it("holds with nothing set, whatever the cost", () => {
		for (const cost of ["cheap", "moderate", "expensive"]) {
			const r = askDecision(input({ cost }), at());
			expect(r.kind).toBe("hold");
			if (r.kind === "hold") expect(r.question).toMatchObject({ state: "waiting", dueAt: null });
		}
	});

	it("stores the deadline from the setting, and `immediate` goes ahead at once", () => {
		const timed = askDecision(input(), at({ cheap: 5 }));
		expect(timed.kind).toBe("timed");
		if (timed.kind === "timed") expect(timed.question.dueAt).toBe(1_000 + 300_000);
		const now = askDecision(input(), at({ cheap: "immediate" }));
		expect(now.kind).toBe("go-ahead");
		if (now.kind === "go-ahead")
			expect(now.question).toMatchObject({
				state: "went-ahead",
				done: "sqlite",
				wentAheadAt: 1_000,
			});
	});

	it("raises the cost from what an option changes, and holds it whatever the setting", () => {
		const opts = [{ label: "a", changes: ["brief"] }, { label: "b" }];
		const r = askDecision(
			input({ options: opts, recommended: "a" }),
			at({ cheap: "immediate", expensive: "immediate" }),
		);
		expect(r.kind).toBe("hold");
		if (r.kind === "hold")
			expect(r.question).toMatchObject({ statedCost: "cheap", cost: "expensive", dueAt: null });
	});
});
