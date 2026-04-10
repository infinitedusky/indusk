import { describe, expect, it } from "vitest";
import { buildJudgePrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";

describe("buildJudgePrompt", () => {
	it("includes all rubric questions in the prompt", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "test123",
			transcriptPath: "/tmp/transcript.jsonl",
			mode: "eval",
			projectGroup: "infinitedusky",
		});

		for (const q of V1_RUBRIC) {
			expect(prompt).toContain(q.id);
			expect(prompt).toContain(q.question);
			expect(prompt).toContain(q.guidance);
		}
	});

	it("tells the judge to read the diff via jj command", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "abc123",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "test",
		});

		expect(prompt).toContain("jj diff -r abc123");
	});

	it("includes Graphiti write instructions in eval mode", () => {
		const prompt = buildJudgePrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
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
			mode: "eval",
			projectGroup: "test",
		});

		expect(prompt).toContain("xyz789");
		expect(prompt).toContain("/home/user/.claude/transcripts/session.jsonl");
	});
});
