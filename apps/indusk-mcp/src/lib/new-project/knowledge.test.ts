import { describe, expect, it } from "vitest";
import { knowledgeOf } from "./knowledge.js";

// promise: a-project-starts-as-a-conversation

describe("what the agent knows about a project so far", () => {
	const states = (d: { brief: string | null; hasProposal: boolean }) =>
		knowledgeOf(d).map((e) => `${e.key}:${e.state}`);

	it("knows nothing settled before the agent has written anything", () => {
		expect(states({ brief: null, hasProposal: false })).toEqual([
			"why:asking",
			"what:open",
			"how-where:open",
			"name-place:open",
		]);
	});

	it("has why and what settled once the brief is written, and asks how and where", () => {
		expect(states({ brief: "# Brief", hasProposal: false })).toEqual([
			"why:settled",
			"what:settled",
			"how-where:asking",
			"name-place:open",
		]);
	});

	it("has everything settled once the proposal is written", () => {
		expect(
			states({ brief: "# Brief", hasProposal: true }).every((s) => s.endsWith(":settled")),
		).toBe(true);
	});
});
