// clause: a-decision-is-a-question/asked-with-a-recommendation
import { describe, expect, it } from "vitest";
import { isAnswer, validateQuestion } from "./record.js";

const opt = (label: string, changes: never[] = []) => ({ label, changes });
const asked = Date.parse("2026-10-19T10:00:00Z");
const q = (over = {}) => ({
	options: [opt("a"), opt("b")],
	recommended: "a",
	reason: "r",
	cost: "cheap",
	askedAt: asked,
	...over,
});

describe("questions — the record", () => {
	it("T1 — a well-formed question is ok", () => {
		expect(validateQuestion(q())).toEqual({ ok: true, missing: [] });
	});

	it("T1 — refuses what is missing, saying what", () => {
		expect(validateQuestion(q({ recommended: undefined })).missing).toContain("recommended");
		expect(validateQuestion(q({ reason: " " })).missing).toContain("reason");
		expect(validateQuestion(q({ options: [opt("a")] })).missing).toContain("options");
		expect(validateQuestion(q({ cost: "huge" })).missing).toContain("cost");
		expect(validateQuestion(q({ recommended: "zzz" })).missing).toContain("recommended");
		expect(validateQuestion(q({ cost: "huge" })).ok).toBe(false);
	});

	it("T1 — an empty reply is not an answer", () => {
		expect(isAnswer("")).toBe(false);
		expect(isAnswer("  \n\t")).toBe(false);
		expect(isAnswer(undefined)).toBe(false);
		expect(isAnswer("go with b")).toBe(true);
	});
});
