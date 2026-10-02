import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	LESSONS_REL_DIR,
	type LessonState,
	lessonStates,
	listLessonFiles,
} from "../lib/lessons/state.js";

export function registerLessonTools(server: McpServer, projectRoot: string): void {
	const lessonsDir = join(projectRoot, LESSONS_REL_DIR);

	server.registerTool(
		"list_lessons",
		{
			description:
				"List all lessons (community + personal) from .claude/lessons/ — returns title, file path and state per lesson, NOT full content. State is derived on every call, never stored: `guarded` when a test or hook names the lesson in its failure message (`lesson: <name>`, so it reaches you the moment the rule breaks — `guardedBy` lists each enforcer and whether it is a hook, test or code site), `advisory` when nothing does. Skim the advisory titles; the guarded ones find you. Read full content via the Read tool against `path` only when a lesson is relevant to the work the user is asking for.",
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

			let lessons: (LessonState | ReturnType<typeof listLessonFiles>[number])[];
			let scan: string | undefined;
			try {
				lessons = await lessonStates(projectRoot);
			} catch (err) {
				// Not scannable (no git repository): say so. Every lesson listed
				// without a state is a listing, never a verdict that nothing guards it.
				lessons = listLessonFiles(projectRoot);
				scan = `guarded/advisory could not be derived: ${(err as Error).message}`;
			}
			const states = lessons as Partial<LessonState>[];
			const guarded = states.filter((l) => l.state === "guarded").length;
			const advisory = states.filter((l) => l.state === "advisory").length;

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								count: lessons.length,
								community: lessons.filter((l) => l.type === "community").length,
								personal: lessons.filter((l) => l.type === "personal").length,
								guarded,
								advisory,
								...(scan ? { scan } : {}),
								note: "Titles are the actionable rules. A guarded lesson reaches you from its enforcer when the rule breaks; skim the advisory titles. Read full content via the Read tool on `path` only when a lesson's title matches the work you're about to do.",
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
