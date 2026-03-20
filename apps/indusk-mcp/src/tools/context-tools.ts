import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	parseContext,
	SECTION_NAMES,
	type SectionName,
	updateSection,
	validateContext,
} from "../lib/context-parser.js";

export function registerContextTools(server: McpServer, projectRoot: string): void {
	const claudeMdPath = join(projectRoot, "CLAUDE.md");

	server.registerTool(
		"get_context",
		{
			description: "Returns CLAUDE.md parsed into its 6 canonical sections with validation status",
		},
		async () => {
			const parsed = parseContext(claudeMdPath);
			const validation = validateContext(parsed);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ ...parsed, validation }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"update_context",
		{
			description:
				"Update a specific section of CLAUDE.md. Validates that the section exists and structure is preserved.",
			inputSchema: {
				section: z.enum(SECTION_NAMES).describe("The section to update"),
				content: z.string().describe("New content for the section (replaces existing content)"),
			},
		},
		async ({ section, content }) => {
			// Validate current structure before modifying
			const parsed = parseContext(claudeMdPath);
			const validation = validateContext(parsed);

			if (!validation.valid) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									success: false,
									error: "CLAUDE.md structure is invalid — fix manually before updating via tool",
									validation,
								},
								null,
								2,
							),
						},
					],
				};
			}

			updateSection(claudeMdPath, section as SectionName, content);

			// Validate after update
			const afterParsed = parseContext(claudeMdPath);
			const afterValidation = validateContext(afterParsed);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								section,
								structureValid: afterValidation.valid,
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
