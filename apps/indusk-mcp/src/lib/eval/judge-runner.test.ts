import { describe, expect, it } from "vitest";
import { buildJudgePrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";

describe("buildJudgePrompt", () => {
	it("includes all rubric questions in the prompt", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "test123",
			transcriptPath: "/tmp/transcript.jsonl",
			diff: "diff --git a/foo.ts b/foo.ts\n+console.log('hello')",
			mode: "eval",
			projectGroup: "infinitedusky",
		});

		for (const q of V1_RUBRIC) {
			expect(prompt).toContain(q.id);
			expect(prompt).toContain(q.question);
			expect(prompt).toContain(q.guidance);
		}
	});

	it("includes the diff in the prompt", () => {
		const diff = "diff --git a/src/thing.ts b/src/thing.ts\n+export function doStuff() {}";
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			diff,
			mode: "eval",
			projectGroup: "test",
		});

		expect(prompt).toContain(diff);
	});

	it("includes Graphiti write instructions in eval mode", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			diff: "",
			mode: "eval",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("Write findings to Graphiti");
		expect(prompt).toContain("myproject");
	});

	it("skips Graphiti writes in baseline mode", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			diff: "",
			mode: "baseline",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("do NOT write to Graphiti");
	});

	it("includes the change ID and transcript path", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "xyz789",
			transcriptPath: "/home/user/.claude/transcripts/session.jsonl",
			diff: "",
			mode: "eval",
			projectGroup: "test",
		});

		expect(prompt).toContain("xyz789");
		expect(prompt).toContain("/home/user/.claude/transcripts/session.jsonl");
	});
});
