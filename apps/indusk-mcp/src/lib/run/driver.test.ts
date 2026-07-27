import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDriver } from "./driver.js";

/**
 * T1 — the Claude driver runs a multi-step tool loop that creates + edits a
 * file in the worktree.
 *
 * Deterministic: no live Anthropic calls. A scripted MockLanguageModelV4
 * (`ai/test`) plays the model: step 1 emits a writeFile tool call, step 2 an
 * edit tool call, step 3 finishes with text. That exercises the real rented
 * loop (generateText + stopWhen) and the real worktree-bound tools — only the
 * provider is faked, which is exactly the seam the registry swaps per model.
 */

/** One scripted model step that calls a tool. */
function toolCallStep(toolName: string, input: Record<string, unknown>) {
	return {
		content: [
			{
				type: "tool-call" as const,
				toolCallId: `call-${toolName}-${Math.random().toString(36).slice(2, 8)}`,
				toolName,
				input: JSON.stringify(input),
			},
		],
		finishReason: "tool-calls" as const,
		usage: {
			inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 10, text: 10, reasoning: 0 },
		},
		warnings: [],
	};
}

/** The final scripted model step: plain text, no tool call. */
function finishStep(text: string) {
	return {
		content: [{ type: "text" as const, text }],
		finishReason: "stop" as const,
		usage: {
			inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 10, text: 10, reasoning: 0 },
		},
		warnings: [],
	};
}

describe("Claude driver — rented multi-step tool loop (T1)", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "dawn-run-t1-"));
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("runs a multi-step loop that creates then edits a file in the worktree", async () => {
		const model = new MockLanguageModelV4({
			doGenerate: [
				toolCallStep("writeFile", {
					path: "foo.ts",
					content: 'export const X = "one";\n',
				}),
				toolCallStep("edit", {
					path: "foo.ts",
					old_string: '"one"',
					new_string: '"two"',
				}),
				finishStep("Created foo.ts and updated X."),
			],
		});

		const result = await runDriver({
			worktree,
			prompt: "Create foo.ts exporting X, then edit X.",
			model,
		});

		// The file exists in the worktree with the EDITED content — proving the
		// loop ran create → edit across steps, not a single shot.
		const content = await readFile(join(worktree, "foo.ts"), "utf8");
		expect(content).toBe('export const X = "two";\n');

		// The loop made exactly the two scripted tool calls, in order.
		expect(result.toolCalls.map((c) => c.toolName)).toEqual([
			"writeFile",
			"edit",
		]);

		// Three model steps: write, edit, finish.
		expect(result.steps).toBe(3);
		expect(result.finishReason).toBe("stop");
		expect(result.text).toContain("Created foo.ts");
	});

	it("surfaces a worktree-escape as a tool error instead of touching the path", async () => {
		const model = new MockLanguageModelV4({
			doGenerate: [
				toolCallStep("writeFile", {
					path: "../escape.txt",
					content: "should never land",
				}),
				finishStep("done"),
			],
		});

		const result = await runDriver({
			worktree,
			prompt: "Try to write outside the worktree.",
			model,
		});

		// The loop completes (tool errors feed back to the model as results),
		// but nothing was written outside the worktree root.
		expect(result.finishReason).toBe("stop");
		await expect(
			readFile(join(worktree, "..", "escape.txt"), "utf8"),
		).rejects.toThrow();
	});
});
