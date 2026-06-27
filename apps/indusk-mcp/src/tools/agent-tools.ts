import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AgentSection } from "../lib/agents/current-md.js";
import { upsertSection } from "../lib/agents/current-md.js";
import { withLock } from "../lib/agents/lock.js";

/**
 * Register the multi-agent presence MCP tools.
 *
 * `update_current_section` is the explicit write surface for the section-shape
 * design (handoff-multi-agent-section-shape plan). The working agent calls
 * this tool at `/handoff` (or any other "promote operational state" moment)
 * with the session ID, task, and three section bodies. The tool reads
 * `.indusk/current.md`, calls `upsertSection`, and writes back atomically
 * (temp + rename).
 *
 * Atomic-write rationale: concurrent register/upsert from two CLI subprocesses
 * on the same workbench could race on the write step. The temp-then-rename
 * pattern guarantees readers never see a half-written file. (Cross-branch
 * concurrent edits — the real two-Claude-Code-sessions case — are handled by
 * git merge, not by this lock.)
 *
 * Path safety: sessionId routes through `sanitizeSessionId` inside
 * `upsertSection`. Poisoned input throws TypeError before any write.
 */
export function registerAgentTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"update_current_section",
		{
			description:
				"Promote the current session's operational state (in-flight work, open questions, cursor position) to `.indusk/current.md`. Finds the agent's own section by session ID and overwrites it in place; appends a new section if no match exists. Other agents' sections are byte-untouched. This is the explicit write surface for the section-shape multi-agent coordination — call it at `/handoff` or any moment when something solidifies that the next session will want.",
			inputSchema: {
				sessionId: z
					.string()
					.describe(
						"The current session's stable ID — typically $CLAUDE_CODE_SESSION_ID (UUID v4) or `pid-<N>` fallback.",
					),
				task: z
					.string()
					.describe(
						"One-line description of what this session is working on. Free-text; used in the section heading for human readability.",
					),
				sections: z
					.object({
						in_flight: z
							.string()
							.describe(
								"Markdown body for the `### In Flight` subsection. What's actively being worked on. Empty string is fine.",
							),
						open_questions: z
							.string()
							.describe(
								"Markdown body for the `### Open Questions` subsection. Hypotheses to confirm, design decisions mid-conversation. Empty string is fine.",
							),
						cursor: z
							.string()
							.describe(
								"Markdown body for the `### Cursor` subsection. Where you stopped — file paths, line numbers, next concrete step. Empty string is fine.",
							),
					})
					.describe("The three section bodies that make up the agent's operational state."),
			},
		},
		async ({ sessionId, task, sections }) => {
			const path = join(projectRoot, ".indusk/current.md");
			const lockPath = `${path}.lock`;
			let agentSection!: AgentSection;
			withLock(lockPath, () => {
				const initial = existsSync(path) ? readFileSync(path, "utf-8") : "";
				agentSection = {
					sessionId,
					sessionShort: sessionId.slice(0, 8),
					task,
					lastUpdated: new Date().toISOString(),
					inFlight: sections.in_flight,
					openQuestions: sections.open_questions,
					cursor: sections.cursor,
				};
				const updated = upsertSection(initial, agentSection);
				const tmpPath = `${path}.tmp.${sessionId}`;
				writeFileSync(tmpPath, updated);
				renameSync(tmpPath, path);
			});
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: true,
								sessionId,
								task,
								lastUpdated: agentSection.lastUpdated,
								path: ".indusk/current.md",
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
