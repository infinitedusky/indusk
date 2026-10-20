import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHANGES, COSTS } from "../lib/questions/record.js";

/**
 * The tool an unattended session asks a choice through (decisions-as-questions,
 * ADR decision 12). It exists for its schema and its permission request: the admin
 * reads the request (`session/protocol.ts`, `ASK_DECISION_TOOL`), records the
 * question and answers it, putting the answer in `answer`, which this tool
 * returns. Called with no admin to answer (a person's own session), it says so.
 */
export function registerDecisionTools(server: McpServer): void {
	server.registerTool(
		"ask_decision",
		{
			description:
				"Ask the person a choice the plan does not settle, in an unattended run (INDUSK_GATE_POLICY=auto). Give at least two options, the one you recommend and why, and a cost: cheap (easy to undo), moderate, or expensive. For each option say what it changes — brief, promise, look or gate — when it changes what was agreed. Never decide such a choice silently or record it as decided unattended: ask it here. The answer is returned; if the question is held for the person, this session ends and resumes with their answer.",
			inputSchema: {
				question: z.string().describe("The choice, in words the person can answer."),
				options: z
					.array(
						z.object({
							label: z.string(),
							description: z.string().optional(),
							changes: z
								.array(z.enum(CHANGES))
								.optional()
								.describe("What choosing this option changes of what was agreed; omit when none."),
						}),
					)
					.min(2),
				recommended: z.string().describe("The label of the option you recommend."),
				reason: z.string().describe("Why you recommend it."),
				cost: z.enum(COSTS).describe("What getting this wrong costs."),
				answer: z.string().optional().describe("Filled in by the admin; never set it yourself."),
			},
		},
		async ({ answer }) => ({
			content: [
				{
					type: "text" as const,
					text:
						answer ??
						"No admin answered this question. Ask the person in the conversation instead, or record the choice and its reason in the plan.",
				},
			],
		}),
	);
}
