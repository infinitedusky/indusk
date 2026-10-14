import { describe, expect, it } from "vitest";
import { newProjectPrompt } from "./prompt.js";

// promise: a-project-conversation-is-a-back-and-forth

describe("A27 — the project conversation's prompt asks for a short back-and-forth", () => {
	const prompt = newProjectPrompt({
		message: "A parental control system",
		documents: [],
		brief: null,
		hasProposal: false,
	});

	it("A27 asks for a few sentences of Markdown", () => {
		expect(prompt).toMatch(/few sentences/i);
		expect(prompt).toMatch(/markdown/i);
	});

	it("A27 asks at most three questions at a time", () => {
		expect(prompt).toMatch(/at most three questions/i);
	});
});
