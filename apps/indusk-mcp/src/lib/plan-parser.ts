import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { getPlanningDir } from "./config.js";

export interface PlanFrontmatter {
	title: string;
	date: string;
	status: string;
}

export type PlanStage =
	| "research"
	| "brief"
	| "adr"
	| "impl"
	| "retrospective"
	| "unknown"
	| "malformed";

export interface PlanSummary {
	name: string;
	stage: PlanStage;
	stageStatus: string;
	nextStep: string;
	dependencies: string[];
	documents: string[];
	/** Set when frontmatter in one of the plan's docs failed to parse. Contains
	 * the file + error so the operator can fix it. The whole plan still appears
	 * in the listing rather than poisoning `list_plans` entirely. */
	parseError?: { file: string; message: string };
}

const STAGE_ORDER: Exclude<PlanStage, "unknown" | "malformed">[] = [
	"research",
	"brief",
	"adr",
	"impl",
	"retrospective",
];

interface ParseFrontmatterResult {
	frontmatter: PlanFrontmatter | null;
	parseError?: { file: string; message: string };
}

function parseFrontmatter(filePath: string): ParseFrontmatterResult {
	if (!existsSync(filePath)) return { frontmatter: null };
	const raw = readFileSync(filePath, "utf-8");
	try {
		const { data } = matter(raw);
		return {
			frontmatter: {
				title: (data.title as string) ?? "",
				date: (data.date as string) ?? "",
				status: (data.status as string) ?? "",
			},
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`[plan-parser] frontmatter parse error in ${filePath}: ${message}\n`);
		return {
			frontmatter: null,
			parseError: { file: filePath, message },
		};
	}
}

function parseDependsOn(filePath: string): string[] {
	if (!existsSync(filePath)) return [];
	const content = readFileSync(filePath, "utf-8");
	const depsMatch = content.match(/## Depends On\s*\n([\s\S]*?)(?=\n## |\n$|$)/);
	if (!depsMatch) return [];

	const deps: string[] = [];
	for (const line of depsMatch[1].split("\n")) {
		const match = line.match(/^-\s+`?(?:\.indusk\/)?planning\/([^/`]+)\/?`?/);
		if (match) {
			deps.push(match[1]);
		}
	}
	return deps;
}

function determineStage(
	planDir: string,
	docs: string[],
): {
	stage: PlanStage;
	stageStatus: string;
	parseError?: { file: string; message: string };
} {
	// Walk stages in reverse to find the most advanced document
	for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
		const stage = STAGE_ORDER[i];
		const file = `${stage}.md`;
		if (docs.includes(file)) {
			const result = parseFrontmatter(join(planDir, file));
			if (result.parseError) {
				return {
					stage: "malformed",
					stageStatus: "parse-error",
					parseError: result.parseError,
				};
			}
			return { stage, stageStatus: result.frontmatter?.status ?? "unknown" };
		}
	}
	return { stage: "unknown", stageStatus: "unknown" };
}

function determineNextStep(
	stage: PlanStage,
	stageStatus: string,
	parseError?: { file: string; message: string },
): string {
	if (stage === "malformed" && parseError) {
		return `Fix YAML frontmatter at ${parseError.file}: ${parseError.message}`;
	}
	if (stage === "unknown") return "Create a brief";

	const idx = STAGE_ORDER.indexOf(stage as Exclude<PlanStage, "unknown" | "malformed">);

	if (stageStatus === "completed" || stageStatus === "accepted") {
		const next = STAGE_ORDER[idx + 1];
		if (next) return `Create ${next}`;
		return "Done";
	}

	if (stageStatus === "in-progress") {
		return `Continue ${stage}`;
	}

	return `Review ${stage} (status: ${stageStatus})`;
}

export function parsePlan(planDir: string): PlanSummary {
	const name = planDir.split("/").pop() ?? "";
	const entries = readdirSync(planDir).filter((f) => f.endsWith(".md"));

	const { stage, stageStatus, parseError } = determineStage(planDir, entries);
	const dependencies = parseDependsOn(join(planDir, "brief.md"));
	const nextStep = determineNextStep(stage, stageStatus, parseError);

	return {
		name,
		stage,
		stageStatus,
		nextStep,
		dependencies,
		documents: entries,
		...(parseError && { parseError }),
	};
}

export function parseAllPlans(projectRoot: string): PlanSummary[] {
	const planningDir = getPlanningDir(projectRoot);
	if (!existsSync(planningDir)) return [];

	return readdirSync(planningDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => {
			try {
				return parsePlan(join(planningDir, d.name));
			} catch (err) {
				// Defense-in-depth: parsePlan should never throw post-1.31.6 (the
				// frontmatter parser catches YAML errors and returns a malformed
				// PlanSummary). If something else fails (filesystem race,
				// unexpected I/O error), return a placeholder so one broken plan
				// doesn't take down the whole list.
				const message = err instanceof Error ? err.message : String(err);
				process.stderr.write(`[plan-parser] error parsing ${d.name}: ${message}\n`);
				return {
					name: d.name,
					stage: "malformed" as const,
					stageStatus: "parse-error",
					nextStep: `Fix plan directory ${d.name}: ${message}`,
					dependencies: [],
					documents: [],
					parseError: { file: join(planningDir, d.name), message },
				};
			}
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}
