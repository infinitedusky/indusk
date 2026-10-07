import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addLesson } from "../lib/bookkeeping/notes.js";
import { bookkeepingRoots } from "../lib/bookkeeping/roots.js";
import { LESSONS_REL_DIR, lessonListing } from "../lib/lessons/state.js";

export function registerLessonTools(server: McpServer, projectRoot: string): void {
	// Lessons live in the main checkout (bookkeeping-lives-where-it-is-read D2).
	const lessonsDir = join(bookkeepingRoots(projectRoot).trunk, LESSONS_REL_DIR);

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

			const { lessons, guarded, advisory, scan } = await lessonListing(projectRoot);

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
			// Written to the main checkout's lessons and committed on main, from
			// any checkout (bookkeeping-lives-where-it-is-read D2).
			const r = addLesson(projectRoot, { name, title, content });
			if ("error" in r) {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ error: r.error }) }],
					isError: true,
				};
			}
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							created: basename(r.file),
							path: r.file,
							committed: r.commit.committed,
							...(r.commit.committed ? {} : { notCommitted: r.commit.reason }),
						}),
					},
				],
			};
		},
	);
}
