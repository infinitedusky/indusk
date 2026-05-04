import { describe, expect, it } from "vitest";
import { buildEvaluatorPrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";

describe("buildEvaluatorPrompt", () => {
	it("includes all rubric questions in the prompt", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "test123",
			transcriptPath: "/tmp/transcript.jsonl",
			mode: "eval",
			projectGroup: "dusk",
		});

		for (const q of V1_RUBRIC) {
			expect(prompt).toContain(q.id);
			expect(prompt).toContain(q.question);
			expect(prompt).toContain(q.guidance);
		}
	});

	it("tells the evaluator to read the diff via jj command (default jj mode)", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc123",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "test",
		});

		expect(prompt).toContain("jj diff -r abc123");
	});

	it("T7: tells the evaluator to read the diff via jj command when scm: 'jj'", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc123",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "test",
			scm: "jj",
		});

		expect(prompt).toContain("jj diff -r abc123");
		expect(prompt).not.toContain("git show abc123");
	});

	it("T7: tells the evaluator to read the diff via git command when scm: 'git'", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc123",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "test",
			scm: "git",
		});

		expect(prompt).toContain("git show abc123");
		expect(prompt).not.toContain("jj diff -r abc123");
	});

	it("includes Graphiti write instructions in eval mode", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("Write findings to the knowledge graph");
		expect(prompt).toContain("myproject");
	});

	it("skips Graphiti writes in baseline mode", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "baseline",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("do NOT write to Graphiti");
	});

	it("T10: includes highlight-processing instructions with level→weight mapping in eval mode", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("mcp__indusk__highlights_unprocessed");
		expect(prompt).toContain("mcp__indusk__highlight_mark_processed");

		expect(prompt).toMatch(/critical[^\n]*1\.0/);
		expect(prompt).toMatch(/important[^\n]*0\.6/);
		expect(prompt).toMatch(/note[^\n]*0\.3/);

		expect(prompt).toMatch(/additive context[^.]*not a constraint/i);
	});

	it("T10 baseline: does NOT tell the evaluator to process highlights in baseline mode", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "baseline",
			projectGroup: "myproject",
		});

		expect(prompt).not.toContain("mcp__indusk__highlights_unprocessed");
	});

	it("includes the change ID and transcript path", () => {
		const prompt = buildEvaluatorPrompt({
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
