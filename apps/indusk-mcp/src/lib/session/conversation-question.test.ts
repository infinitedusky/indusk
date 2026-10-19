import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSessionLine } from "./protocol.js";

/**
 * decisions-as-questions T19, a regression guard: a conversation session with
 * the person present asks as it does today. Its `question` event carries the
 * questions and nothing else: no cost, no recommendation, no deadline. It
 * passes now and must keep passing once the question record exists.
 */
describe("T19 — a conversation question carries no cost and no timer", () => {
	it("the recorded question event has only the session's own fields", () => {
		const lines = readFileSync(join(__dirname, "__fixtures__", "question.jsonl"), "utf-8")
			.split("\n")
			.filter((l) => l.startsWith("<< "))
			.map((l) => l.slice(3));
		const questions = lines
			.flatMap((l) => parseSessionLine(l))
			.filter((e) => e.type === "question");
		expect(questions.length).toBeGreaterThan(0);
		for (const q of questions) {
			expect(Object.keys(q).sort()).toEqual(["input", "questions", "requestId", "type"]);
			expect(q).not.toHaveProperty("cost");
			expect(q).not.toHaveProperty("dueAt");
			expect(q).not.toHaveProperty("recommended");
		}
	});
});
