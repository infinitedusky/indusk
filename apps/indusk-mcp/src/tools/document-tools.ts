import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseAllPlans } from "../lib/plan-parser.js";

function findMarkdownFiles(dir: string, base: string): string[] {
	if (!existsSync(dir)) return [];

	const results: string[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory() && !entry.name.startsWith(".")) {
			results.push(...findMarkdownFiles(fullPath, base));
		} else if (entry.name.endsWith(".md")) {
			results.push(relative(base, fullPath));
		}
	}

	return results;
}

export function registerDocumentTools(server: McpServer, projectRoot: string): void {
	const docsDir = join(projectRoot, "apps/indusk-docs/src");

	server.registerTool(
		"list_docs",
		{
			description:
				"List all markdown files in the VitePress docs directory (apps/indusk-docs/src/)",
		},
		async () => {
			const files = findMarkdownFiles(docsDir, docsDir);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ docsDir: "apps/indusk-docs/src", files }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"check_docs_coverage",
		{
			description:
				"Compare completed plans to existing decision/lesson pages in the docs site. Flags plans that lack corresponding documentation.",
		},
		async () => {
			const plans = parseAllPlans(projectRoot);
			const completedPlans = plans.filter(
				(p) => p.stageStatus === "completed" || p.documents.includes("retrospective.md"),
			);

			// Check decisions directory for matching pages
			const decisionsDir = join(docsDir, "decisions");
			const lessonsDir = join(docsDir, "lessons");

			const decisionFiles = existsSync(decisionsDir)
				? readdirSync(decisionsDir).filter((f) => f.endsWith(".md") && f !== "index.md")
				: [];

			const lessonFiles = existsSync(lessonsDir)
				? readdirSync(lessonsDir).filter((f) => f.endsWith(".md") && f !== "index.md")
				: [];

			// Check each completed plan for a matching decision page
			const coverage = completedPlans.map((plan) => {
				const hasDecision = decisionFiles.some((f) => f.includes(plan.name));
				const hasLesson = lessonFiles.some((f) => f.includes(plan.name));

				return {
					plan: plan.name,
					stage: plan.stage,
					stageStatus: plan.stageStatus,
					hasDecisionPage: hasDecision,
					hasLessonPage: hasLesson,
					gap: !hasDecision,
				};
			});

			const gaps = coverage.filter((c) => c.gap);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								completedPlans: completedPlans.length,
								documented: coverage.filter((c) => !c.gap).length,
								gaps: gaps.length,
								coverage,
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
