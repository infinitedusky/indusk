import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	markProcessed,
	readUnprocessedHighlights,
	writeHighlight,
} from "../lib/highlights/highlights.js";

/**
 * Register the three highlight MCP tools:
 *
 * - `highlight` — the working agent writes a highlight at trigger points
 *   (brief accepted, ADR accepted, correction confirmed, retro lesson,
 *   manual /highlight). The highlight is append-only to
 *   .indusk/highlights.jsonl.
 * - `highlights_unprocessed` — the eval agent reads unprocessed
 *   highlights to decide what to turn into Graphiti episodes.
 * - `highlight_mark_processed` — the eval agent marks a highlight as
 *   processed (either wrote-episode or skipped) to move it out of the
 *   unprocessed queue.
 *
 * See .indusk/planning/agent-roles/adr.md for the three-tier role model
 * and the highlights-queue interface.
 */
export function registerHighlightTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"highlight",
		{
			description:
				"Write a highlight to the queue. Called by the working agent at trigger points — brief/ADR acceptance, corrections, retro lessons, or explicit user flags. The eval agent processes these later into structured Graphiti episodes.",
			inputSchema: {
				tag: z
					.string()
					.describe(
						"Short tag for the highlight type: brief-accepted, adr-accepted, correction, retro-lesson, observation, or a custom tag.",
					),
				note: z.string().describe("The highlight content — a single line describing what matters."),
				level: z
					.enum(["critical", "important", "note"])
					.describe(
						"Weight level: critical = architectural decision, important = correction/lesson, note = observation.",
					),
			},
		},
		async ({ tag, note, level }) => {
			const entry = writeHighlight(projectRoot, { tag, note, level });
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(entry, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"highlights_unprocessed",
		{
			description:
				"Return all highlights that haven't yet been marked as processed. Called by the eval agent to find highlights needing structured episodes.",
		},
		async () => {
			const unprocessed = readUnprocessedHighlights(projectRoot);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(unprocessed, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"highlight_mark_processed",
		{
			description:
				"Mark a highlight as processed. Called by the eval agent after handling a highlight — either writing a structured Graphiti episode (wrote-episode) or deciding not to (skipped).",
			inputSchema: {
				id: z.string().describe("The highlight ID to mark (format: h-YYYYMMDD-NNN)."),
				action: z
					.enum(["wrote-episode", "skipped"])
					.describe(
						"What was done: wrote-episode = structured episode created; skipped = no episode.",
					),
				detail: z
					.string()
					.optional()
					.describe(
						"Optional detail — for wrote-episode, the episode name; for skipped, the reason.",
					),
			},
		},
		async ({ id, action, detail }) => {
			const mark = markProcessed(projectRoot, id, action, detail);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(mark, null, 2),
					},
				],
			};
		},
	);
}
