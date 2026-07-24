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

	it("tells the evaluator to read the diff via git show (git-only as of 1.31.0)", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc123",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "test",
		});

		expect(prompt).toContain("git show abc123");
		expect(prompt).not.toContain("jj diff -r abc123");
	});

	it("includes findings-persistence instructions in eval mode (no knowledge-graph write — indusk-makeover)", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("Findings persistence");
		expect(prompt).not.toContain("knowledge graph");
		expect(prompt).toContain("myproject");
	});

	it("baseline mode findings persist via the scorecard only", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "baseline",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("findings persist via the scorecard only");
	});

	it("T10: includes highlight-processing instructions targeting the lessons rail in eval mode", () => {
		const prompt = buildEvaluatorPrompt({
			rubric: V1_RUBRIC,
			changeId: "abc",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
			projectGroup: "myproject",
		});

		expect(prompt).toContain("mcp__indusk__highlights_unprocessed");
		expect(prompt).toContain("mcp__indusk__highlight_mark_processed");

		// Post-makeover the rail materializes lessons, not weighted graph episodes.
		expect(prompt).toContain("mcp__indusk__add_lesson");
		expect(prompt).not.toContain("graph_capture");
		expect(prompt).not.toContain("mcp__graphiti__");

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
