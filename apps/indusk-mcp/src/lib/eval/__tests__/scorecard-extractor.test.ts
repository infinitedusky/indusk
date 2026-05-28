import { describe, expect, it } from "vitest";
import { buildEvaluatorPrompt } from "../prompt-builder.js";
import { V1_RUBRIC } from "../rubric.js";
import { extractScorecardJson, formatParseError } from "../scorecard-extractor.js";

describe("T1: prose-prefixed JSON (the smoke 4 failure mode)", () => {
	it("extracts a balanced JSON object when text begins with prose followed by JSON", () => {
		const text = `Now I've got everything I need. Here's the scorecard:

{"questions":[{"id":"conventions","answer":"yes"}],"summary":"Looks good","graphitiWrites":3}`;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		const parsed = JSON.parse(extracted as string);
		expect(parsed.summary).toBe("Looks good");
		expect(parsed.graphitiWrites).toBe(3);
	});

	it("handles JSON with braces inside string literals", () => {
		const text = `Here you go: {"summary":"the brace { is inside this string","count":1}`;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		const parsed = JSON.parse(extracted as string);
		expect(parsed.summary).toBe("the brace { is inside this string");
		expect(parsed.count).toBe(1);
	});

	it("handles JSON with escaped quotes inside string literals", () => {
		const text = `Output: {"summary":"He said \\"hi\\" to me","x":2}`;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		const parsed = JSON.parse(extracted as string);
		expect(parsed.summary).toBe('He said "hi" to me');
	});
});

describe("T2: pure JSON (the cleanest case)", () => {
	it("extracts JSON when text is exactly a JSON object with no surrounding content", () => {
		const text = `{"questions":[],"summary":"clean","graphitiWrites":0}`;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		expect(JSON.parse(extracted as string).summary).toBe("clean");
	});

	it("handles JSON with leading/trailing whitespace only", () => {
		const text = `   \n  {"summary":"padded"}\n   `;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		expect(JSON.parse(extracted as string).summary).toBe("padded");
	});
});

describe("T3: fenced JSON (markdown code block)", () => {
	it("extracts JSON wrapped in ```json fences", () => {
		const text = '```json\n{"summary":"fenced","graphitiWrites":1}\n```';
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		expect(JSON.parse(extracted as string).summary).toBe("fenced");
	});

	it("extracts JSON wrapped in unlabeled ``` fences", () => {
		const text = '```\n{"summary":"unlabeled"}\n```';
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		expect(JSON.parse(extracted as string).summary).toBe("unlabeled");
	});
});

describe("T4: prose around fenced JSON", () => {
	it("extracts JSON when prose precedes and follows a fenced block", () => {
		const text = `Sure, here's the result:

\`\`\`json
{"summary":"surrounded","graphitiWrites":2}
\`\`\`

Hope that helps!`;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		expect(JSON.parse(extracted as string).summary).toBe("surrounded");
	});

	it("extracts JSON when only prose precedes a fenced block", () => {
		const text = `Done. \`\`\`json\n{"x":1}\n\`\`\``;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		expect(JSON.parse(extracted as string).x).toBe(1);
	});
});

describe("T5: no parseable JSON", () => {
	it("returns null when text contains no JSON at all", () => {
		const text = "I tried but couldn't generate the scorecard. Please retry.";
		expect(extractScorecardJson(text)).toBeNull();
	});

	it("returns null when text has unmatched braces (no balanced object)", () => {
		const text = "Here is { incomplete";
		expect(extractScorecardJson(text)).toBeNull();
	});

	it("returns null on empty input", () => {
		expect(extractScorecardJson("")).toBeNull();
	});

	it("formatParseError preserves the raw stdout snippet", () => {
		const err = new SyntaxError("Unexpected token 'N', \"Now I've g\"... is not valid JSON");
		const rawStdout =
			"Now I've got everything I need to score this commit. Let me think about it...".repeat(5);
		const formatted = formatParseError(err, rawStdout);
		expect(formatted).toContain("Unexpected token");
		// Snippet must be at least 200 characters of the raw stdout (or all of it if shorter)
		const expectedSnippet = rawStdout.slice(0, Math.min(500, rawStdout.length));
		expect(formatted).toContain(expectedSnippet.slice(0, 200));
	});

	it("formatParseError handles short stdout without padding", () => {
		const err = new SyntaxError("Unexpected token");
		const rawStdout = "tiny output";
		const formatted = formatParseError(err, rawStdout);
		expect(formatted).toContain("tiny output");
	});

	it("formatParseError handles non-Error inputs", () => {
		const err = "raw string error";
		const rawStdout = "some output";
		const formatted = formatParseError(err, rawStdout);
		expect(formatted).toContain("raw string error");
		expect(formatted).toContain("some output");
	});
});

describe("T6: prompt has end-of-prompt format reminder + concrete JSON example", () => {
	const baseOpts = {
		rubric: V1_RUBRIC,
		changeId: "test123",
		transcriptPath: "/tmp/transcript",
		mode: "eval" as const,
		projectGroup: "test-project",
	};

	it("rendered prompt ends with a FINAL REMINDER format-enforcement section", () => {
		const prompt = buildEvaluatorPrompt(baseOpts);
		// The reminder should be the LAST significant content in the prompt —
		// closer to where Claude generates output, so the format constraint is
		// freshest in its working memory.
		const tail = prompt.slice(-1500);
		expect(tail).toMatch(/FINAL REMINDER/);
		expect(tail).toMatch(/JSON object/i);
		expect(tail).toMatch(/no prose/i);
	});

	it("rendered prompt's final reminder includes a concrete JSON example", () => {
		const prompt = buildEvaluatorPrompt(baseOpts);
		const tail = prompt.slice(-1500);
		// Concrete example must contain a recognizable scorecard field shape so
		// Claude has a literal template to imitate.
		expect(tail).toContain('"version"');
		expect(tail).toContain('"questions"');
		expect(tail).toContain('"summary"');
		expect(tail).toContain('"graphitiWrites"');
	});

	it("rendered prompt for baseline mode also includes the FINAL REMINDER", () => {
		const baselinePrompt = buildEvaluatorPrompt({ ...baseOpts, mode: "baseline" });
		const tail = baselinePrompt.slice(-1500);
		expect(tail).toMatch(/FINAL REMINDER/);
		expect(tail).toContain('"questions"');
	});
});

describe("end-to-end: extracted JSON parses cleanly to a scorecard shape", () => {
	it("smoke 4 reproduction: prose-prefixed real-shaped scorecard parses successfully", () => {
		const realScorecardShape = JSON.stringify({
			version: 1,
			timestamp: "2026-04-19T18:06:00.000Z",
			mode: "eval",
			changeId: "lzmzrzpt",
			projectGroup: "dusk",
			questions: [
				{
					id: "conventions",
					question: "Did the agent follow the project's conventions?",
					answer: "yes",
					severity: "info",
					evidence: 'evidence text with a brace { and a quote "',
					finding: "ok",
				},
			],
			summary: "all good",
			graphitiWrites: 3,
			telemetryPosted: false,
		});
		const text = `Now I've got everything I need. Here's the scorecard:\n\n${realScorecardShape}`;
		const extracted = extractScorecardJson(text);
		expect(extracted).not.toBeNull();
		const parsed = JSON.parse(extracted as string);
		expect(parsed.questions[0].answer).toBe("yes");
		expect(parsed.graphitiWrites).toBe(3);
	});
});
