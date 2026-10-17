import { describe, expect, it } from "vitest";
import { newProjectPrompt } from "./prompt.js";
import { TELEMETRY_RECOMMENDATION } from "./proposal.js";

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

// promise: a-new-project-is-written-only-under-its-parent

describe("A36 — the agent is told where new projects go", () => {
	const parent = "/home/me/code";
	const prompt = newProjectPrompt(
		{ message: "A parental control system", documents: [], brief: null, hasProposal: false },
		{ parent },
	);

	it("A36 names the parent directory", () => {
		expect(prompt).toContain(parent);
	});

	it("A36 asks for a proposed location inside it", () => {
		expect(prompt).toMatch(/"location"[\s\S]{0,80}inside \/home\/me\/code/);
	});
});

// promise: a-recommendation-can-be-declined

describe("T32 — the agent names a telemetry recommendation the way the decline rule reads it", () => {
	const prompt = newProjectPrompt({
		message: "A parental control system",
		documents: [],
		brief: null,
		hasProposal: false,
	});

	it("T32 the prompt gives the telemetry recommendation the name the decline rule matches", () => {
		expect(TELEMETRY_RECOMMENDATION).toBe("telemetry");
		expect(prompt).toContain(`"name": "${TELEMETRY_RECOMMENDATION}"`);
	});
});
