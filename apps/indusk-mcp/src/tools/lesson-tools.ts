import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerLessonTools(server: McpServer, projectRoot: string): void {
	const lessonsDir = join(projectRoot, ".claude/lessons");

	server.registerTool(
		"list_lessons",
		{
			description:
				"List all lessons (community + personal) from .claude/lessons/ — returns title + file path per lesson, NOT full content. Titles ARE the rules in most cases; read full content via the Read tool against `path` only when a lesson is relevant to the work the user is asking for.",
		},
		async () => {
			if (!existsSync(lessonsDir)) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								lessons: [],
								count: 0,
								note: "No lessons directory — run init",
							}),
						},
					],
				};
			}

			const files = readdirSync(lessonsDir).filter((f) => f.endsWith(".md"));
			const lessons = files.map((file) => {
				const filePath = join(lessonsDir, file);
				// Read only enough bytes to find the H1 — avoids loading full content for the listing.
				const content = readFileSync(filePath, "utf-8");
				const firstLine = content.split("\n").find((l) => l.startsWith("# "));
				return {
					file,
					path: filePath,
					type: file.startsWith("community-") ? "community" : "personal",
					title: firstLine?.replace("# ", "") ?? file,
				};
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								count: lessons.length,
								community: lessons.filter((l) => l.type === "community").length,
								personal: lessons.filter((l) => l.type === "personal").length,
								note: "Titles are the actionable rules. Read full content via the Read tool on `path` only when a lesson's title matches the work you're about to do.",
								lessons,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"add_lesson",
		{
			description:
				"Create a new personal lesson file. Use after retrospectives or when discovering a non-obvious pattern worth remembering across projects.",
			inputSchema: {
				name: z
					.string()
					.describe("Short kebab-case name for the lesson (e.g., 'validate-env-vars')"),
				title: z
					.string()
					.describe("Human-readable title (e.g., 'Always validate environment variables')"),
				content: z
					.string()
					.describe(
						"The lesson content — explain the pattern, why it matters, and what to do instead",
					),
			},
		},
		async ({ name, title, content }) => {
			mkdirSync(lessonsDir, { recursive: true });

			const fileName = name.startsWith("community-") ? name.replace("community-", "") : name;
			const filePath = join(lessonsDir, `${fileName}.md`);

			if (existsSync(filePath)) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: `Lesson ${fileName}.md already exists` }),
						},
					],
					isError: true,
				};
			}

			const fileContent = `# ${title}\n\n${content}\n`;
			writeFileSync(filePath, fileContent);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ created: `${fileName}.md`, path: filePath }),
					},
				],
			};
		},
	);
}
